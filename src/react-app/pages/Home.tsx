import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStats, listArchetypes, searchCards } from "../lib/api";
import type { ArchetypeSummary, CardSummary } from "../../shared/types";
import { CardGrid } from "../components/CardThumbnail";
import { SeriesGrid } from "./Archetypes";
import { SearchBar } from "../components/SearchControls";
import { useLang } from "../lib/i18n";

export default function Home() {
  const nav = useNavigate();
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<{ cards: number; archetypes: number; artworks: number; sets: number } | null>(null);
  const [series, setSeries] = useState<ArchetypeSummary[]>([]);
  const [seriesErr, setSeriesErr] = useState("");
  const [hero, setHero] = useState<CardSummary[]>([]);

  // stats/hero 失败可静默降级（有 — 占位）；系列失败要给出错误与重试入口
  const loadSeries = () => {
    setSeriesErr("");
    listArchetypes(40).then((a) => setSeries(a.slice(0, 8))).catch((e) => setSeriesErr(String(e.message || e)));
  };
  useEffect(() => {
    document.title = "游戏王集卡社 · 游戏王卡图 / 图鉴 / 制卡器";
    getStats().then(setStats).catch(() => {});
    loadSeries();
    searchCards({ q: "青眼", size: 12 }).then((r) => setHero(r.items)).catch(() => {});
  }, []);

  const go = () => nav(`/search?q=${encodeURIComponent(q.trim())}`);
  const fmt = (n?: number) => (n ? n.toLocaleString("zh-CN") : "—");

  return (
    <div className="container page fade-in">
      <section className="hero hero-bg">
        <h1>{t("home.heroTitle1")}<br /><span className="g">{t("home.heroTitle2")}</span>{t("home.heroTitle3")}</h1>
        <p>{t("home.heroSub")}</p>
        <div className="cta">
          <Link to="/search" className="btn btn-primary">{t("home.ctaSearch")}</Link>
          <Link to="/archetypes" className="btn">{t("home.ctaArchetypes")}</Link>
          <Link to="/maker" className="btn btn-ghost">{t("home.ctaMaker")}</Link>
        </div>
        <div className="hero-stats">
          <div className="stat"><b>{fmt(stats?.cards)}</b><span>{t("home.statCards")}</span></div>
          <div className="stat"><b>{fmt(stats?.artworks)}</b><span>{t("home.statArtworks")}</span></div>
          <div className="stat"><b>{fmt(stats?.archetypes)}</b><span>{t("home.statArchetypes")}</span></div>
          <div className="stat"><b>{fmt(stats?.sets)}</b><span>{t("home.statSets")}</span></div>
        </div>
      </section>

      <div style={{ maxWidth: 620, margin: "0 auto 8px" }}>
        <SearchBar value={q} onChange={setQ} onSubmit={go} />
      </div>

      {hero.length > 0 && (
        <>
          <div className="section-head">
            <h2>{t("home.hotCards")}</h2>
            <Link to="/search">{t("common.viewAll")}</Link>
          </div>
          <CardGrid cards={hero} showAttr />
        </>
      )}

      <div className="section-head">
        <h2>{t("home.hotArchetypes")}</h2>
        <Link to="/archetypes">{t("common.viewAll")}</Link>
      </div>
      {seriesErr && !series.length ? (
        <div className="muted" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <span>{t("home.seriesLoadFail")}{seriesErr}</span>
          <button className="btn" onClick={loadSeries}>{t("common.retry")}</button>
        </div>
      ) : (
        <SeriesGrid items={series} />
      )}
    </div>
  );
}
