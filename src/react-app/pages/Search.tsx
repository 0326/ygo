import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchCards } from "../lib/api";
import type { SearchResponse } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { SearchBar, FilterPanel, filtersFromParams, filtersToParams, type Filters } from "../components/SearchControls";
import { Spinner, Empty, ErrorBox } from "../components/common";
import { useLang } from "../lib/i18n";

const PAGE_SIZE = 30;

const intOr = (v: string | null, d: number) => {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/** 把当前编辑态序列化成 URL 参数（省略空值与 page=1，保持地址干净） */
function buildParams(q: string, filters: Filters, archetype: string, page: number): URLSearchParams {
  const next = new URLSearchParams();
  if (q.trim()) next.set("q", q.trim());
  for (const [k, v] of Object.entries(filtersToParams(filters))) {
    if (v) next.set(k, v);
  }
  if (archetype) next.set("archetype", archetype);
  if (page > 1) next.set("page", String(page));
  return next;
}

// URL 是搜索状态的唯一事实来源：筛选/页码全部进地址栏，刷新、分享、前进后退均可还原。
export default function Search() {
  const { t } = useLang();
  const [sp, setSp] = useSearchParams();
  const spStr = sp.toString();
  const [q, setQ] = useState(() => sp.get("q") || "");
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(sp));
  const [page, setPage] = useState(() => intOr(sp.get("page"), 1));
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const archetype = sp.get("archetype") || "";
  const reqId = useRef(0);

  // 编辑态对应的 URL 串。关键词仅在提交时进 URL，故这里用 URL 里的 q 而非输入框实时值。
  const stateStr = buildParams(sp.get("q") || "", filters, archetype, page).toString();
  const stateRef = useRef(stateStr);
  stateRef.current = stateStr;

  // URL → 状态 + 请求：外部变化（后退/前进/分享链接）时采纳 URL；任何 URL 变化都触发查询
  useEffect(() => {
    const cur = new URLSearchParams(spStr);
    if (stateRef.current !== spStr) {
      setFilters(filtersFromParams(cur));
      setQ(cur.get("q") || "");
      setPage(intOr(cur.get("page"), 1));
    }
    const pg = intOr(cur.get("page"), 1);
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    searchCards({ ...Object.fromEntries(cur.entries()), page: pg, size: PAGE_SIZE })
      .then((r) => {
        if (id !== reqId.current) return;
        if (r.items.length === 0 && r.total > 0 && pg > 1) {
          // 过期分享链接页码越界 → 钳回第 1 页重查
          cur.delete("page");
          setPage(1);
          setSp(cur, { replace: true });
          return;
        }
        setData(r);
      })
      .catch((e) => { if (id === reqId.current) setErr(String(e.message || e)); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spStr]);

  // 状态 → URL：筛选点击/范围输入防抖同步（replace 不产生历史垃圾）；提交与翻页走各自的立即 push
  useEffect(() => {
    if (stateStr === spStr) return;
    const t = setTimeout(() => setSp(new URLSearchParams(stateStr), { replace: true }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStr, spStr]);

  const submit = () => {
    const next = buildParams(q, filters, archetype, 1);
    setPage(1);
    if (next.toString() !== spStr) setSp(next); // push：不同关键词间可后退
  };

  const goPage = (pg: number) => {
    setPage(pg);
    setSp(buildParams(sp.get("q") || "", filters, archetype, pg));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>{t("search.title")}</h1>
          <div className="sub">{data ? t("search.matched", { n: data.total.toLocaleString() }) : t("search.sub")}</div>
        </div>
      </div>

      <SearchBar value={q} onChange={setQ} onSubmit={submit} />

      <div className="search-layout">
        <aside className="search-aside">
          <FilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
        </aside>

        <div className="search-results">
          {err ? <ErrorBox msg={err} />
            : loading && !data ? <Spinner />
            : data && data.items.length === 0 ? <Empty text={t("common.empty")} />
            : data && (
              <>
                <div style={{ opacity: loading ? .5 : 1, transition: ".2s" }}>
                  <CardGrid cards={data.items} showAttr />
                </div>
                {totalPages > 1 && (
                  <div className="pager">
                    <button className="btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>{t("common.prev")}</button>
                    <span className="cur">{page} / {totalPages}</span>
                    <button className="btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>{t("common.next")}</button>
                  </div>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
