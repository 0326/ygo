import { ATTR_CN, ATTR_COLOR, frameColor } from "../lib/labels";
import type { LinkMarker } from "../../shared/types";

export function AttributeIcon({ attr, size = 26 }: { attr: string | null; size?: number }) {
  if (!attr) return null;
  return (
    <span
      className="attr-icon"
      title={ATTR_CN[attr] ? `${ATTR_CN[attr]}属性` : attr}
      style={{
        width: size, height: size, fontSize: size * 0.5,
        background: `radial-gradient(circle at 35% 30%, ${ATTR_COLOR[attr] || "#888"}, #00000055)`,
      }}
    >
      {ATTR_CN[attr] || "?"}
    </span>
  );
}

const Star = ({ rank }: { rank?: boolean }) => (
  <svg className={`star${rank ? " rank" : ""}`} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z" />
  </svg>
);

export function LevelStars({ level, rank = false }: { level: number; rank?: boolean }) {
  if (!level || level < 1) return null;
  return (
    <span className="stars" title={rank ? `${level} 阶` : `${level} 星`}>
      {Array.from({ length: Math.min(level, 13) }, (_, i) => <Star key={i} rank={rank} />)}
    </span>
  );
}

const MARKER_POS: Record<LinkMarker, number> = {
  "top-left": 0, top: 1, "top-right": 2,
  left: 3, right: 5,
  "bottom-left": 6, bottom: 7, "bottom-right": 8,
};
const ARROW_CHARS = ["◤", "▲", "◥", "◀", "", "▶", "◣", "▼", "◢"];

export function LinkMarkers({ markers }: { markers: LinkMarker[] }) {
  const on = new Set(markers.map((m) => MARKER_POS[m]));
  return (
    <span className="link-markers" title={`连接标记: ${markers.length}`}>
      {Array.from({ length: 9 }, (_, i) => {
        if (i === 4) return <span key={i} className="lm-cell center" />;
        return (
          <span key={i} className={`lm-cell${on.has(i) ? " on" : ""}`}>
            {on.has(i) ? ARROW_CHARS[i] : ""}
          </span>
        );
      })}
    </span>
  );
}

export function FrameBadge({ frame, label, pendulum = false }: { frame: string; label: string; pendulum?: boolean }) {
  const c = frameColor(frame, pendulum);
  return (
    <span
      className="chip"
      style={{ background: c.base, color: c.text, borderColor: "transparent", fontWeight: 600 }}
    >
      {label}
    </span>
  );
}
