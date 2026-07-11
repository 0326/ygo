// M9 壁纸采集：从 Wallhaven API 拉取游戏王相关高清壁纸，生成 data/wallpapers.seed.sql。
// 用法：node scripts/collect-wallpapers.mjs [--max-pages N] [--enrich N]
//   --max-pages  基础查询最多翻页数（默认全量）
//   --enrich     对收藏数最高的前 N 张补拉详情标签（默认 400，受 45 req/min 限速约束）
// 设计：
//   1) 基础集 = q=yu-gi-oh 全量翻页（含横竖屏），按 ratio 分 pc/mobile
//   2) 角色/原画子查询命中的 id 归类 character/artwork，并把查询词写入 tags
//   3) 详情补全 top-N 的完整标签（wallhaven 搜索接口不返回 tags）
// 输出为幂等 seed（INSERT OR REPLACE），可重复执行增量刷新。

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://wallhaven.cc/api/v1";
// wallhaven 限速 45 req/min，留余量按 ~38 req/min 走
const THROTTLE_MS = 1600;

const args = process.argv.slice(2);
const argNum = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? parseInt(args[i + 1], 10) : def;
};
const MAX_PAGES = argNum("--max-pages", Infinity);
const ENRICH_N = argNum("--enrich", 400);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "ygo-club-wallpaper-bot/1.0" } });
      if (res.status === 429) { await sleep(20000); continue; }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(5000);
    }
  }
}

// 基础/子查询统一走搜索接口（categories=110 综合+动漫，purity=100 仅 SFW）
async function searchAll(q, label, maxPages = Infinity) {
  const items = [];
  let page = 1, last = 1;
  do {
    const url = `${API}/search?q=${encodeURIComponent(q)}&categories=110&purity=100&sorting=favorites&per_page=24&page=${page}`;
    const json = await getJson(url);
    items.push(...json.data);
    last = json.meta.last_page;
    process.stdout.write(`\r[${label}] page ${page}/${Math.min(last, maxPages)} 累计 ${items.length} 张   `);
    page++;
    await sleep(THROTTLE_MS);
  } while (page <= last && page <= maxPages);
  console.log();
  return items;
}

// 角色（动画人物）与原画（卡片怪兽美术）子查询 → 归类 + 打标签
const CHARACTER_QUERIES = [
  "yami yugi", "yugi muto", "seto kaiba", "joey wheeler", "atem",
  "jaden yuki", "yusei fudo", "yubel", "akiza izinski", "mai valentine",
  "tea gardner", "alexis rhodes", "aki izayoi", "mokuba",
];
const ARTWORK_QUERIES = [
  "dark magician", "dark magician girl", "blue-eyes white dragon",
  "red-eyes black dragon", "exodia", "kuriboh", "stardust dragon",
  "obelisk", "slifer", "ra dragon", "sky striker", "ash blossom",
];

function classifyDevice(w) {
  return w.dimension_x >= w.dimension_y ? "pc" : "mobile";
}

const esc = (s) => String(s).replace(/'/g, "''");

async function main() {
  console.log("== M9 壁纸采集（Wallhaven）==");
  const base = await searchAll("yu-gi-oh", "yu-gi-oh 基础集", MAX_PAGES);

  // id → 记录
  const map = new Map();
  for (const w of base) {
    map.set(w.id, {
      id: w.id,
      category: "wallpaper",
      tags: new Set(["yu-gi-oh"]),
      device: classifyDevice(w),
      width: w.dimension_x,
      height: w.dimension_y,
      ratio: Number(w.ratio) || w.dimension_x / w.dimension_y,
      file_type: w.file_type,
      file_size: w.file_size,
      colors: w.colors || [],
      favorites: w.favorites || 0,
      views: w.views || 0,
      source: "wallhaven",
      source_url: w.url,
      image_url: w.path,
      thumb_url: w.thumbs?.large || w.thumbs?.original,
      created_at: w.created_at,
    });
  }

  // 子查询：只对基础集内的 id 重归类/补标签（防止无关图混入）
  const applySub = (list, category, term) => {
    let hit = 0;
    for (const w of list) {
      const rec = map.get(w.id);
      if (!rec) continue;
      rec.tags.add(term);
      if (rec.category === "wallpaper") rec.category = category;
      hit++;
    }
    return hit;
  };
  for (const q of CHARACTER_QUERIES) {
    const list = await searchAll(q, `角色:${q}`, 3);
    console.log(`  ↳ 命中基础集 ${applySub(list, "character", q)} 张`);
  }
  for (const q of ARTWORK_QUERIES) {
    const list = await searchAll(q, `原画:${q}`, 3);
    console.log(`  ↳ 命中基础集 ${applySub(list, "artwork", q)} 张`);
  }

  // 详情标签补全：收藏数 top-N
  const top = [...map.values()].sort((a, b) => b.favorites - a.favorites).slice(0, ENRICH_N);
  console.log(`== 详情标签补全 top ${top.length}（约 ${Math.ceil((top.length * THROTTLE_MS) / 60000)} 分钟）==`);
  let done = 0;
  for (const rec of top) {
    try {
      const json = await getJson(`${API}/w/${rec.id}`);
      for (const t of json.data.tags || []) rec.tags.add(t.name.toLowerCase());
    } catch { /* 单张失败跳过 */ }
    done++;
    if (done % 20 === 0) process.stdout.write(`\r  已补全 ${done}/${top.length}   `);
    await sleep(THROTTLE_MS);
  }
  console.log(`\r  已补全 ${done}/${top.length}   `);

  // 生成 seed SQL
  const rows = [...map.values()];
  const stats = { pc: 0, mobile: 0, wallpaper: 0, artwork: 0, character: 0 };
  for (const r of rows) { stats[r.device]++; stats[r.category]++; }
  console.log(`== 共 ${rows.length} 张：PC ${stats.pc} / 手机 ${stats.mobile}；壁纸 ${stats.wallpaper} / 原画 ${stats.artwork} / 角色 ${stats.character} ==`);

  const lines = [
    "-- M9 壁纸种子数据（scripts/collect-wallpapers.mjs 生成，勿手改）",
    `-- 生成时间：${new Date().toISOString()}；共 ${rows.length} 张`,
    "DELETE FROM wallpapers;",
  ];
  for (const r of rows) {
    const tags = [...r.tags].join(",");
    lines.push(
      `INSERT OR REPLACE INTO wallpapers (id,title,tags,category,device,width,height,ratio,file_type,file_size,colors,favorites,views,source,source_url,image_url,thumb_url,created_at) VALUES (` +
      `'${esc(r.id)}','Yu-Gi-Oh! #${esc(r.id)}','${esc(tags)}','${r.category}','${r.device}',` +
      `${r.width},${r.height},${r.ratio.toFixed(4)},'${esc(r.file_type)}',${r.file_size},` +
      `'${esc(JSON.stringify(r.colors))}',${r.favorites},${r.views},'${esc(r.source)}','${esc(r.source_url)}',` +
      `'${esc(r.image_url)}','${esc(r.thumb_url)}','${esc(r.created_at)}');`
    );
  }
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const out = join(ROOT, "data", "wallpapers.seed.sql");
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`已写入 ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
