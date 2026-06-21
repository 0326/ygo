// M0.3 数据 API 的 D1 查询层。所有 SQL 集中于此。
import type {
  CardSummary, CardDetail, Artwork, Print, ArchetypeSummary,
  SearchResponse, SetSummary, Frame, Attribute, CardType, LinkMarker,
  MonsterSubtype, BanInfo, BanStatus,
} from "../../shared/types";
import { thumbUrl, fullUrl } from "./images";

interface CardRow {
  id: number; cn_name: string; en_name: string; card_type: string;
  frame: string; attribute: string | null; race: string | null;
  level: number | null; link_val: number | null; link_markers: string | null;
  scale: number | null; atk: number | null; def: number | null;
  effect_cn?: string; pendulum_effect_cn?: string | null;
  subtypes?: string | null; archetype_id?: number | null;
  default_key?: string | null;
  ban_ocg?: number | null; ban_tcg?: number | null; ban_md?: number | null;
}

const COLS = `c.id,c.cn_name,c.en_name,c.card_type,c.frame,c.attribute,c.race,
  c.level,c.link_val,c.link_markers,c.scale,c.atk,c.def,c.subtypes,c.archetype_id,
  (SELECT image_key FROM card_artworks a WHERE a.card_id=c.id ORDER BY a.is_default DESC, a.id LIMIT 1) AS default_key,
  (SELECT status FROM banlist b WHERE b.card_id=c.id AND b.format='ocg') AS ban_ocg,
  (SELECT status FROM banlist b WHERE b.card_id=c.id AND b.format='tcg') AS ban_tcg,
  (SELECT status FROM banlist b WHERE b.card_id=c.id AND b.format='md') AS ban_md`;

function toBan(r: CardRow): BanInfo | null {
  const ban: BanInfo = {};
  if (r.ban_ocg != null) ban.ocg = r.ban_ocg as BanStatus;
  if (r.ban_tcg != null) ban.tcg = r.ban_tcg as BanStatus;
  if (r.ban_md != null) ban.md = r.ban_md as BanStatus;
  return Object.keys(ban).length ? ban : null;
}

function toSummary(r: CardRow): CardSummary {
  const key = r.default_key || String(r.id);
  return {
    id: r.id,
    cn_name: r.cn_name,
    en_name: r.en_name,
    card_type: r.card_type as CardType,
    frame: r.frame as Frame,
    attribute: (r.attribute as Attribute) ?? null,
    level: r.level ?? null,
    link_val: r.link_val ?? null,
    link_markers: r.link_markers ? (JSON.parse(r.link_markers) as LinkMarker[]) : null,
    scale: r.scale ?? null,
    atk: r.atk ?? null,
    def: r.def ?? null,
    race: r.race ?? null,
    subtypes: r.subtypes ? (JSON.parse(r.subtypes) as MonsterSubtype[]) : null,
    ban: toBan(r),
    thumb_url: thumbUrl(key),
  };
}

