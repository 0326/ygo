import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { restoreSession } from './services/auth'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    // 冷启动时从本地缓存恢复登录态（若有 token）
    restoreSession()
  })
  return children
}

export default App
