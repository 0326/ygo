// 卡面渲染器（Taro 移植版）。绘制数学移植自 web 端 CardCanvasRenderer.ts，逐像素对齐 1394×2031 卡框。
// 与 web 版差异：资源加载走 adapter（小程序 canvas.createImage / Taro.loadFontFace），
// SVG 攻守线在小程序不可绘，改为字体文字兜底。
import type { Frame, Attribute, LinkMarker, MonsterSubtype } from '../types'
import { raceCn, SUBTYPE_CN } from '../utils/labels'
import { IMG_BASE } from './assets'
import { createImage, loadFonts, type CanvasLike, type CanvasImage } from './adapter'

export interface CardModel {
  frame: Frame
  isPendulum: boolean
  cardType: 'monster' | 'spell' | 'trap'
  name: string
  attribute: Attribute | null
  level: number | null
  isRank: boolean
  isLink: boolean
  linkMarkers: LinkMarker[]
  scale: number | null
  race: string
  subtype?: MonsterSubtype | ''
  effect: string
  pendulumEffect: string | null
  atk: number | null
  def: number | null
  passcode: string
  rarity: string
  setCode: string
  artImage: CanvasImage | null
}

const BW = 1394
const BH = 2031
const RATIO = BH / BW

const resolved = new Map<string, CanvasImage>()
const pending = new Map<string, Promise<void>>()

function ensureImg(canvas: CanvasLike, url: string): Promise<void> {
  if (resolved.has(url)) return Promise.resolve()
  let p = pending.get(url)
  if (!p) {
    p = new Promise<void>((res) => {
      const im = createImage(canvas)
      im.onload = () => { resolved.set(url, im); res() }
      im.onerror = () => res()
      im.src = url
    })
    pending.set(url, p)
  }
  return p
}
const imgOf = (url: string): CanvasImage | undefined => resolved.get(url)

const MONSTER_PEND_FRAMES = new Set(['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz'])

function frameAsset(m: CardModel): string {
  if (m.cardType === 'spell') return 'card-spell'
  if (m.cardType === 'trap') return 'card-trap'
  if (m.isLink) return 'card-link'
  if (m.isPendulum && MONSTER_PEND_FRAMES.has(m.frame)) return `card-${m.frame}-pendulum`
  return `card-${m.frame}`
}
function isPendLayout(m: CardModel): boolean {
  return m.cardType === 'monster' && m.isPendulum && !m.isLink && MONSTER_PEND_FRAMES.has(m.frame)
}
function whiteName(m: CardModel): boolean {
  if (m.cardType !== 'monster') return true
  return m.isLink || m.frame === 'xyz'
}
function attrAsset(m: CardModel): string | null {
  if (m.cardType === 'spell') return 'attribute-spell'
  if (m.cardType === 'trap') return 'attribute-trap'
  if (!m.attribute) return null
  return `attribute-${m.attribute.toLowerCase()}`
}
const ST_ICON: Record<string, string> = {
  Continuous: 'continuous', 'Quick-Play': 'quick-play', Equip: 'equip',
  Field: 'field', Ritual: 'ritual', Counter: 'counter',
}
function stIcon(m: CardModel): string | null {
  if (m.cardType === 'monster') return null
  const key = ST_ICON[m.race]
  return key ? `icon-${key}` : null
}
function rareAsset(m: CardModel): string | null {
  const pend = isPendLayout(m) ? '-pendulum' : ''
  if (m.rarity === '烫金') return `rare-ur${pend}`
  if (m.rarity === '闪') return `rare-ser${pend}`
  if (m.rarity === '金字') return `rare-gr${pend}`
  return null
}

const ARROW_SEQ: { marker: LinkMarker; name: string; x: number; y: number }[] = [
  { marker: 'top', name: 'up', x: 555, y: 278 },
  { marker: 'top-right', name: 'right-up', x: 1130, y: 299 },
  { marker: 'right', name: 'right', x: 1223, y: 761 },
  { marker: 'bottom-right', name: 'right-down', x: 1130, y: 1336 },
  { marker: 'bottom', name: 'down', x: 555, y: 1428 },
  { marker: 'bottom-left', name: 'left-down', x: 95, y: 1336 },
  { marker: 'left', name: 'left', x: 71, y: 758 },
  { marker: 'top-left', name: 'left-up', x: 95, y: 299 },
]

