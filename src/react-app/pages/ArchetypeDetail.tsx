import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArchetype } from "../lib/api";
import type { CardSummary, ArchetypeSummary } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, ErrorBox } from "../components/common";
import { CARD_TYPE_CN } from "../lib/labels";

export default function ArchetypeDetail() {
  const { id } = useParams();
  const [data, setData] = useState<{ archetype: ArchetypeSummary; cards: CardSummary[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null); setErr(""); window.scrollTo(0, 0);
    getArchetype(id!).then(setData).catch((e) => setErr(String(e.message || e)));
  }, [id]);

  if (err) return <div className="container page"><ErrorBox msg={err} /></div>;
  if (!data) return <div className="container page"><Spinner /></div>;

  const { archetype: a, cards } = data;
  const groups: { key: string; label: string; cards: CardSummary[] }[] = [
    { key: "monster", label: "怪兽", cards: cards.filter((c) => c.card_type === "monster") },
    { key: "spell", label: "魔法", cards: cards.filter((c) => c.card_type === "spell") },
    { key: "trap", label: "陷阱", cards: cards.filter((c) => c.card_type === "trap") },
  ].filter((g) => g.cards.length);

  return (
    <div className="container page fade-in">
      <div
        className="hero"
        style={{
          padding: "44px 36px", marginTop: 8, marginBottom: 30,
          backgroundImage: a.cover_thumb_url
            ? `linear-gradient(110deg, rgba(11,12,16,.96) 35%, rgba(11,12,16,.55)), url(${a.cover_thumb_url})`
            : undefined,
          backgroundSize: "cover", backgroundPosition: "center 25%",
        }}
      >
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          <Link to="/archetypes">系列图鉴</Link> · 图鉴
        </div>
        <h1 style={{ fontSize: 38 }}>{a.cn_name}</h1>
        {a.en_name !== a.cn_name && <p style={{ margin: "8px 0 0", color: "var(--text-1)" }}>{a.en_name}</p>}
        <div className="hero-stats" style={{ marginTop: 20 }}>
          <div className="stat"><b>{a.card_count}</b><span>系列卡片</span></div>
          {groups.map((g) => <div className="stat" key={g.key}><b>{g.cards.length}</b><span>{g.label}</span></div>)}
        </div>
        <div className="cta" style={{ marginTop: 22 }}>
          <Link className="btn btn-primary" to={`/share?archetype=${a.id}`}>生成系列长图 →</Link>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.key} style={{ marginBottom: 36 }}>
          <div className="section-head" style={{ margin: "0 0 14px" }}>
            <h2>{CARD_TYPE_CN[g.key as "monster"]}（{g.cards.length}）</h2>
          </div>
          <CardGrid cards={g.cards} showAttr={g.key === "monster"} />
        </section>
      ))}
    </div>
  );
}
