// M8.2 真卡还原渲染器：以社区高清卡框素材（1394×2031，MIT）合成，逼近实体 OCG 简中卡面。
// 素材位于 public/cardgen/（卡框/属性/星级/林克箭头/魔陷图标/稀有镭射 + 游戏王专用字体）。
// 版式坐标移植自开源项目 kooriookami/yugioh-card 的 sc（简体中文）样式，逐像素对齐卡框。
// 成品在实卡版权文字位标注「@游戏王集卡社同人卡」，明确为同人二创。
// 说明：素材/字体需异步加载，故绘制走「preload → 同步 render」两段式；renderCard 为便捷 async 封装。

import type { Frame, Attribute, LinkMarker, MonsterSubtype } from "../../shared/types";
import { raceCn, SUBTYPE_CN } from "../lib/labels";

/** 制卡器与渲染器共用的卡面数据模型（保持不变，向后兼容） */
export interface CardModel {
  frame: Frame;
  isPendulum: boolean;
  cardType: "monster" | "spell" | "trap";
  name: string;
  attribute: Attribute | null;
  level: number | null;
  isRank: boolean;
  isLink: boolean;
  linkMarkers: LinkMarker[];
  scale: number | null;
  race: string;
  subtype?: MonsterSubtype | "";  // 能力子类型：调整/反转/二重/灵魂/同盟/卡通
  effect: string;
  pendulumEffect: string | null;
  atk: number | null;   // null 隐藏；-1 => "?"
  def: number | null;
  passcode: string;
  rarity: string;       // 普通 / 金字 / 闪 / 烫金
  setCode: string;
  artImage: HTMLImageElement | null;
}

// 设计基准画布（素材原生尺寸）
const BW = 1394;
const BH = 2031;
const RATIO = BH / BW; // ≈1.4570

const RES = "/cardgen";
const IMG = `${RES}/image`;

// ---------------- 资源加载（图片 + 字体，模块级缓存） ----------------
const resolved = new Map<string, HTMLImageElement>();
const pendingImg = new Map<string, Promise<void>>();

function ensureImg(url: string): Promise<void> {
  if (resolved.has(url)) return Promise.resolve();
  let p = pendingImg.get(url);
  if (!p) {
    p = new Promise<void>((res) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { resolved.set(url, im); res(); };
      im.onerror = () => res(); // 缺图则跳过，不阻塞整卡
      im.src = url;
    });
    pendingImg.set(url, p);
  }
  return p;
}
const imgOf = (url: string): HTMLImageElement | undefined => resolved.get(url);

let fontsPromise: Promise<void> | null = null;
export function loadCardFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  const list: [string, string][] = [
    ["ygo-sc", "ygo-sc.woff2"],
    ["ygo-atk-def", "ygo-atk-def.woff2"],
    ["ygo-link", "ygo-link.woff2"],
    ["ygo-password", "ygo-password.woff2"],
  ];
  fontsPromise = Promise.all(
    list.map(([fam, file]) => {
      try {
        const ff = new FontFace(fam, `url(${RES}/font/${file}) format("woff2")`, { display: "swap" });
        (document as unknown as { fonts: FontFaceSet }).fonts.add(ff);
        return ff.load().then(() => undefined, () => undefined);
      } catch { return Promise.resolve(); }
    })
  ).then(() => undefined);
  return fontsPromise;
}

// ---------------- 模型 → 素材映射 ----------------
const MONSTER_PEND_FRAMES = new Set(["normal", "effect", "ritual", "fusion", "synchro", "xyz"]);

function frameAsset(m: CardModel): string {
  if (m.cardType === "spell") return "card-spell";
  if (m.cardType === "trap") return "card-trap";
  if (m.isLink) return "card-link";
  if (m.isPendulum && MONSTER_PEND_FRAMES.has(m.frame)) return `card-${m.frame}-pendulum`;
  return `card-${m.frame}`;
}
function isPendLayout(m: CardModel): boolean {
  return m.cardType === "monster" && m.isPendulum && !m.isLink && MONSTER_PEND_FRAMES.has(m.frame);
}
function whiteName(m: CardModel): boolean {
  if (m.cardType !== "monster") return true;          // 魔/陷名条为白字
  return m.isLink || m.frame === "xyz";                // 超量/连接为白字
}
function attrAsset(m: CardModel): string | null {
  if (m.cardType === "spell") return "attribute-spell";
  if (m.cardType === "trap") return "attribute-trap";
  if (!m.attribute) return null;
  return `attribute-${m.attribute.toLowerCase()}`;
}
const ST_ICON: Record<string, string> = {
  Continuous: "continuous", "Quick-Play": "quick-play", Equip: "equip",
  Field: "field", Ritual: "ritual", Counter: "counter",
};
function stIcon(m: CardModel): string | null {
  if (m.cardType === "monster") return null;
  const key = ST_ICON[m.race];
  return key ? `icon-${key}` : null;
}
// 稀有度 → 镭射叠层素材
function rareAsset(m: CardModel): string | null {
  const pend = isPendLayout(m) ? "-pendulum" : "";
  if (m.rarity === "烫金") return `rare-ur${pend}`;
  if (m.rarity === "闪") return `rare-ser${pend}`;
  if (m.rarity === "金字") return `rare-gr${pend}`;
  return null;
}

