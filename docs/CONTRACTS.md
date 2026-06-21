# M0 共享契约（冻结版 v1）

> 本文件是全站**唯一事实源**。M1（Track A）、M2（Track B）一律**只读消费**。
> 任何 schema / API / 共享组件的变更，必须回到 M0 在此统一修改并广播，禁止在 feature 代码里私改。

## 4.1 数据 Schema（D1）

见 [`migrations/0001_init.sql`](../migrations/0001_init.sql)。要点：

- `cards`：卡密(passcode)为主键；`frame` 去掉了 `_pendulum` 后缀，灵摆与否由 `scale IS NOT NULL` 判定。
  - M6 新增 `pendulum_effect_cn`（灵摆效果，与 `effect_cn` 的怪兽效果分开）、`subtypes`（JSON 数组，怪兽能力子类型 `tuner/flip/gemini/spirit/union/toon`）、`md_rarity`（Master Duel 罕贵 `N/R/SR/UR`，来源 ygoprodeck `misc_info.md_rarity`）。
- `card_artworks`：一卡多图，`is_default=1` 为默认画；其余为异画（`variant_name`）。
- `archetypes` / `sets` / `card_prints`：系列、卡包、收录/罕贵。
- `banlist`（M6 新增）：禁限卡表，`(card_id, format)` 主键，`format ∈ {ocg,tcg,md}`，`status` 0=禁/1=限/2=准限。数据源 YGOPRODeck `banlist_info`（含 ocg/tcg；md 暂无开源数据源）。
- `archetypes.cn_name`（M6）：系列简中名，来源优先级 `data/i18n/archetypes.cn.json`（人工高置信）> cdb「」标签启发式 > 英文回退（当前约 64% 有中文名；卡包名 `sets.cn_name` 暂无数据源仍为英文）。
- `cards_fts`：FTS5 **trigram** 虚表，覆盖 `cn_name / en_name / effect_cn`。
- `cards_bigram`（M6）：FTS5 unicode61 虚表，`cn_name` 相邻二元组，`rowid=卡密`。搜索分流：≥3 字走 `cards_fts`、=2 字 CJK 走 `cards_bigram`、其余 `LIKE`。

## 4.2 数据 API（Workers 动态查询）

实现见 [`src/worker/index.ts`](../src/worker/index.ts) + [`src/worker/lib/queries.ts`](../src/worker/lib/queries.ts)。
TypeScript 形态见 [`src/shared/types.ts`](../src/shared/types.ts)（前后端共享）。

| 端点 | 返回 | 缓存 |
|---|---|---|
| `GET /api/search?q=&frame=&attribute=&race=&level=&archetype=&type=&sort=&page=&size=` | `SearchResponse` | 300s |
| ↳ M6 新增筛选参数 `level_min/level_max/atk_min/atk_max/def_min/def_max/link/scale/subtype/md_rarity`（区间为闭区间；`subtype` 逗号分隔取交集；魔陷子类型复用 `race`；`md_rarity ∈ {N,R,SR,UR}`） | | |
| `GET /api/cards/:id` | `CardDetail` | 3600s |
| `GET /api/cards/:id/artworks` | `Artwork[]` | 3600s |
| `GET /api/archetypes?min=` | `ArchetypeSummary[]` | 3600s |
| `GET /api/archetypes/:id` | `{ archetype, cards }` | 3600s |
| `GET /api/sets` | `SetSummary[]` | 3600s |
| `GET /api/sets/:code` | `{ set, cards }` | 3600s |
| `GET /api/stats` | 站点统计 | 3600s |
| `GET /img/:key` / `GET /img/:key/s` | 卡图(自托管代理) | 30d |

- 多值筛选（`frame`/`attribute`/`race`/`type`）用英文 key、逗号分隔，例如 `frame=fusion,synchro`。
- 缓存：所有 `/api/*` 经 Cache API 边缘缓存（卡片数据近静态），避免打爆 D1 免费读配额。
- 图片 URL 契约：`/img/{image_key}` 与 `/img/{image_key}/s`（缩略）。终态切到 R2 自定义域名 `img.hajimikitty.com` 时前端无感。

## 4.3 设计系统 & 共享组件

- **Design tokens**：[`src/react-app/styles/tokens.css`](../src/react-app/styles/tokens.css)（配色按卡框色系延展、CJK 字体、间距、圆角、移动端断点 720px）。
- **显示映射**：[`src/react-app/lib/labels.ts`](../src/react-app/lib/labels.ts)（属性/卡框/种族 → 简中 + 配色）。
- **API 客户端**：[`src/react-app/lib/api.ts`](../src/react-app/lib/api.ts)。
- **基础组件**：`CardThumbnail`/`CardGrid`、`AttributeIcon`、`LevelStars`、`LinkMarkers`、`FrameBadge`、`SearchBar`、`FilterPanel`、`SeriesGrid`、`AppShell`、`Spinner/Empty/ErrorBox`。
- **Canvas 渲染基座**：`src/react-app/canvas/CardCanvasRenderer.ts`（制卡器 M2.1 与长图 M2.2 共用）、`ShareImageComposer.ts`。

## 模块归属（owns）

| 模块 | 拥有路径 |
|---|---|
| M0 | `migrations/`、`scripts/`、`src/worker/`、`src/shared/`、`src/react-app/lib/`、`src/react-app/styles/`、`src/react-app/components/` |
| M1 Track A | `pages/Home/Search/CardDetail/Archetypes/ArchetypeDetail/Sets` |
| M2 Track B | `src/react-app/canvas/`、`pages/CardMaker`、`pages/ShareImage`、`pages/DeckBuilder`、`lib/deck.ts` |
