// API 客户端：只读检索复用 web 端契约；账号/收藏走 Bearer token。
import type {
  SearchResponse, CardDetail, Artwork, ArchetypeSummary,
  CardSummary, Lang, AuthUser, FavKind,
} from '../types'
import { request, qs } from './request'

export interface SearchParams {
  q?: string; frame?: string; attribute?: string; race?: string
  level?: string; archetype?: string; type?: string
  atk_min?: string; atk_max?: string
  link?: string; subtype?: string
  format?: string; lang?: Lang
  sort?: string; page?: number; size?: number
}

export function searchCards(p: SearchParams): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/search${qs(p as Record<string, unknown>)}`, { auth: false })
}

export const getCard = (id: number | string) =>
  request<CardDetail>(`/api/cards/${id}`, { auth: false })
export const getArtworks = (id: number | string) =>
  request<Artwork[]>(`/api/cards/${id}/artworks`, { auth: false })
export const listArchetypes = (min = 6) =>
  request<ArchetypeSummary[]>(`/api/archetypes?min=${min}`, { auth: false })
export const getStats = () =>
  request<{ cards: number; archetypes: number; artworks: number; sets: number }>(`/api/stats`, { auth: false })
export const cardsByIds = (ids: (string | number)[]) =>
  request<{ items: CardSummary[] }>(`/api/cards?ids=${ids.join(',')}`, { auth: false })

// ---------------- 账号（小程序一键登录，走 code 换 token） ----------------
// 后端需新增 /api/auth/mp 端点：接收 { platform, code }，用微信/抖音服务端换 openid，
// 建立/关联账号并返回 { user, token }。此处按契约调用。
export const mpLogin = (platform: 'weapp' | 'tt', code: string) =>
  request<{ user: AuthUser; token: string }>(`/api/auth/mp`, {
    method: 'POST', data: { platform, code }, auth: false,
  })
export const authMe = () => request<{ user: AuthUser }>(`/api/auth/me`)

// ---------------- 收藏 ----------------
export const listFavorites = (kind: FavKind) =>
  request<{ items: string[] }>(`/api/me/favorites?kind=${kind}`)
export const addFavorite = (kind: FavKind, ref: string | number) =>
  request<{ ok: true }>(`/api/me/favorites/${kind}/${encodeURIComponent(String(ref))}`, { method: 'PUT' })
export const removeFavorite = (kind: FavKind, ref: string | number) =>
  request<{ ok: true }>(`/api/me/favorites/${kind}/${encodeURIComponent(String(ref))}`, { method: 'DELETE' })
