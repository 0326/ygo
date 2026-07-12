import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listArchetypes } from "../lib/api";
import type { ArchetypeSummary } from "../../shared/types";
import { Spinner } from "../components/common";
import { useLang } from "../lib/i18n";

export function SeriesGrid({ items }: { items: ArchetypeSummary[] }) {
  const { lang, t } = useLang();
  return (
    <div className="series-grid">
      {items.map((a) => {
        const name = lang === "cn" ? a.cn_name : a.en_name;
        const sub = lang === "cn" ? a.en_name : a.cn_name;
        return (
          <Link key={a.id} to={`/archetypes/${a.id}`} className="series-card">
            {a.cover_thumb_url && (
              <div className="bg" style={{ backgroundImage: `url(${a.cover_thumb_url})` }} />
            )}
            <div className="veil" />
            <div className="meta">
              <h3>{name}</h3>
              {sub !== name && <div className="en">{sub}</div>}
              <div className="cnt">{a.card_count} {t("common.cards")}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Archetypes() {
  const { t } = useLang();
  const [all, setAll] = useState<ArchetypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kw, setKw] = useState("");

  useEffect(() => {
    document.title = "系列图鉴 · 游戏王集卡社";
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
          <h1>{t("arch.title")}</h1>
          <div className="sub">archetype · {all.length}</div>
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
