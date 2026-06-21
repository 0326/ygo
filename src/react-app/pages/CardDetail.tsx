import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCard } from "../lib/api";
import type { CardDetail as CardDetailT } from "../../shared/types";
import { AttributeIcon, LevelStars, LinkMarkers, FrameBadge, BanBadges, SubtypeChips, MdRarityBadge } from "../components/badges";
import { CardGrid } from "../components/CardThumbnail";
import { Spinner, ErrorBox } from "../components/common";
import {
  FRAME_CN, frameColor, raceCn, statStr, CARD_TYPE_CN,
} from "../lib/labels";

export default function CardDetail() {
  const { id } = useParams();
  const [card, setCard] = useState<CardDetailT | null>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    setCard(null); setErr(""); setActive(0);
    window.scrollTo(0, 0);
    getCard(id!).then(setCard).catch((e) => setErr(String(e.message || e)));
  }, [id]);

  if (err) return <div className="container page"><ErrorBox msg={err} /></div>;
  if (!card) return <div className="container page"><Spinner /></div>;

  const isPend = card.scale != null;
  const isLink = card.frame === "link";
  const isXyz = card.frame === "xyz";
  const fc = frameColor(card.frame, isPend);
  const art = card.artworks[active] || card.artworks[0];
  const isMonster = card.card_type === "monster";

  return (
    <div className="container page fade-in">
      <div style={{ marginBottom: 16, fontSize: 13 }} className="muted">
        <Link to="/search">查卡</Link>
        {card.archetype && <> · <Link to={`/archetypes/${card.archetype.id}`}>{card.archetype.cn_name}</Link></>}
        <> · {card.cn_name}</>
      </div>

      <div className="detail-wrap">
        {/* 卡图 + 异画画廊 */}
        <div className="detail-art">
          <img
            className="detail-main-img"
            src={art?.url}
            alt={card.cn_name}
            onClick={() => setZoom(true)}
            style={{ cursor: "zoom-in", boxShadow: `0 12px 40px ${fc.base}33, var(--shadow-2)` }}
          />
          {card.artworks.length > 1 && (
            <>
              <div className="gallery-thumbs">
                {card.artworks.map((a, i) => (
                  <img
                    key={a.image_key} src={a.thumb_url} alt={a.variant_name || card.cn_name}
                    className={i === active ? "active" : ""}
                    onClick={() => setActive(i)} loading="lazy"
                  />
                ))}
              </div>
              <div className="art-count">🎨 {card.artworks.length} 种异画 · 当前：{art?.variant_name || "默认画"}</div>
            </>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to={`/maker?from=${card.id}`}>做成自制卡 →</Link>
            <a className="btn btn-ghost" href={art?.url} target="_blank" rel="noreferrer">查看原图</a>
          </div>
        </div>

        {/* 信息区 */}
        <div>
          <div className="detail-title">
            {isMonster && <AttributeIcon attr={card.attribute} size={34} />}
            <h1>{card.cn_name}</h1>
          </div>
          <div className="detail-en">{card.en_name}</div>

          <div className="stat-line">
            <FrameBadge frame={card.frame} label={FRAME_CN[card.frame]} pendulum={isPend} />
            {isPend && <FrameBadge frame="pendulum" label="灵摆" pendulum />}
            {isMonster && card.race && <span className="chip">{raceCn(card.race)}族</span>}
            {!isMonster && card.race && <span className="chip">{raceCn(card.race)}{card.card_type === "spell" ? "魔法" : "陷阱"}</span>}
            <span className="chip">{CARD_TYPE_CN[card.card_type]}</span>
            {isMonster && <SubtypeChips subtypes={card.subtypes} />}
            {card.archetype && <Link to={`/archetypes/${card.archetype.id}`} className="chip" style={{ color: "var(--gold-soft)" }}>◈ {card.archetype.cn_name}</Link>}
            <BanBadges ban={card.ban} />
            <MdRarityBadge rarity={card.md_rarity} />
          </div>

          {isMonster && (
            <div className="stat-line">
              {isLink ? (
                <span className="k">LINK-{card.link_val}</span>
              ) : (
                <>
                  <span className="k">{isXyz ? "阶级" : "等级"}</span>
                  <LevelStars level={card.level || 0} rank={isXyz} />
                </>
              )}
              {isPend && <><span className="k" style={{ marginLeft: 12 }}>刻度</span><b style={{ color: "var(--gold-soft)" }}>← {card.scale} / {card.scale} →</b></>}
            </div>
          )}

          {isMonster && (
            <div className="atkdef">
              <div><span className="k">攻击</span><span className="v atk">{statStr(card.atk)}</span></div>
              {isLink ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="k">连接标记</span>
                  {card.link_markers && <LinkMarkers markers={card.link_markers} />}
                </div>
              ) : (
                <div><span className="k">守备</span><span className="v def">{statStr(card.def)}</span></div>
              )}
            </div>
          )}

          {isPend && card.pendulum_effect_cn && (
            <div className="detail-section">
              <h3 style={{ color: "var(--gold-soft)" }}>灵摆效果</h3>
              <div className="effect-text pend-effect">{card.pendulum_effect_cn}</div>
            </div>
          )}

          <div className="detail-section">
            <h3>{isMonster && card.frame === "normal" ? "卡图设定" : isPend ? "怪兽效果" : "卡片效果"}</h3>
            <div className="effect-text">{card.effect_cn || "（暂无简中文本）"}</div>
          </div>

          {card.prints.length > 0 && (
            <div className="detail-section">
              <h3>收录情况（{card.prints.length}）</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="prints-table">
                  <thead>
                    <tr><th>卡包</th><th>卡号</th><th>罕贵</th><th>发售</th></tr>
                  </thead>
                  <tbody>
                    {card.prints.slice(0, 40).map((p, i) => (
                      <tr key={i}>
                        <td><Link to={`/sets/${p.set_code}`} style={{ color: "var(--text-0)" }}>{p.set_name}</Link></td>
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
          <h3>同系列关联卡</h3>
          <CardGrid cards={card.related} showAttr />
        </div>
      )}

      {zoom && art && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={art.url} alt={card.cn_name} />
        </div>
      )}
    </div>
  );
}
