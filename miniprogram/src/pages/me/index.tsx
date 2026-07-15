import { useEffect, useState, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import type { CardSummary } from '../../types'
import { listFavorites, cardsByIds } from '../../services/api'
import { logout } from '../../services/auth'
import { useAuth } from '../../utils/useAuth'
import { FRAME_ACCENT } from '../../utils/labels'
import { imgUrl } from '../../services/request'
import './index.scss'

export default function Me() {
  const user = useAuth()
  const [favCards, setFavCards] = useState<CardSummary[]>([])
  const [loading, setLoading] = useState(false)

  const loadFavs = useCallback(async () => {
    if (!user) { setFavCards([]); return }
    setLoading(true)
    try {
      const { items } = await listFavorites('card')
      if (!items.length) { setFavCards([]); return }
      const { items: cards } = await cardsByIds(items.slice(0, 30))
      setFavCards(cards)
    } catch {
      setFavCards([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadFavs() }, [loadFavs])
  useDidShow(() => { loadFavs() })

  const goLogin = () => Taro.navigateTo({ url: '/pages/login/index' })
  const openCard = (id: number) => Taro.navigateTo({ url: `/pages/card/index?id=${id}` })
  const doLogout = () => { logout(); setFavCards([]) }

  if (!user) {
    return (
      <View className='screen me'>
        <View className='guest-card'>
          <View className='avatar guest-av'>🎴</View>
          <Text className='guest-t'>登录后同步你的收藏与自制卡</Text>
          <View className='login-btn' onClick={goLogin}>一键登录</View>
        </View>
      </View>
    )
  }

  return (
    <View className='screen me'>
      <View className='user'>
        <View className='avatar'>🐉</View>
        <View className='uinfo'>
          <View className='uname-row'>
            <Text className='uname'>{user.username}</Text>
            <Text className='lv-badge'>{user.role === 'admin' ? '管理员' : '决斗者'}</Text>
          </View>
          <Text className='usub'>{process.env.TARO_ENV === 'tt' ? '抖音' : '微信'}登录 · ID {user.id}</Text>
        </View>
        <Text className='logout' onClick={doLogout}>退出</Text>
      </View>

      <View className='stats'>
        <View className='st'><Text className='st-b'>{favCards.length}</Text><Text className='st-l'>收藏卡牌</Text></View>
        <View className='st'><Text className='st-b'>0</Text><Text className='st-l'>我的卡组</Text></View>
        <View className='st'><Text className='st-b'>0</Text><Text className='st-l'>自制卡</Text></View>
      </View>

      <View className='segbar'><View className='seg on'>收藏卡牌</View></View>

      {loading ? (
        <View className='empty'><Text className='dim'>加载中…</Text></View>
      ) : favCards.length === 0 ? (
        <View className='empty'><Text className='dim'>还没有收藏，去查卡页收藏喜欢的卡片吧</Text></View>
      ) : (
        <View className='grid'>
          {favCards.map((c) => (
            <View key={c.id} className='gcard' onClick={() => openCard(c.id)}>
              <View className='g-img' style={{ borderColor: FRAME_ACCENT[c.frame] || '#e0a94a' }}>
                {c.thumb_url ? <Image className='g-imgel' src={imgUrl(c.thumb_url)} mode='aspectFill' lazyLoad /> : null}
                <Text className='g-star'>★</Text>
              </View>
              <Text className='g-name'>{c.cn_name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
