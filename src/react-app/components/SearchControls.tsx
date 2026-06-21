import { useState } from "react";
import { FRAME_OPTIONS, ATTR_OPTIONS, RACE_CN, SUBTYPE_OPTIONS, ST_SUBTYPE_OPTIONS, MD_RARITY_OPTIONS } from "../lib/labels";

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
  race: Set<string>;       // 怪兽种族 或 魔陷子类型（按 type 切换语义，均映射到 race 参数）
  subtype: Set<string>;    // 怪兽能力子类型（调整/反转…）
  mdRarity: Set<string>;   // Master Duel 罕贵
  type: string;
  levelMin: string;
  levelMax: string;
  atkMin: string;
  atkMax: string;
  sort: string;
}
export const emptyFilters = (): Filters => ({
  frame: new Set(), attribute: new Set(), race: new Set(), subtype: new Set(), mdRarity: new Set(),
  type: "", levelMin: "", levelMax: "", atkMin: "", atkMax: "", sort: "",
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

function RangeRow({ label, min, max, onMin, onMax, hi = 99999 }: {
  label: string; min: string; max: string;
  onMin: (v: string) => void; onMax: (v: string) => void; hi?: number;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-toggles range-row">
        <input className="range-input" type="number" inputMode="numeric" placeholder="最小"
          value={min} min={0} max={hi} onChange={(e) => onMin(e.target.value)} />
        <span className="range-sep">—</span>
        <input className="range-input" type="number" inputMode="numeric" placeholder="最大"
          value={max} min={0} max={hi} onChange={(e) => onMax(e.target.value)} />
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [openRace, setOpenRace] = useState(false);
  const toggle = (set: Set<string>, v: string): Set<string> => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  };
  const isSpellTrap = filters.type === "spell" || filters.type === "trap";
  const showMonster = !isSpellTrap; // type 为空(全部)或怪兽时按怪兽维度筛选

  // 切换卡种时清掉跨语义的筛选，避免残留（怪兽种族 ↔ 魔陷子类型）
  const setType = (t: string) => onChange({
    ...filters, type: t,
    race: new Set(), subtype: new Set(),
    attribute: t === "spell" || t === "trap" ? new Set() : filters.attribute,
  });

  return (
    <div className="filter-panel">
      <div className="filter-row">
        <span className="filter-label">卡种</span>
        <div className="filter-toggles">
          {(["monster","spell","trap"] as const).map((t) => (
            <Toggle key={t} on={filters.type === t}
              label={{ monster: "怪兽", spell: "魔法", trap: "陷阱" }[t]}
              onClick={() => setType(filters.type === t ? "" : t)} />
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

      {showMonster && (
        <div className="filter-row">
          <span className="filter-label">属性</span>
          <div className="filter-toggles">
            {ATTR_OPTIONS.map((o) => (
              <Toggle key={o.value} on={filters.attribute.has(o.value)} label={o.label}
                onClick={() => onChange({ ...filters, attribute: toggle(filters.attribute, o.value) })} />
            ))}
          </div>
        </div>
      )}

      {showMonster && (
        <>
          <RangeRow label="等级/阶" min={filters.levelMin} max={filters.levelMax} hi={13}
            onMin={(v) => onChange({ ...filters, levelMin: v })}
            onMax={(v) => onChange({ ...filters, levelMax: v })} />
          <RangeRow label="攻击力" min={filters.atkMin} max={filters.atkMax}
            onMin={(v) => onChange({ ...filters, atkMin: v })}
            onMax={(v) => onChange({ ...filters, atkMax: v })} />

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
            <span className="filter-label">子类型</span>
            <div className="filter-toggles">
              {SUBTYPE_OPTIONS.map((o) => (
                <Toggle key={o.value} on={filters.subtype.has(o.value)} label={o.label}
                  onClick={() => onChange({ ...filters, subtype: toggle(filters.subtype, o.value) })} />
              ))}
            </div>
          </div>
        </>
      )}

      {isSpellTrap && (
        <div className="filter-row">
          <span className="filter-label">{filters.type === "spell" ? "魔法种类" : "陷阱种类"}</span>
          <div className="filter-toggles">
            {ST_SUBTYPE_OPTIONS.map((o) => (
              <Toggle key={o.value} on={filters.race.has(o.value)} label={o.label}
                onClick={() => onChange({ ...filters, race: toggle(filters.race, o.value) })} />
            ))}
          </div>
        </div>
      )}

      <div className="filter-row">
        <span className="filter-label">MD 罕贵</span>
        <div className="filter-toggles">
          {MD_RARITY_OPTIONS.map((o) => (
            <Toggle key={o.value} on={filters.mdRarity.has(o.value)} label={o.label}
              onClick={() => onChange({ ...filters, mdRarity: toggle(filters.mdRarity, o.value) })} />
          ))}
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
    subtype: [...f.subtype].join(","),
    md_rarity: [...f.mdRarity].join(","),
    type: f.type,
    level_min: f.levelMin,
    level_max: f.levelMax,
    atk_min: f.atkMin,
    atk_max: f.atkMax,
    sort: f.sort,
  };
}
