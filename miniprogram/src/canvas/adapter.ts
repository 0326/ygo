// 平台适配：单文件运行时分支（H5 用浏览器原生 API；weapp/tt 用小程序 API）。
// 不依赖 Taro 的 .h5 平台文件解析，避免解析未命中导致 createImage 落到小程序分支。
import Taro from '@tarojs/taro'
import { FONT_BASE, FONT_FACES } from './assets'

const IS_H5 = process.env.TARO_ENV === 'h5'

export interface CanvasLike {
  createImage?: () => CanvasImage
  getContext: (type: '2d') => CanvasRenderingContext2D
  width: number
  height: number
}

export interface CanvasImage {
  src: string
  width: number
  height: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

export function createImage(canvas: CanvasLike): CanvasImage {
  if (IS_H5) {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    return im as unknown as CanvasImage
  }
  // 小程序：图片必须由 canvas.createImage() 创建
  return (canvas.createImage as () => CanvasImage)()
}

let fontLoaded = false
export async function loadFonts(): Promise<void> {
  if (fontLoaded) return
  if (IS_H5) {
    await Promise.all(
      FONT_FACES.map(([family, file]) => {
        try {
          const ff = new FontFace(family, `url(${FONT_BASE}/${file}) format("woff2")`, { display: 'swap' })
          ;(document as unknown as { fonts: FontFaceSet }).fonts.add(ff)
          return ff.load().then(() => undefined, () => undefined)
        } catch {
          return Promise.resolve()
        }
      }),
    )
  } else {
    await Promise.all(
      FONT_FACES.map(([family, file]) =>
        Taro.loadFontFace({
          family,
          global: true,
          source: `url("${FONT_BASE}/${file}")`,
        }).catch(() => undefined),
      ),
    )
  }
  fontLoaded = true
}

export async function saveCanvasToAlbum(canvas: CanvasLike): Promise<void> {
  if (IS_H5) {
    const el = canvas as unknown as HTMLCanvasElement
    const url = el.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `ygo-card-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  const { tempFilePath } = await Taro.canvasToTempFilePath({ canvas: canvas as unknown as HTMLCanvasElement })
  try {
    await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath })
  } catch (e: unknown) {
    const msg = (e as { errMsg?: string })?.errMsg || ''
    if (msg.includes('auth deny') || msg.includes('authorize')) {
      const { confirm } = await Taro.showModal({
        title: '需要相册权限',
        content: '保存图片需要授权访问相册，是否前往设置开启？',
        confirmText: '去设置',
      })
      if (confirm) {
        const setting = await Taro.openSetting()
        if (setting.authSetting['scope.writePhotosAlbum']) {
          await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath })
          return
        }
      }
      throw new Error('未获得相册权限')
    }
    throw e
  }
}
