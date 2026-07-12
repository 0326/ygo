// M2.2 分享长图合成器（框架无关）。
// 将若干已选卡片合成一张「天生适合截图转发」的竖向海报长图。
// 默认使用真实卡图缩略图；可选复用 CardCanvasRenderer 的「渲染为卡面」模式。

import type { CardSummary, Lang } from "../../shared/types";
import {
  ATTR_CN,
  ATTR_COLOR,
  frameColor,
  FRAME_CN,
  raceCn,
  statStr,
} from "../lib/labels";
import { renderCard, CARD_RATIO, type CardModel } from "./CardCanvasRenderer";

export interface ShareItem {
  card: CardSummary;
  image: HTMLImageElement | null; // 已加载的卡图缩略图（thumb_url）
}

export interface ShareOptions {
  title: string; // 海报主标题
  subtitle: string; // 副标题/口号
  layout: "list" | "grid" | "cards"; // 列表 / 网格 / 卡面
  width?: number; // 输出宽度（默认 1080，适配手机竖屏分享）
  lang?: Lang; // 卡名显示语言（默认 cn）
}

// 按语言选卡名（与 i18n.cardName 同逻辑，避免在 canvas 模块引入 React 上下文）
function pickName(c: CardSummary, lang: Lang): string {
  if (lang === "jp") return c.jp_name || c.en_name || c.cn_name;
  if (lang === "en") return c.en_name || c.cn_name;
  return c.cn_name || c.en_name;
}

const SITE_NAME = "游戏王集卡社";
const SITE_URL = "抖音号 ygoclub";
const BODY_FONT =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif';
const DISPLAY_FONT =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif';

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
  if (!iw || !ih) return;
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

/** 把 CardSummary 转换为渲染器需要的 CardModel（卡面模式用） */
function toCardModel(item: ShareItem, lang: Lang): CardModel {
  const c = item.card;
  return {
    frame: c.frame,
    isPendulum: c.scale != null,
    cardType: c.card_type,
    name: pickName(c, lang),
    attribute: c.attribute,
    level: c.level,
    isRank: c.frame === "xyz",
    isLink: c.frame === "link",
    linkMarkers: c.link_markers ?? [],
    scale: c.scale,
    race: c.race ?? "",
    effect: "",
    pendulumEffect: null,
    atk: c.atk,
    def: c.def,
    passcode: String(c.id),
    rarity: "普通",
    setCode: "",
    artImage: item.image,
  };
}

/** 简易 QR 风格装饰角标（非真实二维码，仅作「扫码/访问」视觉提示） */
function drawQrBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  ctx.save();
  roundRect(ctx, x, y, s, s, s * 0.12);
  ctx.fillStyle = "#fff";
  ctx.fill();
  const cell = s / 9;
  ctx.fillStyle = "#0b0c10";
  // 伪随机但稳定的图案
  const pat = [
    [1, 1, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 1, 0, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 0, 0, 0],
    [1, 0, 1, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 1, 0, 1],
    [1, 1, 1, 0, 0, 1, 1, 1, 0],
    [1, 0, 1, 1, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1],
  ];
  for (let r = 0; r < 9; r++)
    for (let col = 0; col < 9; col++)
      if (pat[r][col])
        ctx.fillRect(x + col * cell, y + r * cell, cell + 0.5, cell + 0.5);
  ctx.restore();
}

function attrBadge(
  ctx: CanvasRenderingContext2D,
  attr: string,
  cx: number,
  cy: number,
  r: number,
): void {
  const color = ATTR_COLOR[attr] || "#888";
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color + "99");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${r * 1.1}px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ATTR_CN[attr] || "", cx, cy + r * 0.05);
}

