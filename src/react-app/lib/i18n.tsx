// M7 多语言：语言上下文 + UI 词典 + 卡片字段按语言选择（含回退链）。
// 资料语言与界面语言统一由一个开关控制：cn(简中) / jp(日文) / en(英文)。
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang, BanStatus, MonsterSubtype } from "../../shared/types";

const LANG_KEY = "ygo.lang";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "cn", label: "中" },
  { value: "jp", label: "日" },
  { value: "en", label: "EN" },
];

// ---------------- UI 词典 ----------------
const CN = {
  // 导航
  "nav.search": "查卡", "nav.archetypes": "系列图鉴", "nav.sets": "卡包",
  "nav.maker": "制卡器", "nav.deck": "组卡", "nav.share": "长图",
  // 通用
  "common.search": "搜索", "common.retry": "重试", "common.prev": "上一页", "common.next": "下一页",
  "common.viewAll": "查看全部 →", "common.empty": "没有匹配的卡片，换个条件试试",
  "common.searchPlaceholder": "搜索卡名 / 效果…", "common.cards": "张",
  // 首页
  "home.heroTitle1": "全卡片 · 全系列 · 中日英三语", "home.heroTitle2": "为决斗者而生", "home.heroTitle3": "的游戏王资料库",
  "home.heroSub": "查卡、禁限、系列图鉴、组卡与制卡，一站式完成。",
  "home.ctaSearch": "开始查卡", "home.ctaArchetypes": "逛系列图鉴", "home.ctaMaker": "试试制卡器 →",
  "home.statCards": "收录卡片", "home.statArtworks": "卡图(含异画)", "home.statArchetypes": "系列", "home.statSets": "卡包",
  "home.hotCards": "热门卡片", "home.hotArchetypes": "热门系列图鉴", "home.seriesLoadFail": "系列加载失败：",
  // 查卡页
  "search.title": "查卡", "search.matched": "共 {n} 张匹配", "search.sub": "卡名 / 效果全文检索 + 多维筛选",
  "filter.cardType": "卡种", "filter.frame": "卡框", "filter.attribute": "属性", "filter.race": "种族",
  "filter.spellType": "魔法种类", "filter.trapType": "陷阱种类", "filter.sort": "排序",
  "filter.advanced": "高级筛选", "filter.level": "等级/阶", "filter.atk": "攻击力", "filter.def": "守备力",
  "filter.link": "LINK 值", "filter.scale": "灵摆刻度", "filter.subtype": "子类型", "filter.mdRarity": "MD 罕贵",
  "filter.format": "赛制", "filter.more": "更多…", "filter.less": "收起",
  "filter.min": "最小", "filter.max": "最大",
  "sort.default": "默认", "sort.atk": "攻击力", "sort.level": "等级",
  // 详情页
  "detail.pendEffect": "灵摆效果", "detail.monsterEffect": "怪兽效果", "detail.cardEffect": "卡片效果",
  "detail.flavorText": "卡图设定", "detail.prints": "收录情况", "detail.related": "同系列关联卡",
  "detail.set": "卡包", "detail.cardNo": "卡号", "detail.rarity": "罕贵", "detail.release": "发售",
  "detail.atk": "攻击", "detail.def": "守备", "detail.level": "等级", "detail.rank": "阶级",
  "detail.linkMarkers": "连接标记", "detail.scale": "灵摆刻度",
  "detail.makeCard": "做成自制卡 →", "detail.viewOriginal": "查看原图",
  "detail.artworks": "种异画", "detail.current": "当前", "detail.defaultArt": "默认画",
  "detail.noText": "（暂无该语言文本，已回退）", "detail.raceSuffix": "族",
  "detail.formats": "赛制",
  // 卡包/系列
  "sets.title": "卡包", "sets.sub": "按发售时间倒序 · 共收录 {n} 个卡包", "sets.searchPh": "搜索卡包…",
  "arch.title": "系列图鉴",
  // 组卡器
  "deck.title": "组卡器", "deck.sub": "点击 / 拖拽组卡 · 禁限规则校验 · 导出 YDK + 卡组一图流 + 分享链接",
  "deck.main": "主卡组", "deck.extra": "额外卡组", "deck.extraShort": "额外", "deck.side": "副卡组",
  "deck.valid": "✓ 合法卡组", "deck.searchPh": "搜索卡片加入卡组…",
  "deck.hint": "点击加入（额外卡框自动归位） · Shift+点击 / 副+ 进副卡组 · 可拖拽到任意区",
  "deck.emptyPool": "搜索卡片以构筑卡组", "deck.emptyZone": "空", "deck.searchFail": "搜索失败：",
  "deck.importYdk": "导入 YDK", "deck.pasteImport": "粘贴导入", "deck.exportYdk": "导出 YDK",
  "deck.genImage": "生成卡组图", "deck.generating": "生成中…", "deck.copyShare": "复制分享链接", "deck.clear": "清空",
  "deck.sideAdd": "副+",
  // 页脚
  "footer.copy": "卡图版权归 KONAMI 所有，本站仅供学习交流",
  // 赛制标记
  "fmt.ocgOnly": "OCG 专属", "fmt.tcgOnly": "TCG 专属",
};

