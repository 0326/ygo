// 显示映射：英文枚举 -> 简中标签 / 配色。移植自 web 端 lib/labels.ts。
import type { Attribute, Frame, CardType, MonsterSubtype, BanStatus } from '../types'

export const ATTR_CN: Record<string, string> = {
  LIGHT: '光', DARK: '暗', WATER: '水', FIRE: '炎',
  EARTH: '地', WIND: '风', DIVINE: '神',
}

export const FRAME_CN: Record<string, string> = {
  normal: '通常', effect: '效果', ritual: '仪式', fusion: '融合',
  synchro: '同调', xyz: '超量', link: '连接', pendulum: '灵摆',
  spell: '魔法', trap: '陷阱', token: '衍生物',
}

// 卡牌类型语义色（列表标签/缩略图边框）
export const FRAME_ACCENT: Record<string, string> = {
  normal: '#e0a94a', effect: '#e0a94a', token: '#e0a94a',
  ritual: '#4b8fe0', fusion: '#9b6fd4', synchro: '#d8d8d8',
  xyz: '#5f6b80', link: '#2f7fd6', spell: '#17b89a', trap: '#d0578f',
}

export const RACE_CN: Record<string, string> = {
  Aqua: '水', Beast: '兽', 'Beast-Warrior': '兽战士', Creator: '创造神',
  'Creator-God': '创造神', Cyberse: '电子界', Dinosaur: '恐龙', 'Divine-Beast': '幻神兽',
  Dragon: '龙', Fairy: '天使', Fiend: '恶魔', Fish: '鱼', Insect: '昆虫',
  Machine: '机械', Plant: '植物', Psychic: '念动力', Pyro: '炎', Reptile: '爬虫类',
  Rock: '岩石', 'Sea Serpent': '海龙', Spellcaster: '魔法师', Thunder: '雷',
  Warrior: '战士', 'Winged Beast': '鸟兽', Wyrm: '幻龙', Zombie: '不死',
  Illusion: '幻想魔',
  Normal: '通常', 'Quick-Play': '速攻', Continuous: '永续', Equip: '装备',
  Field: '场地', Ritual: '仪式', Counter: '反击',
}
export function raceCn(race: string | null): string {
  if (!race) return ''
  return RACE_CN[race] || race
}

export const CARD_TYPE_CN: Record<CardType, string> = {
  monster: '怪兽', spell: '魔法', trap: '陷阱',
}

export const SUBTYPE_CN: Record<MonsterSubtype, string> = {
  tuner: '调整', flip: '反转', gemini: '二重', spirit: '灵魂', union: '同盟', toon: '卡通',
}

export const BAN_CN: Record<BanStatus, string> = { 0: '禁止', 1: '限制', 2: '准限制' }
export const BAN_COLOR: Record<BanStatus, string> = { 0: '#c0392b', 1: '#d97706', 2: '#b8a03a' }
export const BAN_FORMAT_CN: Record<string, string> = { ocg: 'OCG', tcg: 'TCG', md: 'MD' }

export function statStr(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (v < 0) return '?'
  return String(v)
}

// 类型标签文案（列表用）
export function frameLabel(f: Frame): string {
  return FRAME_CN[f] || f
}

export const FRAME_OPTIONS: { value: Frame; label: string }[] = (
  ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'spell', 'trap'] as Frame[]
).map((f) => ({ value: f, label: FRAME_CN[f] }))

export const ATTR_OPTIONS = (
  ['LIGHT', 'DARK', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE'] as Attribute[]
).map((a) => ({ value: a, label: ATTR_CN[a] }))