export async function search(
  db: D1Database,
  params: {
    q?: string; frame?: string; attribute?: string; race?: string;
    level?: string; archetype?: string; type?: string;
    level_min?: string; level_max?: string;
    atk_min?: string; atk_max?: string; def_min?: string; def_max?: string;
    link?: string; scale?: string; subtype?: string;
    page: number; size: number; sort?: string;
  }
): Promise<SearchResponse> {
  const where: string[] = [];
  const binds: unknown[] = [];
  let from = "cards c";

  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    const esc = q.replace(/"/g, '""');
    if (q.length >= 3) {
      // FTS5 trigram：≥3 字
      from = "cards_fts f JOIN cards c ON c.id=f.rowid";
      where.push("cards_fts MATCH ?");
      binds.push(`"${esc}"`);
    } else if (q.length === 2 && /[一-鿿]/.test(q)) {
      // 双字 CJK：走 bigram 索引（trigram 无法匹配 2 字）
      from = "cards_bigram b JOIN cards c ON c.id=b.rowid";
      where.push("cards_bigram MATCH ?");
      binds.push(`"${esc}"`);
    } else {
      // 单字或拉丁短词：LIKE 兜底
      where.push("(c.cn_name LIKE ? OR c.en_name LIKE ?)");
      binds.push(`%${q}%`, `%${q}%`);
    }
  }
  const inList = (col: string, val?: string) => {
    if (!val) return;
    const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    where.push(`c.${col} IN (${parts.map(() => "?").join(",")})`);
    binds.push(...parts);
  };
  inList("frame", params.frame);
  inList("attribute", params.attribute);
  inList("race", params.race);
  inList("card_type", params.type);
  if (params.level) {
    where.push("c.level = ?");
    binds.push(parseInt(params.level, 10));
  }
  // 区间筛选（等级/攻/守）
  const range = (col: string, min?: string, max?: string) => {
    if (min) { where.push(`c.${col} >= ?`); binds.push(parseInt(min, 10)); }
    if (max) { where.push(`c.${col} <= ?`); binds.push(parseInt(max, 10)); }
  };
  range("level", params.level_min, params.level_max);
  range("atk", params.atk_min, params.atk_max);
  range("def", params.def_min, params.def_max);
  if (params.link) { where.push("c.link_val = ?"); binds.push(parseInt(params.link, 10)); }
  if (params.scale) { where.push("c.scale = ?"); binds.push(parseInt(params.scale, 10)); }
  // 怪兽子类型（JSON 数组内匹配，逗号分隔取交集）
  if (params.subtype) {
    for (const s of params.subtype.split(",").map((x) => x.trim()).filter(Boolean)) {
      where.push("c.subtypes LIKE ?");
      binds.push(`%"${s}"%`);
    }
  }
  if (params.archetype) {
    where.push("c.archetype_id = ?");
    binds.push(parseInt(params.archetype, 10));
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const order =
    params.sort === "atk" ? "c.atk DESC" :
    params.sort === "level" ? "c.level DESC, c.atk DESC" :
    "c.id ASC";

  const size = Math.min(Math.max(params.size, 1), 60);
  const page = Math.max(params.page, 1);
  const offset = (page - 1) * size;

  const countRow = await db
    .prepare(`SELECT count(*) AS n FROM ${from} ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const { results } = await db
    .prepare(`SELECT ${COLS} FROM ${from} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...binds, size, offset)
    .all<CardRow>();

  return { total, page, size, items: (results || []).map(toSummary) };
}

export async function cardDetail(db: D1Database, id: number): Promise<CardDetail | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, c.effect_cn, c.pendulum_effect_cn FROM cards c WHERE c.id = ?`)
    .bind(id)
    .first<CardRow>();
  if (!row) return null;

  const artworks = await getArtworks(db, id);
  const prints = await getPrints(db, id);

  let archetype = null;
  const relMap = new Map<number, CardSummary>();
  if (row.archetype_id) {
    const a = await db
      .prepare("SELECT id,cn_name,en_name FROM archetypes WHERE id=?")
      .bind(row.archetype_id)
      .first<{ id: number; cn_name: string; en_name: string }>();
    if (a) archetype = a;
    const rel = await db
      .prepare(`SELECT ${COLS} FROM cards c WHERE c.archetype_id=? AND c.id<>? ORDER BY c.id LIMIT 12`)
      .bind(row.archetype_id, id)
      .all<CardRow>();
    for (const r of rel.results || []) relMap.set(r.id, toSummary(r));
  }
  // 实战联动：效果文本中点名本卡名的卡（"能检索/特召此卡的卡"）
  if (row.cn_name && row.cn_name.length >= 2) {
    const mentions = await db
      .prepare(`SELECT ${COLS} FROM cards c WHERE c.id<>? AND c.effect_cn LIKE ? ORDER BY c.id LIMIT 12`)
      .bind(id, `%${row.cn_name}%`)
      .all<CardRow>();
    for (const r of mentions.results || []) if (!relMap.has(r.id)) relMap.set(r.id, toSummary(r));
  }

  return {
    ...toSummary(row),
    effect_cn: row.effect_cn || "",
    pendulum_effect_cn: row.pendulum_effect_cn ?? null,
    artworks,
    prints,
    archetype,
    related: [...relMap.values()].slice(0, 18),
  };
}

export async function getArtworks(db: D1Database, id: number): Promise<Artwork[]> {
  const { results } = await db
    .prepare("SELECT image_key,is_default,variant_name FROM card_artworks WHERE card_id=? ORDER BY is_default DESC, id")
    .bind(id)
    .all<{ image_key: string; is_default: number; variant_name: string | null }>();
  return (results || []).map((r) => ({
    image_key: r.image_key,
    url: fullUrl(r.image_key),
    thumb_url: thumbUrl(r.image_key),
    is_default: !!r.is_default,
    variant_name: r.variant_name,
  }));
}

async function getPrints(db: D1Database, id: number): Promise<Print[]> {
  const { results } = await db
    .prepare(
      `SELECT p.set_code,p.rarity,p.card_number,s.en_name AS set_name,s.release_date
       FROM card_prints p LEFT JOIN sets s ON s.code=p.set_code
       WHERE p.card_id=? ORDER BY s.release_date IS NULL, s.release_date, p.card_number`
    )
    .bind(id)
    .all<{ set_code: string; rarity: string | null; card_number: string; set_name: string; release_date: number | null }>();
  return (results || []).map((r) => ({
    set_code: r.set_code,
    set_name: r.set_name || r.set_code,
    rarity: r.rarity,
    card_number: r.card_number,
    release_date: r.release_date,
  }));
}

export async function listArchetypes(db: D1Database, min = 4): Promise<ArchetypeSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id,a.cn_name,a.en_name,a.card_count,a.cover_card_id,
        (SELECT image_key FROM card_artworks w WHERE w.card_id=a.cover_card_id ORDER BY w.is_default DESC LIMIT 1) AS cover_key
       FROM archetypes a WHERE a.card_count>=? ORDER BY a.card_count DESC`
    )
    .bind(min)
    .all<{ id: number; cn_name: string; en_name: string; card_count: number; cover_card_id: number | null; cover_key: string | null }>();
  return (results || []).map((r) => ({
    id: r.id,
    cn_name: r.cn_name,
    en_name: r.en_name,
    card_count: r.card_count,
    cover_card_id: r.cover_card_id,
    cover_thumb_url: r.cover_key ? thumbUrl(r.cover_key) : null,
  }));
}

