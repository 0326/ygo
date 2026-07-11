// M2.3 组卡器：搜索卡池 → 添加到主/额外/副卡组（规则校验）→ 导出 YDK + 卡组一图流 + 分享链接。
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { CardSummary, BanFormat } from "../../shared/types";
import { searchCards, getCard } from "../lib/api";
import {
  emptyDeck, defaultZone, isExtraCard, validate, countOf, toYdk, encodeDeck, decodeDeck,
  uniqueIds, fromYdk, deckStats, hyperAtLeast, LIMITS, type Deck, type Zone,
} from "../lib/deck";
import { SearchBar } from "../components/SearchControls";
import { AttributeIcon, BanBadge } from "../components/badges";
import { Spinner } from "../components/common";
import { frameColor, ATTR_CN, ATTR_COLOR, BAN_FORMAT_CN, BAN_LIMIT } from "../lib/labels";
import {
  composeShareImage, exportShareImage, type ShareItem,
} from "../canvas/ShareImageComposer";
import "./DeckBuilder.css";

const ZONE_CN: Record<Zone, string> = { main: "主卡组", extra: "额外卡组", side: "副卡组" };

export default function DeckBuilder() {
  const [sp, setSp] = useSearchParams();
  const [deck, setDeck] = useState<Deck>(emptyDeck);
  const cache = useRef<Map<number, CardSummary>>(new Map());
  const [, forceTick] = useState(0);
  const bump = () => forceTick((n) => n + 1);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<CardSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingShared, setLoadingShared] = useState(false);
  const [toast, setToast] = useState("");
  const [busyImg, setBusyImg] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<BanFormat>("ocg");
  const fileRef = useRef<HTMLInputElement>(null);
  const imgCache = useRef<Map<number, HTMLImageElement>>(new Map());

  const remember = useCallback((c: CardSummary) => cache.current.set(c.id, c), []);

  // 批量拉取卡数据进缓存（分享链接 / YDK 导入共用）
  const loadIds = useCallback((ids: number[]) => {
    const missing = ids.filter((id) => !cache.current.has(id));
    if (!missing.length) { bump(); return Promise.resolve(); }
    setLoadingShared(true);
    return Promise.all(
      missing.map((id) => getCard(id).then((c) => remember(c)).catch(() => {})),
    ).finally(() => { setLoadingShared(false); bump(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember]);

  // 从分享链接载入卡组
  useEffect(() => {
    const code = sp.get("d");
    if (!code) return;
    const d = decodeDeck(code);
    setDeck(d);
    loadIds(uniqueIds(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // YDK 导入
  const importYdk = (text: string) => {
    const d = fromYdk(text);
    if (!uniqueIds(d).length) { flash("未识别到有效卡密"); return; }
    setDeck(d);
    loadIds(uniqueIds(d));
    flash(`已导入 ${d.main.length + d.extra.length + d.side.length} 张`);
  };
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(importYdk);
    e.target.value = "";
  };
  const pasteYdk = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { /* fallback */ }
    if (!text) text = window.prompt("粘贴 YDK 内容（#main / #extra / !side 卡密列表）") || "";
    if (text.trim()) importYdk(text);
  };

  const flash = (m: string) => { setToast(m); window.clearTimeout((flash as { t?: number }).t); (flash as { t?: number }).t = window.setTimeout(() => setToast(""), 1800); };

  // 搜索
  const [searchErr, setSearchErr] = useState("");
  const submitSearch = () => {
    const term = q.trim();
    if (!term) { setResults([]); setSearchErr(""); return; }
    setSearching(true);
    setSearchErr("");
    searchCards({ q: term, size: 30 })
      .then((r) => { r.items.forEach(remember); setResults(r.items); })
      .catch((e) => { setResults([]); setSearchErr(String(e.message || e)); })
      .finally(() => setSearching(false));
  };

  const add = (c: CardSummary, zone?: Zone) => {
    remember(c);
    const z = zone ?? defaultZone(c);
    // 按当前赛制禁限收紧单卡上限（禁0/限1/准2），加卡时即拦截而非事后报错
    const st = c.ban?.[format];
    const max = st != null ? BAN_LIMIT[st] : LIMITS.perCard;
    setDeck((d) => {
      if (countOf(d, c.id) >= max) {
        flash(max === 0
          ? `「${c.cn_name}」是 ${BAN_FORMAT_CN[format]} 禁止卡`
          : `「${c.cn_name}」在 ${BAN_FORMAT_CN[format]} 上限 ${max} 张`);
        return d;
      }
      if (z === "main" && isExtraCard(c)) { flash("融合/同调/超量/连接请放额外卡组"); return d; }
      if (z === "extra" && !isExtraCard(c)) { flash("只有融合/同调/超量/连接能进额外卡组"); return d; }
      if (z === "main" && d.main.length >= LIMITS.mainMax) { flash("主卡组已满 60"); return d; }
      if (z === "extra" && d.extra.length >= LIMITS.extraMax) { flash("额外卡组已满 15"); return d; }
      if (z === "side" && d.side.length >= LIMITS.sideMax) { flash("副卡组已满 15"); return d; }
      return { ...d, [z]: [...d[z], c.id] };
    });
  };
  const addById = (zone: Zone, id: number) => {
    const c = cache.current.get(id);
    if (c) add(c, zone);
  };
  const removeOne = (zone: Zone, id: number) => {
    setDeck((d) => {
      const arr = [...d[zone]];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      return { ...d, [zone]: arr };
    });
  };
  const clear = () => { if (confirm("清空当前卡组？")) setDeck(emptyDeck()); };

  // 校验（含禁限，依赖缓存里的卡数据与所选赛制；cache 异步填充后由 bump 触发重算）
  const v = validate(deck, { cards: cache.current, format });
  const stats = deckStats(deck, cache.current);
  const mainSize = deck.main.length || 40;

  // 同步分享链接到地址栏（轻量）
  useEffect(() => {
    const total = deck.main.length + deck.extra.length + deck.side.length;
    const next = new URLSearchParams(sp);
    if (total) next.set("d", encodeDeck(deck)); else next.delete("d");
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  const copyShare = async () => {
    const url = `${location.origin}/deck?d=${encodeDeck(deck)}`;
    try { await navigator.clipboard.writeText(url); flash("分享链接已复制"); }
    catch { flash(url); }
  };
  const downloadYdk = () => {
    const blob = new Blob([toYdk(deck)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "deck.ydk";
    a.click();
    URL.revokeObjectURL(a.href);
    flash("YDK 已导出");
  };

  const loadImg = (c: CardSummary) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const hit = imgCache.current.get(c.id);
      if (hit) return resolve(hit);
      const img = new Image();
      img.onload = () => { imgCache.current.set(c.id, img); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = c.thumb_url;
    });

  const genImage = async () => {
    const ids = [...deck.main, ...deck.extra];
    const cards = ids.map((id) => cache.current.get(id)).filter(Boolean) as CardSummary[];
    if (!cards.length) { flash("先添加卡片"); return; }
    setBusyImg(true);
    try {
      const items: ShareItem[] = await Promise.all(
        cards.map(async (c) => ({ card: c, image: await loadImg(c) })),
      );
      const canvas = composeShareImage(items, {
        title: "我的卡组",
        subtitle: `主 ${deck.main.length} · 额外 ${deck.extra.length} · 副 ${deck.side.length}｜哈基米卡库`,
        layout: "grid",
      });
      const { dataUrl } = await exportShareImage(canvas);
      setPreviewUrl(dataUrl);
    } finally {
      setBusyImg(false);
    }
  };

  return (
    <div className="page deck-page fade-in">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>组卡器</h1>
            <div className="sub">点击 / 拖拽组卡 · 禁限规则校验 · 导出 YDK + 卡组一图流 + 分享链接</div>
          </div>
        </div>

        {/* 校验 + 操作栏 */}
        <div className="deck-bar">
          <div className="deck-counts">
            <Count label="主卡组" n={deck.main.length} min={LIMITS.mainMin} max={LIMITS.mainMax} />
            <Count label="额外" n={deck.extra.length} max={LIMITS.extraMax} />
            <Count label="副卡组" n={deck.side.length} max={LIMITS.sideMax} />
            <span className={`deck-valid ${v.ok ? "ok" : "bad"}`} title={v.errors.join("；")}>
              {v.ok ? "✓ 合法卡组" : `✗ ${v.errors[0]}`}
            </span>
          </div>
          <div className="deck-actions">
            <span className="deck-format">
              {(["ocg", "tcg", "md"] as BanFormat[]).map((f) => (
                <button key={f} className={`fmt-tab${format === f ? " on" : ""}`} onClick={() => setFormat(f)}>
                  {BAN_FORMAT_CN[f]}
                </button>
              ))}
            </span>
            <button className="btn" onClick={() => fileRef.current?.click()}>导入 YDK</button>
            <button className="btn" onClick={pasteYdk}>粘贴导入</button>
            <button className="btn" onClick={downloadYdk}>导出 YDK</button>
            <button className="btn" onClick={genImage} disabled={busyImg}>{busyImg ? "生成中…" : "生成卡组图"}</button>
            <button className="btn" onClick={copyShare}>复制分享链接</button>
            <button className="btn btn-ghost" onClick={clear}>清空</button>
            <input ref={fileRef} type="file" accept=".ydk,text/plain" hidden onChange={onPickFile} />
          </div>
        </div>

        <div className="deck-layout">
          {/* 卡池 */}
          <aside className="deck-pool">
            <SearchBar value={q} onChange={setQ} onSubmit={submitSearch} placeholder="搜索卡片加入卡组…" />
            <div className="pool-hint muted">点击加入（额外卡框自动归位） · Shift+点击 / 副+ 进副卡组 · 可拖拽到任意区</div>
            {searching ? <Spinner /> : searchErr ? (
              <div className="pool-err">
                <div>搜索失败：{searchErr}</div>
                <button className="btn" onClick={submitSearch}>重试</button>
              </div>
            ) : (
              <div className="pool-grid">
                {results.map((c) => {
                  const n = countOf(deck, c.id);
                  const st = c.ban?.[format];
                  const max = st != null ? BAN_LIMIT[st] : LIMITS.perCard;
                  return (
                    <div
                      key={c.id} className="pool-card" role="button" tabIndex={0}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}
                      onClick={(e) => add(c, e.shiftKey ? "side" : undefined)}
                      onKeyDown={(e) => { if (e.key === "Enter") add(c, e.shiftKey ? "side" : undefined); }}
                      title={`加入 ${c.cn_name}`}
                    >
                      <img src={c.thumb_url} alt={c.cn_name} loading="lazy" />
                      {c.ban && <span className="pool-ban"><BanBadge ban={c.ban} format={format} dot /></span>}
                      {n > 0 && <span className="pool-count">{n}/{max}</span>}
                      <button
                        className="pool-side-add"
                        onClick={(e) => { e.stopPropagation(); add(c, "side"); }}
                        title={`「${c.cn_name}」加入副卡组`}
                      >副+</button>
                      <span className="pool-name">{c.cn_name}</span>
                    </div>
                  );
                })}
                {!results.length && <div className="muted" style={{ padding: 20 }}>搜索卡片以构筑卡组</div>}
              </div>
            )}
          </aside>

          {/* 卡组三区 */}
          <section className="deck-zones">
            {loadingShared && <div className="muted" style={{ marginBottom: 8 }}>载入分享卡组中…</div>}
            <DeckZone zone="main" deck={deck} cache={cache.current} onRemove={removeOne} onAdd={addById} format={format} />
            <DeckZone zone="extra" deck={deck} cache={cache.current} onRemove={removeOne} onAdd={addById} format={format} />
            <DeckZone zone="side" deck={deck} cache={cache.current} onRemove={removeOne} onAdd={addById} format={format} />

            {!v.ok && v.errors.length > 0 && (
              <div className="deck-errors">
                {v.errors.map((e, i) => <div key={i} className="deck-err">✗ {e}</div>)}
              </div>
            )}

            {deck.main.length > 0 && (
              <DeckStatsPanel stats={stats} mainSize={mainSize} />
            )}
          </section>
        </div>
      </div>

      {toast && <div className="deck-toast">{toast}</div>}

      {previewUrl && (
        <div className="lightbox" onClick={() => setPreviewUrl(null)}>
          <div className="deck-preview" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="卡组一图流" />
            <div className="deck-preview-actions">
              <a className="btn btn-primary" href={previewUrl} download="deck.png">下载 PNG</a>
              <button className="btn" onClick={() => setPreviewUrl(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeckStatsPanel({ stats, mainSize }: { stats: ReturnType<typeof deckStats>; mainSize: number }) {
  const maxCurve = Math.max(1, ...stats.levelCurve.map((c) => c.count));
  const attrs = Object.entries(stats.byAttribute).sort((a, b) => b[1] - a[1]);
  // 起手概率（先攻 5 张）：n-of 卡至少摸到 1 张
  const hand = 5;
  const probs = [3, 2, 1].map((n) => ({ n, p: hyperAtLeast(mainSize, n, hand, 1) }));
  return (
    <div className="deck-stats">
      <div className="ds-block">
        <h4>构成</h4>
        <div className="ds-types">
          <span className="ds-type mon">怪兽 {stats.byCardType.monster}</span>
          <span className="ds-type spell">魔法 {stats.byCardType.spell}</span>
          <span className="ds-type trap">陷阱 {stats.byCardType.trap}</span>
        </div>
        {attrs.length > 0 && (
          <div className="ds-attrs">
            {attrs.map(([a, n]) => (
              <span key={a} className="ds-attr" style={{ borderColor: ATTR_COLOR[a] || "#888" }}>
                {ATTR_CN[a] || a} {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {stats.levelCurve.length > 0 && (
        <div className="ds-block">
          <h4>等级/阶曲线</h4>
          <div className="ds-curve">
            {stats.levelCurve.map((c) => (
              <div key={c.level} className="ds-bar-col" title={`${c.level} 级 · ${c.count} 张`}>
                <div className="ds-bar" style={{ height: `${(c.count / maxCurve) * 100}%` }} />
                <span className="ds-bar-n">{c.count}</span>
                <span className="ds-bar-lv">{c.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ds-block">
        <h4>起手概率<span className="muted" style={{ fontWeight: 400 }}>（先攻 5 张 · 主卡组 {mainSize}）</span></h4>
        <div className="ds-prob">
          {probs.map(({ n, p }) => (
            <div key={n} className="ds-prob-row">
              <span className="ds-prob-k">{n} 张同名卡</span>
              <span className="ds-prob-bar"><span style={{ width: `${p * 100}%` }} /></span>
              <span className="ds-prob-v">{(p * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Count({ label, n, min, max }: { label: string; n: number; min?: number; max?: number }) {
  const bad = (min != null && n < min) || (max != null && n > max);
  return (
    <span className={`deck-count ${bad ? "bad" : ""}`}>
      {label} <b>{n}</b>{max != null && <span className="lim">/{min != null ? `${min}-${max}` : max}</span>}
    </span>
  );
}

function DeckZone({
  zone, deck, cache, onRemove, onAdd, format,
}: {
  zone: Zone; deck: Deck; cache: Map<number, CardSummary>;
  onRemove: (z: Zone, id: number) => void; onAdd: (z: Zone, id: number) => void; format: BanFormat;
}) {
  const ids = deck[zone];
  const [hover, setHover] = useState(false);
  const depth = useRef(0); // dragenter/leave 在子元素间冒泡，用计数器判定真正离开
  return (
    <div
      className={`zone${hover ? " drop-hover" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setHover(true); }}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setHover(false); }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0; setHover(false);
        const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (Number.isFinite(id) && id > 0) onAdd(zone, id);
      }}
    >
      <div className="zone-head">
        <h3>{ZONE_CN[zone]}</h3>
        <span className="muted">{ids.length} 张</span>
      </div>
      <div className="zone-grid">
        {ids.map((id, i) => {
          const c = cache.get(id);
          const fc = c ? frameColor(c.frame, c.scale != null) : null;
          return (
            <button
              key={`${id}-${i}`} className="zone-card"
              onClick={() => onRemove(zone, id)}
              title={c ? `移除 ${c.cn_name}` : String(id)}
              style={fc ? { boxShadow: `0 0 0 1px ${fc.base}66` } : undefined}
            >
              {c ? <img src={c.thumb_url} alt={c.cn_name} loading="lazy" /> : <span className="zone-id">{id}</span>}
              {c?.attribute && <span className="zone-attr"><AttributeIcon attr={c.attribute} size={16} /></span>}
              {c?.ban && <span className="zone-ban"><BanBadge ban={c.ban} format={format} dot /></span>}
            </button>
          );
        })}
        {!ids.length && <div className="zone-empty muted">空</div>}
      </div>
    </div>
  );
}
