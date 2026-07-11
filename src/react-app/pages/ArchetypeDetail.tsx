import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArchetype } from "../lib/api";
import type { CardSummary, ArchetypeSummary } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, ErrorBox } from "../components/common";
import { useLang, cardTypeName } from "../lib/i18n";

export default function ArchetypeDetail() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const [data, setData] = useState<{ archetype: ArchetypeSummary; cards: CardSummary[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null); setErr(""); window.scrollTo(0, 0);
    getArchetype(id!).then(setData).catch((e) => setErr(String(e.message || e)));
  }, [id]);

  if (err) return <div className="container page"><ErrorBox msg={err} /></div>;
  if (!data) return <div className="container page"><Spinner /></div>;

  const { archetype: a, cards } = data;
  const groups: { key: string; label: string; cards: CardSummary[] }[] = (
    ["monster", "spell", "trap"] as const
  ).map((k) => ({ key: k, label: cardTypeName(k, lang), cards: cards.filter((c) => c.card_type === k) }))
    .filter((g) => g.cards.length);
  const archName = lang === "cn" ? a.cn_name : a.en_name;
  const archSub = lang === "cn" ? a.en_name : a.cn_name;

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
          <Link to="/archetypes">{t("arch.title")}</Link>
        </div>
        <h1 style={{ fontSize: 38 }}>{archName}</h1>
        {archSub !== archName && <p style={{ margin: "8px 0 0", color: "var(--text-1)" }}>{archSub}</p>}
        <div className="hero-stats" style={{ marginTop: 20 }}>
          <div className="stat"><b>{a.card_count}</b><span>{t("common.cards")}</span></div>
          {groups.map((g) => <div className="stat" key={g.key}><b>{g.cards.length}</b><span>{g.label}</span></div>)}
        </div>
        <div className="cta" style={{ marginTop: 22 }}>
          <Link className="btn btn-primary" to={`/share?archetype=${a.id}`}>{t("nav.share")} →</Link>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.key} style={{ marginBottom: 36 }}>
          <div className="section-head" style={{ margin: "0 0 14px" }}>
            <h2>{g.label}（{g.cards.length}）</h2>
          </div>
          <CardGrid cards={g.cards} showAttr={g.key === "monster"} />
        </section>
      ))}
    </div>
  );
}
