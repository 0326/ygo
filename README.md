# 哈基米卡库 · ygo.hajimikitty.com

> 卡图最美 · 查卡最爽 · 最懂收藏党的一站式游戏王卡牌站 + 让创作者上瘾的制卡 / 图鉴工具。

栈：**Cloudflare Workers + D1 + R2 ｜ Vite + React 19 + Hono**。v1 不做登录，第一版即上 Workers 动态查询。
产品规划见 [`docs/prd.md`](docs/prd.md)，**冻结的共享契约**见 [`docs/CONTRACTS.md`](docs/CONTRACTS.md)。

## 已实现（v1）

| 模块 | 内容 | 状态 |
|---|---|---|
| **M0 地基** | D1 schema + FTS5 中文检索、cdb(简中)×YGOPRODeck 数据管线、Workers 动态查询 API + 边缘缓存、卡图自托管代理、设计系统 + 共享组件库 | ✅ |
| **M1.1 查卡/筛选** | 简中全文检索 + 卡种/卡框/属性/等级/种族多维筛选 + 分页 | ✅ |
| **M1.2 详情页 + 异画画廊** ⭐ | 高清卡图、异画切换、完整简中效果、系列归属、关联卡、收录卡包/罕贵表 | ✅ |
| **M1.3 系列图鉴** ⭐ | 按 archetype 精美图鉴版式，一键进入分享长图 | ✅ |
| **M2.1 自定义制卡器** ⭐ | Canvas 实时预览、上传卡图、全字段编辑、灵摆/连接、高 DPI 导出、从现有卡片预填、强制「非官方·同人卡」标识 | ✅ |
| **M2.2 分享长图生成器** | 选卡 → 生成带站点水印 + 短链的精美长图（list/grid/卡面三种版式） | ✅ |
| **M2.3 组卡器**（v1.1） | 搜索组卡、主/额外/副三区与规则校验（40-60 / 15 / 15、同名 ≤3、额外卡框自动归位）、导出 YDK + 卡组一图流 + 分享链接 | ✅ |

数据规模：**14,388 张卡（含简中名/效果）· 14,552 张卡图(含异画) · 643 个系列 · 651 个卡包**。

## 本地开发

```bash
npm install

# 1) 准备本地 D1 数据（首次必跑）
#    依赖 data/cards.cdb 与 data/ygoprodeck-full.json（见“数据来源”）
npm run data:build      # 归一化 -> data/seed.sql
npm run db:setup        # 建表 + 灌库（本地 .wrangler/state）

# 2) 启动（Vite 同时跑前端与 Worker API）
npm run dev             # http://localhost:5173
```

> 注意：若本机配置了 HTTP(S)_PROXY，`wrangler` 启动可能 `fetch failed`。本地开发可临时
> `env -u HTTP_PROXY -u HTTPS_PROXY npm run dev`。

## 数据来源（M0.1 管线）

- **简中名称 / 效果**：[mycard/ygopro-database](https://github.com/mycard/ygopro-database) 的 `locales/zh-CN/cards.cdb`（SQLite）。
- **结构化字段 / 异画 / 收录罕贵 / 卡图**：[YGOPRODeck API](https://db.ygoprodeck.com/api/v7/cardinfo.php)。

两者以**卡密(passcode)**为键 join。`scripts/build-data.mjs` 产出 `data/seed.sql`。原始 dump 与 seed 均 gitignore，不入库。
卡图经我方 Worker `/img/:key` 代理 + 边缘缓存（自托管而非热链，符合 ygoprodeck 要求）；终态迁移到 R2 `img.hajimikitty.com` 时前端无感。

## 部署到 Cloudflare（生产）

```bash
# 1) 建远端 D1，把返回的 database_id 填入 wrangler.json
wrangler d1 create ygo-db
# 2) 迁移 + 灌库到远端
npm run db:migrate:remote && npm run db:seed:remote
# 3) 部署 Worker + 静态资源
npm run deploy
```

生产卡图建议改用 R2：拉图 → 转 webp（列表缩略 + 详情 600px）→ R2 → 绑定 `img.hajimikitty.com`，并把
`src/worker/lib/images.ts` 的 origin 切到 R2。新卡自动入库可加 Cron Worker 定时跑数据管线。

## 目录结构

```
migrations/0001_init.sql         D1 schema（契约 4.1）
scripts/build-data.mjs           数据归一化管线（M0.1）
src/shared/types.ts              前后端共享契约类型（4.2）
src/worker/                      Hono API + D1 查询层 + 卡图代理（M0.3 / M0.2）
src/react-app/
  lib/{api,labels}.ts            API 客户端 + 简中显示映射
  styles/                        Design tokens + 组件/页面样式（M0.4）
  components/                    共享组件库（M0.4）
  pages/                         M1（查卡/详情/系列/卡包）+ M2（制卡器/长图）
  canvas/                        CardCanvasRenderer + ShareImageComposer（M2 共用基座）
```

## 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发（前端 + Worker） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | ESLint |
| `npm run data:build` | 重建 `data/seed.sql` |
| `npm run db:setup` | 本地 D1 建表 + 灌库 |
| `npm run deploy` | 部署到 Cloudflare |

> 合规：制卡器输出统一带「非官方·同人卡」标识，定位纪念/创作而非实战仿冒；非商业起步，保留随时下架能力。
