// M2.3 组卡器：卡组模型、规则校验、YDK 与分享链接编解码。
import type { CardSummary, Frame } from "../../shared/types";

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
export function validate(deck: Deck): DeckValidation {
  const errors: string[] = [];
  if (deck.main.length < LIMITS.mainMin) errors.push(`主卡组不足 ${LIMITS.mainMin} 张（当前 ${deck.main.length}）`);
  if (deck.main.length > LIMITS.mainMax) errors.push(`主卡组超过 ${LIMITS.mainMax} 张`);
  if (deck.extra.length > LIMITS.extraMax) errors.push(`额外卡组超过 ${LIMITS.extraMax} 张`);
  if (deck.side.length > LIMITS.sideMax) errors.push(`副卡组超过 ${LIMITS.sideMax} 张`);
  // 同名卡（同卡密）全卡组合计 ≤ 3
  const all = [...deck.main, ...deck.extra, ...deck.side];
  const seen = new Map<number, number>();
  for (const id of all) seen.set(id, (seen.get(id) || 0) + 1);
  for (const [, n] of seen) if (n > LIMITS.perCard) { errors.push(`存在同名卡超过 ${LIMITS.perCard} 张`); break; }
  return { ok: errors.length === 0, errors };
}

// ---- YDK 导出（ygopro 卡组格式） ----
export function toYdk(deck: Deck): string {
  return [
    "#created by 哈基米卡库 ygo.hajimikitty.com",
    "#main",
    ...deck.main.map(String),
    "#extra",
    ...deck.extra.map(String),
    "!side",
    ...deck.side.map(String),
    "",
  ].join("\n");
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
  return b64urlEncode(`${part(deck.main)}~${part(deck.extra)}~${part(deck.side)}`);
}
export function decodeDeck(code: string): Deck {
  try {
    const raw = b64urlDecode(code);
    const [m, e, s] = raw.split("~");
    const nums = (x?: string) =>
      (x || "").split(".").map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
    return { main: nums(m), extra: nums(e), side: nums(s) };
  } catch {
    return emptyDeck();
  }
}

// 全部去重 id（用于批量取卡数据）
export function uniqueIds(deck: Deck): number[] {
  return [...new Set([...deck.main, ...deck.extra, ...deck.side])];
}
