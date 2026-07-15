# 决斗者卡查 · 小程序（Taro + React）

游戏王卡查/自制器的微信 + 抖音双端小程序，与 Web 站共用一套 Cloudflare Workers（Hono）API 与 D1/R2 数据。

## 第一期功能（已实现并验证）

| 模块 | 页面 | 说明 |
|------|------|------|
| 卡牌搜索 | `pages/index` | 关键词 + 类型筛选，复用 `/api/search`；底部三段式 TabBar |
| 卡牌详情 | `pages/card` | 大卡图 / 属性徽章 / 攻守数据 / 效果 / 收录卡包；分享、做同款、收藏 |
| 卡牌自制器 | `pages/maker` | Canvas 2D 真卡渲染（移植自 Web `CardCanvasRenderer`），保存到相册 |
| 登录 | `pages/login` | 微信/抖音一键登录（`Taro.login` → `/api/auth/mp` → Bearer token） |
| 我的 · 收藏 | `pages/me` | 用户信息 / 收藏卡牌网格 |

## 开发与构建

```bash
npm install

# 开发（watch）
npm run dev:weapp      # 微信开发者工具打开 dist/weapp
npm run dev:tt         # 抖音开发者工具打开 dist/tt
npm run dev:h5         # 浏览器验证，devServer :10086，/api 代理见 config/index.ts

# 构建
npm run build:weapp
npm run build:tt
```

H5 验证需先在仓库根启动 API：`npm run dev`（vite+worker），并设 `YGO_DEV_API` 指向其端口。

## 上线前 TODO（生产必做）

1. **域名**：`config/index.ts` 的 `API_BASE_WEAPP` 改为**已备案 HTTPS 域名**；`src/canvas/assets.ts` 的 `CARDGEN_BASE` 指向托管了 `public/cardgen/`（卡框素材 + woff2 字体）的 R2 自定义域名。
2. **合法域名白名单**：微信公众平台 + 抖音开放平台各自配置 request / downloadFile 合法域名。
3. **平台密钥**：Worker 环境变量 `WX_APPID`/`WX_SECRET`、`TT_APPID`/`TT_SECRET`（未配置时 `/api/auth/mp` 走 dev 兜底 openid，仅供本地验证）。
4. **appid**：`project.config.json`（微信）与抖音项目配置填入真实 appid。
5. **相册权限**：抖音端 `scope` 命名与授权流程与微信不同，`src/canvas/adapter.ts` 已按平台分支，正式机需分别回归。

## 已知：H5 预览合成问题（不影响小程序）

`taro build --type h5` 在部分**内嵌 webview 预览器**里，定时器中绘制的 canvas 内容偶发不立即上屏（backing store 已正确绘制，`getImageData` 可验证），需首次交互才显示。此为该预览浏览器的合成层特性；微信/抖音小程序走原生 canvas 渲染管线，无此问题。H5 仅用于逻辑/接口验证，最终以小程序开发者工具为准。

## 平台适配要点

- `src/canvas/adapter.ts`：单文件运行时按 `process.env.TARO_ENV` 分支（图片创建 / 字体加载 / 保存相册），不依赖 `.h5` 文件解析。
- `src/services/request.ts`：小程序无 Cookie，鉴权走 `Authorization: Bearer`；Worker 侧 `userFromRequest` 已兼容 Bearer + Cookie。
- Canvas 首帧在 H5 需 `translateZ(0)` 触发合成上屏（见 `pages/maker/index.scss`）。
