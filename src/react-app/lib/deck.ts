// M2.3 组卡器：卡组模型、规则校验、YDK 与分享链接编解码。
import type {
  CardSummary,
  Frame,
  BanFormat,
  BanStatus,
  Lang,
} from "../../shared/types";

export type Zone = "main" | "extra" | "side";

// 额外卡组卡框：融合 / 同调 / 超量 / 连接
const EXTRA_FRAMES: Frame[] = ["fusion", "synchro", "xyz", "link"];
export function isExtraCard(c: CardSummary): boolean {
  return EXTRA_FRAMES.includes(c.frame);
}
// 添加时默认归位：额外卡框入额外卡组，其余入主卡组
export function defaultZone(c: CardSummary): Zone {
  return isExtraCard(c) ? "extra" : "main";
}

export interface Deck {
  main: number[];
  extra: number[];
  side: number[];
}
export const emptyDeck = (): Deck => ({ main: [], extra: [], side: [] });

export const LIMITS = {
  mainMin: 40,
  mainMax: 60,
  extraMax: 15,
  sideMax: 15,
  perCard: 3,
};

export function countOf(deck: Deck, id: number): number {
  const c = (a: number[]) => a.filter((x) => x === id).length;
  return c(deck.main) + c(deck.extra) + c(deck.side);
}

export interface DeckValidation {
  ok: boolean;
  errors: string[];
}
// 禁限状态 → 单卡上限张数（0=禁→0, 1=限→1, 2=准限→2）
const BAN_MAX: Record<BanStatus, number> = { 0: 0, 1: 1, 2: 2 };

