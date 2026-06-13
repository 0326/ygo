# 游戏王卡牌站 · 产品规划 v2（并行开发版）

> 域名 ygo.hajimikitty.com ｜ 栈：Cloudflare Workers + D1 + R2 ｜ v1 不做登录、第一版即上 Workers 动态查询
> 目标：成为**全网最牛**的游戏王工具 & 卡牌网站
> 用途：本规划按「共享契约 + 可并行模块」组织，每个模块可单独交给 Claude Code 出详细技术方案并行开发。

---

## 0. 本次迭代定调（相对 v1 的变更）

1. **卡图视觉体验 + 系列图鉴 = 基本盘**，必须做到全网最好，不是亮点而是底线。
2. **创作者工具扩容**：不止「组卡器 + 分享长图」，新增**自定义制卡器**为一等公民模块。
3. **v1 不做账号登录**（零注册门槛，体验最顺），但**第一版即上 Workers 动态查询**（非纯静态）。收藏/社区因依赖账号，顺延到 v1 之后。

---

## 1. 「全网最牛」的可执行定义

不靠功能多取胜（正面打集换社/百鸽/DuelMeta 只会摊薄单人精力），而是**在别人做得最差、你天然最强的维度上做到无可争议第一，再向外扩**。

**做到第一的维度**：卡图/异画体验、系列图鉴（完整度+美观度）、创作者工具。
**明确不碰（v1～v2）**：卡价/交易（集换社腹地）、极简秒查（百鸽已极致）、竞技 meta 卡组库（DuelMeta）。

一句话定位：**卡图最美、查卡最爽、最懂收藏党的一站式卡牌站 + 让创作者上瘾的制卡/图鉴工具。**

---

## 2. 独有杠杆（每个决策都要调动）

1. **内容渠道**：3k+ 抖音号 + 持续的系列图鉴 → 免费精准流量 + 传播飞轮。
2. **全栈/可视化开发力** → 卡图、图鉴排版、制卡器是降维打击。
3. **玩家 + 收藏党视角** → 纯商业团队做不出的细节。

护城河 = 审美/craft + 内容飞轮 + 单人可持续维护的克制。

---

## 3. 模块化架构 & 并行开发依赖图

```
                    ┌─────────────────────────────────────────┐
                    │  M0 共享地基 & 契约（前置 · 必须先冻结）   │
                    │  M0.1 数据与同步(D1, cdb导入, Cron)       │
                    │  M0.2 卡图管线(R2, webp, 自定义域名)       │
                    │  M0.3 数据API(Workers 动态查询) ← 核心契约 │
                    │  M0.4 设计系统 & 共享组件库   ← 核心契约   │
                    └───────────────┬─────────────────────────┘
                 契约冻结后，以下两条 Track 完全并行
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                         ▼
┌──────────────────────────┐                    ┌──────────────────────────────┐
│ M1 基本盘·卡图体验(Track A)│                    │ M2 创作者工具套件(Track B)     │
│ M1.1 查卡/筛选            │                    │ M2.1 自定义制卡器 ⭐(可独立开)  │
│ M1.2 卡图详情页+异画画廊⭐ │                    │ M2.2 分享长图生成器            │
│ M1.3 系列图鉴浏览 ⭐       │                    │ M2.3 组卡器(Track B 内最后做)  │
└──────────────────────────┘                    └──────────────────────────────┘
        │                                                         │
        └────────────────────────┬────────────────────────────────┘
                    v1 后（新增「账号体系」这一共享依赖）
        ┌───────────────────────┴───────────────────────┐
        ▼                       ▼                        ▼
   M3 收藏(需账号)         M4 社区(需账号)            M5 变现
```

**并行规则**
- **M0 必须最先做，且要尽早冻结两份契约（M0.3 API spec + M0.4 组件/schema）。** 契约一冻结，M1、M2 可立即并行，甚至能先对着 Mock 开工。
- **M1 与 M2 全程并行**，互不依赖（都只「消费」M0 的契约，不改动它）。
- **M2.1 制卡器几乎完全独立**（主要是前端 Canvas，仅可选地用 API 预填卡面），可以最先动手。
- **M2.3 组卡器**依赖卡组规则/更多数据装配，放 Track B 最后。
- **M3/M4 需要账号体系**（新的共享依赖），因此排在 v1 之后。

