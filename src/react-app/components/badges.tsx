import { ATTR_CN, ATTR_COLOR, frameColor, BAN_CN, BAN_COLOR, BAN_FORMAT_CN, SUBTYPE_CN } from "../lib/labels";
import type { LinkMarker, BanInfo, BanFormat, BanStatus, MonsterSubtype } from "../../shared/types";

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

// 禁限角标。优先按指定赛制显示；缩略图上用单色小圆点。
export function BanBadge({ ban, format = "ocg", dot = false }: { ban: BanInfo | null; format?: BanFormat; dot?: boolean }) {
  if (!ban) return null;
  const st = ban[format] ?? ban.ocg ?? ban.tcg ?? ban.md;
  if (st == null) return null;
  const color = BAN_COLOR[st as BanStatus];
  if (dot) {
    return <span className="ban-dot" style={{ background: color }} title={`${BAN_FORMAT_CN[format]} ${BAN_CN[st as BanStatus]}`} />;
  }
  return (
    <span className="ban-badge" style={{ background: color }}>
      {BAN_FORMAT_CN[format]}·{BAN_CN[st as BanStatus]}
    </span>
  );
}

// 禁限：所有赛制一起展示（详情页用）
export function BanBadges({ ban }: { ban: BanInfo | null }) {
  if (!ban) return null;
  const formats = (["ocg", "tcg", "md"] as BanFormat[]).filter((f) => ban[f] != null);
  if (!formats.length) return null;
  return (
    <span className="ban-badges">
      {formats.map((f) => (
        <span key={f} className="ban-badge" style={{ background: BAN_COLOR[ban[f] as BanStatus] }}>
          {BAN_FORMAT_CN[f]}·{BAN_CN[ban[f] as BanStatus]}
        </span>
      ))}
    </span>
  );
}

export function SubtypeChips({ subtypes }: { subtypes: MonsterSubtype[] | null }) {
  if (!subtypes || !subtypes.length) return null;
  return <>{subtypes.map((s) => <span key={s} className="chip subtype-chip">{SUBTYPE_CN[s]}</span>)}</>;
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