/** 计算长图总高度 */
function computeHeight(opts: ShareOptions, count: number, W: number): number {
  const headerH = W * 0.42;
  const footerH = W * 0.34;
  const padX = W * 0.05;
  if (opts.layout === "list") {
    const rowH = W * 0.2;
    const gap = W * 0.025;
    return headerH + count * (rowH + gap) + footerH;
  }
  if (opts.layout === "grid") {
    const cols = count <= 4 ? 2 : 3;
    const cellW = (W - padX * 2 - (cols - 1) * W * 0.025) / cols;
    const cellH = cellW * 1.0 + W * 0.07;
    const rows = Math.ceil(count / cols);
    return headerH + rows * (cellH + W * 0.025) + footerH;
  }
  // cards
  const cols = 2;
  const cellW = (W - padX * 2 - (cols - 1) * W * 0.04) / cols;
  const cellH = cellW * 1.4665;
  const rows = Math.ceil(count / cols);
  return headerH + rows * (cellH + W * 0.04) + footerH;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  opts: ShareOptions,
  W: number,
): number {
  const headerH = W * 0.42;
  // 渐变背景条
  const g = ctx.createLinearGradient(0, 0, W, headerH);
  g.addColorStop(0, "#15171f");
  g.addColorStop(1, "#0b0c10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, headerH);
  // 金色光晕
  const glow = ctx.createRadialGradient(
    W * 0.8,
    headerH * 0.2,
    0,
    W * 0.8,
    headerH * 0.2,
    W * 0.6,
  );
  glow.addColorStop(0, "rgba(217,179,94,.18)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, headerH);

  const padX = W * 0.06;
  // 站点标识
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#d9b35e";
  ctx.font = `700 ${W * 0.028}px ${BODY_FONT}`;
  ctx.fillText(`${SITE_NAME} · ${SITE_URL}`, padX, headerH * 0.22);

  // 主标题（自动收缩）
  let titlePx = W * 0.075;
  ctx.font = `700 ${titlePx}px ${DISPLAY_FONT}`;
  while (ctx.measureText(opts.title).width > W - padX * 2 && titlePx > 20) {
    titlePx -= 1;
    ctx.font = `700 ${titlePx}px ${DISPLAY_FONT}`;
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.fillText(opts.title, padX, headerH * 0.48);

  // 副标题
  if (opts.subtitle) {
    ctx.fillStyle = "#b8bcc6";
    ctx.font = `400 ${W * 0.034}px ${BODY_FONT}`;
    ctx.fillText(opts.subtitle, padX, headerH * 0.66);
  }

  // 装饰金线
  ctx.fillStyle = "#d9b35e";
  ctx.fillRect(padX, headerH * 0.82, W * 0.12, W * 0.006);

  return headerH;
}

function drawListRow(
  ctx: CanvasRenderingContext2D,
  item: ShareItem,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  W: number,
  lang: Lang,
): void {
  const c = item.card;
  const fc = frameColor(c.frame, c.scale != null);
  // 行底
  roundRect(ctx, x, y, w, h, W * 0.018);
  const bg = ctx.createLinearGradient(x, y, x + w, y);
  bg.addColorStop(0, "#1a1d25");
  bg.addColorStop(1, "#15171f");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = fc.base + "66";
  ctx.stroke();

  // 序号金边
  ctx.fillStyle = fc.base;
  ctx.fillRect(x, y, W * 0.008, h);

  // 卡图缩略
  const imgPad = W * 0.018;
  const imgW = h - imgPad * 2;
  const imgH = h - imgPad * 2;
  ctx.save();
  roundRect(ctx, x + imgPad, y + imgPad, imgW, imgH, W * 0.012);
  ctx.clip();
  if (item.image && item.image.complete && item.image.naturalWidth) {
    drawImageCover(ctx, item.image, x + imgPad, y + imgPad, imgW, imgH);
  } else {
    ctx.fillStyle = fc.base + "44";
    ctx.fillRect(x + imgPad, y + imgPad, imgW, imgH);
  }
  ctx.restore();

  const tx = x + imgPad * 2 + imgW;
  const tw = w - (tx - x) - W * 0.03;
  // 序号
  ctx.fillStyle = "#7d828f";
  ctx.font = `700 ${W * 0.026}px ${BODY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(index + 1).padStart(2, "0"), tx, y + h * 0.28);

  // 名称（收缩）
  const cname = pickName(c, lang);
  let namePx = W * 0.046;
  ctx.font = `700 ${namePx}px ${DISPLAY_FONT}`;
  while (ctx.measureText(cname).width > tw - W * 0.06 && namePx > 14) {
    namePx -= 1;
    ctx.font = `700 ${namePx}px ${DISPLAY_FONT}`;
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.fillText(cname, tx + W * 0.05, y + h * 0.3);

  // 标签行：卡框 + 种族 + 等级
  const tags: string[] = [FRAME_CN[c.frame] || c.frame];
  if (c.card_type === "monster") {
    const rc = raceCn(c.race);
    if (rc) tags.push(rc);
    if (c.frame === "link" && c.link_val) tags.push(`LINK-${c.link_val}`);
    else if (c.frame === "xyz" && c.level) tags.push(`阶${c.level}`);
    else if (c.level) tags.push(`★${c.level}`);
  } else {
    const rc = raceCn(c.race);
    if (rc) tags.push(rc);
  }
  ctx.font = `400 ${W * 0.028}px ${BODY_FONT}`;
  ctx.fillStyle = "#b8bcc6";
  ctx.fillText(tags.join(" · "), tx, y + h * 0.58);

  // ATK/DEF
  if (c.card_type === "monster") {
    ctx.fillStyle = "#d9b35e";
    ctx.font = `700 ${W * 0.03}px ${BODY_FONT}`;
    const atk = `攻 ${statStr(c.atk)}`;
    const def =
      c.frame === "link" ? "" : `  守 ${statStr(c.def)}`;
    ctx.fillText(atk + def, tx, y + h * 0.82);
  }

  // 属性圆
  if (c.attribute) {
    attrBadge(ctx, c.attribute, x + w - W * 0.05, y + h * 0.3, W * 0.03);
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  y: number,
  W: number,
): void {
  const footerH = W * 0.34;
  const g = ctx.createLinearGradient(0, y, 0, y + footerH);
  g.addColorStop(0, "#0b0c10");
  g.addColorStop(1, "#15120a");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, footerH);
  // 顶部金线
  ctx.fillStyle = "#d9b35e";
  ctx.fillRect(0, y, W, W * 0.004);

  const padX = W * 0.06;
  const qrS = footerH * 0.55;
  const qrY = y + footerH * 0.22;
  drawQrBadge(ctx, padX, qrY, qrS);

  // CTA 文案
  const tx = padX + qrS + W * 0.04;
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4f1ea";
  ctx.font = `700 ${W * 0.044}px ${DISPLAY_FONT}`;
  ctx.fillText("扫码 / 访问 查看高清卡图", tx, y + footerH * 0.42);
  ctx.fillStyle = "#d9b35e";
  ctx.font = `700 ${W * 0.04}px ${BODY_FONT}`;
  ctx.fillText(SITE_URL, tx, y + footerH * 0.62);
  ctx.fillStyle = "#7d828f";
  ctx.font = `400 ${W * 0.026}px ${BODY_FONT}`;
  ctx.fillText("卡图最美的游戏王卡库 · 非官方同人站点", tx, y + footerH * 0.78);
}

/**
 * 合成分享长图。返回离屏 canvas（调用方负责导出）。
 * items 中的 image 应已加载完成（same-origin，不污染画布）。
 */
export async function composeShareImage(
  items: ShareItem[],
  opts: ShareOptions,
): Promise<HTMLCanvasElement> {
  const W = opts.width ?? 1080;
  const H = Math.round(computeHeight(opts, items.length, W));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  // 整体底色
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0c10");
  bg.addColorStop(1, "#101218");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const padX = W * 0.05;
  let cy = drawHeader(ctx, opts, W);
  cy += W * 0.03;
  const lang = opts.lang ?? "cn";

  if (opts.layout === "list") {
    const rowH = W * 0.2;
    const gap = W * 0.025;
    items.forEach((it, i) => {
      drawListRow(ctx, it, padX, cy, W - padX * 2, rowH, i, W, lang);
      cy += rowH + gap;
    });
  } else if (opts.layout === "grid") {
    const cols = items.length <= 4 ? 2 : 3;
    const gap = W * 0.025;
    const cellW = (W - padX * 2 - (cols - 1) * gap) / cols;
    const cellH = cellW * 1.0 + W * 0.07;
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (cellW + gap);
      const y = cy + row * (cellH + gap);
      drawGridCell(ctx, it, x, y, cellW, W, lang);
    });
    const rows = Math.ceil(items.length / cols);
    cy += rows * (cellH + gap);
  } else {
    // cards: 复用 renderCard（真卡框合成，需异步预加载素材）
    const cols = 2;
    const gap = W * 0.04;
    const cellW = (W - padX * 2 - (cols - 1) * gap) / cols;
    const cellH = cellW * CARD_RATIO;
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (cellW + gap);
      const y = cy + row * (cellH + gap);
      ctx.save();
      ctx.translate(x, y);
      await renderCard(ctx, toCardModel(items[i], lang), { width: cellW });
      ctx.restore();
    }
    const rows = Math.ceil(items.length / cols);
    cy += rows * (cellH + gap);
  }

  drawFooter(ctx, H - W * 0.34, W);
  return canvas;
}

function drawGridCell(
  ctx: CanvasRenderingContext2D,
  item: ShareItem,
  x: number,
  y: number,
  w: number,
  W: number,
  lang: Lang,
): void {
  const c = item.card;
  const fc = frameColor(c.frame, c.scale != null);
  const imgH = w; // 正方图
  ctx.save();
  roundRect(ctx, x, y, w, imgH, W * 0.014);
  ctx.clip();
  if (item.image && item.image.complete && item.image.naturalWidth) {
    drawImageCover(ctx, item.image, x, y, w, imgH);
  } else {
    ctx.fillStyle = fc.base + "44";
    ctx.fillRect(x, y, w, imgH);
  }
  ctx.restore();
  // 边框
  roundRect(ctx, x, y, w, imgH, W * 0.014);
  ctx.lineWidth = 2;
  ctx.strokeStyle = fc.base + "88";
  ctx.stroke();
  // 名称
  const cname = pickName(c, lang);
  let namePx = W * 0.03;
  ctx.font = `700 ${namePx}px ${DISPLAY_FONT}`;
  while (ctx.measureText(cname).width > w && namePx > 11) {
    namePx -= 1;
    ctx.font = `700 ${namePx}px ${DISPLAY_FONT}`;
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(cname, x, y + imgH + W * 0.04);
  // 副信息
  ctx.fillStyle = "#b8bcc6";
  ctx.font = `400 ${W * 0.022}px ${BODY_FONT}`;
  const sub =
    c.card_type === "monster"
      ? `${raceCn(c.race)} · 攻${statStr(c.atk)}`
      : FRAME_CN[c.frame];
  ctx.fillText(sub, x, y + imgH + W * 0.062);
}

/** 导出 PNG */
export async function exportShareImage(
  canvas: HTMLCanvasElement,
): Promise<{ dataUrl: string; blob: Blob | null }> {
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  return { dataUrl, blob };
}
