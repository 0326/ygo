// 显示映射：英文枚举 -> 简中标签 / 配色。全站只读复用（M0.4）。
import type { Attribute, Frame, CardType, MonsterSubtype, BanStatus } from "../../shared/types";

export const ATTR_CN: Record<string, string> = {
  LIGHT: "光", DARK: "暗", WATER: "水", FIRE: "炎",
  EARTH: "地", WIND: "风", DIVINE: "神",
};
export const ATTR_COLOR: Record<string, string> = {
  LIGHT: "#d9c25a", DARK: "#9b5fc0", WATER: "#3f8fd0",
  FIRE: "#d0533f", EARTH: "#a07b53", WIND: "#4caf82", DIVINE: "#c9a13b",
};

export const FRAME_CN: Record<string, string> = {
  normal: "通常", effect: "效果", ritual: "仪式", fusion: "融合",
  synchro: "同调", xyz: "超量", link: "连接", pendulum: "灵摆",
  spell: "魔法", trap: "陷阱", token: "衍生物",
};

// 卡框主色（视觉基盘：配色按卡框色系延展）
export const FRAME_COLOR: Record<string, { base: string; glow: string; text: string }> = {
  normal:  { base: "#c9a86a", glow: "#e8cf94", text: "#3a2e15" },
  effect:  { base: "#b05a2b", glow: "#e08a4e", text: "#fff" },
  ritual:  { base: "#4a73b5", glow: "#7aa0dd", text: "#fff" },
  fusion:  { base: "#8a5bb0", glow: "#b487d8", text: "#fff" },
  synchro: { base: "#d8d8d8", glow: "#ffffff", text: "#2a2a2a" },
  xyz:     { base: "#2a2a2a", glow: "#6a6a6a", text: "#fff" },
  link:    { base: "#26607d", glow: "#3fa0c8", text: "#fff" },
  pendulum:{ base: "#3aa17c", glow: "#5fd0a6", text: "#fff" },
  spell:   { base: "#1d9b8a", glow: "#3fd0bc", text: "#fff" },
  trap:    { base: "#b03a7a", glow: "#e066a4", text: "#fff" },
  token:   { base: "#9a9a9a", glow: "#c4c4c4", text: "#222" },
};

export function frameColor(frame: string, isPendulum = false) {
  return FRAME_COLOR[isPendulum ? "pendulum" : frame] || FRAME_COLOR.effect;
}

// 种族中文（魔法/陷阱的 race 复用其类型）
export const RACE_CN: Record<string, string> = {
  Aqua: "水", Beast: "兽", "Beast-Warrior": "兽战士", Creator: "创造神",
  "Creator-God": "创造神", Cyberse: "电子界", Dinosaur: "恐龙", "Divine-Beast": "幻神兽",
  Dragon: "龙", Fairy: "天使", Fiend: "恶魔", Fish: "鱼", Insect: "昆虫",
  Machine: "机械", Plant: "植物", Psychic: "念动力", Pyro: "炎", Reptile: "爬虫类",
  Rock: "岩石", "Sea Serpent": "海龙", Spellcaster: "魔法师", Thunder: "雷",
  Warrior: "战士", "Winged Beast": "鸟兽", Wyrm: "幻龙", Zombie: "不死",
  Illusion: "幻想魔",
  // 魔法
  Normal: "通常", "Quick-Play": "速攻", Continuous: "永续", Equip: "装备",
  Field: "场地", Ritual: "仪式", Counter: "反击",
};
export function raceCn(race: string | null): string {
  if (!race) return "";
  return RACE_CN[race] || race;
}

export const CARD_TYPE_CN: Record<CardType, string> = {
  monster: "怪兽", spell: "魔法", trap: "陷阱",
};

// 怪兽子类型 → 简中
export const SUBTYPE_CN: Record<MonsterSubtype, string> = {
  tuner: "调整", flip: "反转", gemini: "二重", spirit: "灵魂", union: "同盟", toon: "卡通",
};
export const SUBTYPE_OPTIONS: { value: MonsterSubtype; label: string }[] =
  (["tuner", "flip", "gemini", "spirit", "union", "toon"] as MonsterSubtype[])
    .map((v) => ({ value: v, label: SUBTYPE_CN[v] }));

// 魔法/陷阱子类型（对应 race 字段的英文 key）
export const ST_SUBTYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "Normal", label: "通常" },
  { value: "Quick-Play", label: "速攻" },
  { value: "Continuous", label: "永续" },
  { value: "Equip", label: "装备" },
  { value: "Field", label: "场地" },
  { value: "Ritual", label: "仪式" },
  { value: "Counter", label: "反击" },
];

// 禁限：状态 → 标签 / 配色
export const BAN_CN: Record<BanStatus, string> = { 0: "禁止", 1: "限制", 2: "准限制" };
export const BAN_LIMIT: Record<BanStatus, number> = { 0: 0, 1: 1, 2: 2 };
export const BAN_COLOR: Record<BanStatus, string> = { 0: "#c0392b", 1: "#d97706", 2: "#b8a03a" };
export const BAN_FORMAT_CN: Record<string, string> = { ocg: "OCG", tcg: "TCG", md: "MD" };

// Master Duel 罕贵：代号 → 标签 / 配色
export const MD_RARITY_CN: Record<string, string> = { N: "普卡", R: "银", SR: "金", UR: "彩" };
export const MD_RARITY_COLOR: Record<string, string> = {
  N: "#9aa0a6", R: "#9fb3c8", SR: "#d4af37", UR: "#c084fc",
};
export const MD_RARITY_OPTIONS = (["UR", "SR", "R", "N"] as const).map((v) => ({ value: v, label: `MD ${v}` }));

// atk/def 显示：-1 表示 ?
export function statStr(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v < 0) return "?";
  return String(v);
}

export const FRAME_OPTIONS: { value: Frame; label: string }[] = (
  ["normal","effect","ritual","fusion","synchro","xyz","link","spell","trap"] as Frame[]
).map((f) => ({ value: f, label: FRAME_CN[f] }));

export const ATTR_OPTIONS = (
  ["LIGHT","DARK","WATER","FIRE","EARTH","WIND","DIVINE"] as Attribute[]
).map((a) => ({ value: a, label: ATTR_CN[a] }));
