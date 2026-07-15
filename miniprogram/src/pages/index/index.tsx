import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { CardSummary, Frame } from '../../types'
import { searchCards } from '../../services/api'
import { CardThumb } from '../../components/CardThumb'
import './index.scss'

const FILTERS: { key: string; label: string; type?: string; frame?: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'monster', label: '怪兽', type: 'monster' },
  { key: 'spell', label: '魔法', type: 'spell' },
  { key: 'trap', label: '陷阱', type: 'trap' },
]

const HOT: { q: string; label: string; note: string }[] = [
  { q: '青眼', label: '青眼', note: '传说之龙' },
  { q: '黑魔术', label: '黑魔术', note: '经典法师' },
  { q: '灰流丽', label: '灰流丽', note: '手坑' },
  { q: '真红眼', label: '真红眼', note: '黑龙' },
]

export default function Index() {
  const [kw, setKw] = useState('')
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState<CardSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const reqSeq = useRef(0)

  const runSearch = useCallback(async (q: string, f: string) => {
    const seq = ++reqSeq.current
    setLoading(true)
    setErr('')
    try {
      const params: Record<string, string | number> = { size: 30, sort: 'name' }
      if (q) params.q = q
      const ff = FILTERS.find((x) => x.key === f)
      if (ff?.type) params.type = ff.type
      const res = await searchCards(params)
      if (seq !== reqSeq.current) return
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      if (seq !== reqSeq.current) return
      setErr((e as Error).message || '检索失败')
      setItems([])
      setTotal(0)
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    runSearch('', 'all')
  }, [runSearch])

  const onFilter = (f: string) => {
    setFilter(f)
    runSearch(kw, f)
  }
  const onSubmit = () => runSearch(kw, filter)
  const onHot = (q: string) => {
    setKw(q)
    setFilter('all')
    runSearch(q, 'all')
  }
  const openCard = (id: number) => {
    Taro.navigateTo({ url: `/pages/card/index?id=${id}` })
  }

  return (
    <View className='screen home'>
      <View className='brand'>
        决斗者卡查<Text className='brand-en'>DUEL DB</Text>
      </View>

      <View className='search'>
        <Text className='search-ic'>⌕</Text>
        <Input
          className='search-input'
          value={kw}
          placeholder='搜索卡名 / 卡密 / 效果文本'
          placeholderClass='search-ph'
          confirmType='search'
          onInput={(e) => setKw(e.detail.value)}
          onConfirm={onSubmit}
        />
        <Text className='search-go' onClick={onSubmit}>检索</Text>
      </View>

      <ScrollView scrollX className='chips'>
        {FILTERS.map((f) => (
          <View
            key={f.key}
            className={`chip ${filter === f.key ? 'chip-on' : ''}`}
            onClick={() => onFilter(f.key)}
          >
            {f.label}
          </View>
        ))}
      </ScrollView>

      <View className='sect'><Text className='sect-t'>热门系列</Text></View>
      <ScrollView scrollX className='hot'>
        {HOT.map((h) => (
          <View key={h.q} className='hot-item' onClick={() => onHot(h.q)}>
            <Text className='hot-b'>{h.label}</Text>
            <Text className='hot-n'>{h.note}</Text>
          </View>
        ))}
      </ScrollView>

      <View className='sect'>
        <Text className='sect-t'>检索结果</Text>
        <Text className='sect-a'>{loading ? '检索中…' : `${total} 张`}</Text>
      </View>

      {err ? (
        <View className='state'>
          <Text className='state-t'>加载失败：{err}</Text>
          <View className='retry' onClick={onSubmit}>重试</View>
        </View>
      ) : null}

      {!err && !loading && items.length === 0 ? (
        <View className='state'><Text className='state-t'>没有匹配的卡片</Text></View>
      ) : null}

      <View className='list'>
        {items.map((c) => (
          <CardThumb key={c.id} card={c} onClick={() => openCard(c.id)} />
        ))}
      </View>
    </View>
  )
}
