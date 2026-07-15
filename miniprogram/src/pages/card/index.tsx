import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Button } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import type { CardDetail } from '../../types'
import { getCard, addFavorite, removeFavorite, listFavorites } from '../../services/api'
import { isLoggedIn } from '../../services/auth'
import {
  FRAME_CN, FRAME_ACCENT, ATTR_CN, raceCn, statStr, BAN_CN, BAN_COLOR, BAN_FORMAT_CN,
} from '../../utils/labels'
import { imgUrl } from '../../services/request'
import './index.scss'

export default function CardPage() {
  const router = useRouter()
  const id = router.params.id
  const [card, setCard] = useState<CardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [fav, setFav] = useState(false)
  const [favBusy, setFavBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCard(id)
      .then((c) => { setCard(c); setErr('') })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false))
    if (isLoggedIn()) {
      listFavorites('card').then((r) => setFav(r.items.includes(String(id)))).catch(() => undefined)
    }
  }, [id])

  useShareAppMessage(() => ({
    title: card ? `${card.cn_name} — 决斗者卡查` : '决斗者卡查',
    path: `/pages/card/index?id=${id}`,
  }))

  const toggleFav = async () => {
    if (!id || favBusy) return
    if (!isLoggedIn()) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    setFavBusy(true)
    try {
      if (fav) { await removeFavorite('card', id); setFav(false) }
      else { await addFavorite('card', id); setFav(true) }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '操作失败', icon: 'none' })
    } finally {
      setFavBusy(false)
    }
  }

  const makeSame = () => {
    if (!id) return
    Taro.navigateTo({ url: `/pages/maker/index?prefill=${id}` })
  }

  if (loading) return <View className='screen center'><Text className='dim'>加载中…</Text></View>
  if (err || !card) return (
    <View className='screen center'>
      <Text className='dim'>加载失败：{err || '卡片不存在'}</Text>
    </View>
  )

  const accent = FRAME_ACCENT[card.frame] || '#e0a94a'
  const isMonster = card.card_type === 'monster'
  const badges: string[] = [FRAME_CN[card.frame] || card.frame]
  if (isMonster && card.attribute) badges.push(`${ATTR_CN[card.attribute]}属性`)
  if (isMonster && card.race) badges.push(`${raceCn(card.race)}族`)
  if (isMonster && card.level && !card.link_val) badges.push(`${card.level}★`)
  if (card.link_val) badges.push(`LINK-${card.link_val}`)

  return (
    <View className='screen carddetail'>
      <ScrollView scrollY className='scroll'>
        <View className='hero'>
          <View className='hero-glow' style={{ background: `radial-gradient(closest-side, ${accent}44, transparent 70%)` }} />
          <Image className='hero-img' src={imgUrl(card.thumb_url)} mode='aspectFit' />
        </View>

        <View className='titlebar'>
          <Text className='t-name'>{card.cn_name}</Text>
          <Text className='t-sub'>{[card.jp_name, card.en_name].filter(Boolean).join(' · ')}</Text>
        </View>

        <View className='badges'>
          {badges.map((b, i) => (
            <Text key={i} className={`badge ${i === 0 ? 'badge-gold' : ''}`}>{b}</Text>
          ))}
        </View>

        {isMonster ? (
          <View className='statgrid'>
            <View className='stat'><Text className='stat-b'>{statStr(card.atk)}</Text><Text className='stat-l'>ATK</Text></View>
            <View className='stat'>
              <Text className='stat-b'>{card.link_val ? `L${card.link_val}` : statStr(card.def)}</Text>
              <Text className='stat-l'>{card.link_val ? 'LINK' : 'DEF'}</Text>
            </View>
            <View className='stat'><Text className='stat-b stat-gold'>{card.id}</Text><Text className='stat-l'>PASSWORD</Text></View>
          </View>
        ) : null}

        {card.ban ? (
          <View className='banrow'>
            {Object.entries(card.ban).map(([fmt, st]) => (
              <Text key={fmt} className='ban' style={{ color: BAN_COLOR[st as 0 | 1 | 2], borderColor: BAN_COLOR[st as 0 | 1 | 2] }}>
                {BAN_FORMAT_CN[fmt]} · {BAN_CN[st as 0 | 1 | 2]}
              </Text>
            ))}
          </View>
        ) : null}

        <View className='panel'>
          <Text className='panel-h'>卡片描述</Text>
          <Text className='panel-p'>{card.effect_cn || '（无效果文本）'}</Text>
        </View>

        {card.prints && card.prints.length ? (
          <View className='panel'>
            <Text className='panel-h'>收录卡包 · {card.prints.length} 个版本</Text>
            {card.prints.map((p, i) => (
              <View key={i} className='print'>
                <Text className='print-l'>
                  {p.set_cn_name || p.set_name}
                  {p.rarity ? <Text className='print-r'> {p.rarity}</Text> : null}
                </Text>
                <Text className='print-c'>{p.card_number}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className='foot-space' />
      </ScrollView>

      <View className='actions'>
        <View className='btn ghost' onClick={toggleFav}>
          {fav ? '★ 已收藏' : '☆ 收藏'}
        </View>
        <View className='btn ghost' onClick={makeSame}>✦ 做同款</View>
        <Button className='btn primary' openType='share'>⤴ 分享</Button>
      </View>
    </View>
  )
}
