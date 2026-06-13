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

export interface CardSummary {
  id: number;
  cn_name: string;
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

export interface SetSummary {
  code: string;
  cn_name: string;
  en_name: string;
  release_date: number | null;
  card_count: number;
}
