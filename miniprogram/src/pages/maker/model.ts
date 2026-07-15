import type { Attribute, Frame, LinkMarker, MonsterSubtype } from '../../types'
import type { CardModel } from '../../canvas/renderer'
import type { CanvasImage } from '../../canvas/adapter'
import type { CardDetail } from '../../types'

export interface MakerState {
  cardType: 'monster' | 'spell' | 'trap'
  frame: Frame
  isPendulum: boolean
  isLink: boolean
  name: string
  attribute: Attribute | null
  level: string
  scale: string
  race: string
  subtype: MonsterSubtype | ''
  effect: string
  pendulumEffect: string
  atk: string
  def: string
  passcode: string
  rarity: string
  setCode: string
  linkMarkers: LinkMarker[]
}

export const DEFAULT_STATE: MakerState = {
  cardType: 'monster',
  frame: 'effect',
  isPendulum: false,
  isLink: false,
  name: '无尽的同人创作',
  attribute: 'DARK',
  level: '4',
  scale: '4',
  race: 'Spellcaster',
  subtype: '',
  effect:
    '①：这张卡可以由你随意书写效果。\n②：这是一张由「游戏王集卡社」制卡器生成的同人卡，仅供创作与欣赏，不可用于任何官方比赛。',
  pendulumEffect: '',
  atk: '1800',
  def: '1200',
  passcode: '00000000',
  rarity: '普通',
  setCode: 'HJMK-CN001',
  linkMarkers: [],
}

function parseStat(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  if (t === '?' || t === '？') return -1
  const n = parseInt(t, 10)
  return Number.isNaN(n) ? null : n
}
function parseNum(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isNaN(n) ? null : n
}

export function buildModel(s: MakerState, art: CanvasImage | null): CardModel {
  return {
    frame: s.isLink ? 'link' : s.frame,
    isPendulum: s.cardType === 'monster' && s.isPendulum && !s.isLink,
    cardType: s.cardType,
    name: s.name,
    attribute: s.cardType === 'monster' ? s.attribute : null,
    level: s.cardType === 'monster' && !s.isLink ? parseNum(s.level) : null,
    isRank: s.frame === 'xyz',
    isLink: s.cardType === 'monster' && s.isLink,
    linkMarkers: s.linkMarkers,
    scale: s.isPendulum ? parseNum(s.scale) : null,
    race: s.race,
    subtype: s.cardType === 'monster' ? s.subtype : '',
    effect: s.effect,
    pendulumEffect: s.isPendulum ? s.pendulumEffect : null,
    atk: s.cardType === 'monster' ? parseStat(s.atk) : null,
    def: s.cardType === 'monster' && !s.isLink ? parseStat(s.def) : null,
    passcode: s.passcode,
    rarity: s.rarity,
    setCode: s.setCode,
    artImage: art,
  }
}

// 从卡牌详情预填自制器（做同款）
export function stateFromCard(c: CardDetail): MakerState {
  const isLink = !!c.link_val
  return {
    ...DEFAULT_STATE,
    cardType: c.card_type,
    frame: isLink ? 'link' : c.frame,
    isPendulum: c.scale !== null && c.scale !== undefined,
    isLink,
    name: c.cn_name,
    attribute: c.attribute,
    level: c.level != null ? String(c.level) : '4',
    scale: c.scale != null ? String(c.scale) : '4',
    race: c.race || 'Spellcaster',
    subtype: (c.subtypes && c.subtypes[0]) || '',
    effect: c.effect_cn || '',
    pendulumEffect: c.pendulum_effect_cn || '',
    atk: c.atk != null ? (c.atk < 0 ? '?' : String(c.atk)) : '',
    def: c.def != null ? (c.def < 0 ? '?' : String(c.def)) : '',
    passcode: String(c.id).padStart(8, '0'),
    rarity: '普通',
    setCode: (c.prints && c.prints[0]?.card_number) || 'HJMK-CN001',
    linkMarkers: c.link_markers || [],
  }
}
