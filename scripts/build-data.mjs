// M0.1 数据管线：cdb(简中) + YGOPRODeck(结构化/异画/收录) -> 归一化 -> seed.sql
// 用法: node scripts/build-data.mjs [--limit N]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

// ---- 1. 读取 CN 文本 (cdb) ----
console.log("reading cdb (CN names/effects)...");
const cnRaw = execFileSync(
  "sqlite3",
  [`${ROOT}data/cards.cdb`, "-json", "SELECT id,name,desc FROM texts"],
  { maxBuffer: 1 << 30 }
).toString();
const cnMap = new Map();
for (const r of JSON.parse(cnRaw)) cnMap.set(r.id, { name: r.name, desc: r.desc });
console.log(`  ${cnMap.size} CN texts`);

// ---- 2. 读取 YGOPRODeck ----
console.log("reading ygoprodeck dump...");
const ygo = JSON.parse(readFileSync(`${ROOT}data/ygoprodeck-full.json`, "utf8")).data;
const ygoSets = JSON.parse(readFileSync(`${ROOT}data/ygoprodeck-sets.json`, "utf8"));
const setDate = new Map(); // prefix -> epoch
for (const s of ygoSets) {
  if (s.set_code && s.tcg_date) setDate.set(s.set_code, Date.parse(s.tcg_date) / 1000 | 0);
}

// ---- helpers ----
const baseFrame = (ft) => (ft || "").replace(/_pendulum$/, "") || "normal";
const cardType = (t) =>
  /Spell Card/i.test(t) ? "spell" : /Trap Card/i.test(t) ? "trap" : "monster";
const markerKey = (m) => m.toLowerCase().replace(/\s+/g, "-"); // "Bottom-Left" -> "bottom-left"
const num = (v) => (v === undefined || v === null ? null : v);

// ---- 3. 归一化 ----
const archIndex = new Map(); // name -> {id, en_name, count, cover}
let archSeq = 1;
const cards = [];
const artworks = [];
const prints = [];
const printKeys = new Set();
const setsMap = new Map(); // code -> {code,name,date}

let count = 0;
for (const c of ygo) {
  if (count >= LIMIT) break;
  count++;
  const ct = cardType(c.type);
  const cn = cnMap.get(c.id);
  let archId = null;
  if (c.archetype) {
    let a = archIndex.get(c.archetype);
    if (!a) {
      a = { id: archSeq++, en_name: c.archetype, count: 0, cover: c.id };
      archIndex.set(c.archetype, a);
    }
    a.count++;
    archId = a.id;
  }
  cards.push({
    id: c.id,
    cn_name: cn?.name || c.name,
    jp_name: null,
    en_name: c.name,
    card_type: ct,
    frame: baseFrame(c.frameType),
    attribute: ct === "monster" ? num(c.attribute) : null,
    race: num(c.race),
    level: num(c.level),
    link_val: num(c.linkval),
    link_markers: c.linkmarkers ? JSON.stringify(c.linkmarkers.map(markerKey)) : null,
    scale: num(c.scale),
    atk: num(c.atk),
    def: num(c.def),
    effect_cn: cn?.desc || c.desc,
    archetype_id: archId,
    alias_of: null,
    updated_at: Math.floor(Date.parse(c.misc_info?.[0]?.tcg_date || 0) / 1000) || 0,
  });

  // artworks
  const imgs = c.card_images || [];
  imgs.forEach((img, i) => {
    artworks.push({
      card_id: c.id,
      image_key: String(img.id),
      is_default: i === 0 ? 1 : 0,
      variant_name: i === 0 ? null : `异画 ${i + 1}`,
      source: "ygoprodeck",
    });
  });

  // prints / sets
  for (const s of c.card_sets || []) {
    const number = s.set_code; // e.g. LOB-EN001
    const prefix = (number.split("-")[0] || number).trim();
    if (!setsMap.has(prefix)) {
      setsMap.set(prefix, {
        code: prefix,
        name: s.set_name,
        date: setDate.get(prefix) ?? null,
      });
    }
    const pk = `${c.id}|${prefix}|${number}`;
    if (printKeys.has(pk)) continue;
    printKeys.add(pk);
    prints.push({
      card_id: c.id,
      set_code: prefix,
      rarity: s.set_rarity || null,
      card_number: number,
    });
  }
}

// fill archetype covers (prefer a monster cover)
const archetypes = [...archIndex.values()].map((a) => ({
  id: a.id,
  cn_name: a.en_name,
  en_name: a.en_name,
  cover_card_id: a.cover,
  card_count: a.count,
}));

console.log(
  `normalized: ${cards.length} cards, ${artworks.length} artworks, ${prints.length} prints, ${setsMap.size} sets, ${archetypes.length} archetypes`
);

// ---- 4. 生成 seed.sql ----
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const out = [];
out.push("PRAGMA foreign_keys=OFF;");
out.push("DELETE FROM card_prints; DELETE FROM sets; DELETE FROM card_artworks; DELETE FROM archetypes; DELETE FROM cards; DELETE FROM cards_fts;");

function batchInsert(table, cols, rows, rowToVals) {
  const SIZE = 40;
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE);
    out.push(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES\n` +
        chunk.map((r) => "(" + rowToVals(r).map(q).join(",") + ")").join(",\n") +
        ";"
    );
  }
}

batchInsert(
  "cards",
  ["id","cn_name","jp_name","en_name","card_type","frame","attribute","race","level","link_val","link_markers","scale","atk","def","effect_cn","archetype_id","alias_of","updated_at"],
  cards,
  (r) => [r.id,r.cn_name,r.jp_name,r.en_name,r.card_type,r.frame,r.attribute,r.race,r.level,r.link_val,r.link_markers,r.scale,r.atk,r.def,r.effect_cn,r.archetype_id,r.alias_of,r.updated_at]
);
batchInsert(
  "card_artworks",
  ["card_id","image_key","is_default","variant_name","source"],
  artworks,
  (r) => [r.card_id,r.image_key,r.is_default,r.variant_name,r.source]
);
batchInsert(
  "archetypes",
  ["id","cn_name","en_name","cover_card_id","card_count"],
  archetypes,
  (r) => [r.id,r.cn_name,r.en_name,r.cover_card_id,r.card_count]
);
batchInsert(
  "sets",
  ["code","cn_name","en_name","release_date"],
  [...setsMap.values()],
  (r) => [r.code, r.name, r.name, r.date]
);
batchInsert(
  "card_prints",
  ["card_id","set_code","rarity","card_number"],
  prints,
  (r) => [r.card_id, r.set_code, r.rarity, r.card_number]
);
out.push("INSERT INTO cards_fts(rowid,cn_name,en_name,effect_cn) SELECT id,cn_name,en_name,effect_cn FROM cards;");

writeFileSync(`${ROOT}data/seed.sql`, out.join("\n"));
console.log(`wrote data/seed.sql (${(out.join("\n").length / 1e6).toFixed(1)} MB)`);
