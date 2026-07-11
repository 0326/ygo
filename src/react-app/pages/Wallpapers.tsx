// M9 壁纸图库：全网游戏王高清壁纸/原画/角色图，搜索 + 设备(PC/手机)/分类筛选 + 灯箱预览下载。
import { useCallback, useEffect, useRef, useState } from "react";
import { listWallpapers, listWallpaperTags } from "../lib/api";
import type { WallpaperItem, WallpaperTagCount } from "../../shared/types";
import { Spinner, Empty, ErrorBox } from "../components/common";
import { useLang } from "../lib/i18n";
import "./Wallpapers.css";

const DEVICES = [
  { value: "", key: "wp.deviceAll" },
  { value: "pc", key: "wp.devicePc" },
  { value: "mobile", key: "wp.deviceMobile" },
] as const;
const CATEGORIES = [
  { value: "", key: "wp.catAll" },
  { value: "wallpaper", key: "wp.catWallpaper" },
  { value: "artwork", key: "wp.catArtwork" },
  { value: "character", key: "wp.catCharacter" },
] as const;
const SORTS = [
  { value: "", key: "wp.sortHot" },
  { value: "newest", key: "wp.sortNew" },
  { value: "resolution", key: "wp.sortRes" },
] as const;

const PAGE_SIZE = 24;

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function Wallpapers() {
  const { t } = useLang();
  const [kw, setKw] = useState("");        // 输入框即时值
  const [q, setQ] = useState("");          // 已提交搜索词
  const [device, setDevice] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tags, setTags] = useState<WallpaperTagCount[]>([]);
  const [active, setActive] = useState<WallpaperItem | null>(null); // 灯箱
  const seq = useRef(0);

  useEffect(() => { listWallpaperTags().then(setTags).catch(() => {}); }, []);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true); setErr("");
    listWallpapers({ q, device, category, sort, page, size: PAGE_SIZE })
      .then((r) => { if (seq.current === id) { setItems(r.items); setTotal(r.total); } })
      .catch((e) => { if (seq.current === id) setErr(String(e.message || e)); })
      .finally(() => { if (seq.current === id) setLoading(false); });
  }, [q, device, category, sort, page]);

  const submit = useCallback((v: string) => { setQ(v.trim()); setPage(1); }, []);
  const pickTag = (tag: string) => { setKw(tag); submit(tag); };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 灯箱打开时锁定滚动 + Esc 关闭
  useEffect(() => {
    if (!active) return;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [active]);

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>{t("wp.title")}</h1>
          <div className="sub">{t("wp.sub", { n: total || "…" })}</div>
        </div>
      </div>

      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); submit(kw); }}>
        <input
          value={kw}
          placeholder={t("wp.searchPh")}
          onChange={(e) => setKw(e.target.value)}
        />
        {kw && (
          <button type="button" className="sb-clear" onClick={() => { setKw(""); submit(""); }}>×</button>
        )}
        <button type="submit" className="btn sb-go">{t("common.search")}</button>
      </form>

      <div className="wp-filters">
        <div className="filter-toggles">
          {DEVICES.map((d) => (
            <button key={d.value} className={`filter-toggle${device === d.value ? " on" : ""}`}
              onClick={() => { setDevice(d.value); setPage(1); }}>
              {t(d.key)}
            </button>
          ))}
        </div>
        <div className="filter-toggles">
          {CATEGORIES.map((c) => (
            <button key={c.value} className={`filter-toggle${category === c.value ? " on" : ""}`}
              onClick={() => { setCategory(c.value); setPage(1); }}>
              {t(c.key)}
            </button>
          ))}
        </div>
        <div className="filter-toggles">
          {SORTS.map((s) => (
            <button key={s.value} className={`filter-toggle${sort === s.value ? " on" : ""}`}
              onClick={() => { setSort(s.value); setPage(1); }}>
              {t(s.key)}
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="wp-tags">
          <span className="wp-tags-label">{t("wp.hotTags")}</span>
          {tags.slice(0, 16).map((tg) => (
            <button key={tg.tag} className={`wp-tag${q === tg.tag ? " on" : ""}`} onClick={() => pickTag(tg.tag)}>
              {tg.tag}
            </button>
          ))}
        </div>
      )}

      {err ? <ErrorBox msg={err} /> : loading ? <Spinner /> : items.length === 0 ? (
        <Empty text={t("wp.empty")} />
      ) : (
        <>
          <div className="muted" style={{ margin: "14px 0 10px", fontSize: 13 }}>{t("wp.matched", { n: total })}</div>
          <div className="wp-grid">
            {items.map((w) => (
              <button key={w.id} className={`wp-card ${w.device}`} onClick={() => setActive(w)} title={w.tags.join(", ")}>
                <img src={w.thumb_url} alt={w.title} loading="lazy"
                  style={{ aspectRatio: String(w.ratio || 1) }} />
                <span className="wp-res">{w.width}×{w.height}</span>
                <span className={`wp-dev ${w.device}`}>{w.device === "pc" ? "🖥" : "📱"}</span>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="pager">
              <button className="btn" disabled={page <= 1} onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}>{t("common.prev")}</button>
              <span className="cur">{page} / {pages}</span>
              <button className="btn" disabled={page >= pages} onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}>{t("common.next")}</button>
            </div>
          )}
        </>
      )}

      {active && (
        <div className="wp-lightbox" onClick={() => setActive(null)}>
          <div className="wp-lb-body" onClick={(e) => e.stopPropagation()}>
            <button className="wp-lb-close" onClick={() => setActive(null)}>×</button>
            <img src={active.url} alt={active.title} style={{ aspectRatio: String(active.ratio || 1) }} />
            <div className="wp-lb-meta">
              <div className="wp-lb-info">
                <b>{active.width}×{active.height}</b>
                <span className="muted"> · {fmtSize(active.file_size)} · ♥ {active.favorites} {t("wp.favorites")}</span>
                {active.tags.length > 0 && (
                  <div className="wp-lb-tags">
                    {active.tags.slice(0, 8).map((tg) => (
                      <button key={tg} className="wp-tag" onClick={() => { setActive(null); pickTag(tg); }}>{tg}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="wp-lb-actions">
                <a className="btn btn-primary" href={active.url} download={`ygo-wallpaper-${active.id}`} target="_blank" rel="noreferrer">
                  ⬇ {t("wp.download")}
                </a>
                {active.source_url && (
                  <a className="btn btn-ghost" href={active.source_url} target="_blank" rel="noreferrer">
                    {t("wp.source")} ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
