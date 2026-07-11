// 自动同步卡牌数据：拉取上游最新源 -> 派生辅助文件 -> build-data.mjs -> (可选) 写入 D1
// 用法: node scripts/sync-data.mjs [--apply local|remote] [--force] [--skip-download]
//   --apply local|remote  重建 seed 后执行 wrangler d1 execute 写入本地/远端 D1
//   --force               忽略版本指纹，强制重建 + 写入
//   --skip-download       不下载，直接用 data/ 现有源文件重建（调试用）
//
// 上游数据源（与 README「数据来源」一致）：
//   - YGOPRODeck cardinfo.php?misc=yes  -> data/ygoprodeck-full.json（结构化字段/异画/收录/禁限 + misc_info）
//   - YGOPRODeck cardsets.php           -> data/ygoprodeck-sets.json（卡包发售日）
//   - mycard/ygopro-database zh-CN cdb  -> data/cards.cdb（简中名称/效果）
//   - mycard/ygopro-database ja-JP cdb  -> data/cards-ja.cdb（日文名称/效果）
// 派生文件（从 misc_info 提取，供 build-data.mjs 消费）：
//   - data/formats.json   {卡密: "ocg,tcg,md"}
//   - data/md-rarity.json {卡密: "Common|Rare|Super Rare|Ultra Rare"}
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = `${ROOT}data/`;
const STATE_FILE = `${DATA}.sync-state.json`;

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const SKIP_DOWNLOAD = argv.includes("--skip-download");
const APPLY = (() => {
  const i = argv.indexOf("--apply");
  if (i === -1) return null;
  const v = argv[i + 1];
  if (v !== "local" && v !== "remote") {
    console.error(`--apply 只接受 local|remote，收到: ${v}`);
    process.exit(1);
  }
  return v;
})();

const SOURCES = {
  ver: "https://db.ygoprodeck.com/api/v7/checkDBVer.php",
  info: "https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes",
  sets: "https://db.ygoprodeck.com/api/v7/cardsets.php",
  cdbCn: "https://github.com/mycard/ygopro-database/raw/master/locales/zh-CN/cards.cdb",
  cdbJa: "https://github.com/mycard/ygopro-database/raw/master/locales/ja-JP/cards.cdb",
};

// curl 下载（跟随重定向、失败重试、原子写入）；curl 会自动读取 HTTP(S)_PROXY 环境变量
function download(url, dest) {
  const tmp = `${dest}.download`;
  console.log(`  GET ${url}`);
  execFileSync("curl", ["-fsSL", "--retry", "3", "--retry-delay", "2", "-o", tmp, url], {
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 10 * 60 * 1000,
  });
  renameSync(tmp, dest);
}

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

// ---- 1. 上游版本指纹 ----
console.log("checking upstream versions...");
let dbVer = null;
try {
  const raw = execFileSync("curl", ["-fsSL", "--retry", "3", SOURCES.ver], { timeout: 60_000 }).toString();
  const v = JSON.parse(raw)?.[0];
  dbVer = v ? `${v.database_version}@${v.last_update}` : null;
  console.log(`  ygoprodeck db: ${dbVer}`);
} catch (e) {
  console.warn(`  checkDBVer 失败（${e.message}），跳过版本比对继续同步`);
}

// ---- 2. 下载源数据 ----
if (!SKIP_DOWNLOAD) {
  console.log("downloading sources...");
  download(SOURCES.info, `${DATA}ygoprodeck-full.json`);
  download(SOURCES.sets, `${DATA}ygoprodeck-sets.json`);
  download(SOURCES.cdbCn, `${DATA}cards.cdb`);
  download(SOURCES.cdbJa, `${DATA}cards-ja.cdb`);
}

// ---- 3. 指纹比对（ygoprodeck 版本 + 两个 cdb 内容哈希）----
const fingerprint = {
  ygoprodeck: dbVer,
  cdb_cn: sha256(`${DATA}cards.cdb`),
  cdb_ja: sha256(`${DATA}cards-ja.cdb`),
};
const prevState = (() => {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return null; }
})();
const unchanged =
  prevState &&
  dbVer !== null &&
  prevState.fingerprint?.ygoprodeck === fingerprint.ygoprodeck &&
  prevState.fingerprint?.cdb_cn === fingerprint.cdb_cn &&
  prevState.fingerprint?.cdb_ja === fingerprint.cdb_ja &&
  // 上次未写入目标（或写入了别的目标）时不视为已同步
  (!APPLY || prevState.applied?.includes(APPLY));
if (unchanged && !FORCE) {
  console.log("up to date（上游无更新，--force 可强制重建）");
  process.exit(0);
}

// ---- 4. 派生 formats.json / md-rarity.json（来源 misc_info）----
console.log("deriving formats.json / md-rarity.json...");
const full = JSON.parse(readFileSync(`${DATA}ygoprodeck-full.json`, "utf8")).data;
const FORMAT_KEY = { OCG: "ocg", TCG: "tcg", "Master Duel": "md" };
const formats = {};
const mdRarity = {};
for (const c of full) {
  const misc = c.misc_info?.[0];
  if (!misc) continue;
  const fs = (misc.formats || [])
    .map((f) => FORMAT_KEY[f])
    .filter(Boolean)
    .sort((a, b) => ["ocg", "tcg", "md"].indexOf(a) - ["ocg", "tcg", "md"].indexOf(b));
  if (fs.length) formats[c.id] = fs.join(",");
  if (misc.md_rarity) mdRarity[c.id] = misc.md_rarity;
}
writeFileSync(`${DATA}formats.json`, JSON.stringify(formats));
writeFileSync(`${DATA}md-rarity.json`, JSON.stringify(mdRarity));
console.log(`  ${full.length} cards, ${Object.keys(formats).length} formats, ${Object.keys(mdRarity).length} md rarities`);

// ---- 5. 重建 seed.sql ----
console.log("rebuilding seed.sql...");
execFileSync("node", [`${ROOT}scripts/build-data.mjs`], { stdio: "inherit" });

// ---- 6. 写入 D1（可选）----
if (APPLY) {
  console.log(`applying to ${APPLY} D1...`);
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "ygo-db", `--${APPLY}`, "--file", "data/seed.sql", "-y"],
    { cwd: ROOT, stdio: "inherit", timeout: 20 * 60 * 1000 }
  );
}

// ---- 7. 记录同步状态 ----
// applied 只在指纹未变时继承（同一版数据先 local 后 remote 各记一次）
const samePrev =
  prevState?.fingerprint?.ygoprodeck === fingerprint.ygoprodeck &&
  prevState?.fingerprint?.cdb_cn === fingerprint.cdb_cn &&
  prevState?.fingerprint?.cdb_ja === fingerprint.cdb_ja;
const applied = new Set(samePrev ? prevState.applied || [] : []);
if (APPLY) applied.add(APPLY);
writeFileSync(
  STATE_FILE,
  JSON.stringify({ fingerprint, applied: [...applied], synced_at: new Date().toISOString() }, null, 2)
);
console.log(`done${APPLY ? `（已写入 ${APPLY} D1）` : "（未写入 D1，加 --apply local|remote）"}`);
