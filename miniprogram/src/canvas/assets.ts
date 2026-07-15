import { API_BASE } from '../services/request'

// 卡框/图标/字体素材根地址。
// - H5 验证：走 devServer 代理的 /cardgen（映射到本地 vite 的 public/cardgen）。
// - 小程序：必须是已备案 HTTPS 域名（配 downloadFile 合法域名），托管 public/cardgen 内容。
export const CARDGEN_BASE: string =
  process.env.TARO_ENV === 'h5' ? '/cardgen' : `${API_BASE}/cardgen`

export const IMG_BASE = `${CARDGEN_BASE}/image`
export const FONT_BASE = `${CARDGEN_BASE}/font`

export const FONT_FACES: [string, string][] = [
  ['ygo-sc', 'ygo-sc.woff2'],
  ['ygo-atk-def', 'ygo-atk-def.woff2'],
  ['ygo-link', 'ygo-link.woff2'],
  ['ygo-password', 'ygo-password.woff2'],
]
