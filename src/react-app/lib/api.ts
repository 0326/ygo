// 前端 API 客户端（只读消费 M0.3 契约）。
import type {
  SearchResponse, CardDetail, Artwork, ArchetypeSummary,
  CardSummary, SetSummary,
  WallpaperItem, WallpaperListResponse, WallpaperTagCount, Lang,
} from "../../shared/types";

export type {
  SearchResponse, CardDetail, Artwork, ArchetypeSummary,
  CardSummary, SetSummary,
  WallpaperItem, WallpaperListResponse, WallpaperTagCount,
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
  format?: string;
  lang?: Lang;
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

// ---------------- M9 壁纸 ----------------
export interface WallpaperParams {
  q?: string; device?: string; category?: string; tag?: string;
  ids?: string;
  sort?: string; page?: number; size?: number;
}

export function listWallpapers(p: WallpaperParams): Promise<WallpaperListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return get<WallpaperListResponse>(`/api/wallpapers?${qs.toString()}`);
}

export const listWallpaperTags = () => get<WallpaperTagCount[]>(`/api/wallpapers/tags`);

// ---------------- M10 账号体系 ----------------
import type { AuthUser, FavKind, UserDeck, AdminUserRow, FeedbackItem, FeedbackListResponse, FeedbackCategory } from "../../shared/types";
export type { AuthUser, FavKind, UserDeck, AdminUserRow, FeedbackItem, FeedbackListResponse, FeedbackCategory };

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

// M11 注册防垃圾：honeypot(website) + 表单渲染时间戳 t
export const authRegister = (username: string, password: string, opts?: { website?: string; t?: number }) =>
  send<{ user: AuthUser }>("/api/auth/register", "POST", { username, password, website: opts?.website, t: opts?.t });
export const authLogin = (username: string, password: string) =>
  send<{ user: AuthUser }>("/api/auth/login", "POST", { username, password });
export const authLogout = () => send<{ ok: true }>("/api/auth/logout", "POST");
export const authMe = () => get<{ user: AuthUser }>("/api/auth/me");

export const listFavorites = (kind: FavKind) => get<{ items: string[] }>(`/api/me/favorites?kind=${kind}`);
export const addFavorite = (kind: FavKind, ref: string | number) =>
  send<{ ok: true }>(`/api/me/favorites/${kind}/${encodeURIComponent(String(ref))}`, "PUT");
export const removeFavorite = (kind: FavKind, ref: string | number) =>
  send<{ ok: true }>(`/api/me/favorites/${kind}/${encodeURIComponent(String(ref))}`, "DELETE");

export const listMyDecks = () => get<{ items: UserDeck[] }>("/api/me/decks");
export const saveMyDeck = (d: { id?: number; name: string; deck_code: string; format: string }) =>
  send<{ id: number }>("/api/me/decks", "POST", d);
export const deleteMyDeck = (id: number) => send<{ ok: true }>(`/api/me/decks/${id}`, "DELETE");

export const cardsByIds = (ids: (string | number)[]) =>
  get<{ items: CardSummary[] }>(`/api/cards?ids=${ids.join(",")}`);

export const adminListUsers = () => get<{ items: AdminUserRow[] }>("/api/admin/users");
export const adminCreateWallpaper = (w: Record<string, unknown>) =>
  send<{ id: string }>("/api/admin/wallpapers", "POST", w);
export const adminUpdateWallpaper = (id: string, w: Record<string, unknown>) =>
  send<{ ok: true }>(`/api/admin/wallpapers/${encodeURIComponent(id)}`, "PUT", w);
export const adminDeleteWallpaper = (id: string) =>
  send<{ ok: true }>(`/api/admin/wallpapers/${encodeURIComponent(id)}`, "DELETE");

// ---------------- M11 反馈建议 ----------------
export const listFeedback = (page = 1, size = 20) =>
  get<FeedbackListResponse>(`/api/feedback?page=${page}&size=${size}`);
export const submitFeedback = (category: FeedbackCategory, content: string) =>
  send<{ id: number }>("/api/feedback", "POST", { category, content });
export const adminUpdateFeedback = (id: number, patch: { reply?: string; status?: "open" | "resolved" }) =>
  send<{ ok: true }>(`/api/admin/feedback/${id}`, "PUT", patch);