---

## 4. 共享契约（冻结后才能并行 —— 这是并行开发的地基）

> 以下为草案，由 M0 落地并冻结 v1 版本。M1/M2 一律**只读消费**，任何 schema/接口变更必须回到 M0 统一改，避免并行撞车。

### 4.1 D1 数据 Schema（草案）

```sql
-- 卡片主表（卡密为主键）
cards(
  id INTEGER PRIMARY KEY,        -- passcode/卡密
  cn_name TEXT, jp_name TEXT, en_name TEXT,
  card_type TEXT,                -- monster | spell | trap
  frame TEXT,                    -- normal|effect|ritual|fusion|synchro|xyz|link|pendulum|spell|trap
  attribute TEXT,                -- 光暗水火地风神
  race TEXT,                     -- 种族
  level INTEGER,                 -- 星/阶
  link_val INTEGER, link_markers TEXT,  -- 连接值 / 连接标记(JSON)
  scale INTEGER,                 -- 灵摆刻度
  atk INTEGER, def INTEGER,
  effect_cn TEXT,
  archetype_id INTEGER,
  alias_of INTEGER,              -- 异画/勘误归一到主卡
  updated_at INTEGER
);
-- 一卡多图（承接异画，基本盘的关键）
card_artworks(
  id INTEGER PRIMARY KEY,
  card_id INTEGER,               -- -> cards.id
  image_key TEXT,                -- R2 对象 key
  is_default INTEGER,
  variant_name TEXT, source TEXT
);
archetypes(id INTEGER PRIMARY KEY, cn_name TEXT, en_name TEXT, cover_card_id INTEGER);
sets(code TEXT PRIMARY KEY, cn_name TEXT, release_date INTEGER);   -- 卡包
card_prints(card_id INTEGER, set_code TEXT, rarity TEXT, card_number TEXT,
            PRIMARY KEY(card_id, set_code, card_number));          -- 收录/罕贵
-- 搜索：建议 FTS5 虚表覆盖 cn_name/effect_cn；常用筛选字段建索引
```

要点：`alias_of` 处理 cdb 里异画/勘误的重复 id；`card_artworks` 一卡多图是「异画画廊」与制卡器预填的基础。

### 4.2 数据 API 契约（Workers 动态查询，草案）

```
GET /api/search?q=&frame=&attribute=&race=&level=&archetype=&type=&page=&size=
    -> { total, page, size, items: CardSummary[] }
GET /api/cards/:id            -> CardDetail
GET /api/cards/:id/artworks   -> Artwork[]
GET /api/archetypes           -> ArchetypeSummary[]
GET /api/archetypes/:id       -> { archetype, cards: CardSummary[] }   // 系列图鉴数据源
GET /api/sets                 -> SetSummary[]
GET /api/sets/:code           -> { set, cards: CardSummary[] }

CardSummary { id, cn_name, frame, attribute, level|rank|link, atk, def, thumb_url }
CardDetail  = CardSummary & { race, scale, link_markers, effect_cn,
                              artworks: Artwork[], prints: Print[],
                              archetype, related: CardSummary[] }
Artwork { image_key, url, is_default, variant_name }
图片 URL 约定：https://img.hajimikitty.com/{image_key}   // R2 自定义域名
```

缓存策略（重要）：卡片数据近静态，Workers 前置 Cache API / KV 重缓存，避免打爆 D1 免费读配额；可对 `/api/search` 的热门组合与全部 `/api/cards/:id` 做边缘缓存。

### 4.3 设计系统 & 共享组件清单（M0.4 产出，全站只读复用）

- **Design tokens**：配色（按卡框色系延展）、字体（含 CJK 卡牌字体）、间距、圆角、移动端断点。
- **基础组件**：`CardThumbnail`、`AttributeIcon`、`LevelStars/RankStars`、`LinkMarkers`、`RarityBadge`、`EffectText`、`ArtworkGallery`、`SearchBar`、`FilterPanel`、`SeriesGrid`、`Pagination`、移动端 `AppShell/底部导航`。
- **Canvas 渲染基座**：`CardCanvasRenderer`（卡面渲染核心，制卡器 M2.1 与长图 M2.2 共用，保证视觉一致）、`ShareImageComposer`（多卡拼版长图）。

