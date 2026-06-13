// M0.4 共享卡面渲染器（框架无关，不依赖 React）。
// 在任意 CanvasRenderingContext2D 上以任意尺度绘制「同人风」游戏王卡。
// 严禁使用 Konami 官方卡图/字体——卡框由渐变与几何形状自绘，输出明确为原创二创。
// M2.1 自定义制卡器 与 M2.2 分享长图（可选「渲染为卡面」模式）共用此模块。

import type { Frame, Attribute, LinkMarker } from "../../shared/types";
import { ATTR_CN, ATTR_COLOR, frameColor, raceCn } from "../lib/labels";

/** 制卡器与渲染器共用的卡面数据模型 */
export interface CardModel {
  frame: Frame;
  isPendulum: boolean;
  cardType: "monster" | "spell" | "trap";
  name: string;
  attribute: Attribute | null;
  level: number | null; // 星级 / 阶级数值
  isRank: boolean; // true => 超量(阶)，左对齐
  isLink: boolean; // true => 连接怪兽
  linkMarkers: LinkMarker[];
  scale: number | null; // 灵摆刻度
  race: string; // 种族（英文枚举或自定义中文）
  effect: string;
  atk: number | null; // null => 隐藏；-1 => "?"
  def: number | null; // null => 隐藏；-1 => "?"
  passcode: string;
  rarity: string; // 罕贵：普通/金字/闪/烫金
  setCode: string;
  artImage: HTMLImageElement | null;
}

const RATIO = 1.4665; // 高/宽

/** 8 个连接标记的中心方位（相对 art 窗口的单位坐标，-1..1） */
const MARKER_DIRS: Record<LinkMarker, { x: number; y: number; a: number }> = {
  "top-left": { x: -1, y: -1, a: -135 },
  top: { x: 0, y: -1, a: -90 },
  "top-right": { x: 1, y: -1, a: -45 },
  left: { x: -1, y: 0, a: 180 },
  right: { x: 1, y: 0, a: 0 },
  "bottom-left": { x: -1, y: 1, a: 135 },
  bottom: { x: 0, y: 1, a: 90 },
  "bottom-right": { x: 1, y: 1, a: 45 },
};

