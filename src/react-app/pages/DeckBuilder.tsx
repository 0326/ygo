// M2.3 组卡器：搜索卡池 → 添加到主/额外/副卡组（规则校验）→ 导出 YDK + 卡组一图流 + 分享链接。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CardSummary } from "../../shared/types";
import { searchCards, getCard } from "../lib/api";
import {
  emptyDeck, defaultZone, validate, countOf, toYdk, encodeDeck, decodeDeck,
  uniqueIds, LIMITS, type Deck, type Zone,
} from "../lib/deck";
import { SearchBar } from "../components/SearchControls";
import { AttributeIcon } from "../components/badges";
import { Spinner } from "../components/common";
import { frameColor } from "../lib/labels";
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
  const imgCache = useRef<Map<number, HTMLImageElement>>(new Map());

  const remember = useCallback((c: CardSummary) => cache.current.set(c.id, c), []);

  // 从分享链接载入卡组
  useEffect(() => {
    const code = sp.get("d");
    if (!code) return;
    const d = decodeDeck(code);
    setDeck(d);
    const ids = uniqueIds(d);
    if (!ids.length) return;
    setLoadingShared(true);
    Promise.all(
      ids.map((id) => getCard(id).then((c) => remember(c)).catch(() => {})),
    ).finally(() => { setLoadingShared(false); bump(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m: string) => { setToast(m); window.clearTimeout((flash as { t?: number }).t); (flash as { t?: number }).t = window.setTimeout(() => setToast(""), 1800); };

  // 搜索（防抖）
  const submitSearch = () => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    setSearching(true);
    searchCards({ q: term, size: 30 })
      .then((r) => { r.items.forEach(remember); setResults(r.items); })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  };

  const add = (c: CardSummary, zone?: Zone) => {
    remember(c);
    const z = zone ?? defaultZone(c);
    setDeck((d) => {
      if (countOf(d, c.id) >= LIMITS.perCard) { flash(`「${c.cn_name}」最多 3 张`); return d; }
      if (z === "main" && d.main.length >= LIMITS.mainMax) { flash("主卡组已满 60"); return d; }
      if (z === "extra" && d.extra.length >= LIMITS.extraMax) { flash("额外卡组已满 15"); return d; }
      if (z === "side" && d.side.length >= LIMITS.sideMax) { flash("副卡组已满 15"); return d; }
      return { ...d, [z]: [...d[z], c.id] };
    });
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

  const v = useMemo(() => validate(deck), [deck]);

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
            <div className="sub">拖入主/额外/副卡组 · 规则校验 · 导出 YDK + 卡组一图流 + 分享链接</div>
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
            <button className="btn" onClick={downloadYdk}>导出 YDK</button>
            <button className="btn" onClick={genImage} disabled={busyImg}>{busyImg ? "生成中…" : "生成卡组图"}</button>
            <button className="btn" onClick={copyShare}>复制分享链接</button>
            <button className="btn btn-ghost" onClick={clear}>清空</button>
          </div>
        </div>

        <div className="deck-layout">
          {/* 卡池 */}
          <aside className="deck-pool">
            <SearchBar value={q} onChange={setQ} onSubmit={submitSearch} placeholder="搜索卡片加入卡组…" />
            <div className="pool-hint muted">点击卡片加入卡组 · 额外卡框自动进额外卡组</div>
            {searching ? <Spinner /> : (
              <div className="pool-grid">
                {results.map((c) => (
                  <button key={c.id} className="pool-card" onClick={() => add(c)} title={`加入 ${c.cn_name}`}>
                    <img src={c.thumb_url} alt={c.cn_name} loading="lazy" />
                    <span className="pool-name">{c.cn_name}</span>
                  </button>
                ))}
                {!results.length && <div className="muted" style={{ padding: 20 }}>搜索卡片以构筑卡组</div>}
              </div>
            )}
          </aside>

          {/* 卡组三区 */}
          <section className="deck-zones">
            {loadingShared && <div className="muted" style={{ marginBottom: 8 }}>载入分享卡组中…</div>}
            <DeckZone zone="main" deck={deck} cache={cache.current} onRemove={removeOne} />
            <DeckZone zone="extra" deck={deck} cache={cache.current} onRemove={removeOne} />
            <DeckZone zone="side" deck={deck} cache={cache.current} onRemove={removeOne} />
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

function Count({ label, n, min, max }: { label: string; n: number; min?: number; max?: number }) {
  const bad = (min != null && n < min) || (max != null && n > max);
  return (
    <span className={`deck-count ${bad ? "bad" : ""}`}>
      {label} <b>{n}</b>{max != null && <span className="lim">/{min != null ? `${min}-${max}` : max}</span>}
    </span>
  );
}

function DeckZone({
  zone, deck, cache, onRemove,
}: {
  zone: Zone; deck: Deck; cache: Map<number, CardSummary>; onRemove: (z: Zone, id: number) => void;
}) {
  const ids = deck[zone];
  return (
    <div className="zone">
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
            </button>
          );
        })}
        {!ids.length && <div className="zone-empty muted">空</div>}
      </div>
    </div>
  );
}
