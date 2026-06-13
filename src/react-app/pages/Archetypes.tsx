import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listArchetypes } from "../lib/api";
import type { ArchetypeSummary } from "../../shared/types";
import { Spinner } from "../components/common";

export function SeriesGrid({ items }: { items: ArchetypeSummary[] }) {
  return (
    <div className="series-grid">
      {items.map((a) => (
        <Link key={a.id} to={`/archetypes/${a.id}`} className="series-card">
          {a.cover_thumb_url && (
            <div className="bg" style={{ backgroundImage: `url(${a.cover_thumb_url})` }} />
          )}
          <div className="veil" />
          <div className="meta">
            <h3>{a.cn_name}</h3>
            {a.en_name !== a.cn_name && <div className="en">{a.en_name}</div>}
            <div className="cnt">{a.card_count} 张</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Archetypes() {
  const [all, setAll] = useState<ArchetypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kw, setKw] = useState("");

  useEffect(() => {
    listArchetypes(6).then(setAll).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return all;
    return all.filter((a) => a.cn_name.toLowerCase().includes(k) || a.en_name.toLowerCase().includes(k));
  }, [all, kw]);

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>系列图鉴</h1>
          <div className="sub">按系列（archetype）浏览，{all.length} 个系列 · 天生适合截图转发</div>
        </div>
        <input
          style={{
            maxWidth: 260, padding: "10px 14px", background: "var(--bg-2)",
            border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)",
            color: "var(--text-0)", fontSize: 14, outline: "none",
          }}
          placeholder="筛选系列…" value={kw} onChange={(e) => setKw(e.target.value)}
        />
      </div>
      {loading ? <Spinner /> : <SeriesGrid items={shown} />}
    </div>
  );
}