type UIKey = keyof typeof CN;

const JP: Record<UIKey, string> = {
  "nav.search": "カード検索", "nav.archetypes": "テーマ図鑑", "nav.sets": "パック",
  "nav.maker": "カードメーカー", "nav.deck": "デッキ構築", "nav.share": "シェア画像",
  "common.search": "検索", "common.retry": "再試行", "common.prev": "前へ", "common.next": "次へ",
  "common.viewAll": "すべて見る →", "common.empty": "該当するカードがありません。条件を変えてみてください",
  "common.searchPlaceholder": "カード名 / テキストを検索…", "common.cards": "枚",
  "home.heroTitle1": "全カード · 全テーマ · 三言語対応", "home.heroTitle2": "デュエリストのため", "home.heroTitle3": "の遊戯王データベース",
  "home.heroSub": "カード検索・禁止制限・テーマ図鑑・デッキ構築・カードメーカーを一つに。",
  "home.ctaSearch": "検索を始める", "home.ctaArchetypes": "テーマ図鑑へ", "home.ctaMaker": "カードメーカー →",
  "home.statCards": "収録カード", "home.statArtworks": "カード画像(別イラスト含む)", "home.statArchetypes": "テーマ", "home.statSets": "パック",
  "home.hotCards": "人気カード", "home.hotArchetypes": "人気テーマ図鑑", "home.seriesLoadFail": "テーマの読み込みに失敗：",
  "search.title": "カード検索", "search.matched": "{n} 枚がヒット", "search.sub": "カード名 / テキスト全文検索 + 絞り込み",
  "filter.cardType": "種類", "filter.frame": "カードの種類", "filter.attribute": "属性", "filter.race": "種族",
  "filter.spellType": "魔法の種類", "filter.trapType": "罠の種類", "filter.sort": "並び順",
  "filter.advanced": "詳細検索", "filter.level": "レベル/ランク", "filter.atk": "攻撃力", "filter.def": "守備力",
  "filter.link": "LINK", "filter.scale": "Pスケール", "filter.subtype": "その他", "filter.mdRarity": "MD レアリティ",
  "filter.format": "フォーマット", "filter.more": "もっと見る…", "filter.less": "閉じる",
  "filter.min": "最小", "filter.max": "最大",
  "sort.default": "デフォルト", "sort.atk": "攻撃力", "sort.level": "レベル",
  "detail.pendEffect": "ペンデュラム効果", "detail.monsterEffect": "モンスター効果", "detail.cardEffect": "カードの効果",
  "detail.flavorText": "フレイバー・テキスト", "detail.prints": "収録パック", "detail.related": "関連カード",
  "detail.set": "パック", "detail.cardNo": "カードNo.", "detail.rarity": "レアリティ", "detail.release": "発売",
  "detail.atk": "攻撃力", "detail.def": "守備力", "detail.level": "レベル", "detail.rank": "ランク",
  "detail.linkMarkers": "リンクマーカー", "detail.scale": "Pスケール",
  "detail.makeCard": "オリカを作る →", "detail.viewOriginal": "元画像を見る",
  "detail.artworks": "種のイラスト", "detail.current": "現在", "detail.defaultArt": "通常イラスト",
  "detail.noText": "（この言語のテキストがないため代替表示）", "detail.raceSuffix": "族",
  "detail.formats": "フォーマット",
  "sets.title": "パック", "sets.sub": "発売日順 · 全 {n} パック収録", "sets.searchPh": "パックを検索…",
  "arch.title": "テーマ図鑑",
  "deck.title": "デッキ構築", "deck.sub": "クリック / ドラッグで構築 · 禁止制限チェック · YDK / デッキ画像 / 共有リンク",
  "deck.main": "メインデッキ", "deck.extra": "エクストラデッキ", "deck.extraShort": "EX", "deck.side": "サイドデッキ",
  "deck.valid": "✓ 有効なデッキ", "deck.searchPh": "カードを検索して追加…",
  "deck.hint": "クリックで追加（EXカードは自動振り分け） · Shift+クリック / サイド+ でサイドへ · ドラッグ可",
  "deck.emptyPool": "カードを検索してデッキを構築", "deck.emptyZone": "なし", "deck.searchFail": "検索に失敗：",
  "deck.importYdk": "YDK 読込", "deck.pasteImport": "貼り付け読込", "deck.exportYdk": "YDK 出力",
  "deck.genImage": "デッキ画像生成", "deck.generating": "生成中…", "deck.copyShare": "共有リンクをコピー", "deck.clear": "クリア",
  "deck.sideAdd": "サイド+",
  "footer.copy": "カード画像の著作権は KONAMI に帰属します。本サイトは学習・交流用です",
  "fmt.ocgOnly": "OCG 限定", "fmt.tcgOnly": "TCG 限定",
};