function assetUrls(m: CardModel): string[] {
  const urls = new Set<string>()
  urls.add(`${IMG_BASE}/${frameAsset(m)}.png`)
  urls.add(`${IMG_BASE}/${isPendLayout(m) ? 'card-mask-pendulum' : 'card-mask'}.png`)
  const a = attrAsset(m)
  if (a) urls.add(`${IMG_BASE}/${a}.png`)
  const st = stIcon(m)
  if (st) urls.add(`${IMG_BASE}/${st}.png`)
  if (m.cardType === 'monster' && !m.isLink) {
    urls.add(`${IMG_BASE}/${m.frame === 'xyz' ? 'rank' : 'level'}.png`)
  }
  if (m.isLink) {
    for (const ar of ARROW_SEQ) {
      urls.add(`${IMG_BASE}/arrow-${ar.name}-on.png`)
      urls.add(`${IMG_BASE}/arrow-${ar.name}-off.png`)
    }
  }
  const rare = rareAsset(m)
  if (rare) urls.add(`${IMG_BASE}/${rare}.png`)
  return [...urls]
}

export async function preloadCardAssets(canvas: CanvasLike, m: CardModel): Promise<void> {
  await Promise.all([loadFonts(), ...assetUrls(m).map((u) => ensureImg(canvas, u))])
}

function drawImg(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, w?: number, h?: number): void {
  const im = imgOf(url)
  if (!im) return
  const dw = w ?? im.width
  const dh = h ?? im.height
  ctx.drawImage(im as unknown as HTMLImageElement, x, y, dw, dh)
}

function coverDraw(ctx: CanvasRenderingContext2D, im: CanvasImage, dx: number, dy: number, dw: number, dh: number): void {
  const iw = im.width, ih = im.height
  const ir = iw / ih, dr = dw / dh
  let sx = 0, sy = 0, sw = iw, sh = ih
  if (ir > dr) { sw = ih * dr; sx = (iw - sw) / 2 } else { sh = iw / dr; sy = (ih - sh) / 2 }
  if (sy > 0) sy = 0
  ctx.drawImage(im as unknown as HTMLImageElement, sx, sy, sw, sh, dx, dy, dw, dh)
}

function measure(ctx: CanvasRenderingContext2D, text: string, letter: number): number {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + letter
  return w - (text.length ? letter : 0)
}
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letter: number): void {
  if (!letter) { ctx.fillText(text, x, y); return }
  let cx = x
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + letter }
}

function drawSquished(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, fontPx: number,
  font: string, color: string, align: CanvasTextAlign = 'left', letter = 0,
  vAlign: 'top' | 'middle' = 'top',
): void {
  if (!text) return
  ctx.font = `${fontPx}px ${font}`
  ctx.textBaseline = vAlign as CanvasTextBaseline
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  const w = measure(ctx, text, letter)
  const scaleX = w > maxW ? maxW / w : 1
  ctx.save()
  const startX = align === 'right' ? x - w * scaleX : align === 'center' ? x - (w * scaleX) / 2 : x
  ctx.translate(startX, y)
  ctx.scale(scaleX, 1)
  drawSpaced(ctx, text, 0, 0, letter)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
}

function wrapCJK(ctx: CanvasRenderingContext2D, text: string, maxW: number, letter: number): { text: string; hard: boolean }[] {
  const out: { text: string; hard: boolean }[] = []
  const paras = text.split('\n')
  paras.forEach((para) => {
    if (para === '') { out.push({ text: '', hard: true }); return }
    let cur = ''
    let curW = 0
    for (const ch of para) {
      const cw = ctx.measureText(ch).width + letter
      if (curW + cw > maxW && cur !== '') {
        out.push({ text: cur, hard: false })
        cur = ch; curW = cw
      } else {
        cur += ch; curW += cw
      }
    }
    out.push({ text: cur, hard: true })
  })
  return out
}

function drawParagraph(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, w: number, h: number,
  basePx: number, font: string, color: string,
  lineHeight = 1.2, letter = 0, justify = true,
): void {
  if (!text) return
  let px = basePx
  let lines: { text: string; hard: boolean }[] = []
  const minPx = basePx * 0.55
  for (;;) {
    ctx.font = `${px}px ${font}`
    lines = wrapCJK(ctx, text, w, letter)
    if (lines.length * px * lineHeight <= h || px <= minPx) break
    px -= 1
  }
  ctx.font = `${px}px ${font}`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const lh = px * lineHeight
  const maxLines = Math.max(1, Math.floor(h / lh + 0.01))
  const shown = lines.slice(0, maxLines)
  shown.forEach((ln, i) => {
    const ty = y + i * lh + (lh - px) / 2
    const chars = [...ln.text]
    const isLast = i === shown.length - 1 || ln.hard
    const raw = measure(ctx, ln.text, letter)
    if (justify && !isLast && chars.length > 1 && raw < w) {
      const extra = (w - raw) / (chars.length - 1)
      let cx = x
      for (const ch of chars) { ctx.fillText(ch, cx, ty); cx += ctx.measureText(ch).width + letter + extra }
    } else {
      drawSpaced(ctx, ln.text, x, ty, letter)
    }
  })
  ctx.textBaseline = 'alphabetic'
}

