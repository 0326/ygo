import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchCards } from "../lib/api";
import type { SearchResponse } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { SearchBar, FilterPanel, emptyFilters, filtersToParams, type Filters } from "../components/SearchControls";
import { Spinner, Empty, ErrorBox } from "../components/common";

const PAGE_SIZE = 30;

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [filters, setFilters] = useState<Filters>(() => {
    const f = emptyFilters();
    if (sp.get("archetype")) f.type = ""; // archetype handled via param
    return f;
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const archetype = sp.get("archetype") || "";
  const reqId = useRef(0);

  const run = useCallback((pg: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    searchCards({ q: q.trim(), ...filtersToParams(filters), archetype, page: pg, size: PAGE_SIZE })
      .then((r) => { if (id === reqId.current) { setData(r); setPage(pg); } })
      .catch((e) => { if (id === reqId.current) setErr(String(e.message || e)); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [q, filters, archetype]);

  // 首次挂载 + 筛选/系列变化时回到第一页重新搜索（关键词仅在提交时触发，故不入依赖）
  useEffect(() => {
    run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, archetype]);

  const submit = () => {
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set("q", q.trim()); else next.delete("q");
    setSp(next, { replace: true });
    run(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>查卡</h1>
          <div className="sub">{data ? `共 ${data.total.toLocaleString("zh-CN")} 张匹配` : "简中卡名 / 效果全文检索 + 多维筛选"}</div>
        </div>
      </div>

      <SearchBar value={q} onChange={setQ} onSubmit={submit} />
      <FilterPanel filters={filters} onChange={setFilters} />

      {err ? <ErrorBox msg={err} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <Empty text="没有匹配的卡片，换个条件试试" />
        : data && (
          <>
            <div style={{ opacity: loading ? .5 : 1, transition: ".2s" }}>
              <CardGrid cards={data.items} showAttr />
            </div>
            {totalPages > 1 && (
              <div className="pager">
                <button className="btn" disabled={page <= 1} onClick={() => run(page - 1)}>上一页</button>
                <span className="cur">{page} / {totalPages}</span>
                <button className="btn" disabled={page >= totalPages} onClick={() => run(page + 1)}>下一页</button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