const EN: Record<UIKey, string> = {
  "nav.search": "Cards", "nav.archetypes": "Archetypes", "nav.sets": "Sets",
  "nav.maker": "Card Maker", "nav.deck": "Deck Builder", "nav.share": "Share Image",
  "common.search": "Search", "common.retry": "Retry", "common.prev": "Prev", "common.next": "Next",
  "common.viewAll": "View all →", "common.empty": "No cards matched. Try different filters",
  "common.searchPlaceholder": "Search card name / text…", "common.cards": "cards",
  "home.heroTitle1": "Every card · Every archetype · CN/JP/EN", "home.heroTitle2": "A Yu-Gi-Oh! database", "home.heroTitle3": " built for duelists",
  "home.heroSub": "Card search, banlists, archetypes, deck building and card maker — all in one place.",
  "home.ctaSearch": "Search cards", "home.ctaArchetypes": "Browse archetypes", "home.ctaMaker": "Try card maker →",
  "home.statCards": "Cards", "home.statArtworks": "Artworks (incl. alts)", "home.statArchetypes": "Archetypes", "home.statSets": "Sets",
  "home.hotCards": "Popular cards", "home.hotArchetypes": "Popular archetypes", "home.seriesLoadFail": "Failed to load archetypes: ",
  "search.title": "Card Search", "search.matched": "{n} matches", "search.sub": "Full-text search + multi-dimension filters",
  "filter.cardType": "Type", "filter.frame": "Frame", "filter.attribute": "Attribute", "filter.race": "Race",
  "filter.spellType": "Spell type", "filter.trapType": "Trap type", "filter.sort": "Sort",
  "filter.advanced": "Advanced", "filter.level": "Level/Rank", "filter.atk": "ATK", "filter.def": "DEF",
  "filter.link": "Link", "filter.scale": "Scale", "filter.subtype": "Ability", "filter.mdRarity": "MD rarity",
  "filter.format": "Format", "filter.more": "More…", "filter.less": "Less",
  "filter.min": "Min", "filter.max": "Max",
  "sort.default": "Default", "sort.atk": "ATK", "sort.level": "Level",
  "detail.pendEffect": "Pendulum Effect", "detail.monsterEffect": "Monster Effect", "detail.cardEffect": "Card Text",
  "detail.flavorText": "Flavor Text", "detail.prints": "Printings", "detail.related": "Related cards",
  "detail.set": "Set", "detail.cardNo": "Card #", "detail.rarity": "Rarity", "detail.release": "Released",
  "detail.atk": "ATK", "detail.def": "DEF", "detail.level": "Level", "detail.rank": "Rank",
  "detail.linkMarkers": "Link Markers", "detail.scale": "Pendulum Scale",
  "detail.makeCard": "Make custom card →", "detail.viewOriginal": "View original",
  "detail.artworks": "artworks", "detail.current": "Current", "detail.defaultArt": "Default art",
  "detail.noText": "(No text in this language — showing fallback)", "detail.raceSuffix": "",
  "detail.formats": "Formats",
  "sets.title": "Sets", "sets.sub": "By release date · {n} sets", "sets.searchPh": "Search sets…",
  "arch.title": "Archetypes",
  "deck.title": "Deck Builder", "deck.sub": "Click / drag to build · Banlist validation · YDK export + deck image + share link",
  "deck.main": "Main Deck", "deck.extra": "Extra Deck", "deck.extraShort": "Extra", "deck.side": "Side Deck",
  "deck.valid": "✓ Legal deck", "deck.searchPh": "Search cards to add…",
  "deck.hint": "Click to add (Extra frames auto-sort) · Shift+click / Side+ for side deck · drag to any zone",
  "deck.emptyPool": "Search cards to build your deck", "deck.emptyZone": "Empty", "deck.searchFail": "Search failed: ",
  "deck.importYdk": "Import YDK", "deck.pasteImport": "Paste import", "deck.exportYdk": "Export YDK",
  "deck.genImage": "Deck image", "deck.generating": "Generating…", "deck.copyShare": "Copy share link", "deck.clear": "Clear",
  "deck.sideAdd": "Side+",
  "footer.copy": "Card images © KONAMI. This site is for learning and communication only",
  "fmt.ocgOnly": "OCG only", "fmt.tcgOnly": "TCG only",
};

