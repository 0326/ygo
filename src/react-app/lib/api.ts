// 前端 API 客户端（只读消费 M0.3 契约）。
import type {
  SearchResponse, CardDetail, Artwork, ArchetypeSummary,
  CardSummary, SetSummary,
} from "../../shared/types";

export type {
  SearchResponse, CardDetail, Artwork, ArchetypeSummary,
  CardSummary, SetSummary,
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export interface SearchParams {
  q?: string; frame?: string; attribute?: string; race?: string;
  level?: string; archetype?: string; type?: string;
  level_min?: string; level_max?: string;
  atk_min?: string; atk_max?: string; def_min?: string; def_max?: string;
  link?: string; scale?: string; subtype?: string; md_rarity?: string;
  sort?: string; page?: number; size?: number;
}

export function searchCards(p: SearchParams): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return get<SearchResponse>(`/api/search?${qs.toString()}`);
}

export const getCard = (id: number | string) => get<CardDetail>(`/api/cards/${id}`);
export const getArtworks = (id: number | string) => get<Artwork[]>(`/api/cards/${id}/artworks`);
export const listArchetypes = (min = 6) => get<ArchetypeSummary[]>(`/api/archetypes?min=${min}`);
export const getArchetype = (id: number | string) =>
  get<{ archetype: ArchetypeSummary; cards: CardSummary[] }>(`/api/archetypes/${id}`);
export const listSets = () => get<SetSummary[]>(`/api/sets`);
export const getSet = (code: string) =>
  get<{ set: SetSummary; cards: CardSummary[] }>(`/api/sets/${code}`);
export const getStats = () =>
  get<{ cards: number; archetypes: number; artworks: number; sets: number }>(`/api/stats`);
