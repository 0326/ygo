import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listSets, getSet } from "../lib/api";
import type { SetSummary, CardSummary } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, ErrorBox } from "../components/common";

export function Sets() {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kw, setKw] = useState("");

  useEffect(() => { listSets().then(setSets).finally(() => setLoading(false)); }, []);
  const shown = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return k ? sets.filter((s) => s.en_name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k)) : sets;
  }, [sets, kw]);

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div><h1>卡包</h1><div className="sub">按发售时间倒序 · 共收录 {sets.length} 个卡包</div></div>
        <input
          style={{ maxWidth: 260, padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: 14, outline: "none" }}
          placeholder="搜索卡包…" value={kw} onChange={(e) => setKw(e.target.value)}
        />
      </div>
      {loading ? <Spinner /> : (
        <div className="sets-grid">
          {shown.slice(0, 200).map((s) => (
            <Link key={s.code} to={`/sets/${s.code}`} className="set-card">
              <div className="set-cover">
                {s.cover_thumb_url
                  ? <img src={s.cover_thumb_url} alt={s.en_name} />
                  : <span className="set-cover-ph">🃏</span>}
                {s.release_date && <span className="set-year">{new Date(s.release_date * 1000).getFullYear()}</span>}
              </div>
              <div className="set-meta">
                <b>{s.en_name}</b>
                <div className="muted">{s.code} · {s.card_count} 张</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SetDetail() {
  const { code } = useParams();
  const [data, setData] = useState<{ set: SetSummary; cards: CardSummary[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setData(null); setErr(""); window.scrollTo(0, 0);
    getSet(code!).then(setData).catch((e) => setErr(String(e.message || e)));
  }, [code]);

  if (err) return <div className="container page"><ErrorBox msg={err} /></div>;
  if (!data) return <div className="container page"><Spinner /></div>;
  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}><Link to="/sets">卡包</Link></div>
          <h1>{data.set.en_name}</h1>
          <div className="sub">{data.set.code} · {data.cards.length} 张{data.set.release_date ? ` · ${new Date(data.set.release_date * 1000).toLocaleDateString("zh-CN")}` : ""}</div>
        </div>
      </div>
      <CardGrid cards={data.cards} showAttr />
    </div>
  );
}
