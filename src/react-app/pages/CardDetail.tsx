import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCard } from "../lib/api";
import type { CardDetail as CardDetailT } from "../../shared/types";
import { AttributeIcon, LevelStars, LinkMarkers, FrameBadge, BanBadges, SubtypeChips, MdRarityBadge, FavButton } from "../components/badges";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, ErrorBox } from "../components/common";
import { frameColor, statStr } from "../lib/labels";
import { useLang, cardName, cardAltName, cardEffect, frameName, raceName, cardTypeName, setName } from "../lib/i18n";
import { imgFull, imgThumb } from "../lib/cardImage";

export default function CardDetail() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const [card, setCard] = useState<CardDetailT | null>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    setCard(null); setErr(""); setActive(0);
    window.scrollTo(0, 0);
    getCard(id!).then((c) => {
      setCard(c);
      if (c) document.title = `${c.cn_name || c.en_name} · 游戏王集卡社`;
    }).catch((e) => setErr(String(e.message || e)));
  }, [id]);

  // 灯箱键盘操作：Esc 关闭，←/→ 切换异画
  useEffect(() => {
    if (!zoom) return;
    const n = card?.artworks.length ?? 0;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowLeft" && n > 1) setActive((i) => (i - 1 + n) % n);
      else if (e.key === "ArrowRight" && n > 1) setActive((i) => (i + 1) % n);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [zoom, card]);

  if (err) return <div className="container page"><ErrorBox msg={err} /></div>;
  if (!card) return <div className="container page"><Spinner /></div>;

  const isPend = card.scale != null;
  const isLink = card.frame === "link";
  const isXyz = card.frame === "xyz";
  const fc = frameColor(card.frame, isPend);
  const art = card.artworks[active] || card.artworks[0];
  const isMonster = card.card_type === "monster";
  const name = cardName(card, lang);
  const eff = cardEffect(card, lang);
  const archName = card.archetype ? (lang === "cn" ? card.archetype.cn_name : card.archetype.en_name) : "";

  return (
    <div className="container page fade-in">
      <div style={{ marginBottom: 16, fontSize: 13 }} className="muted">
        <Link to="/search">{t("nav.search")}</Link>
        {card.archetype && <> · <Link to={`/archetypes/${card.archetype.id}`}>{archName}</Link></>}
        <> · {name}</>
      </div>

      <div className="detail-wrap">
        {/* 卡图 + 异画画廊 */}
        <div className="detail-art">
          <img
            className="detail-main-img"
            src={imgFull(art?.image_key || card.id, lang)}
            alt={name}
            onClick={() => setZoom(true)}
            style={{ cursor: "zoom-in", boxShadow: `0 12px 40px ${fc.base}33, var(--shadow-2)` }}
          />
          {card.artworks.length > 1 && (
            <>
              <div className="gallery-thumbs">
                {card.artworks.map((a, i) => (
                  <img
                    key={a.image_key} src={imgThumb(a.image_key, lang)} alt={a.variant_name || name}
                    className={i === active ? "active" : ""}
                    onClick={() => setActive(i)} loading="lazy"
                  />
                ))}
              </div>
              <div className="art-count">🎨 {card.artworks.length} {t("detail.artworks")} · {t("detail.current")}：{art?.variant_name || t("detail.defaultArt")}</div>
            </>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <FavButton kind="card" refId={card.id} />
            <Link className="btn" to={`/maker?from=${card.id}`}>{t("detail.makeCard")}</Link>
            <a className="btn btn-ghost" href={imgFull(art?.image_key || card.id, lang)} target="_blank" rel="noreferrer">{t("detail.viewOriginal")}</a>
          </div>
        </div>

        {/* 信息区 */}
        <div>
          <div className="detail-title">
            {isMonster && <AttributeIcon attr={card.attribute} size={34} />}
            <h1>{name}</h1>
          </div>
          <div className="detail-en">
            {cardAltName(card, lang)}
            {lang === "cn" && card.jp_name && <span className="muted"> ｜ {card.jp_name}</span>}
          </div>

          <div className="stat-line">
            <FrameBadge frame={card.frame} label={frameName(card.frame, lang)} pendulum={isPend} />
            {isPend && <FrameBadge frame="pendulum" label={frameName("pendulum", lang)} pendulum />}
            {isMonster && card.race && <span className="chip">{raceName(card.race, lang)}{t("detail.raceSuffix")}</span>}
            {!isMonster && card.race && <span className="chip">{raceName(card.race, lang)}{lang === "en" ? ` ${cardTypeName(card.card_type, lang)}` : cardTypeName(card.card_type, lang)}</span>}
            <span className="chip">{cardTypeName(card.card_type, lang)}</span>
            {isMonster && <SubtypeChips subtypes={card.subtypes} />}
            {card.formats && (
              <span className="chip fmt-chip" title={t("detail.formats")}>
                {card.formats.map((f) => f.toUpperCase()).join(" / ")}
              </span>
            )}
            {card.archetype && <Link to={`/archetypes/${card.archetype.id}`} className="chip" style={{ color: "var(--gold-soft)" }}>◈ {archName}</Link>}
            <BanBadges ban={card.ban} />
            <MdRarityBadge rarity={card.md_rarity} />
          </div>

          {isMonster && (
            <div className="stat-line">
              {isLink ? (
                <span className="k">LINK-{card.link_val}</span>
              ) : (
                <>
                  <span className="k">{isXyz ? t("detail.rank") : t("detail.level")}</span>
                  <LevelStars level={card.level || 0} rank={isXyz} />
                </>
              )}
              {isPend && <><span className="k" style={{ marginLeft: 12 }}>{t("detail.scale")}</span><b style={{ color: "var(--gold-soft)" }}>{card.scale}</b></>}
            </div>
          )}

          {isMonster && (
            <div className="atkdef">
              <div><span className="k">{t("detail.atk")}</span><span className="v atk">{statStr(card.atk)}</span></div>
              {isLink ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="k">{t("detail.linkMarkers")}</span>
                  {card.link_markers && <LinkMarkers markers={card.link_markers} />}
                </div>
              ) : (
                <div><span className="k">{t("detail.def")}</span><span className="v def">{statStr(card.def)}</span></div>
              )}
            </div>
          )}

          {isPend && eff.pend && (
            <div className="detail-section">
              <h3 style={{ color: "var(--gold-soft)" }}>{t("detail.pendEffect")}</h3>
              <div className="effect-text pend-effect">{eff.pend}</div>
            </div>
          )}

          <div className="detail-section">
            <h3>{isMonster && card.frame === "normal" ? t("detail.flavorText") : isPend ? t("detail.monsterEffect") : t("detail.cardEffect")}</h3>
            {eff.fallback && <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("detail.noText")}</div>}
            <div className="effect-text">{eff.effect || "—"}</div>
          </div>

          {card.prints.length > 0 && (
            <div className="detail-section">
              <h3>{t("detail.prints")}（{card.prints.length}）</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="prints-table">
                  <thead>
                    <tr><th>{t("detail.set")}</th><th>{t("detail.cardNo")}</th><th>{t("detail.rarity")}</th><th>{t("detail.release")}</th></tr>
                  </thead>
                  <tbody>
                    {card.prints.slice(0, 40).map((p, i) => (
                      <tr key={i}>
                        <td><Link to={`/sets/${p.set_code}`} style={{ color: "var(--text-0)" }}>{setName({ cn_name: p.set_cn_name, en_name: p.set_name }, lang)}</Link></td>
                        <td className="muted">{p.card_number}</td>
                        <td>{p.rarity ? <span className="rarity-tag">{p.rarity}</span> : "—"}</td>
                        <td className="muted">{p.release_date ? new Date(p.release_date * 1000).getFullYear() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {card.related.length > 0 && (
        <div className="detail-section">
          <h3>{t("detail.related")}</h3>
          <CardGrid cards={card.related} showAttr />
        </div>
      )}

      {zoom && art && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={imgFull(art.image_key, lang)} alt={name} />
        </div>
      )}
    </div>
  );
}