function statText(v: number | null): string {
  if (v === null) return ''
  if (v < 0) return '?'
  return String(v)
}

function monsterTypeLine(m: CardModel): string {
  const parts: string[] = []
  const rc = raceCn(m.race) || m.race
  if (rc) parts.push(/[一-鿿]/.test(rc) ? `${rc}族` : rc)
  if (m.frame === 'token') { parts.push('衍生物'); return `【${parts.join('／')}】` }
  if (m.isLink) parts.push('连接')
  else if (m.frame === 'xyz') parts.push('超量')
  else if (m.frame === 'synchro') parts.push('同调')
  else if (m.frame === 'fusion') parts.push('融合')
  else if (m.frame === 'ritual') parts.push('仪式')
  if (m.isPendulum && !m.isLink) parts.push('灵摆')
  if (m.subtype && SUBTYPE_CN[m.subtype]) parts.push(SUBTYPE_CN[m.subtype])
  parts.push(m.frame === 'normal' ? '通常' : '效果')
  return `【${parts.join('／')}】`
}

function roundClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.clip()
}

export function renderCardSync(ctx: CanvasRenderingContext2D, model: CardModel, opts: { width: number }): void {
  const s = opts.width / BW
  const pend = isPendLayout(model)
  const isMonster = model.cardType === 'monster'
  const nameColor = whiteName(model) ? '#f8f8f4' : '#0a0a0a'
  const darkText = whiteName(model) && model.frame === 'xyz' ? '#ffffff' : '#0a0a0a'

  ctx.save()
  ctx.scale(s, s)
  roundClip(ctx, 0, 0, BW, BH, 24)

  drawImg(ctx, `${IMG_BASE}/${frameAsset(model)}.png`, 0, 0, BW, BH)

  const art = model.artImage
  const aw = pend ? 1205 : 1054, ah = pend ? 1205 : 1054
  const ax = pend ? 94 : 170, ay = pend ? 364 : 375
  if (art && art.width) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(ax, ay, aw, ah)
    ctx.clip()
    coverDraw(ctx, art, ax, ay, aw, ah)
    ctx.restore()
  } else {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,.16)'
    ctx.fillRect(ax, ay, aw, ah)
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.font = `64px ygo-sc`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('上传卡图', ax + aw / 2, ay + ah / 2)
    ctx.restore()
  }
  drawImg(ctx, `${IMG_BASE}/${pend ? 'card-mask-pendulum' : 'card-mask'}.png`, pend ? 68 : 117, pend ? 342 : 322)

  const showAttr = isMonster ? !!model.attribute : true
  const nameMaxW = showAttr ? 1033 : 1161
  drawSquished(ctx, model.name || '', 116, 160, nameMaxW, 108, 'ygo-sc', nameColor, 'left', 0, 'middle')

  const a = attrAsset(model)
  if (a && showAttr) drawImg(ctx, `${IMG_BASE}/${a}.png`, 1163, 96, 128, 128)

  if (isMonster && !model.isLink && (model.level ?? 0) > 0) {
    const count = Math.min(model.level ?? 0, 13)
    if (model.frame === 'xyz') {
      const left = count < 13 ? 147 : 101
      const url = `${IMG_BASE}/rank.png`
      for (let i = 0; i < count; i++) drawImg(ctx, url, left + i * (88 + 4), 247, 88, 88)
    } else {
      const right = count < 13 ? 147 : 101
      const url = `${IMG_BASE}/level.png`
      for (let i = 0; i < count; i++) drawImg(ctx, url, BW - right - i * (88 + 4) - 88, 247, 88, 88)
    }
  }

  if (!isMonster) {
    const label = model.cardType === 'spell' ? '【魔法卡' : '【陷阱卡'
    const rb = '】'
    const st = stIcon(model)
    const stImg = st ? imgOf(`${IMG_BASE}/${st}.png`) : undefined
    ctx.font = `76px ygo-sc`
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#0a0a0a'
    ctx.textAlign = 'left'
    const rbW = ctx.measureText(rb).width
    const iconW = stImg ? 72 : 0
    const iconGapL = stImg ? 10 : 0
    const labelW = measure(ctx, label, 2)
    const total = labelW + iconGapL + iconW + rbW
    const topY = 254
    let cx = BW - 134 - total
    drawSpaced(ctx, label, cx, topY, 2)
    cx += labelW + iconGapL
    if (stImg) { drawImg(ctx, `${IMG_BASE}/${st}.png`, cx, topY + 8, 72, 72); cx += iconW }
    ctx.fillText(rb, cx, topY)
    ctx.textBaseline = 'alphabetic'
  }

  if (pend) {
    ctx.fillStyle = '#0a0a0a'
    ctx.font = `98px ygo-atk-def`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    const sc = String(model.scale ?? 0)
    ctx.fillText(sc, 145, 1370)
    ctx.fillText(sc, 1249, 1370)
    ctx.textBaseline = 'alphabetic'
    const pe = (model.pendulumEffect || '').trim()
    if (pe) drawParagraph(ctx, pe, 221, 1282, 950, 232, 36, 'ygo-sc', '#0a0a0a', 1.2, 2, false)
  }

  if (model.isLink) {
    for (const ar of ARROW_SEQ) {
      const on = model.linkMarkers.includes(ar.marker)
      drawImg(ctx, `${IMG_BASE}/arrow-${ar.name}-${on ? 'on' : 'off'}.png`, ar.x, ar.y)
    }
  }

  const effTop = 1528
  const effLineH = 44 * 1.2
  let descTop = effTop
  if (isMonster) {
    drawSquished(ctx, monsterTypeLine(model), 109, effTop, 1175, 44, 'ygo-sc', '#0a0a0a', 'left', 1)
    descTop = effTop + effLineH
  }
  let descH = 385
  if (isMonster) { descH -= effLineH; descH -= 60 }
  drawParagraph(ctx, model.effect || '', 109, descTop, 1175, descH, 36, 'ygo-sc', '#0a0a0a', 1.2, 2, true)

  if (isMonster) {
    // 攻守线：优先用 SVG 素材；小程序不可绘 SVG 时用字体文字兜底
    const svgUrl = `${IMG_BASE}/${model.isLink ? 'atk-link' : 'atk-def'}.svg`
    const svgImg = imgOf(svgUrl)
    if (svgImg) {
      drawImg(ctx, svgUrl, 109, 1844, 1174, 52)
    } else {
      ctx.fillStyle = '#0a0a0a'
      ctx.font = `52px ygo-atk-def`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText('ATK/', 700, 1844 + 46)
      if (!model.isLink) ctx.fillText('DEF/', 1000, 1844 + 46)
      else ctx.fillText('LINK-', 1050, 1844 + 46)
    }
    ctx.fillStyle = '#0a0a0a'
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'right'
    const numBase = 1844 + 51.6
    if (model.atk !== null) {
      ctx.font = `62px ygo-atk-def`
      ctx.fillText(statText(model.atk), 999, numBase)
    }
    if (model.isLink) {
      ctx.font = `44px ygo-link`
      const linkN = model.linkMarkers.length || model.level || 0
      ctx.save()
      ctx.translate(1280, numBase)
      ctx.scale(1.3, 1)
      ctx.textAlign = 'right'
      ctx.fillText(String(linkN), 0, 0)
      ctx.restore()
    } else if (model.def !== null) {
      ctx.font = `62px ygo-atk-def`
      ctx.fillText(statText(model.def), 1282, numBase)
    }
  }

  ctx.fillStyle = darkText
  ctx.textBaseline = 'top'
  ctx.font = `40px ygo-password`
  ctx.textAlign = 'left'
  if (model.passcode) ctx.fillText(model.passcode, 66, 1932)
  if (model.setCode) {
    if (pend) {
      ctx.textAlign = 'left'
      ctx.fillText(model.setCode, 116, 1859)
    } else {
      ctx.textAlign = 'right'
      const right = model.isLink ? 252 : 148
      ctx.fillText(model.setCode, BW - right, 1455)
    }
  }
  ctx.textBaseline = 'alphabetic'

  const rare = rareAsset(model)
  if (rare) {
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.globalCompositeOperation = 'screen'
    drawImg(ctx, `${IMG_BASE}/${rare}.png`, 0, 0, BW, BH)
    ctx.restore()
  }

  ctx.fillStyle = model.frame === 'xyz' && isMonster ? 'rgba(255,255,255,.85)' : 'rgba(20,14,8,.8)'
  ctx.font = `30px ygo-sc`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('@游戏王集卡社同人卡', BW - 141, 1936)
  ctx.textBaseline = 'alphabetic'

  ctx.restore()
}

export { RATIO as CARD_RATIO, BW as CARD_BASE_W }