const NAME_FONT = '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif';
const BODY_FONT =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 混合两色，t=0 -> a，t=1 -> b */
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 是否暗色卡框（超量等），用于决定描边/对比色 */
function isDarkBase(base: string): boolean {
  const { r, g, b } = hexToRgb(base);
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

/** 自动收缩字号以适配单行宽度 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  family: string,
  weight = "700",
  minPx = 8,
): number {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 1;
  }
  return px;
}

/** CJK 友好的逐字断行 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine === "") {
      lines.push("");
      continue;
    }
    let cur = "";
    for (const ch of rawLine) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur !== "") {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur !== "") lines.push(cur);
  }
  return lines;
}

function statText(v: number | null): string {
  if (v === null) return "";
  if (v < 0) return "?";
  return String(v);
}

/**
 * 在 ctx 上绘制完整卡面。原点 (0,0) 为卡左上角，卡宽 = opts.width。
 * 调用方负责清屏与缩放（如高 DPI 时整体放大）。
 */
export function renderCard(
  ctx: CanvasRenderingContext2D,
  model: CardModel,
  opts: { width: number },
): void {
  const W = opts.width;
  const H = W * RATIO;
  const fc = frameColor(model.frame, model.isPendulum);
  const dark = isDarkBase(fc.base);

  ctx.save();
  ctx.textBaseline = "alphabetic";

  // ===== 外底（暗金描边外壳）=====
  const pad = W * 0.035;
  const outerR = W * 0.05;
  // 外框：金属质感渐变
  const shellGrad = ctx.createLinearGradient(0, 0, W, H);
  shellGrad.addColorStop(0, "#1a1206");
  shellGrad.addColorStop(0.5, "#3a2c12");
  shellGrad.addColorStop(1, "#120c04");
  roundRect(ctx, 0, 0, W, H, outerR);
  ctx.fillStyle = shellGrad;
  ctx.fill();

  // ===== 卡身底色（卡框色系渐变）=====
  const bodyX = pad,
    bodyY = pad,
    bodyW = W - pad * 2,
    bodyH = H - pad * 2;
  const bodyR = W * 0.035;
  const bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyGrad.addColorStop(0, mix(fc.glow, fc.base, 0.15));
  bodyGrad.addColorStop(0.5, fc.base);
  bodyGrad.addColorStop(1, mix(fc.base, "#000000", 0.35));
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyR);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  // 内描边
  ctx.lineWidth = W * 0.006;
  ctx.strokeStyle = mix(fc.glow, "#ffffff", 0.3);
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ===== 标题栏 =====
  const titleX = bodyX + W * 0.045;
  const titleY = bodyY + W * 0.04;
  const titleW = bodyW - W * 0.09;
  const titleH = W * 0.105;
  const titleGrad = ctx.createLinearGradient(0, titleY, 0, titleY + titleH);
  titleGrad.addColorStop(0, dark ? "#3a3a3a" : "rgba(255,255,255,.22)");
  titleGrad.addColorStop(1, dark ? "#1a1a1a" : "rgba(0,0,0,.12)");
  roundRect(ctx, titleX, titleY, titleW, titleH, titleH * 0.22);
  ctx.fillStyle = titleGrad;
  ctx.fill();
  ctx.lineWidth = W * 0.003;
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  ctx.stroke();

  // 属性圆（右上）—— 怪兽显示属性，魔陷显示类别符
  const attrR = titleH * 0.46;
  const attrCx = titleX + titleW - attrR - W * 0.01;
  const attrCy = titleY + titleH / 2;
  const showAttr = model.cardType === "monster" ? model.attribute : null;
  const attrColor =
    model.cardType === "monster"
      ? showAttr
        ? ATTR_COLOR[showAttr]
        : "#888"
      : model.cardType === "spell"
        ? "#1d9b8a"
        : "#b03a7a";
  const attrChar =
    model.cardType === "monster"
      ? showAttr
        ? ATTR_CN[showAttr]
        : ""
      : model.cardType === "spell"
        ? "魔"
        : "陷";
  if (attrChar) {
    const ag = ctx.createRadialGradient(
      attrCx - attrR * 0.3,
      attrCy - attrR * 0.3,
      attrR * 0.1,
      attrCx,
      attrCy,
      attrR,
    );
    ag.addColorStop(0, mix(attrColor, "#ffffff", 0.45));
    ag.addColorStop(1, mix(attrColor, "#000000", 0.25));
    ctx.beginPath();
    ctx.arc(attrCx, attrCy, attrR, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.lineWidth = W * 0.004;
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${attrR * 1.05}px ${NAME_FONT}`;
    ctx.fillText(attrChar, attrCx, attrCy + attrR * 0.04);
    ctx.textBaseline = "alphabetic";
  }

  // 卡名（自动收缩）
  const nameMaxW = attrChar
    ? attrCx - attrR - titleX - W * 0.02
    : titleW - W * 0.04;
  const namePx = fitFont(
    ctx,
    model.name || "未命名卡片",
    nameMaxW,
    titleH * 0.6,
    NAME_FONT,
  );
  ctx.font = `700 ${namePx}px ${NAME_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // 罕贵：烫金/闪 给卡名描金箔
  const nameColor =
    model.rarity === "烫金" || model.rarity === "金字"
      ? "#d9b35e"
      : dark
        ? "#f0f0f0"
        : "#1a1208";
  if (model.rarity === "烫金" || model.rarity === "闪") {
    ctx.shadowColor = "rgba(217,179,94,.7)";
    ctx.shadowBlur = W * 0.012;
  }
  ctx.fillStyle = nameColor;
  ctx.fillText(model.name || "未命名卡片", titleX + W * 0.012, attrCy);
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";

  // ===== 等级 / 阶 / 灵摆刻度行 =====
  const starsY = titleY + titleH + W * 0.028;
  const starSize = W * 0.045;
  if (model.cardType === "monster" && !model.isLink) {
    const lvl = model.level ?? 0;
    if (lvl > 0) {
      const isRank = model.isRank;
      const starColor = isRank ? "#000" : "#caa23a";
      const starGlow = isRank ? "#444" : "#ffe08a";
      // rank 左对齐，level 右对齐
      const total = Math.min(lvl, 13);
      const gap = starSize * 1.12;
      const dir = isRank ? 1 : -1;
      let sx = isRank
        ? titleX + starSize * 0.6
        : titleX + titleW - starSize * 0.6;
      const sy = starsY + starSize * 0.55;
      for (let i = 0; i < total; i++) {
        drawStar(ctx, sx, sy, starSize * 0.5, starColor, starGlow);
        sx += dir * gap;
      }
    }
  }

  // ===== 美术窗口 =====
  const artMargin = W * 0.08;
  const artX = bodyX + artMargin;
  const artW = bodyW - artMargin * 2;
  const artY = starsY + starSize * 1.2;
  // 灵摆卡：art 更宽更矮，下方留灵摆效果框
  const artH = model.isPendulum ? artW * 0.62 : artW * 0.92;
  // art 边框（深色金属边）
  const artBorderW = W * 0.012;
  ctx.save();
  roundRect(
    ctx,
    artX - artBorderW,
    artY - artBorderW,
    artW + artBorderW * 2,
    artH + artBorderW * 2,
    W * 0.01,
  );
  ctx.fillStyle = dark ? "#0a0a0a" : "#6b5a2e";
  ctx.fill();
  ctx.restore();

  // art 内容（cover-fit）
  ctx.save();
  roundRect(ctx, artX, artY, artW, artH, W * 0.006);
  ctx.clip();
  if (model.artImage && model.artImage.complete && model.artImage.naturalWidth) {
    drawImageCover(ctx, model.artImage, artX, artY, artW, artH);
  } else {
    // 占位：柔和渐变 + 提示
    const ph = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
    ph.addColorStop(0, mix(fc.base, "#000", 0.5));
    ph.addColorStop(1, mix(fc.glow, "#000", 0.55));
    ctx.fillStyle = ph;
    ctx.fillRect(artX, artY, artW, artH);
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${W * 0.04}px ${BODY_FONT}`;
    ctx.fillText("上传卡图", artX + artW / 2, artY + artH / 2);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // 连接标记（围绕 art 窗口边缘）
  if (model.isLink) {
    drawLinkMarkers(ctx, model.linkMarkers, artX, artY, artW, artH, W);
  }

  // ===== 灵摆效果子框 =====
  let contentTop = artY + artH + W * 0.03;
  if (model.isPendulum) {
    const pbX = artX - artBorderW;
    const pbW = artW + artBorderW * 2;
    const pbY = artY + artH + artBorderW + W * 0.012;
    const pbH = W * 0.18;
    roundRect(ctx, pbX, pbY, pbW, pbH, W * 0.008);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fill();
    ctx.lineWidth = W * 0.003;
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();
    // 两侧刻度数字
    const sc = model.scale ?? 0;
    ctx.fillStyle = dark ? "#fff" : "#1a1208";
    ctx.font = `700 ${W * 0.07}px ${NAME_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(sc), pbX + W * 0.05, pbY + pbH / 2);
    ctx.fillText(String(sc), pbX + pbW - W * 0.05, pbY + pbH / 2);
    // 中央「灵摆」标识（效果文本统一在下方效果框展示）
    ctx.font = `700 ${W * 0.04}px ${NAME_FONT}`;
    ctx.fillStyle = dark ? "rgba(255,255,255,.7)" : "rgba(26,18,8,.6)";
    ctx.fillText("灵 摆", pbX + pbW / 2, pbY + pbH / 2);
    ctx.textBaseline = "alphabetic";
    contentTop = pbY + pbH + W * 0.03;
  }

  // ===== 种族 / 类别行 =====
  const infoX = artX - artBorderW;
  const infoW = artW + artBorderW * 2;
  let typeLine: string;
  if (model.cardType === "monster") {
    const parts: string[] = [];
    const rc = raceCn(model.race) || model.race;
    if (rc) parts.push(rc);
    if (model.isLink) parts.push("连接");
    else if (model.isPendulum) parts.push("灵摆");
    parts.push(model.frame === "normal" ? "通常" : "效果");
    typeLine = `【${parts.join("／")}】`;
  } else {
    const rc = raceCn(model.race);
    typeLine = rc ? `【${model.cardType === "spell" ? "魔法" : "陷阱"}·${rc}】` : `【${model.cardType === "spell" ? "魔法" : "陷阱"}】`;
  }
  ctx.fillStyle = dark ? "#f0e6c8" : "#2a1d08";
  const typePx = fitFont(ctx, typeLine, infoW, W * 0.04, NAME_FONT, "700");
  ctx.font = `700 ${typePx}px ${NAME_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(typeLine, infoX, contentTop);
  contentTop += typePx + W * 0.018;
  // 分隔线
  ctx.strokeStyle = "rgba(0,0,0,.3)";
  ctx.lineWidth = W * 0.002;
  ctx.beginPath();
  ctx.moveTo(infoX, contentTop);
  ctx.lineTo(infoX + infoW, contentTop);
  ctx.stroke();
  contentTop += W * 0.014;

  // ===== 效果文本框（自适应字号 + CJK 断行）=====
  const atkLineH = W * 0.07;
  const effBottom = bodyY + bodyH - atkLineH - W * 0.045;
  const effBoxX = infoX;
  const effBoxW = infoW;
  const effBoxY = contentTop;
  const effBoxH = effBottom - effBoxY;
  if (effBoxH > W * 0.04) {
    // 半透明底
    roundRect(ctx, effBoxX, effBoxY, effBoxW, effBoxH, W * 0.008);
    ctx.fillStyle = dark ? "rgba(20,20,20,.45)" : "rgba(255,255,255,.5)";
    ctx.fill();
    ctx.fillStyle = dark ? "#eee" : "#1a1208";
    const padE = W * 0.018;
    const innerW = effBoxW - padE * 2;
    // 自适应：从大字号开始缩，直到能容纳全部行
    let effPx = W * 0.034;
    let lines: string[] = [];
    while (effPx > W * 0.018) {
      ctx.font = `400 ${effPx}px ${BODY_FONT}`;
      lines = wrapText(ctx, model.effect || "", innerW);
      const lh = effPx * 1.32;
      if (lines.length * lh <= effBoxH - padE * 2) break;
      effPx -= 0.5;
    }
    ctx.font = `400 ${effPx}px ${BODY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lh = effPx * 1.32;
    let ty = effBoxY + padE;
    const maxLines = Math.floor((effBoxH - padE * 2) / lh);
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      let ln = lines[i];
      if (i === maxLines - 1 && lines.length > maxLines) {
        // 截断省略
        while (
          ctx.measureText(ln + "…").width > innerW &&
          ln.length > 1
        )
          ln = ln.slice(0, -1);
        ln += "…";
      }
      ctx.fillText(ln, effBoxX + padE, ty);
      ty += lh;
    }
  }

  // ===== ATK / DEF / LINK 行 =====
  const statY = bodyY + bodyH - W * 0.035;
  if (model.cardType === "monster") {
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${W * 0.045}px ${NAME_FONT}`;
    ctx.textAlign = "right";
    ctx.fillStyle = dark ? "#f0e6c8" : "#2a1d08";
    if (model.isLink) {
      // LINK-N（右下）
      const linkN = model.linkMarkers.length || model.level || 0;
      ctx.fillText(`LINK-${linkN}`, infoX + infoW, statY);
    } else {
      const atk = statText(model.atk);
      const def = statText(model.def);
      const segs: string[] = [];
      if (model.atk !== null) segs.push(`攻 ${atk}`);
      if (model.def !== null) segs.push(`守 ${def}`);
      if (segs.length) ctx.fillText(segs.join("   "), infoX + infoW, statY);
    }
  }

  // ===== 底部信息条：密码、套牌码 =====
  ctx.textAlign = "left";
  ctx.font = `400 ${W * 0.024}px ${BODY_FONT}`;
  ctx.fillStyle = dark ? "rgba(255,255,255,.6)" : "rgba(26,18,8,.6)";
  if (model.passcode) ctx.fillText(model.passcode, infoX, bodyY + bodyH - W * 0.012);
  if (model.setCode) {
    ctx.textAlign = "right";
    ctx.fillText(model.setCode, infoX + infoW, bodyY + bodyH - W * 0.012);
  }

  // ===== 强制水印：非官方·同人卡（PRD 合规，不可移除）=====
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${W * 0.02}px ${BODY_FONT}`;
  const wmText = "非官方·同人卡 NON-OFFICIAL FAN ART";
  const wmW = ctx.measureText(wmText).width + W * 0.04;
  const wmH = W * 0.038;
  const wmX = W / 2 - wmW / 2;
  const wmY = H - pad - wmH * 0.5;
  roundRect(ctx, wmX, wmY - wmH / 2, wmW, wmH, wmH / 2);
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(wmText, W / 2, wmY + W * 0.001);
  ctx.restore();

  ctx.restore();
}

/** 绘制五角星 */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  glow: string,
): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, glow);
  g.addColorStop(1, fill);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = "rgba(0,0,0,.4)";
  ctx.stroke();
  ctx.restore();
}

