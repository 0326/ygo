# R2 卡图系统运维手册

## 当前同步状态（2026-07-13）

| 卡图类型       | R2 目录           | 数量   | 状态   | 分辨率       |
| -------------- | ----------------- | ------ | ------ | ------------ |
| 英文高清图     | `cards/`          | ~14.5k | ✅ 完整 | 可变         |
| 英文缩略图     | `cards_small/`    | ~14.5k | ✅ 完整 | 可变         |
| 英文裁剪图     | `cards_cropped/`  | ~14.5k | ✅ 完整 | 可变         |
| 简中高清图     | `cards_cn/`       | 6,458  | ✅ 完整 | 1626×2370    |
| 简中缩略图     | `cards_cn_small/` | 6,458  | ✅ 完整 | 缩略图 (~40KB) |
| 日文卡图       | `cards_jp/`       | 14,839 | ✅ 完整 | 484×700      |

> **覆盖率说明**：简中卡图覆盖率约 43.8%（6458/14730），缺失时自动回退英文卡图。
> 日文卡图覆盖率最高，包含大部分异画版本。

---

## 系统架构

### 多语言卡图回退策略

```
请求 /img/{key}?lang=cn
    │
    ├─ 查 R2: cards_cn/{key}.jpg
    │   └─ 命中 → 返回简中卡图
    │
    └─ 未命中 → 查 R2: cards/{key}.jpg（英文）
        ├─ 命中 → 返回英文卡图
        │
        └─ 未命中 → 回源 ygoprodeck → 回填 R2 cards/ → 返回
```

回退链配置见 [`src/worker/lib/images.ts`](../src/worker/lib/images.ts) 中的 `FALLBACK` 和 `LANG_DIRS`。

### R2 目录结构

```
ygo-cards/
├── cards/               # 英文高清图（ygoprodeck 回填）
├── cards_small/         # 英文缩略图（ygoprodeck 回填）
├── cards_cropped/       # 英文裁剪图（制卡器用）
├── cards_cn/            # 简中高清图（手动上传）
├── cards_cn_small/      # 简中缩略图（手动上传，sips 生成）
└── cards_jp/            # 日文卡图（手动上传，full/small 共用）
```

---

## 卡图源数据准备

### 1. 简中卡图

**来源**：夸克网盘用户分享的高清卡图包

**目录结构要求**：
```
cards/
└── _merged_cn_hd/
    ├── pics/          # 简中高清原图 (1626×2370)
    └── pics_small/    # 简中缩略图（需生成）
```

**生成缩略图**（macOS 自带 sips）：
```bash
cd cards/_merged_cn_hd
mkdir -p pics_small
for f in pics/*.jpg; do
  sips -Z 400 "$f" --out pics_small/$(basename "$f")
done
```

> 批量生成 6458 张缩略图约需几分钟，总大小 ~666MB，平均每张 ~40KB。

### 2. 日文卡图

**来源**：日文卡图数据包

**目录结构要求**：
```
cards/
└── _merged_jp/
    └── pics/          # 日文卡图 (484×700)
```

> 日文卡图只有一种分辨率，full 和 small 变体共用同一目录 `cards_jp/`。

---

## 上传脚本使用

### 一键上传所有卡图

```bash
python3 scripts/upload_all_cards.py

# 自定义参数
python3 scripts/upload_all_cards.py \
  --cards-dir ./cards \
  --bucket ygo-cards \
  --workers 4
```

### 单独上传某类卡图

```bash
# 简中缩略图
python3 scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_cn_hd/pics_small \
  --r2-prefix cards_cn_small

# 简中高清图
python3 scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_cn_hd/pics \
  --r2-prefix cards_cn \
  --workers 4

# 日文卡图
python3 scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_jp/pics \
  --r2-prefix cards_jp \
  --workers 4
```

### 脚本参数说明

