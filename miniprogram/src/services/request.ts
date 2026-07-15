import Taro from '@tarojs/taro'

// 编译期注入（config/index.ts defineConstants）。H5 为空串走 devServer 代理的相对路径；
// 小程序为绝对域名。运行时兜底：defineConstants 未命中时用空串。
declare const YGO_API_BASE: string
export const API_BASE: string = (() => {
  try {
    return typeof YGO_API_BASE !== 'undefined' ? YGO_API_BASE : ''
  } catch {
    return ''
  }
})()

const TOKEN_KEY = 'ygo_token'

export function getToken(): string {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}
export function setToken(t: string): void {
  try {
    if (t) Taro.setStorageSync(TOKEN_KEY, t)
    else Taro.removeStorageSync(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface ReqOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown> | undefined
  auth?: boolean
}

export async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const { method = 'GET', data, auth = true } = opts
  const header: Record<string, string> = { accept: 'application/json' }
  if (data !== undefined) header['content-type'] = 'application/json'
  // 小程序无 Cookie 机制，鉴权改用 Bearer token（后端需支持 Authorization 头，见 worker 适配说明）
  if (auth) {
    const tk = getToken()
    if (tk) header['authorization'] = `Bearer ${tk}`
  }

  const res = await Taro.request({
    url: `${API_BASE}${path}`,
    method,
    header,
    data,
  })

  const status = res.statusCode
  const body = res.data as T & { error?: string; token?: string }
  if (status < 200 || status >= 300) {
    const msg = (body && body.error) || `请求失败 (${status})`
    throw new Error(msg)
  }
  return body
}

// 拼查询串
export function qs(params: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

// 站内图片地址：小程序需绝对 URL；H5 走代理用相对路径
export function imgUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return `${API_BASE}${pathOrUrl}`
}
