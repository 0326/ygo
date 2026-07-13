import { Link } from "react-router-dom";
import { useState } from "react";
import type { CardSummary } from "../../shared/types";
import { frameColor, MD_RARITY_COLOR } from "../lib/labels";
import { useLang, cardName } from "../lib/i18n";
import { imgThumb } from "../lib/cardImage";
import { AttributeIcon, BanBadge } from "./badges";

export function CardThumbnail({ card, showAttr = false }: { card: CardSummary; showAttr?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const { lang, t } = useLang();
  const c = frameColor(card.frame, card.scale != null);
  const name = cardName(card, lang);
  // 赛制专属标记：仅在单区收录时显示（双区/未知不标）
  const exclusive =
    card.formats && card.formats.includes("ocg") && !card.formats.includes("tcg") ? "ocg"
    : card.formats && card.formats.includes("tcg") && !card.formats.includes("ocg") ? "tcg"
    : null;
  return (
    <Link
      to={`/card/${card.id}`}
      className="card-thumb fade-in"
      style={{ boxShadow: loaded ? `0 0 0 1px ${c.base}44` : undefined }}
      title={name}
    >
      {!loaded && !errored && <div className="ct-skel" />}
      {/* 加载完成前不能 display:none——lazy 图片无布局盒就永远不进视口、永远不加载（死锁） */}
      {errored ? (
        <div className="ct-fallback">{name}</div>
      ) : (
        <img
          src={imgThumb(card.id, lang)}
          alt={name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={loaded ? undefined : "ct-img-loading"}
        />
      )}
      {showAttr && card.attribute && (
        <span className="ct-badge"><AttributeIcon attr={card.attribute} size={22} /></span>
      )}
      {card.ban && <span className="ct-ban"><BanBadge ban={card.ban} dot /></span>}
      {card.md_rarity && (
        <span
          className="ct-md"
          style={{
            background: MD_RARITY_COLOR[card.md_rarity],
            color: card.md_rarity === "N" || card.md_rarity === "R" ? "#1a1a1a" : "#fff",
          }}
        >
          {card.md_rarity}
        </span>
      )}
      {exclusive && (
        <span className={`ct-fmt ${exclusive}`}>{t(exclusive === "ocg" ? "fmt.ocgOnly" : "fmt.tcgOnly")}</span>
      )}
      <span className="ct-name">{name}</span>
    </Link>
  );
}

export function CardGrid({ cards, showAttr }: { cards: CardSummary[]; showAttr?: boolean }) {
  return (
    <div className="grid-cards">
      {cards.map((c) => <CardThumbnail key={c.id} card={c} showAttr={showAttr} />)}
    </div>
  );
}