| 参数                | 说明                     | 默认值     |
| ------------------- | ------------------------ | ---------- |
| `--local-dir`       | 本地卡图目录（必填）     | -          |
| `--r2-prefix`       | R2 中的前缀路径（必填）  | -          |
| `--bucket`          | R2 Bucket 名称           | `ygo-cards`|
| `--workers`         | 并发上传线程数           | `4`        |
| `--progress-interval`| 进度刷新间隔（秒）      | `5`        |
| `--pattern`         | 文件匹配模式             | `*.jpg`    |
| `--reset-progress`  | 重置上传进度，重新上传   | false      |

### 并发数建议

| 卡图类型   | 推荐并发 | 说明                         |
| ---------- | -------- | ---------------------------- |
| 缩略图     | 4-8      | 文件小，速度快               |
| 高清图     | 2-4      | 文件大，网络带宽为瓶颈       |

> **注意**：R2 免费版总容量 10GB，并发过高可能导致 CPU 占用过高或触发限流。
> 实测 4 并发是 Mac 本地运行的稳定值。

---

## 断点续传与进度

### 进度文件

脚本自动在 `scripts/` 目录下生成进度文件：
- `.upload_progress_pics_cards_cn.json` — 简中高清图
- `.upload_progress_small_cards_cn_small.json` — 简中缩略图
- `.upload_progress_pics_cards_jp.json` — 日文卡图

格式：
```json
{
  "uploaded": ["2511.jpg", "2512.jpg", ...]
}
```

### 断点续传

直接重新运行脚本即可，脚本会：
1. 读取进度文件中的已上传列表
2. 扫描本地文件，跳过已上传的
3. 继续上传剩余文件

### 强制重新上传

```bash
# 重置某类卡图的上传进度
python3 scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_cn_hd/pics \
  --r2-prefix cards_cn \
  --reset-progress
```

---

## 监控与自动重启

### 监控脚本

`scripts/monitor_upload.py` 可检查上传状态，进程挂掉时自动重启：

```bash
# 检查并自动重启简中高清图上传
python3 scripts/monitor_upload.py ./cards/_merged_cn_hd/pics cards_cn 4

# 结合 cron 每 10 分钟检查一次
*/10 * * * * cd /path/to/ygo && python3 scripts/monitor_upload.py ./cards/_merged_cn_hd/pics cards_cn 4 >> upload_monitor.log 2>&1
```

### 查看实时进度

```bash
# 查看上传日志
tail -f scripts/upload_pics.log

# 查看进度文件已上传数量
python3 -c "import json; d=json.load(open('scripts/.upload_progress_pics_cards_cn.json')); print(len(d['uploaded']))"
```

---

## 卡图更新升级流程

### 场景 1：新卡发布后批量更新

当上游发布新卡，需要补充简中/日文卡图时：

1. **下载新卡图**到对应目录（覆盖式新增）
2. **生成缩略图**（仅简中需要）
   ```bash
   # 增量生成缩略图（已存在的跳过）
   cd cards/_merged_cn_hd
   for f in pics/*.jpg; do
     out="pics_small/$(basename "$f")"
     [ ! -f "$out" ] && sips -Z 400 "$f" --out "$out"
   done
   ```
3. **增量上传**（自动断点续传，只传新文件）
   ```bash
   python3 scripts/upload_all_cards.py
   ```
4. **验证**：随机抽查几张新卡的多语言卡图是否正常
   ```
   https://your-domain/img/新卡密?lang=cn
   https://your-domain/img/新卡密/s?lang=jp
   ```

### 场景 2：更换/替换已有卡图

1. 替换本地文件
2. **重置进度**后重新上传（或只删除进度文件中对应文件名）
   ```bash
   # 方法一：重置全部进度重新上传
   python3 scripts/upload_r2_cards.py --local-dir ... --r2-prefix ... --reset-progress

   # 方法二：手动删除进度文件中的指定条目（推荐，只重传变化的）
   python3 -c "
import json
f = 'scripts/.upload_progress_pics_cards_cn.json'
d = json.load(open(f))
d['uploaded'] = [x for x in d['uploaded'] if x not in ['2511.jpg', '2512.jpg']]
json.dump(d, open(f, 'w'))
"
   ```
3. **刷新 CDN 缓存**：修改 `CACHE_VERSION`（见下文）

### 场景 3：刷新 CDN 卡图缓存

