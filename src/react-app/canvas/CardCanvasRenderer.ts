// M0.4 共享卡面渲染器（框架无关，不依赖 React）。
// 在任意 CanvasRenderingContext2D 上以任意尺度绘制游戏王风格卡面。
// 严禁使用 Konami 官方卡图/字体——卡框由渐变与几何形状自绘，输出明确为原创二创；
// M8 起版面几何对齐实体卡比例（方形卡图区 / 全宽名条 / 效果框内嵌攻守行），提升还原度。
// M2.1 自定义制卡器 与 M2.2 分享长图（可选「渲染为卡面」模式）共用此模块。

import type { Frame, Attribute, LinkMarker } from "../../shared/types";
import { ATTR_CN, ATTR_COLOR, raceCn } from "../lib/labels";

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
  pendulumEffect: string | null; // 灵摆效果（画在灵摆框内）
  atk: number | null; // null => 隐藏；-1 => "?"
  def: number | null; // null => 隐藏；-1 => "?"
  passcode: string;
  rarity: string; // 罕贵：普通/金字/闪/烫金
  setCode: string;
  artImage: HTMLImageElement | null;
}

const RATIO = 1.4665; // 高/宽（59×86mm 实体卡）

// 实体卡各卡框主色（渲染器专用，比站内 UI 色更贴近实卡印刷色）
const CARD_FRAME: Record<string, { base: string; light: string; nameText: string }> = {
  normal:  { base: "#c9a457", light: "#e8cf94", nameText: "#181008" },
  effect:  { base: "#c07235", light: "#e0995c", nameText: "#181008" },
  ritual:  { base: "#6c8dc4", light: "#9db8e0", nameText: "#181008" },
  fusion:  { base: "#9268a8", light: "#b795cc", nameText: "#181008" },
  synchro: { base: "#e5e3dd", light: "#ffffff", nameText: "#181008" },
  xyz:     { base: "#20201e", light: "#4d4d48", nameText: "#f2f2ee" },
  link:    { base: "#1b5fa8", light: "#3f86cf", nameText: "#f2f2ee" },
  pendulum:{ base: "#3aa17c", light: "#5fd0a6", nameText: "#181008" },
  spell:   { base: "#1d8e76", light: "#37b598", nameText: "#f2f2ee" },
  trap:    { base: "#b0447e", light: "#d06fa3", nameText: "#f2f2ee" },
  token:   { base: "#9a9a9a", light: "#c4c4c4", nameText: "#181008" },
};

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
const STAT_FONT = '"Palatino", "Times New Roman", "Songti SC", serif';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