const DICTS: Record<Lang, Record<UIKey, string>> = { cn: CN, jp: JP, en: EN };

// ---------------- 枚举翻译（labels.ts 的 CN 版之上叠加 jp/en）----------------
import { ATTR_CN, FRAME_CN, RACE_CN, SUBTYPE_CN, BAN_CN } from "./labels";

const ATTR_JP: Record<string, string> = {
  LIGHT: "光", DARK: "闇", WATER: "水", FIRE: "炎", EARTH: "地", WIND: "風", DIVINE: "神",
};
const ATTR_EN: Record<string, string> = {
  LIGHT: "LIGHT", DARK: "DARK", WATER: "WATER", FIRE: "FIRE", EARTH: "EARTH", WIND: "WIND", DIVINE: "DIVINE",
};
const FRAME_JP: Record<string, string> = {
  normal: "通常", effect: "効果", ritual: "儀式", fusion: "融合", synchro: "シンクロ",
  xyz: "エクシーズ", link: "リンク", pendulum: "ペンデュラム", spell: "魔法", trap: "罠", token: "トークン",
};
const FRAME_EN: Record<string, string> = {
  normal: "Normal", effect: "Effect", ritual: "Ritual", fusion: "Fusion", synchro: "Synchro",
  xyz: "Xyz", link: "Link", pendulum: "Pendulum", spell: "Spell", trap: "Trap", token: "Token",
};
const RACE_JP: Record<string, string> = {
  Aqua: "水", Beast: "獣", "Beast-Warrior": "獣戦士", Creator: "創造神", "Creator-God": "創造神",
  Cyberse: "サイバース", Dinosaur: "恐竜", "Divine-Beast": "幻神獣", Dragon: "ドラゴン",
  Fairy: "天使", Fiend: "悪魔", Fish: "魚", Insect: "昆虫", Machine: "機械", Plant: "植物",
  Psychic: "サイキック", Pyro: "炎", Reptile: "爬虫類", Rock: "岩石", "Sea Serpent": "海竜",
  Spellcaster: "魔法使い", Thunder: "雷", Warrior: "戦士", "Winged Beast": "鳥獣",
  Wyrm: "幻竜", Zombie: "アンデット", Illusion: "幻想魔",
  Normal: "通常", "Quick-Play": "速攻", Continuous: "永続", Equip: "装備",
  Field: "フィールド", Ritual: "儀式", Counter: "カウンター",
};
const SUBTYPE_JP: Record<MonsterSubtype, string> = {
  tuner: "チューナー", flip: "リバース", gemini: "デュアル", spirit: "スピリット", union: "ユニオン", toon: "トゥーン",
};
const SUBTYPE_EN: Record<MonsterSubtype, string> = {
  tuner: "Tuner", flip: "Flip", gemini: "Gemini", spirit: "Spirit", union: "Union", toon: "Toon",
};
const BAN_JP: Record<BanStatus, string> = { 0: "禁止", 1: "制限", 2: "準制限" };
const BAN_EN: Record<BanStatus, string> = { 0: "Forbidden", 1: "Limited", 2: "Semi-Limited" };
const CARD_TYPE_JP = { monster: "モンスター", spell: "魔法", trap: "罠" } as const;
const CARD_TYPE_EN = { monster: "Monster", spell: "Spell", trap: "Trap" } as const;

