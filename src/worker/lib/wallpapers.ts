// M9 壁纸模块：D1 查询 + 图片代理（R2 自托管懒回填，同 M0.2 卡图管线思路）。
// 图片 URL 契约：/wp-img/{id}（原图）、/wp-img/{id}/s（缩略）。
import type {
  WallpaperItem, WallpaperListResponse, WallpaperTagCount,
  WallpaperCategory, WallpaperDevice,
} from "../../shared/types";

interface WpRow {
  id: string; title: string; tags: string | null; category: string; device: string;
  width: number; height: number; ratio: number | null;
  file_type: string | null; file_size: number | null; colors: string | null;
  favorites: number | null; source: string | null; source_url: string | null;
  image_url: string; thumb_url: string | null;
}

// 中文/日文常用词 → 英文标签别名（搜索词先做别名展开再 LIKE）
const TAG_ALIASES: Record<string, string> = {
  "青眼白龙": "blue-eyes white dragon", "青眼": "blue-eyes", "蓝眼白龙": "blue-eyes white dragon",
  "真红眼黑龙": "red-eyes black dragon", "红眼": "red-eyes", "黑魔术师": "dark magician",
  "黑魔导": "dark magician", "黑魔术少女": "dark magician girl", "黑魔导女孩": "dark magician girl",
  "游戏": "yugi", "武藤游戏": "yugi muto", "暗游戏": "yami yugi", "亚图姆": "atem",
  "海马": "kaiba", "海马濑人": "seto kaiba", "城之内": "joey wheeler",
  "游城十代": "jaden yuki", "十代": "jaden", "不动游星": "yusei fudo", "游星": "yusei",
  "艾克佐迪亚": "exodia", "栗子球": "kuriboh", "星尘龙": "stardust dragon",
  "欧贝利斯克": "obelisk", "巨神兵": "obelisk", "欧西里斯": "slifer", "天空龙": "slifer",
  "太阳神": "ra", "翼神龙": "ra dragon", "闪刀姬": "sky striker", "灰流丽": "ash blossom",
  "尤贝尔": "yubel", "怪兽": "monster", "龙": "dragon", "决斗": "duel",
  "ブルーアイズ": "blue-eyes", "ブラック・マジシャン": "dark magician", "遊戯": "yugi",
  "海馬": "kaiba", "ユベル": "yubel",
};

function toItem(r: WpRow): WallpaperItem {
  return {
    id: r.id,
    title: r.title || `Yu-Gi-Oh! #${r.id}`,
    // 展示层过滤黑名单标签（DB 原始 tags 仍参与搜索）
    tags: r.tags
      ? r.tags.split(",").map((s) => s.trim()).filter((t) => t && !TAG_BLOCKLIST.has(t))
      : [],
    category: r.category as WallpaperCategory,
    device: r.device as WallpaperDevice,
    width: r.width,
    height: r.height,
    ratio: r.ratio ?? (r.height ? r.width / r.height : 1),
    file_type: r.file_type,
    file_size: r.file_size,
    colors: r.colors ? (JSON.parse(r.colors) as string[]) : [],
    favorites: r.favorites ?? 0,
    source: r.source,
    source_url: r.source_url,
    url: `/wp-img/${r.id}`,
    thumb_url: `/wp-img/${r.id}/s`,
  };
}

const COLS = "id,title,tags,category,device,width,height,ratio,file_type,file_size,colors,favorites,source,source_url,image_url,thumb_url";