function isDarkBase(base: string): boolean {
  const { r, g, b } = hexToRgb(base);
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

/** 自动收缩字号以适配单行宽度 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string, maxWidth: number, startPx: number, family: string,
  weight = "700", minPx = 8,
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
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine === "") { lines.push(""); continue; }
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

/** 在矩形内绘制自适应字号 + 截断省略的多行文本，返回实际使用的字号 */
function fillWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, w: number, h: number,
  startPx: number, minPx: number, color: string, lineHeight = 1.3,
): void {
  let px = startPx;
  let lines: string[] = [];
  while (px > minPx) {
    ctx.font = `400 ${px}px ${BODY_FONT}`;
    lines = wrapText(ctx, text, w);
    if (lines.length * px * lineHeight <= h) break;
    px -= 0.5;
  }
  ctx.font = `400 ${px}px ${BODY_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lh = px * lineHeight;
  const maxLines = Math.max(1, Math.floor(h / lh));
  let ty = y;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    let ln = lines[i];
    if (i === maxLines - 1 && lines.length > maxLines) {
      while (ctx.measureText(ln + "…").width > w && ln.length > 1) ln = ln.slice(0, -1);
      ln += "…";
    }
    ctx.fillText(ln, x, ty);
    ty += lh;
  }
}

/**
 * 在 ctx 上绘制完整卡面。原点 (0,0) 为卡左上角，卡宽 = opts.width。
 * 版面几何对齐实体卡：全宽名条 / 方形卡图区 / 羊皮纸效果框（含攻守行）。
 */
export function renderCard(
  ctx: CanvasRenderingContext2D,
  model: CardModel,
  opts: { width: number },
): void {
  const W = opts.width;
  const H = W * RATIO;
  const frameKey = model.isLink ? "link" : model.frame;
  const fc = CARD_FRAME[frameKey] || CARD_FRAME.effect;
  const dark = isDarkBase(fc.base);
  const isMonster = model.cardType === "monster";
  const isPend = model.isPendulum;

  ctx.save();
  ctx.textBaseline = "alphabetic";

  // ===== 卡体：黑色描边外壳 + 卡框色渐变 =====
  const edge = W * 0.014;
  roundRect(ctx, 0, 0, W, H, W * 0.042);
  ctx.fillStyle = "#0c0a08";
  ctx.fill();

  const bx = edge, by = edge, bw = W - edge * 2, bh = H - edge * 2;
  const bodyGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bodyGrad.addColorStop(0, mix(fc.light, fc.base, 0.25));
  bodyGrad.addColorStop(0.45, fc.base);
  bodyGrad.addColorStop(1, mix(fc.base, "#000000", 0.22));
  roundRect(ctx, bx, by, bw, bh, W * 0.032);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  // 细高光内描边（金属包边感）
  roundRect(ctx, bx + W * 0.004, by + W * 0.004, bw - W * 0.008, bh - W * 0.008, W * 0.028);
  ctx.lineWidth = W * 0.0035;
  ctx.strokeStyle = dark ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.55)";
  ctx.stroke();

  // ===== 名条（全宽，斜切金属渐变 + 内浮雕）=====
  const nbX = W * 0.068, nbW = W * 0.864;
  const nbY = W * 0.055, nbH = W * 0.095;
  const nbGrad = ctx.createLinearGradient(0, nbY, 0, nbY + nbH);
  if (dark) {
    nbGrad.addColorStop(0, "#3c3c38");
    nbGrad.addColorStop(0.5, "#242422");
    nbGrad.addColorStop(1, "#161614");
  } else {
    nbGrad.addColorStop(0, "rgba(255,255,255,.72)");
    nbGrad.addColorStop(0.5, "rgba(255,255,255,.38)");
    nbGrad.addColorStop(1, "rgba(140,110,50,.20)");
  }
  roundRect(ctx, nbX, nbY, nbW, nbH, W * 0.012);
  ctx.fillStyle = nbGrad;
  ctx.fill();
  ctx.lineWidth = W * 0.0035;
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  ctx.stroke();
  roundRect(ctx, nbX + W * 0.004, nbY + W * 0.004, nbW - W * 0.008, nbH - W * 0.008, W * 0.009);
  ctx.lineWidth = W * 0.002;
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.stroke();

  // 属性珠（名条右端内嵌）
  const attrR = nbH * 0.40;
  const attrCx = nbX + nbW - attrR - W * 0.014;
  const attrCy = nbY + nbH / 2;
  const showAttr = isMonster ? model.attribute : null;
  const attrColor = isMonster
    ? (showAttr ? ATTR_COLOR[showAttr] : "#888")
    : model.cardType === "spell" ? "#1d8e76" : "#b0447e";
  const attrChar = isMonster
    ? (showAttr ? ATTR_CN[showAttr] : "")
    : model.cardType === "spell" ? "魔" : "陷";
  if (attrChar) {
    // 外金环
    ctx.beginPath();
    ctx.arc(attrCx, attrCy, attrR + W * 0.004, 0, Math.PI * 2);
    ctx.fillStyle = "#0e0c08";
    ctx.fill();
    const ag = ctx.createRadialGradient(
      attrCx - attrR * 0.35, attrCy - attrR * 0.35, attrR * 0.1,
      attrCx, attrCy, attrR,
    );
    ag.addColorStop(0, mix(attrColor, "#ffffff", 0.5));
    ag.addColorStop(1, mix(attrColor, "#000000", 0.3));
    ctx.beginPath();
    ctx.arc(attrCx, attrCy, attrR, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${attrR * 1.15}px ${NAME_FONT}`;
    ctx.fillText(attrChar, attrCx, attrCy + attrR * 0.05);
    ctx.textBaseline = "alphabetic";
  }

  // 卡名（左对齐，自动收缩；罕贵决定颜色/发光）
  const nameMaxW = (attrChar ? attrCx - attrR - W * 0.012 : nbX + nbW - W * 0.02) - (nbX + W * 0.018);
  const namePx = fitFont(ctx, model.name || "未命名卡片", nameMaxW, nbH * 0.62, NAME_FONT, "900");
  ctx.font = `900 ${namePx}px ${NAME_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const goldName = model.rarity === "烫金" || model.rarity === "金字";
  const nameColor = goldName ? "#c8a24a" : fc.nameText;
  if (model.rarity === "烫金" || model.rarity === "闪") {
    ctx.shadowColor = goldName ? "rgba(255,220,130,.85)" : "rgba(255,255,255,.7)";
    ctx.shadowBlur = W * 0.01;
  }
  ctx.fillStyle = nameColor;
  ctx.fillText(model.name || "未命名卡片", nbX + W * 0.018, attrCy);
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";

  // ===== 等级/阶（怪兽）或 类别行（魔陷）=====
  const rowY = nbY + nbH + W * 0.017;
  const rowH = W * 0.062;
  if (isMonster && !model.isLink) {
    const lvl = Math.min(model.level ?? 0, 13);
    if (lvl > 0) {
      const isRank = model.isRank;
      const sr = rowH * 0.46;
      const gap = sr * 2.35;
      const cy = rowY + rowH / 2;
      let cx = isRank ? nbX + sr * 1.1 : nbX + nbW - sr * 1.1;
      const dir = isRank ? 1 : -1;
      for (let i = 0; i < lvl; i++) {
        drawLevelStar(ctx, cx, cy, sr, isRank);
        cx += dir * gap;
      }
    }
  } else if (!isMonster) {
    // 【魔法卡】/【陷阱卡】右对齐（含子类型）
    const rc = raceCn(model.race);
    const kind = model.cardType === "spell" ? "魔法卡" : "陷阱卡";
    const typeText = rc && rc !== "通常" ? `【${kind}·${rc}】` : `【${kind}】`;
    ctx.font = `700 ${rowH * 0.72}px ${NAME_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = dark ? "#f2f2ee" : "#181008";
    ctx.fillText(typeText, nbX + nbW, rowY + rowH / 2);
    ctx.textBaseline = "alphabetic";
  }

  // ===== 卡图区 =====
  // 普通卡：方形居中；灵摆卡：更宽、约 4:3
  const artX = isPend ? W * 0.075 : W * 0.112;
  const artW = isPend ? W * 0.85 : W * 0.776;
  const artY = rowY + rowH + W * 0.012;
  const artH = isPend ? artW * 0.78 : artW;

  // 金铜色卡图包边
  const bez = W * 0.009;
  ctx.fillStyle = dark ? "#101010" : "#231a08";
  ctx.fillRect(artX - bez, artY - bez, artW + bez * 2, artH + bez * 2);
  const bezGrad = ctx.createLinearGradient(artX, artY - bez, artX, artY + artH + bez);
  bezGrad.addColorStop(0, "rgba(255,255,255,.35)");
  bezGrad.addColorStop(1, "rgba(0,0,0,.4)");
  ctx.strokeStyle = bezGrad;
  ctx.lineWidth = W * 0.003;
  ctx.strokeRect(artX - bez, artY - bez, artW + bez * 2, artH + bez * 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(artX, artY, artW, artH);
  ctx.clip();
  if (model.artImage && model.artImage.complete && model.artImage.naturalWidth) {
    drawImageCover(ctx, model.artImage, artX, artY, artW, artH);
  } else {
    const ph = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
    ph.addColorStop(0, mix(fc.base, "#000", 0.55));
    ph.addColorStop(1, mix(fc.light, "#000", 0.6));
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

  // 连接标记（贴 art 边缘）
  if (model.isLink) {
    drawLinkMarkers(ctx, model.linkMarkers, artX, artY, artW, artH, W);
  }

  // ===== 灵摆框（蓝/红刻度翼 + 灵摆效果文本）=====
  let below = artY + artH + bez + W * 0.012;
  if (isPend) {
    const pbX = artX - bez, pbW = artW + bez * 2;
    const pbY = below, pbH = W * 0.175;
    // 底：淡羊皮纸
    ctx.fillStyle = "#efe6cd";
    ctx.fillRect(pbX, pbY, pbW, pbH);
    ctx.strokeStyle = "#3d2f14";
    ctx.lineWidth = W * 0.0028;
    ctx.strokeRect(pbX, pbY, pbW, pbH);
    // 左右刻度翼（蓝/红渐变）
    const wingW = W * 0.095;
    const lw = ctx.createLinearGradient(pbX, pbY, pbX + wingW, pbY);
    lw.addColorStop(0, "#2a6fc0");
    lw.addColorStop(1, "#8fb8e6");
    ctx.fillStyle = lw;
    ctx.fillRect(pbX, pbY, wingW, pbH);
    const rw = ctx.createLinearGradient(pbX + pbW - wingW, pbY, pbX + pbW, pbY);
    rw.addColorStop(0, "#e69a8f");
    rw.addColorStop(1, "#c0392b");
    ctx.fillStyle = rw;
    ctx.fillRect(pbX + pbW - wingW, pbY, wingW, pbH);
    // 刻度数字 + 小标
    const sc = model.scale ?? 0;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${W * 0.026}px ${BODY_FONT}`;
    ctx.fillText("◂", pbX + wingW / 2, pbY + pbH * 0.2);
    ctx.fillText("▸", pbX + pbW - wingW / 2, pbY + pbH * 0.2);
    ctx.font = `900 ${W * 0.068}px ${STAT_FONT}`;
    ctx.fillText(String(sc), pbX + wingW / 2, pbY + pbH * 0.62);
    ctx.fillText(String(sc), pbX + pbW - wingW / 2, pbY + pbH * 0.62);
    ctx.textBaseline = "alphabetic";
    // 中央灵摆效果文本
    const peX = pbX + wingW + W * 0.014;
    const peW = pbW - wingW * 2 - W * 0.028;
    const pe = (model.pendulumEffect || "").trim();
    if (pe) {
      fillWrapped(ctx, pe, peX, pbY + W * 0.012, peW, pbH - W * 0.024, W * 0.028, W * 0.016, "#181008", 1.28);
    } else {
      ctx.fillStyle = "rgba(24,16,8,.35)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `400 ${W * 0.028}px ${BODY_FONT}`;
      ctx.fillText("（灵摆效果）", pbX + pbW / 2, pbY + pbH / 2);
      ctx.textBaseline = "alphabetic";
    }
    below = pbY + pbH + W * 0.014;
  } else {
    // 卡包编号（卡图与效果框之间，右对齐）——实体卡位
    if (model.setCode) {
      ctx.font = `400 ${W * 0.026}px ${BODY_FONT}`;
      ctx.textAlign = "right";
      ctx.fillStyle = dark ? "rgba(255,255,255,.75)" : "rgba(24,16,8,.75)";
      ctx.fillText(model.setCode, artX + artW + bez, below + W * 0.02);
    }
    below += W * 0.033;
  }

  // ===== 效果框（羊皮纸 + 内嵌种族行与攻守行）=====
  const ebX = W * 0.068, ebW = W * 0.864;
  const ebY = isPend ? below : below;
  const ebBottom = H - W * 0.062;
  const ebH = ebBottom - ebY;
  ctx.fillStyle = "#efe6cd";
  ctx.fillRect(ebX, ebY, ebW, ebH);
  ctx.strokeStyle = "#3d2f14";
  ctx.lineWidth = W * 0.0028;
  ctx.strokeRect(ebX, ebY, ebW, ebH);

  const inPad = W * 0.016;
  let cursor = ebY + inPad * 0.8;

  // 怪兽：种族/类别行（粗体，效果框首行）
  if (isMonster) {
    const parts: string[] = [];
    const rc = raceCn(model.race) || model.race;
    if (rc) parts.push(rc);
    if (model.isLink) parts.push("连接");
    else if (model.isRank) parts.push("超量");
    else if (isPend) parts.push("灵摆");
    if (model.frame === "fusion") parts.push("融合");
    if (model.frame === "synchro") parts.push("同调");
    if (model.frame === "ritual") parts.push("仪式");
    parts.push(model.frame === "normal" ? "通常" : "效果");
    const typeLine = `【${parts.join("／")}】`;
    const tp = fitFont(ctx, typeLine, ebW - inPad * 2, W * 0.036, NAME_FONT, "900");
    ctx.font = `900 ${tp}px ${NAME_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#181008";
    ctx.fillText(typeLine, ebX + inPad, cursor);
    cursor += tp + W * 0.008;
  }

  // 攻守行（怪兽专用，效果框底部，上方一条细线）
  const statLineH = isMonster ? W * 0.062 : 0;
  const statTop = ebBottom - statLineH;

  // 效果正文
  const effH = statTop - cursor - (isMonster ? W * 0.006 : inPad * 0.6);
  if (effH > W * 0.03) {
    fillWrapped(
      ctx, model.effect || "",
      ebX + inPad, cursor, ebW - inPad * 2, effH,
      W * 0.032, W * 0.018, "#181008", 1.32,
    );
  }

  if (isMonster) {
    ctx.strokeStyle = "#3d2f14";
    ctx.lineWidth = W * 0.0024;
    ctx.beginPath();
    ctx.moveTo(ebX + inPad * 0.6, statTop);
    ctx.lineTo(ebX + ebW - inPad * 0.6, statTop);
    ctx.stroke();
    ctx.font = `700 ${W * 0.038}px ${STAT_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#181008";
    const cyS = statTop + statLineH / 2 + W * 0.002;
    if (model.isLink) {
      const linkN = model.linkMarkers.length || model.level || 0;
      const atkS = model.atk !== null ? `ATK/${statText(model.atk)}` : "";
      ctx.fillText(`${atkS}${atkS ? "　" : ""}LINK—${linkN}`, ebX + ebW - inPad, cyS);
    } else {
      const segs: string[] = [];
      if (model.atk !== null) segs.push(`ATK/${statText(model.atk)}`);
      if (model.def !== null) segs.push(`DEF/${statText(model.def)}`);
      if (segs.length) ctx.fillText(segs.join("　"), ebX + ebW - inPad, cyS);
    }
    ctx.textBaseline = "alphabetic";
  }

  // ===== 底部信息：卡密（左）+ 强制水印（中）=====
  const footY = H - W * 0.026;
  ctx.textAlign = "left";
  ctx.font = `400 ${W * 0.024}px ${BODY_FONT}`;
  ctx.fillStyle = dark ? "rgba(255,255,255,.7)" : "rgba(24,16,8,.72)";
  if (model.passcode) ctx.fillText(model.passcode, ebX, footY);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${W * 0.017}px ${BODY_FONT}`;
  const wmText = "非官方·同人卡 NON-OFFICIAL FAN ART";
  ctx.fillStyle = dark ? "rgba(255,255,255,.5)" : "rgba(24,16,8,.5)";
  ctx.fillText(wmText, W * 0.62, footY - W * 0.006);
  ctx.restore();
}

/** 等级星（金橙）/ 阶级星（黑底金星） */
function drawLevelStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, rank: boolean,
): void {
  ctx.save();
  if (rank) {
    // 阶级：黑圆底
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = "#101010";
    ctx.fill();
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = "#c8a24a";
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.46, cy + Math.sin(a2) * r * 0.46);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#ffe89a");
  g.addColorStop(0.6, "#f2c14e");
  g.addColorStop(1, "#c8871a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.13;
  ctx.strokeStyle = "#6e4a10";
  ctx.stroke();
  ctx.restore();
}

/** cover-fit 绘制图片 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ir = iw / ih;
  const dr = dw / dh;
  let sx = 0, sy = 0, sw = iw, sh = ih;
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
  ax: number, ay: number, aw: number, ah: number, W: number,
): void {
  const cx = ax + aw / 2;
  const cy = ay + ah / 2;
  const size = W * 0.042;
  const offX = aw / 2 + size * 0.28;
  const offY = ah / 2 + size * 0.28;
  (Object.keys(MARKER_DIRS) as LinkMarker[]).forEach((key) => {
    const d = MARKER_DIRS[key];
    const px = cx + d.x * offX;
    const py = cy + d.y * offY;
    const lit = markers.includes(key);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((d.a * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(size * 0.62, 0);
    ctx.lineTo(-size * 0.34, -size * 0.5);
    ctx.lineTo(-size * 0.34, size * 0.5);
    ctx.closePath();
    if (lit) {
      ctx.fillStyle = "#ff2a2a";
      ctx.shadowColor = "rgba(255,60,60,.9)";
      ctx.shadowBlur = size * 0.55;
    } else {
      ctx.fillStyle = "rgba(30,30,30,.85)";
    }
    ctx.fill();
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = lit ? "#7a0000" : "rgba(200,162,74,.5)";
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