/** cover-fit 绘制图片 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ir = iw / ih;
  const dr = dw / dh;
  let sx = 0,
    sy = 0,
    sw = iw,
    sh = ih;
  if (ir > dr) {
    sw = ih * dr;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / dr;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** 围绕 art 窗口绘制 8 方向连接箭头，点亮的为红色 */
function drawLinkMarkers(
  ctx: CanvasRenderingContext2D,
  markers: LinkMarker[],
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  W: number,
): void {
  const cx = ax + aw / 2;
  const cy = ay + ah / 2;
  const size = W * 0.04;
  const offX = aw / 2 + size * 0.7;
  const offY = ah / 2 + size * 0.7;
  (Object.keys(MARKER_DIRS) as LinkMarker[]).forEach((key) => {
    const d = MARKER_DIRS[key];
    const px = cx + d.x * offX;
    const py = cy + d.y * offY;
    const lit = markers.includes(key);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((d.a * Math.PI) / 180);
    ctx.beginPath();
    // 朝外的三角箭头
    ctx.moveTo(size * 0.6, 0);
    ctx.lineTo(-size * 0.4, -size * 0.5);
    ctx.lineTo(-size * 0.4, size * 0.5);
    ctx.closePath();
    if (lit) {
      ctx.fillStyle = "#ff3b3b";
      ctx.shadowColor = "rgba(255,60,60,.9)";
      ctx.shadowBlur = size * 0.6;
    } else {
      ctx.fillStyle = "rgba(255,255,255,.18)";
    }
    ctx.fill();
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = lit ? "#7a0000" : "rgba(0,0,0,.35)";
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  });
}

/**
 * 离屏渲染并导出 PNG。返回 dataURL 与 blob。
 * width 默认 1200（高 DPI 导出）。
 */
export async function exportCardPng(
  model: CardModel,
  width = 1200,
): Promise<{ dataUrl: string; blob: Blob | null }> {
  const W = width;
  const H = Math.round(W * RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  renderCard(ctx, model, { width: W });
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  return { dataUrl, blob };
}

export { RATIO as CARD_RATIO };
