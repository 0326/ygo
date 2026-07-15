// API 网关地址：小程序不能用相对路径，必须绝对域名。
// 正式环境请改为已备案 HTTPS 域名，并在微信/抖音后台配置为 request 合法域名。
// H5 验证时走 devServer 代理（见下方 h5.proxy），故 H5 用相对 /api 即可。
const API_BASE_WEAPP = process.env.YGO_API_BASE || 'https://ygo.example.com'
const DEV_API = process.env.YGO_DEV_API || 'http://localhost:5174'

const config = {
  projectName: 'ygo-miniprogram',
  date: '2026-7-15',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2, 375: 2 },
  sourceRoot: 'src',
  outputRoot: `dist/${process.env.TARO_ENV}`,
  plugins: [],
  defineConstants: {
    YGO_API_BASE: JSON.stringify(process.env.TARO_ENV === 'h5' ? '' : API_BASE_WEAPP),
  },
  copy: { patterns: [], options: {} },
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false },
    },
    devServer: {
      host: '0.0.0.0',
      port: 10086,
      historyApiFallback: true,
      proxy: {
        '/api': { target: DEV_API, changeOrigin: true },
        '/img': { target: DEV_API, changeOrigin: true },
        '/cardgen': { target: DEV_API, changeOrigin: true },
      },
    },
  },
}

module.exports = function (merge: (...args: unknown[]) => unknown) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, {})
  }
  return merge({}, config, {})
}
