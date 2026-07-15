import Taro from '@tarojs/taro'
import type { AuthUser } from '../types'
import { getToken, setToken } from './request'
import { mpLogin, authMe } from './api'

// 极简全局登录态：订阅式，无需引入状态库。
let currentUser: AuthUser | null = null
const listeners = new Set<(u: AuthUser | null) => void>()

export function getUser(): AuthUser | null {
  return currentUser
}
export function isLoggedIn(): boolean {
  return !!currentUser && !!getToken()
}
export function subscribe(fn: (u: AuthUser | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit() {
  for (const fn of listeners) fn(currentUser)
}
function setUser(u: AuthUser | null) {
  currentUser = u
  emit()
}

// 冷启动：有 token 则拉取 /me 恢复用户信息
export async function restoreSession(): Promise<void> {
  if (!getToken()) return
  try {
    const { user } = await authMe()
    setUser(user)
  } catch {
    // token 失效
    setToken('')
    setUser(null)
  }
}

// 取平台侧登录 code。weapp/tt 走 Taro.login；H5 验证用 dev mock。
async function getLoginCode(): Promise<string> {
  if (process.env.TARO_ENV === 'h5') {
    return 'H5_DEV_CODE'
  }
  const res = await Taro.login()
  if (!res.code) throw new Error('未获取到登录凭证')
  return res.code
}

function platform(): 'weapp' | 'tt' {
  return process.env.TARO_ENV === 'tt' ? 'tt' : 'weapp'
}

// 一键登录：换 code → 后端换 openid → 返回 token+user
export async function login(): Promise<AuthUser> {
  const code = await getLoginCode()
  const { user, token } = await mpLogin(platform(), code)
  setToken(token)
  setUser(user)
  return user
}

export function logout(): void {
  setToken('')
  setUser(null)
}