export async function archetypeDetail(
  db: D1Database, id: number
): Promise<{ archetype: ArchetypeSummary; cards: CardSummary[] } | null> {
  const a = await db
    .prepare("SELECT id,cn_name,en_name,card_count,cover_card_id FROM archetypes WHERE id=?")
    .bind(id)
    .first<{ id: number; cn_name: string; en_name: string; card_count: number; cover_card_id: number | null }>();
  if (!a) return null;
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM cards c WHERE c.archetype_id=? ORDER BY c.card_type, c.frame, c.level DESC, c.id`)
    .bind(id)
    .all<CardRow>();
  const cards = (results || []).map(toSummary);
  return {
    archetype: {
      id: a.id, cn_name: a.cn_name, en_name: a.en_name,
      card_count: a.card_count, cover_card_id: a.cover_card_id,
      cover_thumb_url: cards[0]?.thumb_url ?? null,
    },
    cards,
  };
}

export async function listSets(db: D1Database): Promise<SetSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT s.code,s.cn_name,s.en_name,s.release_date,
        (SELECT count(DISTINCT card_id) FROM card_prints p WHERE p.set_code=s.code) AS card_count
       FROM sets s ORDER BY s.release_date IS NULL, s.release_date DESC LIMIT 300`
    )
    .all<SetSummary>();
  return results || [];
}

export async function setDetail(
  db: D1Database, code: string
): Promise<{ set: SetSummary; cards: CardSummary[] } | null> {
  const s = await db
    .prepare("SELECT code,cn_name,en_name,release_date FROM sets WHERE code=?")
    .bind(code)
    .first<{ code: string; cn_name: string; en_name: string; release_date: number | null }>();
  if (!s) return null;
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM cards c
       JOIN (SELECT DISTINCT card_id FROM card_prints WHERE set_code=?) p ON p.card_id=c.id
       ORDER BY c.id`
    )
    .bind(code)
    .all<CardRow>();
  const cards = (results || []).map(toSummary);
  return { set: { ...s, card_count: cards.length }, cards };
}

// 站点统计（首页用）
export async function stats(db: D1Database) {
  const r = await db
    .prepare(
      "SELECT (SELECT count(*) FROM cards) AS cards,(SELECT count(*) FROM archetypes) AS archetypes,(SELECT count(*) FROM card_artworks) AS artworks,(SELECT count(*) FROM sets) AS sets"
    )
    .first<{ cards: number; archetypes: number; artworks: number; sets: number }>();
  return r;
}