> 框架选型：M2.1 拟基于 **kooriookami/yugioh-card（Vue + Canvas）** 二开；若全站用 React，则把其 **Canvas 绘制逻辑与素材模板抽成框架无关的渲染库**（绘制逻辑本身与框架无关，是可移植的真正价值所在），再在 React 里包一层。此决定由 M0.4 + M2.1 共同拍板并写进契约。

---

## 5. 模块详细规格（每块即一个可交给 Claude Code 的交付单元）

> 每个模块都给了：目标 / 依赖 / 消费契约 / 核心功能 / 边界（owns & 不要碰）/ 验收标准 / 复用提示。复制一节即可独立开工。

### M0 · 共享地基 & 契约【前置阻塞】

- **目标**：干净完整可自动更新的数据 + 卡图资源 + 冻结的 API/组件契约。
- **核心功能**
  - M0.1 简中数据落 D1（基于开源 cdb：github.com/mycard/ygopro-database）；Cron Worker 定时同步新卡。
  - M0.2 卡图管线：从 ygoprodeck 拉图 → 压缩转 webp（列表缩略 + 详情 600px）→ R2 → img 自定义域名。**ygoprodeck 要求自托管而非热链，正合规。**
  - M0.3 数据 API（见 4.2），含搜索（FTS5）+ 边缘缓存。
  - M0.4 设计系统 + 共享组件库（见 4.3）。
- **边界**：M0 **独占** schema、API 形态、共享组件与 tokens 的修改权。
- **验收**：任意卡 1 秒内可查；详情含全部异画；新卡两周内自动入库；API 契约与组件库文档冻结发布。

### M1 · 基本盘 · 卡图体验【Track A，依赖 M0.3 + M0.4】

#### M1.1 查卡 / 筛选
- 目标：体验好、简中、筛选顺手；做到不输百鸽即可，不拼极速。
- 消费契约：`GET /api/search`。
- 验收：常用筛选组合可用、分页流畅、适配主流PC。

#### M1.2 卡图详情页 + 异画画廊 ⭐（核心爆点）
- 目标：让人第一次打开就觉得「这详情页全网最好看」。
- 核心功能：高清卡图、**异画画廊**、完整效果、系列归属、关联卡、收录卡包/稀有度、（可选）卡图设定/考据。
- 消费契约：`GET /api/cards/:id`、`/artworks`。
- 验收：同类里肉眼可见最美；异画展示完整流畅。

#### M1.3 系列图鉴浏览 ⭐
- 目标：把你的抖音图鉴内容产品化、可逛化。
- 核心功能：按系列（archetype）以精美图鉴版式呈现；天生适合截图转发。
- 消费契约：`GET /api/archetypes`、`/api/archetypes/:id`。
- 验收：系列页美观、信息完整、可一键进入分享长图（与 M2.2 联动）。

- **Track A 边界**：只读消费 API 与共享组件，不改 schema、不改组件库。

### M2 · 创作者工具套件【Track B，与 Track A 并行】

#### M2.1 自定义制卡器 ⭐（可最先独立开工）
- 目标：全网最好用的在线制卡器，承接你最初看中的 ygosgs 那类需求并做得更好。
- 核心功能：选卡类型→对应卡框模板；上传自定义卡图；编辑名称/属性/星阶/攻守/种族效果/灵摆刻度/卡密/罕贵(烫金/闪)/卡包码；高 DPI 导出 PNG；可选「从现有卡片预填」（调 `/api/cards/:id`）。
- **复用提示**：基于 **github.com/kooriookami/yugioh-card** 二开（Canvas 渲染，含卡框/属性/星级等素材模板），省掉绝大部分脏活；按 4.3 决定 Vue 直用还是抽渲染库。
- 依赖：M0.4 的 `CardCanvasRenderer`（或反过来由本模块沉淀出该基座供 M2.2 复用）。
- 边界：拥有制卡器素材与渲染逻辑；导出的卡需带「非官方/同人」标识（见风险节）。
- 验收：主流卡类型还原度高、导出清晰、移动端可用。

#### M2.2 分享长图生成器
- 目标：选若干卡 → 自动生成精美、带站点水印+短链的系列图鉴长图（创作者工具 + 病毒回路）。
- 消费契约：卡数据 API + 复用 `ShareImageComposer`/`CardCanvasRenderer`。
- 验收：长图美观、默认带水印短链、被你和早期用户实际用于发内容。

