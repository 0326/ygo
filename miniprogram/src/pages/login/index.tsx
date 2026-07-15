import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { login } from '../../services/auth'
import './index.scss'

// 平台：编译期常量。微信端展示微信按钮，抖音端展示抖音按钮。
const ENV = process.env.TARO_ENV

export default function Login() {
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(true)

  const doLogin = async () => {
    if (busy) return
    if (!agree) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    setBusy(true)
    try {
      await login()
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/me/index' })), 600)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '登录失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const skip = () => {
    Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/index/index' }))
  }

  return (
    <View className='screen login'>
      <View className='hero'>
        <View className='ring'>
          <View className='disc'><View className='eye' /></View>
        </View>
        <Text className='brand'>决斗者卡查</Text>
        <Text className='slogan'>SEARCH · BUILD · CREATE</Text>
        <View className='perks'>
          <View className='perk'><Text className='perk-i'>★</Text><Text className='perk-t'>云端收藏</Text></View>
          <View className='perk'><Text className='perk-i'>⛊</Text><Text className='perk-t'>卡组同步</Text></View>
          <View className='perk'><Text className='perk-i'>✦</Text><Text className='perk-t'>自制存档</Text></View>
        </View>
      </View>

      <View className='bottom'>
        {ENV === 'tt' ? (
          <View className='btn tt' onClick={doLogin}>
            <Text className='btn-ic tt-ic'>♪</Text>抖音一键登录
          </View>
        ) : (
          <View className='btn wx' onClick={doLogin}>
            <Text className='btn-ic wx-ic'>微</Text>微信一键登录
          </View>
        )}
        <Text className='guest' onClick={skip}>先逛逛，暂不登录 ›</Text>
        <View className='privacy'>
          <View className={`ck ${agree ? 'on' : ''}`} onClick={() => setAgree((v) => !v)}>{agree ? '✓' : ''}</View>
          <Text className='privacy-t'>已阅读并同意《用户协议》与《隐私政策》，仅获取头像昵称用于展示</Text>
        </View>
      </View>
    </View>
  )
}