卡图有 30 天 CDN 缓存（`Cache-Control: public, max-age=2592000, immutable`）。
如果上传了新卡图但用户看到的还是旧图，需要递增缓存版本号：

1. 编辑 [`src/worker/lib/images.ts`](../src/worker/lib/images.ts)
2. 修改 `CACHE_VERSION`（如 `v3` → `v4`）
   ```typescript
   const CACHE_VERSION = "v4";
   ```
3. 重新部署 Worker
   ```bash
   npm run deploy
   ```

> 原理：Worker 会在缓存 key 中注入 `_cv=v3` 参数，版本号变化后旧缓存自动失效。

---

## 验证上传结果

### 抽查单张卡图

```bash
# 下载到本地验证
npx wrangler r2 object get ygo-cards/cards_cn/2511.jpg --file /tmp/test.jpg --remote
open /tmp/test.jpg

# 统计某目录下文件数（通过列举）
npx wrangler r2 object list ygo-cards --prefix cards_cn/ --remote | wc -l
```

### 在线验证

部署后访问：
- 简中高清：`https://your-domain/img/2511?lang=cn`
- 简中缩略：`https://your-domain/img/2511/s?lang=cn`
- 日文卡图：`https://your-domain/img/2511?lang=jp`

响应头说明：
- `x-r2: hit` — R2 命中
- `x-r2: miss` — R2 未命中，回源英文
- `x-img-lang: cn/jp/en` — 返回的卡图语言

---

## 常见问题

### Q1: 上传速度慢

**可能原因**：
- 网络带宽限制（主要瓶颈）
- wrangler 进程启动开销
- R2 API 限流

**优化建议**：
- 适当增加并发数（`--workers 8`），但不建议超过 8
- 在网络较好的环境运行
- 拆分到多台机器同时上传不同目录

### Q2: CPU 占用过高

**现象**：Mac 风扇狂转，kernel_task 占用高

**原因**：wrangler 为每个文件创建 Node.js 子进程，进程创建销毁开销大

**解决**：降低并发数到 2-4

### Q3: 上传进程意外退出

**常见原因**：
- wrangler 日志写入权限问题
- 内存不足
- 网络中断

**解决**：
- 脚本已自动重定向 wrangler HOME 到项目内 `.wrangler_home/`，解决权限问题
- 使用 `monitor_upload.py` 监控并自动重启
- 重新运行脚本即可断点续传

### Q4: 部署后卡图没切换语言

**原因**：CDN 缓存了旧的无 lang 参数的结果

**解决**：
1. 确认前端已传递 `?lang=cn` 参数
2. 检查 `CACHE_VERSION` 是否为最新
3. 如不行，递增 `CACHE_VERSION` 后重新部署

### Q5: wrangler 认证过期

**错误**：`Failed to fetch auth token: 400 Bad Request`

**解决**：
```bash
npx wrangler login
```

### Q6: R2 空间不够

R2 免费版 10GB 容量。当前占用估算：
- 英文卡图：~2GB
- 简中高清图：6458 张 × ~2MB ≈ 13GB（⚠️ 超出免费版）
- 简中缩略图：6458 张 × ~40KB ≈ 260MB
- 日文卡图：14839 张 × ~100KB ≈ 1.5GB

> 如超出免费额度，考虑升级 R2 付费版或仅保留缩略图 + 详情页按需回源。

---

## 相关文件索引

| 文件 | 作用 |
| ---- | ---- |
| [`src/worker/lib/images.ts`](../src/worker/lib/images.ts) | 卡图路由核心：多语言、回退、缓存 |
| [`src/react-app/lib/cardImage.ts`](../src/react-app/lib/cardImage.ts) | 前端卡图 URL 生成工具 |
| [`scripts/upload_r2_cards.py`](../scripts/upload_r2_cards.py) | 单类卡图上传脚本（核心） |
| [`scripts/upload_all_cards.py`](../scripts/upload_all_cards.py) | 一键上传所有卡图 |
| [`scripts/monitor_upload.py`](../scripts/monitor_upload.py) | 上传监控 + 自动重启 |
| [`wrangler.json`](../wrangler.json) | Worker 配置 + R2 Bucket 绑定 |