#### M2.3 组卡器（Track B 内最后做）
- 目标：拖拽组卡（主/额外/副，规则校验）→ 导出 YDK 码 + 卡组一图流 + 分享链接。
- 消费契约：`/api/search`、`/api/cards/:id`；复用长图渲染。
- 验收：组卡→导出→分享链路顺滑。

### M3 收藏 / M4 社区 / M5 变现【v1 后，需账号体系】

- **M3 收藏**：收藏打卡、系列集齐进度、收藏墙、(可选轻量)收藏概览。
- **M4 社区**：用户投稿图鉴/卡图考据、收藏/休闲向卡组分享、评论点赞（定位区别于交易社区与竞技社区）。
- **M5 变现**：会员（高级导出/无水印/批量）、原创美术周边、约稿、轻合作。
- 共同前置：先做**账号体系**（这是 v1 后第一个新增共享依赖，建议单列为 M-Auth）。

---

## 6. v1 范围界定

**v1 交付（做到惊艳）**：M0 全部 + M1 全部 + M2.1 制卡器 + M2.2 分享长图。
**v1.1 快速跟进**：M2.3 组卡器。
**v1 明确不做**：账号登录、收藏、社区、卡价/交易、竞技 meta。

> v1 唯一任务：让人记住「卡图和图鉴全网最好看，还能在线制卡」。其余全放下。

---

## 7. 内容飞轮（产品 ↔ 抖音）

```
抖音内容(系列图鉴/卡图科普) → 导流 → 站点(详情页/系列图鉴/制卡器)
   → 一键生成带水印+短链的长图/自制卡 → 用户分享到抖音·小红书·QQ群 → 新用户回流
```
落地：所有可分享产物默认带**站点水印 + 短链**；你的抖音内容直接用站点工具生产，既省力又示范用法；优先做「天生适合截图转发」的页面。

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| **IP/版权（卡图/卡框为 Konami 版权，同人灰区）** | 非商业起步、不卖含官图周边、不做实战代用卡复刻；**制卡器输出统一带「非官方/同人卡」标识**，定位纪念/创作而非实战仿冒；ygoprodeck 本就要求自托管，相对可控；保留随时下架能力 |
| **国内访问速度（海外免费栈天花板）** | v1 接受「够用」：重压缩、懒加载、缩略图、边缘缓存；有量后再考虑备案 + 国内 OSS |
| **单人精力耗尽（同人工具头号死因）** | 范围极度克制；先把基本盘 + 制卡器打磨到惊艳再扩；数据更新全自动化 |
| **并行开发撞车** | 先冻结 M0 两份契约；M1/M2 只读消费、不碰 schema/组件库；变更统一回 M0 |
| **制卡器素材/字体来源** | 复用 kooriookami 开源素材时确认其授权；字体注意版权，必要时换可商用/开源字体 |
| **被模仿** | 护城河放在审美/craft + 内容飞轮 + 社区沉淀，抄不快 |

---

## 9. 给 Claude Code 的并行开发说明

1. **先做 M0，并尽早冻结 `4.1 schema` + `4.2 API` + `4.3 组件清单` 三份契约**，作为全局唯一事实源。
2. 契约冻结后，**M1（Track A）与 M2（Track B）各开一个分支/worktree 并行**；M2.1 制卡器可最先独立启动。
3. 纪律：所有 feature 模块**只读消费契约**；任何 schema/API/共享组件变更必须回 M0 统一改并广播，禁止在 feature 分支私改。
4. 建议起手顺序：`M0.1/M0.2 数据&图` → `M0.3 API + M0.4 组件`(契约冻结) →（并行）`M1.2 详情页`+`M2.1 制卡器` 两个爆点先出 → 其余模块跟进。
5. 每个模块交给 Claude Code 时，把对应小节（含「消费契约 / 核心功能 / 边界 / 验收」）整段贴过去，即可让它展开为该阶段的详细技术方案。

> 核心信念不变：**不是功能多取胜，而是在卡图/图鉴/制卡体验上做到无可争议第一，用内容飞轮滚大，用社区筑墙。** 这条路，单人 + 有内容渠道 + 懂收藏的你，最适合走。
