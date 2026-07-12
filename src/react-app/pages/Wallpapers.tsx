// M9 壁纸图库：全网游戏王高清壁纸/原画/角色图，搜索 + 设备(PC/手机)/分类筛选 + 灯箱预览下载。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listWallpapers, listWallpaperTags, adminDeleteWallpaper } from "../lib/api";
import type { WallpaperItem, WallpaperTagCount } from "../../shared/types";
import { Spinner, Empty, ErrorBox } from "../components/common";
import { FavButton } from "../components/badges";
import { useUser } from "../lib/user";
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
  const { me } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kw, setKw] = useState("");        // 输入框即时值
  const [q, setQ] = useState("");          // 已提交搜索词
  const [device, setDevice] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);       // 首屏/重置加载
  const [loadingMore, setLoadingMore] = useState(false); // 下拉加载更多
  const [err, setErr] = useState("");
  const [tags, setTags] = useState<WallpaperTagCount[]>([]);
  const [active, setActive] = useState<WallpaperItem | null>(null); // 灯箱
  const [delMsg, setDelMsg] = useState("");
  const [showTop, setShowTop] = useState(false); // 返回顶部按钮
  const pageRef = useRef(1);
  const seq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => { listWallpaperTags().then(setTags).catch(() => {}); document.title = "游戏王壁纸 · 游戏王集卡社"; }, []);

  // 列数随容器宽度变化（最小 1080px，默认 4 列）
  const [colCount, setColCount] = useState(4);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setColCount(w <= 800 ? 2 : w <= 1100 ? 3 : 4);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // 固定列瀑布流：贪心分配到最短列，已分配项的列归属稳定（追加不重排）
  const columns = useMemo(() => {
    const cols: WallpaperItem[][] = Array.from({ length: colCount }, () => []);
    const heights = new Array(colCount).fill(0);
    for (const w of items) {
      let min = 0;
      for (let i = 1; i < colCount; i++) if (heights[i] < heights[min]) min = i;
      cols[min].push(w);
      // 列宽固定，高度增量 ∝ 1/ratio
      heights[min] += 1 / (w.ratio || 1);
    }
    return cols;
  }, [items, colCount]);

  // 滚动超过 2 屏显示返回顶部
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // 首次加载或筛选/搜索/排序变化时重置并拉第 1 页
  useEffect(() => {
    const id = ++seq.current;
    pageRef.current = 1;
    setLoading(true); setLoadingMore(false); setErr("");
    listWallpapers({ q, device, category, sort, page: 1, size: PAGE_SIZE })
      .then((r) => { if (seq.current === id) { setItems(r.items); setTotal(r.total); } })
      .catch((e) => { if (seq.current === id) setErr(String(e.message || e)); })
      .finally(() => { if (seq.current === id) setLoading(false); });
  }, [q, device, category, sort]);

  // 加载下一页（追加）
  const loadMore = useCallback(() => {
    if (loadingMore || loading || err) return;
    if (items.length >= total) return;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    listWallpapers({ q, device, category, sort, page: next, size: PAGE_SIZE })
      .then((r) => {
        pageRef.current = next;
        setItems((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          return [...prev, ...r.items.filter((x) => !ids.has(x.id))];
        });
        setTotal(r.total);
      })
      .catch(() => { /* 单次失败不打断 */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, err, items.length, total, q, device, category, sort]);

  // 底部哨兵：进入视口即加载下一页
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    ioRef.current = io;
    return () => { io.disconnect(); ioRef.current = null; };
  }, [loadMore]);

  const submit = useCallback((v: string) => { setQ(v.trim()); }, []);
  const pickTag = (tag: string) => { setKw(tag); submit(tag); };
  const hasMore = items.length < total;

  // URL ?id=xxx → 自动打开对应壁纸灯箱
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || active) return;
    // 已在当前列表里直接用，否则按 id 单查
    const hit = items.find((w) => w.id === id);
    if (hit) { setActive(hit); return; }
    let cancelled = false;
    listWallpapers({ ids: id, size: 1 })
      .then((r) => { if (!cancelled && r.items[0]) setActive(r.items[0]); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items]);

  // 关闭灯箱时清掉 URL 上的 id
  const closeLightbox = useCallback(() => {
    setActive(null);
    if (searchParams.has("id")) {
      const next = new URLSearchParams(searchParams);
      next.delete("id");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // 灯箱打开时锁定滚动 + Esc 关闭
  useEffect(() => {
    if (!active) return;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [active, closeLightbox]);

  // 管理员删除
  const onDelete = async () => {
    if (!active) return;
    if (!confirm(`删除壁纸「${active.title}」(${active.id})？不可恢复`)) return;
    try {
      await adminDeleteWallpaper(active.id);
      setItems((prev) => prev.filter((w) => w.id !== active.id));
      setTotal((n) => Math.max(0, n - 1));
      setDelMsg(`已删除 ${active.id}`);
      setTimeout(() => setDelMsg(""), 2500);
      closeLightbox();
    } catch (e) {
      setDelMsg(String((e as Error).message || e));
      setTimeout(() => setDelMsg(""), 2500);
    }
  };

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
              onClick={() => setDevice(d.value)}>
              {t(d.key)}
            </button>
          ))}
        </div>
        <div className="filter-toggles">
          {CATEGORIES.map((c) => (
            <button key={c.value} className={`filter-toggle${category === c.value ? " on" : ""}`}
              onClick={() => setCategory(c.value)}>
              {t(c.key)}
            </button>
          ))}
        </div>
        <div className="filter-toggles">
          {SORTS.map((s) => (
            <button key={s.value} className={`filter-toggle${sort === s.value ? " on" : ""}`}
              onClick={() => setSort(s.value)}>
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

      {delMsg && <div className="wp-flash">{delMsg}</div>}

      {err ? <ErrorBox msg={err} /> : loading ? <Spinner /> : items.length === 0 ? (
        <Empty text={t("wp.empty")} />
      ) : (
        <>
          <div className="muted" style={{ margin: "14px 0 10px", fontSize: 13 }}>{t("wp.matched", { n: total })}</div>
          <div className="wp-grid">
            {columns.map((col, ci) => (
              <div className="wp-col" key={ci}>
                {col.map((w) => (
                  <button key={w.id} className={`wp-card ${w.device}`} onClick={() => setActive(w)} title={w.tags.join(", ")}>
                    <img src={w.thumb_url} alt={w.title} loading="lazy"
                      style={{ aspectRatio: String(w.ratio || 1) }} />
                    <span className="wp-res">{w.width}×{w.height}</span>
                    <span className={`wp-dev ${w.device}`}>{w.device === "pc" ? "🖥" : "📱"}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          {/* 下拉加载哨兵 */}
          <div ref={sentinelRef} className="wp-sentinel" aria-hidden="true" />
          {loadingMore && <div className="wp-more"><Spinner /></div>}
          {!hasMore && items.length > 0 && (
            <div className="wp-end">{t("wp.noMore")}</div>
          )}
        </>
      )}

      {active && (
        <Lightbox
          item={active}
          onClose={closeLightbox}
          onPickTag={(tag) => { setKw(tag); submit(tag); closeLightbox(); }}
          isAdmin={me?.role === "admin"}
          onDelete={onDelete}
        />
      )}

      {showTop && (
        <button className="wp-to-top" onClick={toTop} title={t("wp.toTop")} aria-label={t("wp.toTop")}>↑</button>
      )}
    </div>
  );
}

// 灯箱：缩略图秒开占位，高清图加载完成后交叉淡入
function Lightbox({
  item, onClose, onPickTag, isAdmin, onDelete,
}: {
  item: WallpaperItem;
  onClose: () => void;
  onPickTag: (tag: string) => void;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const { t } = useLang();
  const [hdLoaded, setHdLoaded] = useState(false);
  // 切换壁纸时重置高清图加载状态
  useEffect(() => { setHdLoaded(false); }, [item.id]);

  return (
    <div className="wp-lightbox" onClick={onClose}>
      <div className="wp-lb-body" onClick={(e) => e.stopPropagation()}>
        <button className="wp-lb-close" onClick={onClose}>×</button>
        <div
          className="wp-lb-img-wrap"
          style={{ "--ratio": String(item.ratio || 1) } as React.CSSProperties}
        >
          {/* 缩略图层：秒开占位，铺满容器 */}
          <img className="wp-lb-img thumb" src={item.thumb_url} alt={item.title} />
          {/* 高清图层：加载完成后淡入覆盖缩略图 */}
          <img
            className={`wp-lb-img hd${hdLoaded ? " loaded" : ""}`}
            src={item.url}
            alt={item.title}
            onLoad={() => setHdLoaded(true)}
          />
          {!hdLoaded && <span className="wp-lb-loading">{t("wp.loadingHd")}</span>}
        </div>
        <div className="wp-lb-meta">
          <div className="wp-lb-info">
            <b>{item.width}×{item.height}</b>
            <span className="muted"> · {fmtSize(item.file_size)} · ♥ {item.favorites} {t("wp.favorites")}</span>
            {item.tags.length > 0 && (
              <div className="wp-lb-tags">
                {item.tags.slice(0, 8).map((tg) => (
                  <button key={tg} className="wp-tag" onClick={() => onPickTag(tg)}>{tg}</button>
                ))}
              </div>
            )}
          </div>
          <div className="wp-lb-actions">
            <FavButton kind="wallpaper" refId={item.id} />
            <a className="btn btn-primary" href={item.url} download={`ygo-wallpaper-${item.id}`} target="_blank" rel="noreferrer">
              ⬇ {t("wp.download")}
            </a>
            {item.source_url && (
              <a className="btn btn-ghost" href={item.source_url} target="_blank" rel="noreferrer">
                {t("wp.source")} ↗
              </a>
            )}
            {isAdmin && (
              <button className="btn btn-danger" onClick={onDelete} title={t("wp.deleteTip")}>
                🗑 {t("wp.delete")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
