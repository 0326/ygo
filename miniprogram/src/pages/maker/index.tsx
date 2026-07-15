import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Input, Textarea, Canvas, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import type { Attribute, Frame } from '../../types'
import { getCard } from '../../services/api'
import { preloadCardAssets, renderCardSync, CARD_RATIO } from '../../canvas/renderer'
import { createImage, saveCanvasToAlbum, type CanvasImage, type CanvasLike } from '../../canvas/adapter'
import { ATTR_CN } from '../../utils/labels'
import { MakerState, DEFAULT_STATE, buildModel, stateFromCard } from './model'
import './index.scss'

const CARD_TYPES: { key: MakerState['cardType']; label: string }[] = [
  { key: 'monster', label: '怪兽' },
  { key: 'spell', label: '魔法' },
  { key: 'trap', label: '陷阱' },
]
const FRAMES: { key: Frame; label: string }[] = [
  { key: 'normal', label: '通常' },
  { key: 'effect', label: '效果' },
  { key: 'ritual', label: '仪式' },
  { key: 'fusion', label: '融合' },
  { key: 'synchro', label: '同调' },
  { key: 'xyz', label: '超量' },
]
const ATTRS: Attribute[] = ['LIGHT', 'DARK', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE']
const CANVAS_ID = 'cardCanvas'
const CSS_W = 320 // rpx→px 后的逻辑宽度基准（px）

function queryCanvasOnce(): Promise<CanvasLike | null> {
  return new Promise((resolve) => {
    if (process.env.TARO_ENV === 'h5') {
      const el = (document.querySelector(`#${CANVAS_ID} canvas`) ||
        document.querySelector(`canvas`)) as unknown as CanvasLike | null
      resolve(el)
      return
    }
    Taro.createSelectorQuery()
      .select(`#${CANVAS_ID}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && (res[0] as { node?: CanvasLike }).node
        resolve(node || null)
      })
  })
}

// 跨端获取 canvas 节点：canvas 挂载可能晚于首帧，轮询重试直到就绪
async function getCanvasNode(retries = 20, gap = 100): Promise<CanvasLike> {
  for (let i = 0; i < retries; i++) {
    const node = await queryCanvasOnce()
    if (node) return node
    await new Promise((r) => setTimeout(r, gap))
  }
  throw new Error('canvas not found')
}

export default function Maker() {
  const router = useRouter()
  const [state, setState] = useState<MakerState>(DEFAULT_STATE)
  const [art, setArt] = useState<CanvasImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const canvasReady = useRef(false)
  const seq = useRef(0)

  const set = useCallback(<K extends keyof MakerState>(k: K, v: MakerState[K]) => {
    setState((s) => ({ ...s, [k]: v }))
  }, [])

  // 预填（做同款）
  useEffect(() => {
    const pid = router.params.prefill
    if (!pid) return
    setLoading(true)
    getCard(pid)
      .then((c) => setState(stateFromCard(c)))
      .catch(() => Taro.showToast({ title: '预填失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [router.params.prefill])

  // 重绘
  const redraw = useCallback(async () => {
    const mySeq = ++seq.current
    let canvas: CanvasLike
    try {
      canvas = await getCanvasNode()
    } catch {
      return
    }
    const model = buildModel(state, art)
    try {
      await preloadCardAssets(canvas, model)
    } catch {
      return
    }
    if (mySeq !== seq.current) return
    const dpr = process.env.TARO_ENV === 'h5' ? Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2) : (Taro.getSystemInfoSync().pixelRatio || 2)
    const pxW = CSS_W
    canvas.width = Math.round(pxW * dpr)
    canvas.height = Math.round(pxW * CARD_RATIO * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)
    renderCardSync(ctx, model, { width: pxW })
    ctx.restore()
    canvasReady.current = true
    // H5：内嵌浏览器对定时器中绘制的 canvas 不总是立即合成上屏，轻推 opacity 触发合成。
    // 注：极少数内嵌 webview 仍需用户首次交互才上屏，属预览环境特性；小程序原生渲染管线无此问题。
    if (process.env.TARO_ENV === 'h5') {
      const el = canvas as unknown as HTMLElement
      el.style.opacity = '0.996'
      requestAnimationFrame(() => { el.style.opacity = '1' })
    }
  }, [state, art])

  // 状态变化即重绘（canvas 未就绪时轮询直到成功）。
  useEffect(() => {
    let stopped = false
    let n = 0
    const tick = async () => {
      if (stopped) return
      await redraw()
      if (stopped || canvasReady.current || n++ > 40) return
      setTimeout(tick, 200)
    }
    tick()
    return () => { stopped = true }
  }, [redraw])

  // 上传卡图
  const chooseArt = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['original', 'compressed'] })
      const path = res.tempFilePaths[0]
      if (!path) return
      const canvas = await getCanvasNode()
      const im = createImage(canvas)
      im.onload = () => setArt(im)
      im.onerror = () => Taro.showToast({ title: '图片加载失败', icon: 'none' })
      im.src = path
    } catch {
      /* 用户取消 */
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      if (!canvasReady.current) await redraw()
      const canvas = await getCanvasNode()
      await saveCanvasToAlbum(canvas)
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const level = parseInt(state.level, 10) || 0
  const isMonster = state.cardType === 'monster'

  return (
    <View className='screen maker'>
      <ScrollView scrollY className='maker-scroll'>
        <View className='preview'>
          <View className='preview-glow' />
          <Canvas
            type='2d'
            id={CANVAS_ID}
            canvasId={CANVAS_ID}
            className='preview-canvas'
          />
          {loading ? <View className='preview-loading'><Text className='dim'>预填中…</Text></View> : null}
        </View>

        <View className='field'>
          <Text className='label'>卡片类型</Text>
          <View className='seg'>
            {CARD_TYPES.map((t) => (
              <View
                key={t.key}
                className={`seg-i ${state.cardType === t.key ? 'on' : ''}`}
                onClick={() => set('cardType', t.key)}
              >{t.label}</View>
            ))}
          </View>
        </View>

        {isMonster ? (
          <View className='field'>
            <Text className='label'>卡框</Text>
            <View className='seg wrap'>
              {FRAMES.map((f) => (
                <View
                  key={f.key}
                  className={`seg-i ${!state.isLink && state.frame === f.key ? 'on' : ''}`}
                  onClick={() => setState((s) => ({ ...s, frame: f.key, isLink: false }))}
                >{f.label}</View>
              ))}
              <View
                className={`seg-i ${state.isLink ? 'on' : ''}`}
                onClick={() => setState((s) => ({ ...s, isLink: true }))}
              >连接</View>
            </View>
          </View>
        ) : null}

        {isMonster ? (
          <View className='field'>
            <Text className='label'>属性</Text>
            <View className='attr-row'>
              {ATTRS.map((a) => (
                <View
                  key={a}
                  className={`attr ${state.attribute === a ? 'on' : ''}`}
                  onClick={() => set('attribute', a)}
                >{ATTR_CN[a]}</View>
              ))}
            </View>
          </View>
        ) : null}

        {isMonster && !state.isLink ? (
          <View className='field'>
            <Text className='label'>等级 · {level} 星</Text>
            <View className='stepper'>
              <View className='step-btn' onClick={() => set('level', String(Math.max(0, level - 1)))}>−</View>
              <View className='step-stars'>{'★'.repeat(Math.min(level, 12)) || '—'}</View>
              <View className='step-btn' onClick={() => set('level', String(Math.min(12, level + 1)))}>＋</View>
            </View>
          </View>
        ) : null}

        <View className='field'>
          <Text className='label'>卡名</Text>
          <Input className='inp' value={state.name} maxlength={30} onInput={(e) => set('name', e.detail.value)} />
        </View>

        <View className='field'>
          <Text className='label'>效果文本</Text>
          <Textarea className='inp area' value={state.effect} maxlength={400} autoHeight onInput={(e) => set('effect', e.detail.value)} />
        </View>

        {isMonster ? (
          <View className='field row2'>
            <View className='col'>
              <Text className='label'>攻击力</Text>
              <Input className='inp' type='text' value={state.atk} onInput={(e) => set('atk', e.detail.value)} />
            </View>
            {!state.isLink ? (
              <View className='col'>
                <Text className='label'>守备力</Text>
                <Input className='inp' type='text' value={state.def} onInput={(e) => set('def', e.detail.value)} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className='field row2'>
          <View className='col'>
            <Text className='label'>卡密</Text>
            <Input className='inp' value={state.passcode} maxlength={8} onInput={(e) => set('passcode', e.detail.value)} />
          </View>
          <View className='col'>
            <Text className='label'>卡包编号</Text>
            <Input className='inp' value={state.setCode} onInput={(e) => set('setCode', e.detail.value)} />
          </View>
        </View>

        <View className='upload' onClick={chooseArt}>
          <Text className='upload-ic'>＋</Text>
          <Text className='upload-t'>{art ? '更换卡图' : '上传卡图'}</Text>
        </View>

        <View className='foot-space' />
      </ScrollView>

      <View className='actions'>
        <Button className='btn ghost' onClick={() => { setState(DEFAULT_STATE); setArt(null) }}>重置</Button>
        <Button className='btn primary' loading={saving} onClick={save}>⬇ 保存到相册</Button>
      </View>
    </View>
  )
}