export function attrName(attr: string | null, lang: Lang): string {
  if (!attr) return "";
  return (lang === "jp" ? ATTR_JP : lang === "en" ? ATTR_EN : ATTR_CN)[attr] || attr;
}
export function frameName(frame: string, lang: Lang): string {
  return (lang === "jp" ? FRAME_JP : lang === "en" ? FRAME_EN : FRAME_CN)[frame] || frame;
}
export function raceName(race: string | null, lang: Lang): string {
  if (!race) return "";
  if (lang === "en") return race;
  return (lang === "jp" ? RACE_JP : RACE_CN)[race] || race;
}
export function subtypeName(s: MonsterSubtype, lang: Lang): string {
  return (lang === "jp" ? SUBTYPE_JP : lang === "en" ? SUBTYPE_EN : SUBTYPE_CN)[s] || s;
}
export function banName(s: BanStatus, lang: Lang): string {
  return (lang === "jp" ? BAN_JP : lang === "en" ? BAN_EN : BAN_CN)[s];
}
export function cardTypeName(t: "monster" | "spell" | "trap", lang: Lang): string {
  return (lang === "jp" ? CARD_TYPE_JP : lang === "en" ? CARD_TYPE_EN : { monster: "怪兽", spell: "魔法", trap: "陷阱" })[t];
}

// ---------------- 卡片字段按语言选择（含回退链）----------------
interface NamedCard { cn_name: string; jp_name?: string | null; en_name: string }
export function cardName(c: NamedCard, lang: Lang): string {
  if (lang === "jp") return c.jp_name || c.en_name || c.cn_name;
  if (lang === "en") return c.en_name || c.cn_name;
  return c.cn_name || c.en_name;
}
/** 详情页副标题：主名称之外的另一语言名 */
export function cardAltName(c: NamedCard, lang: Lang): string {
  if (lang === "cn") return c.en_name;
  if (lang === "jp") return c.en_name;
  return c.jp_name || c.cn_name;
}

interface EffectCard {
  effect_cn: string; pendulum_effect_cn: string | null;
  effect_jp?: string | null; pendulum_effect_jp?: string | null;
  effect_en?: string | null; pendulum_effect_en?: string | null;
}
/** 效果文本按语言选择；所选语言缺失时回退 cn→en，并标记 fallback */
export function cardEffect(c: EffectCard, lang: Lang): { effect: string; pend: string | null; fallback: boolean } {
  const pick = {
    cn: { effect: c.effect_cn, pend: c.pendulum_effect_cn },
    jp: { effect: c.effect_jp, pend: c.pendulum_effect_jp },
    en: { effect: c.effect_en, pend: c.pendulum_effect_en },
  }[lang];
  if (pick.effect) return { effect: pick.effect, pend: pick.pend ?? null, fallback: false };
  const fb = c.effect_cn ? { effect: c.effect_cn, pend: c.pendulum_effect_cn } : { effect: c.effect_en || "", pend: c.pendulum_effect_en ?? null };
  return { effect: fb.effect, pend: fb.pend ?? null, fallback: true };
}

// ---------------- Context ----------------
interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: UIKey, vars?: Record<string, string | number>) => string;
}
const Ctx = createContext<LangCtx>({ lang: "cn", setLang: () => {}, t: (k) => CN[k] });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const v = localStorage.getItem(LANG_KEY);
    return v === "jp" || v === "en" ? v : "cn";
  });
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem(LANG_KEY, l); };
  useEffect(() => {
    document.documentElement.lang = lang === "cn" ? "zh-CN" : lang === "jp" ? "ja" : "en";
  }, [lang]);
  const t = (key: UIKey, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? CN[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}
