// 共享契约类型（4.2）。M1/M2 前端与 Worker API 均只读消费此文件。
// 任何变更必须回到 M0 统一修改。

export type CardType = "monster" | "spell" | "trap";
export type Frame =
  | "normal" | "effect" | "ritual" | "fusion" | "synchro"
  | "xyz" | "link" | "spell" | "trap" | "token";
export type Attribute =
  | "LIGHT" | "DARK" | "WATER" | "FIRE" | "EARTH" | "WIND" | "DIVINE";
export type LinkMarker =
  | "top-left" | "top" | "top-right" | "left" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

// 禁限：赛制 + 状态（0=禁止 1=限制 2=准限制；不入表即无限制=3张）
export type BanFormat = "ocg" | "tcg" | "md";
export type BanStatus = 0 | 1 | 2;
export type BanInfo = Partial<Record<BanFormat, BanStatus>>;

// 怪兽子类型（typeline 中的能力位，灵摆由 scale 判定，故不含 pendulum）
export type MonsterSubtype =
  | "tuner" | "flip" | "gemini" | "spirit" | "union" | "toon";

// Master Duel 罕贵代号
export type MdRarity = "N" | "R" | "SR" | "UR";

// 界面/资料语言（M7 多语言）
export type Lang = "cn" | "jp" | "en";

export interface CardSummary {
  id: number;
  cn_name: string;
  jp_name: string | null;
  en_name: string;
  card_type: CardType;
  frame: Frame;
  attribute: Attribute | null;
  level: number | null;      // 星 / 阶(rank)
  link_val: number | null;
  link_markers: LinkMarker[] | null;
  scale: number | null;      // 灵摆刻度(非空即灵摆卡)
  atk: number | null;        // -1 表示 ?
  def: number | null;        // -1 表示 ?
  race: string | null;
  subtypes: MonsterSubtype[] | null;  // 调整/反转/灵魂/同盟/二重/卡通
  ban: BanInfo | null;                // 各赛制禁限状态（无则不入表）
  md_rarity: MdRarity | null;         // Master Duel 罕贵（来源 ygoprodeck）
  formats: BanFormat[] | null;        // 赛制归属 ocg/tcg/md（M7，来源 ygoprodeck misc_info）
  thumb_url: string;
}

export interface Artwork {
  image_key: string;
  url: string;
  thumb_url: string;
  is_default: boolean;
  variant_name: string | null;
}

export interface Print {
  set_code: string;
  set_name: string;
  rarity: string | null;
  card_number: string;
  release_date: number | null;
}

export interface ArchetypeRef {
  id: number;
  cn_name: string;
  en_name: string;
}

export interface CardDetail extends CardSummary {
  effect_cn: string;
  pendulum_effect_cn: string | null;  // 灵摆效果（仅灵摆卡，与怪兽效果分开）
  effect_jp: string | null;           // 日文效果（M7）
  pendulum_effect_jp: string | null;
  effect_en: string | null;           // 英文效果（M7）
  pendulum_effect_en: string | null;
  artworks: Artwork[];
  prints: Print[];
  archetype: ArchetypeRef | null;
  related: CardSummary[];
}

export interface SearchResponse {
  total: number;
  page: number;
  size: number;
  items: CardSummary[];
}

export interface ArchetypeSummary {
  id: number;
  cn_name: string;
  en_name: string;
  card_count: number;
  cover_thumb_url: string | null;
  cover_card_id: number | null;
}

// ---------------- M9 壁纸模块 ----------------
export type WallpaperDevice = "pc" | "mobile";
export type WallpaperCategory = "wallpaper" | "artwork" | "character";

export interface WallpaperItem {
  id: string;
  title: string;
  tags: string[];
  category: WallpaperCategory;
  device: WallpaperDevice;
  width: number;
  height: number;
  ratio: number;
  file_type: string | null;
  file_size: number | null;
  colors: string[];
  favorites: number;
  source: string | null;
  source_url: string | null;
  url: string;        // 原图（站内代理地址）
  thumb_url: string;  // 缩略图（站内代理地址）
}

export interface WallpaperListResponse {
  total: number;
  page: number;
  size: number;
  items: WallpaperItem[];
}

export interface WallpaperTagCount {
  tag: string;
  count: number;
}

export interface SetSummary {
  code: string;
  cn_name: string;
  en_name: string;
  release_date: number | null;
  card_count: number;
  cover_thumb_url?: string | null;
}