export interface ValidateOpts {
  cards?: Map<number, CardSummary>; // 用于禁限校验
  format?: BanFormat; // 'ocg' | 'tcg' | 'md'，默认 ocg
  lang?: Lang; // 卡名显示语言，默认 cn
}
export function validate(deck: Deck, opts: ValidateOpts = {}): DeckValidation {
  const errors: string[] = [];
  if (deck.main.length < LIMITS.mainMin)
    errors.push(`主卡组不足 ${LIMITS.mainMin} 张（当前 ${deck.main.length}）`);
  if (deck.main.length > LIMITS.mainMax)
    errors.push(`主卡组超过 ${LIMITS.mainMax} 张`);
  if (deck.extra.length > LIMITS.extraMax)
    errors.push(`额外卡组超过 ${LIMITS.extraMax} 张`);
  if (deck.side.length > LIMITS.sideMax)
    errors.push(`副卡组超过 ${LIMITS.sideMax} 张`);
  // 额外卡组卡框误入主/副卡组
  const cards = opts.cards;
  if (cards) {
    const misplaced = (zone: number[], wantExtra: boolean) =>
      zone.some((id) => {
        const c = cards.get(id);
        return c && isExtraCard(c) !== wantExtra;
      });
    if (misplaced(deck.main, false))
      errors.push("主卡组混入了额外卡组卡（融合/同调/超量/连接）");
    if (misplaced(deck.extra, true)) errors.push("额外卡组混入了非额外卡组卡");
  }
  // 同名卡（同卡密）全卡组合计上限：默认 3，禁限收紧
  const all = [...deck.main, ...deck.extra, ...deck.side];
  const seen = new Map<number, number>();
  for (const id of all) seen.set(id, (seen.get(id) || 0) + 1);
  const fmt = opts.format ?? "ocg";
  const lg = opts.lang ?? "cn";
  for (const [id, n] of seen) {
    const card = cards?.get(id);
    const status = card?.ban?.[fmt];
    const max = status != null ? BAN_MAX[status] : LIMITS.perCard;
    if (n > max) {
      const name = card
        ? (lg === "en" ? (card.en_name || card.cn_name) : lg === "jp" ? (card.jp_name || card.en_name || card.cn_name) : (card.cn_name || card.en_name))
        : `#${id}`;
      const tag =
        status === 0
          ? "禁止卡"
          : status === 1
            ? "限制(上限1)"
            : status === 2
              ? "准限制(上限2)"
              : `上限 ${LIMITS.perCard}`;
      errors.push(`「${name}」${tag}，当前 ${n} 张`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---- YDK 导出（ygopro 卡组格式） ----
export function toYdk(deck: Deck): string {
  return [
    "#created by 游戏王集卡社 ygo.hajimikitty.com",
    "#main",
    ...deck.main.map(String),
    "#extra",
    ...deck.extra.map(String),
    "!side",
    ...deck.side.map(String),
    "",
  ].join("\n");
}

// ---- YDK 导入（解析 ygopro 卡组格式） ----
export function fromYdk(text: string): Deck {
  const deck = emptyDeck();
  let zone: Zone | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#main")) {
      zone = "main";
      continue;
    }
    if (line.startsWith("#extra")) {
      zone = "extra";
      continue;
    }
    if (line.startsWith("!side")) {
      zone = "side";
      continue;
    }
    if (line.startsWith("#")) continue; // 注释行（#created by ...）
    const id = parseInt(line, 10);
    if (zone && Number.isFinite(id) && id > 0) deck[zone].push(id);
  }
  return deck;
}

// ---- 卡组统计（曲线 / 分布 / 比例），纯前端聚合 ----
export interface DeckStats {
  total: number;
  byCardType: { monster: number; spell: number; trap: number };
  levelCurve: { level: number; count: number }[]; // 主卡组怪兽等级/阶分布
  byAttribute: Record<string, number>;
  byRace: Record<string, number>;
}
export function deckStats(
  deck: Deck,
  cards: Map<number, CardSummary>,
): DeckStats {
  const byCardType = { monster: 0, spell: 0, trap: 0 };
  const byAttribute: Record<string, number> = {};
  const byRace: Record<string, number> = {};
  const levelCount = new Map<number, number>();
  for (const id of deck.main) {
    const c = cards.get(id);
    if (!c) continue;
    byCardType[c.card_type]++;
    if (c.card_type === "monster") {
      if (c.attribute)
        byAttribute[c.attribute] = (byAttribute[c.attribute] || 0) + 1;
      if (c.race) byRace[c.race] = (byRace[c.race] || 0) + 1;
      const lv = c.frame === "link" ? (c.link_val ?? 0) : (c.level ?? 0);
      if (lv > 0) levelCount.set(lv, (levelCount.get(lv) || 0) + 1);
    }
  }
  const levelCurve = [...levelCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => ({ level, count }));
  return {
    total: deck.main.length,
    byCardType,
    levelCurve,
    byAttribute,
    byRace,
  };
}

// ---- 起手概率（超几何分布） ----
// 在 deckSize 张卡组中有 successes 张目标卡，抽 handSize 张，至少摸到 atLeast 张的概率。
function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}
export function hyperAtLeast(
  deckSize: number,
  successes: number,
  handSize: number,
  atLeast = 1,
): number {
  if (deckSize <= 0 || handSize <= 0 || successes <= 0) return 0;
  handSize = Math.min(handSize, deckSize);
  const denom = logChoose(deckSize, handSize);
  let cum = 0; // P(摸到 0..atLeast-1 张) 累加后取补
  const maxFail = Math.min(atLeast - 1, successes, handSize);
  for (let k = 0; k <= maxFail; k++) {
    const ln =
      logChoose(successes, k) +
      logChoose(deckSize - successes, handSize - k) -
      denom;
    if (Number.isFinite(ln)) cum += Math.exp(ln);
  }
  return Math.max(0, Math.min(1, 1 - cum));
}

// ---- 分享链接编解码（紧凑 base64url） ----
function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}
export function encodeDeck(deck: Deck): string {
  const part = (a: number[]) => a.join(".");
  return b64urlEncode(
    `${part(deck.main)}~${part(deck.extra)}~${part(deck.side)}`,
  );
}
export function decodeDeck(code: string): Deck {
  try {
    const raw = b64urlDecode(code);
    const [m, e, s] = raw.split("~");
    const nums = (x?: string) =>
      (x || "")
        .split(".")
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n));
    return { main: nums(m), extra: nums(e), side: nums(s) };
  } catch {
    return emptyDeck();
  }
}

// 全部去重 id（用于批量取卡数据）
export function uniqueIds(deck: Deck): number[] {
  return [...new Set([...deck.main, ...deck.extra, ...deck.side])];
}