// 8 个连接箭头（顺序对应 arrowList 1..8：上/右上/右/右下/下/左下/左/左上）
const ARROW_SEQ: { marker: LinkMarker; name: string; x: number; y: number }[] = [
  { marker: "top", name: "up", x: 555, y: 278 },
  { marker: "top-right", name: "right-up", x: 1130, y: 299 },
  { marker: "right", name: "right", x: 1223, y: 761 },
  { marker: "bottom-right", name: "right-down", x: 1130, y: 1336 },
  { marker: "bottom", name: "down", x: 555, y: 1428 },
  { marker: "bottom-left", name: "left-down", x: 95, y: 1336 },
  { marker: "left", name: "left", x: 71, y: 758 },
  { marker: "top-left", name: "left-up", x: 95, y: 299 },
];

// 收集一张卡需要的全部素材 URL
function assetUrls(m: CardModel): string[] {
  const urls = new Set<string>();
  urls.add(`${IMG}/${frameAsset(m)}.png`);
  urls.add(`${IMG}/${isPendLayout(m) ? "card-mask-pendulum" : "card-mask"}.png`);
  const a = attrAsset(m);
  if (a) urls.add(`${IMG}/${a}.png`);
  const st = stIcon(m);
  if (st) urls.add(`${IMG}/${st}.png`);
  // 星级/阶级
  if (m.cardType === "monster" && !m.isLink) {
    urls.add(`${IMG}/${m.frame === "xyz" ? "rank" : "level"}.png`);
  }
  // 攻守线
  if (m.cardType === "monster") {
    urls.add(`${IMG}/${m.isLink ? "atk-link" : "atk-def"}.svg`);
  }
  // 连接箭头（点亮/熄灭都要）
  if (m.isLink) {
    for (const ar of ARROW_SEQ) {
      urls.add(`${IMG}/arrow-${ar.name}-on.png`);
      urls.add(`${IMG}/arrow-${ar.name}-off.png`);
    }
  }
  const rare = rareAsset(m);
  if (rare) urls.add(`${IMG}/${rare}.png`);
  return [...urls];
}

/** 预加载某张卡所需的全部素材与字体 */
export async function preloadCardAssets(m: CardModel): Promise<void> {
  await Promise.all([loadCardFonts(), ...assetUrls(m).map(ensureImg)]);
}

// ---------------- 绘制原语（均在基准坐标系，外部通过 ctx.scale 缩放） ----------------
function drawImg(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, w?: number, h?: number): void {
  const im = imgOf(url);
  if (!im) return;
  const dw = w ?? im.naturalWidth;
  const dh = h ?? im.naturalHeight;
  ctx.drawImage(im, x, y, dw, dh);
}

function coverDraw(ctx: CanvasRenderingContext2D, im: HTMLImageElement, dx: number, dy: number, dw: number, dh: number): void {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const ir = iw / ih, dr = dw / dh;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (ir > dr) { sw = ih * dr; sx = (iw - sw) / 2; }
  else { sh = iw / dr; sy = (ih - sh) / 2; } // align top
  if (sy > 0) sy = 0; // 顶端对齐（与实卡一致）
  ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
}

