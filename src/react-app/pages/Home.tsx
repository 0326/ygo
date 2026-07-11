import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStats, listArchetypes, searchCards } from "../lib/api";
import type { ArchetypeSummary, CardSummary } from "../../shared/types";
import { CardThumbnail } from "../components/CardThumbnail";
import { SeriesGrid } from "./Archetypes";
import { SearchBar } from "../components/SearchControls";

export default function Home() {
  const nav = useNavigate();
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
    getStats().then(setStats).catch(() => {});
    loadSeries();
    searchCards({ q: "青眼", size: 3 }).then((r) => setHero(r.items)).catch(() => {});
  }, []);

  const go = () => nav(`/search?q=${encodeURIComponent(q.trim())}`);
  const fmt = (n?: number) => (n ? n.toLocaleString("zh-CN") : "—");

  return (
    <div className="container page fade-in">
      <section className="hero">
        <h1>卡图最美 · 查卡最爽<br /><span className="g">最懂收藏党</span>的游戏王卡库</h1>
        <p>全网最完整的简中卡图与系列图鉴，加上让创作者上瘾的在线制卡器与分享长图工具。</p>
        <div className="cta">
          <Link to="/search" className="btn btn-primary">开始查卡</Link>
          <Link to="/archetypes" className="btn">逛系列图鉴</Link>
          <Link to="/maker" className="btn btn-ghost">试试制卡器 →</Link>
        </div>
        <div className="hero-stats">
          <div className="stat"><b>{fmt(stats?.cards)}</b><span>收录卡片</span></div>
          <div className="stat"><b>{fmt(stats?.artworks)}</b><span>卡图(含异画)</span></div>
          <div className="stat"><b>{fmt(stats?.archetypes)}</b><span>系列</span></div>
          <div className="stat"><b>{fmt(stats?.sets)}</b><span>卡包</span></div>
        </div>
        <div className="hero-deco">
          {hero.map((c) => <CardThumbnail key={c.id} card={c} />)}
        </div>
      </section>

      <div style={{ maxWidth: 620, margin: "0 auto 8px" }}>
        <SearchBar value={q} onChange={setQ} onSubmit={go} />
      </div>

      <div className="section-head">
        <h2>热门系列图鉴</h2>
        <Link to="/archetypes">查看全部 →</Link>
      </div>
      {seriesErr && !series.length ? (
        <div className="muted" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <span>系列加载失败：{seriesErr}</span>
          <button className="btn" onClick={loadSeries}>重试</button>
        </div>
      ) : (
        <SeriesGrid items={series} />
      )}
    </div>
  );
}
