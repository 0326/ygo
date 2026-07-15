import { View, Text, Image } from '@tarojs/components'
import type { CardSummary } from '../types'
import { FRAME_CN, FRAME_ACCENT, raceCn, ATTR_CN, statStr } from '../utils/labels'
import { imgUrl } from '../services/request'
import './CardThumb.scss'

export function CardThumb({ card, onClick }: { card: CardSummary; onClick?: () => void }) {
  const accent = FRAME_ACCENT[card.frame] || '#e0a94a'
  const typeCn = FRAME_CN[card.frame] || card.frame
  const isMonster = card.card_type === 'monster'
  const stars = card.level && isMonster && !card.link_val ? '★'.repeat(Math.min(card.level, 12)) : ''
  const metaBits: string[] = []
  if (isMonster) {
    if (card.attribute) metaBits.push(ATTR_CN[card.attribute] || card.attribute)
    if (card.race) metaBits.push(raceCn(card.race))
  } else {
    metaBits.push(raceCn(card.race) ? `${raceCn(card.race)}${card.card_type === 'spell' ? '魔法' : '陷阱'}` : typeCn)
  }

  return (
    <View className='cardthumb' style={{ '--accent': accent } as React.CSSProperties} onClick={onClick}>
      <View className='ct-thumb' style={{ borderColor: accent }}>
        {card.thumb_url ? (
          <Image className='ct-img' src={imgUrl(card.thumb_url)} mode='aspectFill' lazyLoad />
        ) : null}
      </View>
      <View className='ct-info'>
        <View className='ct-name-row'>
          <Text className='ct-name'>{card.cn_name}</Text>
          {card.jp_name ? <Text className='ct-jp'>{card.jp_name}</Text> : null}
        </View>
        <View className='ct-meta'>
          <Text className='ct-tag' style={{ color: accent, background: `${accent}22` }}>{typeCn}</Text>
          {metaBits.length ? <Text className='ct-metatext'>{metaBits.join(' · ')}</Text> : null}
          {stars ? <Text className='ct-stars'>{stars}</Text> : null}
        </View>
        <Text className='ct-sub'>
          {isMonster && !card.link_val
            ? `ATK ${statStr(card.atk)} / DEF ${statStr(card.def)}`
            : isMonster
              ? `ATK ${statStr(card.atk)} / LINK-${card.link_val}`
              : `密码 ${card.id}`}
        </Text>
      </View>
    </View>
  )
}