// 单行文本，超宽时横向压缩（还原卡名/类别行的挤压效果）。
// y 语义与源版式一致：vAlign="top" 时为文字行顶边，"middle" 时为行垂直中心。
function drawSquished(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, fontPx: number,
  font: string, color: string, align: CanvasTextAlign = "left", letter = 0,
  vAlign: "top" | "middle" = "top",
): void {
  if (!text) return;
  ctx.font = `${fontPx}px ${font}`;
  ctx.textBaseline = vAlign;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  const w = measure(ctx, text, letter);
  const scaleX = w > maxW ? maxW / w : 1;
  ctx.save();
  const startX = align === "right" ? x - w * scaleX : align === "center" ? x - (w * scaleX) / 2 : x;
  ctx.translate(startX, y);
  ctx.scale(scaleX, 1);
  drawSpaced(ctx, text, 0, 0, letter);
  ctx.restore();
  ctx.textBaseline = "alphabetic";
}

function measure(ctx: CanvasRenderingContext2D, text: string, letter: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + letter;
  return w - (text.length ? letter : 0);
}
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letter: number): void {
  if (!letter) { ctx.fillText(text, x, y); return; }
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + letter; }
}

// 段落：CJK 逐字断行 + 自动缩字号 + 两端对齐（justify）
function drawParagraph(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, w: number, h: number,
  basePx: number, font: string, color: string,
  lineHeight = 1.2, letter = 0, justify = true,
): void {
  if (!text) return;
  let px = basePx;
  let lines: { text: string; hard: boolean }[] = [];
  const minPx = basePx * 0.55;
  for (;;) {
    ctx.font = `${px}px ${font}`;
    lines = wrapCJK(ctx, text, w, letter);
    if (lines.length * px * lineHeight <= h || px <= minPx) break;
    px -= 1;
  }
  ctx.font = `${px}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lh = px * lineHeight;
  const maxLines = Math.max(1, Math.floor(h / lh + 0.01));
  const shown = lines.slice(0, maxLines);
  shown.forEach((ln, i) => {
    // 行高的半行距均分上下（与源版式 line-height 语义一致）
    const ty = y + i * lh + (lh - px) / 2;
    const chars = [...ln.text];
    const isLast = i === shown.length - 1 || ln.hard;
    const raw = measure(ctx, ln.text, letter);
    if (justify && !isLast && chars.length > 1 && raw < w) {
      const extra = (w - raw) / (chars.length - 1);
      let cx = x;
      for (const ch of chars) { ctx.fillText(ch, cx, ty); cx += ctx.measureText(ch).width + letter + extra; }
    } else {
      drawSpaced(ctx, ln.text, x, ty, letter);
    }
  });
  ctx.textBaseline = "alphabetic";
}

function wrapCJK(ctx: CanvasRenderingContext2D, text: string, maxW: number, letter: number): { text: string; hard: boolean }[] {
  const out: { text: string; hard: boolean }[] = [];
  const paras = text.split("\n");
  paras.forEach((para, pi) => {
    if (para === "") { out.push({ text: "", hard: true }); return; }
    let cur = "";
    let curW = 0;
    for (const ch of para) {
      const cw = ctx.measureText(ch).width + letter;
      if (curW + cw > maxW && cur !== "") {
        out.push({ text: cur, hard: false });
        cur = ch; curW = cw;
      } else {
        cur += ch; curW += cw;
      }
    }
    // 段末行标记 hard（结束该自然段，不做两端对齐）
    out.push({ text: cur, hard: true });
    void pi;
  });
  return out;
}

function statText(v: number | null): string {
  if (v === null) return "";
  if (v < 0) return "?";
  return String(v);
}

// 构造怪兽类别行【种族／召唤类型／灵摆／能力／通常|效果】（对齐实卡顺序）
function monsterTypeLine(m: CardModel): string {
  const parts: string[] = [];
  const rc = raceCn(m.race) || m.race;
  if (rc) parts.push(/[一-鿿]/.test(rc) ? `${rc}族` : rc);
  if (m.frame === "token") {
    parts.push("衍生物");
    return `【${parts.join("／")}】`;
  }
  if (m.isLink) parts.push("连接");
  else if (m.frame === "xyz") parts.push("超量");
  else if (m.frame === "synchro") parts.push("同调");
  else if (m.frame === "fusion") parts.push("融合");
  else if (m.frame === "ritual") parts.push("仪式");
  if (m.isPendulum && !m.isLink) parts.push("灵摆");
  if (m.subtype && SUBTYPE_CN[m.subtype]) parts.push(SUBTYPE_CN[m.subtype]);
  parts.push(m.frame === "normal" ? "通常" : "效果");
  return `【${parts.join("／")}】`;
}

// ---------------- 同步绘制（要求素材/字体已 preload） ----------------
export function renderCardSync(ctx: CanvasRenderingContext2D, model: CardModel, opts: { width: number }): void {
  const s = opts.width / BW;
  const pend = isPendLayout(model);
  const isMonster = model.cardType === "monster";
  const nameColor = whiteName(model) ? "#f8f8f4" : "#0a0a0a";
  const darkText = whiteName(model) && model.frame === "xyz" ? "#ffffff" : "#0a0a0a";

  ctx.save();
  ctx.scale(s, s);
  // 圆角裁切
  roundClip(ctx, 0, 0, BW, BH, 24);

  // 1) 卡框
  drawImg(ctx, `${IMG}/${frameAsset(model)}.png`, 0, 0, BW, BH);

  // 2) 卡图（顶端对齐 cover）+ 遮罩（斜切内框）
  const art = model.artImage;
  const aw = pend ? 1205 : 1054, ah = pend ? 1205 : 1054;
  const ax = pend ? 94 : 170, ay = pend ? 364 : 375;
  if (art && art.complete && art.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ax, ay, aw, ah);
    ctx.clip();
    coverDraw(ctx, art, ax, ay, aw, ah);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.fillRect(ax, ay, aw, ah);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = `${64}px ygo-sc`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("上传卡图", ax + aw / 2, ay + ah / 2);
    ctx.restore();
  }
  drawImg(ctx, `${IMG}/${pend ? "card-mask-pendulum" : "card-mask"}.png`, pend ? 68 : 117, pend ? 342 : 322);

  // 3) 卡名（垂直中心对齐属性珠中心 y=160，与实卡名条一致）
  const showAttr = isMonster ? !!model.attribute : true;
  const nameMaxW = showAttr ? 1033 : 1161;
  drawSquished(ctx, model.name || "", 116, 160, nameMaxW, 108, "ygo-sc", nameColor, "left", 0, "middle");

  // 4) 属性图标
  const a = attrAsset(model);
  if (a && showAttr) drawImg(ctx, `${IMG}/${a}.png`, 1163, 96, 128, 128);

  // 5) 星级 / 阶级
  if (isMonster && !model.isLink && (model.level ?? 0) > 0) {
    const count = Math.min(model.level ?? 0, 13);
    if (model.frame === "xyz") {
      const left = count < 13 ? 147 : 101;
      const url = `${IMG}/rank.png`;
      for (let i = 0; i < count; i++) drawImg(ctx, url, left + i * (88 + 4), 247, 88, 88);
    } else {
      const right = count < 13 ? 147 : 101;
      const url = `${IMG}/level.png`;
      for (let i = 0; i < count; i++) drawImg(ctx, url, BW - right - i * (88 + 4) - 88, 247, 88, 88);
    }
  }

  // 6) 魔法/陷阱类别行（右对齐，可含子类型图标；魔陷名条为白字但类别行在框内为黑字）
  if (!isMonster) {
    const label = model.cardType === "spell" ? "【魔法卡" : "【陷阱卡";
    const rb = "】";
    const st = stIcon(model);
    const stImg = st ? imgOf(`${IMG}/${st}.png`) : undefined;
    ctx.font = `76px ygo-sc`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#0a0a0a";
    ctx.textAlign = "left";
    const rbW = ctx.measureText(rb).width;
    const iconW = stImg ? 72 : 0;
    const iconGapL = stImg ? 10 : 0;
    const labelW = measure(ctx, label, 2);
    const total = labelW + iconGapL + iconW + rbW;
    const topY = 254;
    let cx = BW - 134 - total;
    drawSpaced(ctx, label, cx, topY, 2);
    cx += labelW + iconGapL;
    if (stImg) { drawImg(ctx, `${IMG}/${st}.png`, cx, topY + 8, 72, 72); cx += iconW; }
    ctx.fillText(rb, cx, topY);
    ctx.textBaseline = "alphabetic";
  }

  // 7) 灵摆刻度 + 灵摆效果
  if (pend) {
    ctx.fillStyle = "#0a0a0a";
    ctx.font = `98px ygo-atk-def`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const sc = String(model.scale ?? 0);
    ctx.fillText(sc, 145, 1370);
    ctx.fillText(sc, 1249, 1370);
    ctx.textBaseline = "alphabetic";
    const pe = (model.pendulumEffect || "").trim();
    if (pe) drawParagraph(ctx, pe, 221, 1282, 950, 232, 36, "ygo-sc", "#0a0a0a", 1.2, 2, false);
  }

  // 8) 连接箭头
  if (model.isLink) {
    for (const ar of ARROW_SEQ) {
      const on = model.linkMarkers.includes(ar.marker);
      drawImg(ctx, `${IMG}/arrow-${ar.name}-${on ? "on" : "off"}.png`, ar.x, ar.y);
    }
  }

  // 9) 效果框：类别行 + 正文
  const effTop = 1528;
  const effLineH = 44 * 1.2;
  let descTop = effTop;
  if (isMonster) {
    drawSquished(ctx, monsterTypeLine(model), 109, effTop, 1175, 44, "ygo-sc", "#0a0a0a", "left", 1);
    descTop = effTop + effLineH;
  }
  // 正文高度
  let descH = 385;
  if (isMonster) {
    descH -= effLineH;      // 让出类别行
    descH -= 60;            // 让出攻守线
  }
  const descText = model.effect || "";
  drawParagraph(ctx, descText, 109, descTop, 1175, descH, 36, "ygo-sc", "#0a0a0a", 1.2, 2, true);

  // 10) 攻 / 守 / LINK
  if (isMonster) {
    if (model.isLink) {
      drawImg(ctx, `${IMG}/atk-link.svg`, 109, 1844, 1174, 52);
    } else {
      drawImg(ctx, `${IMG}/atk-def.svg`, 109, 1844, 1174, 52);
    }
    ctx.fillStyle = "#0a0a0a";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "right";
    // 数字基线钉在 atk-def.svg 内 "ATK/ DEF/" 标签的字形基线上（svg 内 y≈51.6，贴图于 1844）
    const numBase = 1844 + 51.6;
    if (model.atk !== null) {
      ctx.font = `62px ygo-atk-def`;
      ctx.fillText(statText(model.atk), 999, numBase);
    }
    if (model.isLink) {
      ctx.font = `44px ygo-link`;
      const linkN = model.linkMarkers.length || model.level || 0;
      ctx.save();
      ctx.translate(1280, numBase);
      ctx.scale(1.3, 1);
      ctx.textAlign = "right";
      ctx.fillText(String(linkN), 0, 0);
      ctx.restore();
    } else if (model.def !== null) {
      ctx.font = `62px ygo-atk-def`;
      ctx.fillText(statText(model.def), 1282, numBase);
    }
  }

  // 11) 卡密（左下）+ 套牌编号（右下 / 灵摆左下）
  ctx.fillStyle = darkText;
  ctx.textBaseline = "top";
  ctx.font = `40px ygo-password`;
  ctx.textAlign = "left";
  if (model.passcode) ctx.fillText(model.passcode, 66, 1932);
  if (model.setCode) {
    if (pend) {
      ctx.textAlign = "left";
      ctx.fillText(model.setCode, 116, 1859);
    } else {
      ctx.textAlign = "right";
      const right = model.isLink ? 252 : 148;
      ctx.fillText(model.setCode, BW - right, 1455);
    }
  }
  ctx.textBaseline = "alphabetic";

  // 12) 稀有度镭射叠层（克制透明度，作为箔面光泽而非彩虹涂布）
  const rare = rareAsset(model);
  if (rare) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = "screen";
    drawImg(ctx, `${IMG}/${rare}.png`, 0, 0, BW, BH);
    ctx.restore();
  }

  // 13) 同人卡标识（实卡版权文字位，右下；用简中卡面字体保证 CJK 字形一致）
  ctx.fillStyle = model.frame === "xyz" && isMonster ? "rgba(255,255,255,.85)" : "rgba(20,14,8,.8)";
  ctx.font = `30px ygo-sc`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("@游戏王集卡社同人卡", BW - 141, 1936);
  ctx.textBaseline = "alphabetic";

  ctx.restore();
}

function roundClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();
}

/** 便捷 async 封装：自动预加载后同步绘制（供长图合成等外部调用） */
export async function renderCard(ctx: CanvasRenderingContext2D, model: CardModel, opts: { width: number }): Promise<void> {
  await preloadCardAssets(model);
  renderCardSync(ctx, model, opts);
}

/** 离屏渲染并导出 PNG。width 默认 1394（素材原生分辨率，打印级）。 */
export async function exportCardPng(model: CardModel, width = BW): Promise<{ dataUrl: string; blob: Blob | null }> {
  await preloadCardAssets(model);
  const W = width;
  const H = Math.round(W * RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  renderCardSync(ctx, model, { width: W });
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  return { dataUrl, blob };
}

export { RATIO as CARD_RATIO };
