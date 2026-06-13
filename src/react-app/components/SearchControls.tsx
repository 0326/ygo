import { useState } from "react";
import { FRAME_OPTIONS, ATTR_OPTIONS, RACE_CN } from "../lib/labels";

export function SearchBar({
  value, onChange, onSubmit, placeholder = "搜索卡名 / 效果（简中）…",
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string;
}) {
  return (
    <div className="searchbar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      {value && <button className="sb-clear" onClick={() => { onChange(""); }}>×</button>}
      <button className="btn btn-primary sb-go" onClick={onSubmit}>搜索</button>
    </div>
  );
}

export interface Filters {
  frame: Set<string>;
  attribute: Set<string>;
  race: Set<string>;
  type: string;
  level: string;
  sort: string;
}
export const emptyFilters = (): Filters => ({
  frame: new Set(), attribute: new Set(), race: new Set(), type: "", level: "", sort: "",
});

const MONSTER_RACES = [
  "Dragon","Spellcaster","Warrior","Beast","Machine","Fiend","Fairy","Zombie",
  "Aqua","Pyro","Rock","Winged Beast","Insect","Fish","Dinosaur","Reptile",
  "Plant","Thunder","Psychic","Cyberse","Wyrm","Sea Serpent","Beast-Warrior",
];

function Toggle({ on, label, color, onClick }: { on: boolean; label: string; color?: string; onClick: () => void }) {
  return (
    <button
      className={`filter-toggle${on ? " on" : ""}`}
      style={on && color ? { background: color, borderColor: "transparent", color: "#fff" } : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [openRace, setOpenRace] = useState(false);
  const toggle = (set: Set<string>, v: string): Set<string> => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  };
  return (
    <div className="filter-panel">
      <div className="filter-row">
        <span className="filter-label">卡种</span>
        <div className="filter-toggles">
          {(["monster","spell","trap"] as const).map((t) => (
            <Toggle key={t} on={filters.type === t}
              label={{ monster: "怪兽", spell: "魔法", trap: "陷阱" }[t]}
              onClick={() => onChange({ ...filters, type: filters.type === t ? "" : t })} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">卡框</span>
        <div className="filter-toggles">
          {FRAME_OPTIONS.map((o) => (
            <Toggle key={o.value} on={filters.frame.has(o.value)} label={o.label}
              onClick={() => onChange({ ...filters, frame: toggle(filters.frame, o.value) })} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">属性</span>
        <div className="filter-toggles">
          {ATTR_OPTIONS.map((o) => (
            <Toggle key={o.value} on={filters.attribute.has(o.value)} label={o.label}
              onClick={() => onChange({ ...filters, attribute: toggle(filters.attribute, o.value) })} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">等级</span>
        <div className="filter-toggles">
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((lv) => (
            <Toggle key={lv} on={filters.level === lv} label={lv}
              onClick={() => onChange({ ...filters, level: filters.level === lv ? "" : lv })} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">种族</span>
        <div className="filter-toggles">
          {(openRace ? MONSTER_RACES : MONSTER_RACES.slice(0, 10)).map((r) => (
            <Toggle key={r} on={filters.race.has(r)} label={RACE_CN[r] || r}
              onClick={() => onChange({ ...filters, race: toggle(filters.race, r) })} />
          ))}
          <button className="filter-toggle ghost" onClick={() => setOpenRace((v) => !v)}>
            {openRace ? "收起" : "更多…"}
          </button>
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">排序</span>
        <div className="filter-toggles">
          {[["", "默认"], ["atk", "攻击力"], ["level", "等级"]].map(([v, l]) => (
            <Toggle key={v} on={filters.sort === v} label={l}
              onClick={() => onChange({ ...filters, sort: v })} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function filtersToParams(f: Filters) {
  return {
    frame: [...f.frame].join(","),
    attribute: [...f.attribute].join(","),
    race: [...f.race].join(","),
    type: f.type,
    level: f.level,
    sort: f.sort,
  };
}