export async function listWallpapers(
  db: D1Database,
  params: { q?: string; device?: string; category?: string; tag?: string; sort?: string; ids?: string; page: number; size: number }
): Promise<WallpaperListResponse> {
  const where: string[] = [];
  const binds: unknown[] = [];

  // 按 id 批量取（M10 用户收藏页用）
  if (params.ids) {
    const ids = params.ids.split(",").map((s) => s.replace(/[^a-z0-9]/gi, "")).filter(Boolean).slice(0, 100);
    if (ids.length) {
      where.push(`id IN (${ids.map(() => "?").join(",")})`);
      binds.push(...ids);
    }
  }

  if (params.q && params.q.trim()) {
    // 别名展开：整词命中或包含中文关键词时翻译为英文标签
    let q = params.q.trim().toLowerCase();
    for (const [cn, en] of Object.entries(TAG_ALIASES)) {
      if (q.includes(cn.toLowerCase())) q = en;
    }
    where.push("(tags LIKE ? OR title LIKE ? OR id = ?)");
    binds.push(`%${q}%`, `%${q}%`, q);
  }
  if (params.device === "pc" || params.device === "mobile") {
    where.push("device = ?");
    binds.push(params.device);
  }
  if (params.category && ["wallpaper", "artwork", "character"].includes(params.category)) {
    where.push("category = ?");
    binds.push(params.category);
  }
  if (params.tag && params.tag.trim()) {
    where.push("tags LIKE ?");
    binds.push(`%${params.tag.trim()}%`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const order =
    params.sort === "newest" ? "created_at DESC" :
    params.sort === "resolution" ? "width * height DESC" :
    "favorites DESC"; // 默认按热度

  const size = Math.min(Math.max(params.size, 1), 60);
  const page = Math.max(params.page, 1);

  const countRow = await db
    .prepare(`SELECT count(*) AS n FROM wallpapers ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const { results } = await db
    .prepare(`SELECT ${COLS} FROM wallpapers ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...binds, size, (page - 1) * size)
    .all<WpRow>();

  return { total, page, size, items: (results || []).map(toItem) };
}

// 标签黑名单：来源站标签鱼龙混杂，chips 只展示题材相关的干净标签
const TAG_BLOCKLIST = new Set([
  "boobs", "big boobs", "cleavage", "ecchi", "ass", "thighs", "underwear",
  "lingerie", "bikini", "swimwear", "nopan", "no bra", "panties",
  "anime", "anime girls", "anime boys", "manga", "wallpaper", "digital art",
  // 泛外观标签：对游戏王题材筛选无意义
  "yu-gi-oh!", "long hair", "short hair", "twintails", "blonde", "brunette",
  "white hair", "gray hair", "blue hair", "pink hair", "red hair", "black hair",
  "green hair", "purple hair", "looking at viewer", "solo", "smiling",
  "blue eyes", "red eyes", "green eyes", "yellow eyes", "purple eyes",
]);

// 高频标签（画廊页筛选 chips 用）：从热度 top 500 里聚合
export async function wallpaperTags(db: D1Database, limit = 24): Promise<WallpaperTagCount[]> {
  const { results } = await db
    .prepare("SELECT tags FROM wallpapers ORDER BY favorites DESC LIMIT 500")
    .all<{ tags: string | null }>();
  const counts = new Map<string, number>();
  for (const r of results || []) {
    for (const t of (r.tags || "").split(",").map((s) => s.trim()).filter(Boolean)) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([t]) => t !== "yu-gi-oh" && !TAG_BLOCKLIST.has(t)) // 全站标签无筛选意义 + 黑名单
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export async function wallpaperStats(db: D1Database) {
  return db
    .prepare(
      `SELECT count(*) AS total,
        sum(device='pc') AS pc, sum(device='mobile') AS mobile,
        sum(category='wallpaper') AS wallpaper, sum(category='artwork') AS artwork,
        sum(category='character') AS character`
    )
    .first();
}

// ---------- 图片代理：优先 R2，未命中回源并异步回填 ----------
const R2_DIR = { full: "wallpapers", small: "wallpapers_small" } as const;

export async function proxyWallpaperImage(
  req: Request,
  db: D1Database,
  id: string,
  small: boolean,
  bucket?: R2Bucket,
  ctx?: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const safe = id.replace(/[^a-z0-9]/gi, "");
  const row = await db
    .prepare("SELECT image_url, thumb_url, file_type FROM wallpapers WHERE id = ?")
    .bind(safe)
    .first<{ image_url: string; thumb_url: string | null; file_type: string | null }>();
  if (!row) return new Response("wallpaper not found", { status: 404 });

  const contentType = small ? "image/jpeg" : row.file_type || "image/jpeg";
  const headers = {
    "Cache-Control": "public, max-age=2592000, immutable",
    "Content-Type": contentType,
  };
  const objKey = `${small ? R2_DIR.small : R2_DIR.full}/${safe}`;

  // 1) R2 自托管
  if (bucket) {
    const obj = await bucket.get(objKey);
    if (obj) {
      const res = new Response(obj.body, { headers });
      res.headers.set("x-r2", "hit");
      if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }
  }

  // 2) 回源（缩略图优先 thumb_url，缺失回退原图）
  const upstream = await fetch(small ? row.thumb_url || row.image_url : row.image_url, {
    headers: { referer: "https://wallhaven.cc/" },
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!upstream.ok) return new Response("image fetch failed", { status: 502 });

  // 3) 回填 R2：冷路径同步写入，仅首位访问者承担一次
  const buf = await upstream.arrayBuffer();
  const res = new Response(buf, { headers });
  res.headers.set("x-r2", "miss");
  if (bucket) {
    try {
      await bucket.put(objKey, buf, { httpMetadata: { contentType } });
    } catch { /* 回填失败不影响本次返回 */ }
  }
  if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

// ---------- 管理端 CRUD（M10：仅 admin 路由调用） ----------
export interface WallpaperUpsert {
  id?: string;
  title?: string;
  tags?: string;        // 逗号分隔
  category: string;     // wallpaper | artwork | character
  device: string;       // pc | mobile
  width?: number;
  height?: number;
  image_url: string;
  thumb_url?: string;
  source?: string;
  source_url?: string;
}

const WP_CATEGORIES = ["wallpaper", "artwork", "character"];
const WP_DEVICES = ["pc", "mobile"];

export async function adminCreateWallpaper(
  db: D1Database, w: WallpaperUpsert,
): Promise<{ id: string } | { error: string }> {
  if (!w.image_url || !/^https?:\/\//.test(w.image_url)) return { error: "image_url 需为 http(s) 直链" };
  if (!WP_CATEGORIES.includes(w.category)) return { error: "category 无效" };
  if (!WP_DEVICES.includes(w.device)) return { error: "device 无效" };
  const id = (w.id || "u" + Math.random().toString(36).slice(2, 9)).replace(/[^a-z0-9]/gi, "").slice(0, 16);
  if (!id) return { error: "id 无效" };
  const exists = await db.prepare("SELECT id FROM wallpapers WHERE id = ?").bind(id).first();
  if (exists) return { error: `id「${id}」已存在` };
  const width = w.width || 0, height = w.height || 0;
  await db
    .prepare(
      `INSERT INTO wallpapers (id,title,tags,category,device,width,height,ratio,file_type,file_size,colors,favorites,views,source,source_url,image_url,thumb_url,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,0,0,?,?,?,?,datetime('now'))`,
    )
    .bind(
      id, w.title || null, w.tags || null, w.category, w.device,
      width, height, height ? width / height : null,
      w.image_url.endsWith(".png") ? "image/png" : "image/jpeg",
      w.source || "manual", w.source_url || null, w.image_url, w.thumb_url || null,
    )
    .run();
  return { id };
}

export async function adminUpdateWallpaper(
  db: D1Database, id: string,
  w: Partial<WallpaperUpsert>,
): Promise<{ ok: true } | { error: string }> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (w.title !== undefined) { sets.push("title = ?"); binds.push(w.title || null); }
  if (w.tags !== undefined) { sets.push("tags = ?"); binds.push(w.tags || null); }
  if (w.category !== undefined) {
    if (!WP_CATEGORIES.includes(w.category)) return { error: "category 无效" };
    sets.push("category = ?"); binds.push(w.category);
  }
  if (w.device !== undefined) {
    if (!WP_DEVICES.includes(w.device)) return { error: "device 无效" };
    sets.push("device = ?"); binds.push(w.device);
  }
  if (w.source_url !== undefined) { sets.push("source_url = ?"); binds.push(w.source_url || null); }
  if (w.image_url !== undefined) {
    if (!/^https?:\/\//.test(w.image_url)) return { error: "image_url 需为 http(s) 直链" };
    sets.push("image_url = ?"); binds.push(w.image_url);
  }
  if (w.thumb_url !== undefined) { sets.push("thumb_url = ?"); binds.push(w.thumb_url || null); }
  if (!sets.length) return { error: "没有要更新的字段" };
  const r = await db
    .prepare(`UPDATE wallpapers SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds, id.replace(/[^a-z0-9]/gi, ""))
    .run();
  if (!r.meta.changes) return { error: "壁纸不存在" };
  return { ok: true };
}

export async function adminDeleteWallpaper(
  db: D1Database, id: string, bucket?: R2Bucket,
): Promise<{ ok: true } | { error: string }> {
  const safe = id.replace(/[^a-z0-9]/gi, "");
  const r = await db.prepare("DELETE FROM wallpapers WHERE id = ?").bind(safe).run();
  if (!r.meta.changes) return { error: "壁纸不存在" };
  // 顺带清掉 R2 自托管副本（失败不影响删除结果）
  if (bucket) {
    try { await bucket.delete([`wallpapers/${safe}`, `wallpapers_small/${safe}`]); } catch { /* noop */ }
  }
  return { ok: true };
}
