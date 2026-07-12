// M10 用户中心：收藏卡片 / 卡包 / 壁纸 + 我的卡组。
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CardSummary, SetSummary, WallpaperItem, UserDeck } from "../../shared/types";
import { cardsByIds, listSets, listWallpapers, listMyDecks, deleteMyDeck } from "../lib/api";
import { useUser } from "../lib/user";
import { useLang } from "../lib/i18n";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, Empty } from "../components/common";
import { decodeDeck } from "../lib/deck";
import { BAN_FORMAT_CN } from "../lib/labels";

type Tab = "card" | "set" | "wallpaper" | "deck";

export default function Me() {
  const { me, logout, favs } = useUser();
  const { t } = useLang();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("card");

  useEffect(() => {
    if (me === null) nav("/login?next=/me", { replace: true });
  }, [me, nav]);

  if (!me) return <div className="container page"><Spinner /></div>;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "card", label: t("me.favCards"), count: favs.card.length },
    { key: "set", label: t("me.favSets"), count: favs.set.length },
    { key: "wallpaper", label: t("me.favWallpapers"), count: favs.wallpaper.length },
    { key: "deck", label: t("me.decks") },
  ];

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>{t("me.title")}</h1>
          <div className="sub">
            {me.username}
            {me.role === "admin" && <span className="chip" style={{ marginLeft: 10, color: "var(--gold-soft)" }}>admin</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {me.role === "admin" && <Link className="btn" to="/admin">{t("me.admin")}</Link>}
          <button className="btn btn-ghost" onClick={() => { void logout().then(() => nav("/")); }}>{t("auth.logout")}</button>
        </div>
      </div>

      <div className="me-tabs">
        {TABS.map((x) => (
          <button key={x.key} className={`fmt-tab${tab === x.key ? " on" : ""}`} onClick={() => setTab(x.key)}>
            {x.label}{x.count != null ? `（${x.count}）` : ""}
          </button>
        ))}
      </div>

      {tab === "card" && <FavCards ids={favs.card} />}
      {tab === "set" && <FavSets codes={favs.set} />}
      {tab === "wallpaper" && <FavWallpapers ids={favs.wallpaper} />}
      {tab === "deck" && <MyDecks />}
    </div>
  );
}

function FavCards({ ids }: { ids: string[] }) {
  const { t } = useLang();
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  useEffect(() => {
    if (!ids.length) { setCards([]); return; }
    cardsByIds(ids).then((r) => setCards(r.items)).catch(() => setCards([]));
  }, [ids]);
  if (!cards) return <Spinner />;
  if (!cards.length) return <Empty text={t("me.empty")} />;
  return <CardGrid cards={cards} showAttr />;
}

function FavSets({ codes }: { codes: string[] }) {
  const { t } = useLang();
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  useEffect(() => {
    if (!codes.length) { setSets([]); return; }
    listSets().then((all) => {
      const want = new Set(codes);
      setSets(all.filter((s) => want.has(s.code)));
    }).catch(() => setSets([]));
  }, [codes]);
  if (!sets) return <Spinner />;
  if (!sets.length) return <Empty text={t("me.empty")} />;
  return (
    <div className="sets-grid">
      {sets.map((s) => (
        <Link key={s.code} to={`/sets/${s.code}`} className="set-card">
          <div className="set-cover">
            {s.cover_thumb_url ? <img src={s.cover_thumb_url} alt={s.en_name} /> : <span className="set-cover-ph">🃏</span>}
            {s.release_date && <span className="set-year">{new Date(s.release_date * 1000).getFullYear()}</span>}
          </div>
          <div className="set-meta">
            <b>{s.en_name}</b>
            <div className="muted">{s.code} · {s.card_count} {t("common.cards")}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function FavWallpapers({ ids }: { ids: string[] }) {
  const { t } = useLang();
  const [items, setItems] = useState<WallpaperItem[] | null>(null);
  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    listWallpapers({ ids: ids.join(","), size: 100 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [ids]);
  if (!items) return <Spinner />;
  if (!items.length) return <Empty text={t("me.empty")} />;
  return (
    <div className="me-wp-grid">
      {items.map((w) => (
        <Link key={w.id} className="me-wp" to={`/wallpapers?id=${encodeURIComponent(w.id)}`} title={w.title}>
          <img src={w.thumb_url} alt={w.title} loading="lazy" />
          <span className="me-wp-meta">{w.width}×{w.height}</span>
        </Link>
      ))}
    </div>
  );
}

function MyDecks() {
  const { t } = useLang();
  const [decks, setDecks] = useState<UserDeck[] | null>(null);
  const load = () => listMyDecks().then((r) => setDecks(r.items)).catch(() => setDecks([]));
  useEffect(() => { void load(); }, []);
  const counts = useMemo(
    () => new Map((decks || []).map((d) => {
      const dk = decodeDeck(d.deck_code);
      return [d.id, `${dk.main.length}+${dk.extra.length}+${dk.side.length}`];
    })),
    [decks],
  );
  if (!decks) return <Spinner />;
  if (!decks.length) return <Empty text={t("me.empty")} />;
  return (
    <div className="me-decks">
      {decks.map((d) => (
        <div key={d.id} className="me-deck">
          <div className="me-deck-info">
            <b>{d.name}</b>
            <span className="muted">
              {BAN_FORMAT_CN[d.format] || d.format} · {counts.get(d.id)} · {new Date(d.updated_at * 1000).toLocaleDateString()}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn" to={`/deck?d=${d.deck_code}&save=${d.id}&name=${encodeURIComponent(d.name)}`}>{t("me.open")}</Link>
            <button
              className="btn btn-ghost"
              onClick={() => { if (confirm(`${t("me.delete")}「${d.name}」?`)) void deleteMyDeck(d.id).then(load); }}
            >
              {t("me.delete")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
