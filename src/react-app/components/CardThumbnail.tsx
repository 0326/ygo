import { Link } from "react-router-dom";
import { useState } from "react";
import type { CardSummary } from "../../shared/types";
import { frameColor } from "../lib/labels";
import { AttributeIcon } from "./badges";

export function CardThumbnail({ card, showAttr = false }: { card: CardSummary; showAttr?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const c = frameColor(card.frame, card.scale != null);
  return (
    <Link
      to={`/card/${card.id}`}
      className="card-thumb fade-in"
      style={{ boxShadow: loaded ? `0 0 0 1px ${c.base}44` : undefined }}
      title={card.cn_name}
    >
      {!loaded && !errored && <div className="ct-skel" />}
      {errored ? (
        <div className="ct-fallback">{card.cn_name}</div>
      ) : (
        <img
          src={card.thumb_url}
          alt={card.cn_name}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
      {showAttr && card.attribute && (
        <span className="ct-badge"><AttributeIcon attr={card.attribute} size={22} /></span>
      )}
      <span className="ct-name">{card.cn_name}</span>
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
