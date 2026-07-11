import { useEffect, useState } from "react";
import { FRAME_OPTIONS, ATTR_OPTIONS, SUBTYPE_OPTIONS, ST_SUBTYPE_OPTIONS, MD_RARITY_OPTIONS } from "../lib/labels";
import { useLang, frameName, attrName, raceName, subtypeName, cardTypeName } from "../lib/i18n";

export function SearchBar({
  value, onChange, onSubmit, placeholder,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string;
}) {
  const { t } = useLang();
  return (
    <div className="searchbar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        placeholder={placeholder ?? t("common.searchPlaceholder")}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      {value && <button className="sb-clear" onClick={() => { onChange(""); }}>×</button>}
      <button className="btn btn-primary sb-go" onClick={onSubmit}>{t("common.search")}</button>
    </div>
  );
}

export interface Filters {
  frame: Set<string>;
  attribute: Set<string>;
  race: Set<string>;       // 怪兽种族 或 魔陷子类型（按 type 切换语义，均映射到 race 参数）
  subtype: Set<string>;    // 怪兽能力子类型（调整/反转…）
  mdRarity: Set<string>;   // Master Duel 罕贵
  format: Set<string>;     // 赛制归属 ocg/tcg/md（M7）
  type: string;
  levelMin: string;
  levelMax: string;
  atkMin: string;
  atkMax: string;
  defMin: string;
  defMax: string;
  link: string;            // LINK 值（单选）
  scale: string;           // 灵摆刻度
  sort: string;
}
export const emptyFilters = (): Filters => ({
  frame: new Set(), attribute: new Set(), race: new Set(), subtype: new Set(), mdRarity: new Set(),
  format: new Set(),
  type: "", levelMin: "", levelMax: "", atkMin: "", atkMax: "",
  defMin: "", defMax: "", link: "", scale: "", sort: "",
});

/** 高级筛选中处于激活状态的条件数（折叠时展示在按钮上） */
export function advancedCount(f: Filters): number {
  let n = 0;
  if (f.levelMin || f.levelMax) n++;
  if (f.atkMin || f.atkMax) n++;
  if (f.defMin || f.defMax) n++;
  if (f.link) n++;
  if (f.scale) n++;
  return n + f.subtype.size + f.mdRarity.size;
}

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

function RangeRow({ label, min, max, onMin, onMax, hi = 99999, phMin, phMax }: {
  label: string; min: string; max: string;
  onMin: (v: string) => void; onMax: (v: string) => void; hi?: number;
  phMin: string; phMax: string;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-toggles range-row">
        <input className="range-input" type="number" inputMode="numeric" placeholder={phMin}
          value={min} min={0} max={hi} onChange={(e) => onMin(e.target.value)} />
        <span className="range-sep">—</span>
        <input className="range-input" type="number" inputMode="numeric" placeholder={phMax}
          value={max} min={0} max={hi} onChange={(e) => onMax(e.target.value)} />
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { lang, t } = useLang();
  const [openRace, setOpenRace] = useState(false);
  const advCount = advancedCount(filters);
  const hasAdv = advCount > 0;
  const [openAdv, setOpenAdv] = useState(hasAdv);
  // URL 恢复 / 前进后退带出高级条件时自动展开，让激活的筛选可见
  useEffect(() => { if (hasAdv) setOpenAdv(true); }, [hasAdv]);
  const toggle = (set: Set<string>, v: string): Set<string> => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  };
  const isSpellTrap = filters.type === "spell" || filters.type === "trap";
  const showMonster = !isSpellTrap; // type 为空(全部)或怪兽时按怪兽维度筛选

  // 切换卡种时清掉跨语义的筛选，避免残留（怪兽种族 ↔ 魔陷子类型；魔陷下清掉怪兽专属高级条件）
  const setType = (t: string) => {
    const st = t === "spell" || t === "trap";
    onChange({
      ...filters, type: t,
      race: new Set(), subtype: new Set(),
      attribute: st ? new Set() : filters.attribute,
      ...(st ? { levelMin: "", levelMax: "", atkMin: "", atkMax: "", defMin: "", defMax: "", link: "", scale: "" } : null),
    });
  };

  return (
    <div className="filter-panel">
      <div className="filter-row">
        <span className="filter-label">{t("filter.cardType")}</span>
        <div className="filter-toggles">
          {(["monster","spell","trap"] as const).map((ty) => (
            <Toggle key={ty} on={filters.type === ty}
              label={cardTypeName(ty, lang)}
              onClick={() => setType(filters.type === ty ? "" : ty)} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">{t("filter.format")}</span>
        <div className="filter-toggles">
          {["ocg", "tcg", "md"].map((f) => (
            <Toggle key={f} on={filters.format.has(f)} label={f.toUpperCase()}
              onClick={() => onChange({ ...filters, format: toggle(filters.format, f) })} />
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">{t("filter.frame")}</span>
        <div className="filter-toggles">
          {FRAME_OPTIONS.map((o) => (
            <Toggle key={o.value} on={filters.frame.has(o.value)} label={frameName(o.value, lang)}
              onClick={() => onChange({ ...filters, frame: toggle(filters.frame, o.value) })} />
          ))}
        </div>
      </div>

      {showMonster && (
        <div className="filter-row">
          <span className="filter-label">{t("filter.attribute")}</span>
          <div className="filter-toggles">
            {ATTR_OPTIONS.map((o) => (
              <Toggle key={o.value} on={filters.attribute.has(o.value)} label={attrName(o.value, lang)}
                onClick={() => onChange({ ...filters, attribute: toggle(filters.attribute, o.value) })} />
            ))}
          </div>
        </div>
      )}

      {showMonster && (
        <div className="filter-row">
          <span className="filter-label">{t("filter.race")}</span>
          <div className="filter-toggles">
            {(openRace ? MONSTER_RACES : MONSTER_RACES.slice(0, 10)).map((r) => (
              <Toggle key={r} on={filters.race.has(r)} label={raceName(r, lang)}
                onClick={() => onChange({ ...filters, race: toggle(filters.race, r) })} />
            ))}
            <button className="filter-toggle ghost" onClick={() => setOpenRace((v) => !v)}>
              {openRace ? t("filter.less") : t("filter.more")}
            </button>
          </div>
        </div>
      )}

      {isSpellTrap && (
        <div className="filter-row">
          <span className="filter-label">{filters.type === "spell" ? t("filter.spellType") : t("filter.trapType")}</span>
          <div className="filter-toggles">
            {ST_SUBTYPE_OPTIONS.map((o) => (
              <Toggle key={o.value} on={filters.race.has(o.value)} label={raceName(o.value, lang)}
                onClick={() => onChange({ ...filters, race: toggle(filters.race, o.value) })} />
            ))}
          </div>
        </div>
      )}

      <div className="filter-row">
        <span className="filter-label" />
        <div className="filter-toggles">
          <button className="filter-toggle ghost adv-toggle" onClick={() => setOpenAdv((v) => !v)}>
            {t("filter.advanced")}{!openAdv && advCount > 0 ? `（${advCount}）` : ""} {openAdv ? "▴" : "▾"}
          </button>
        </div>
      </div>

      {openAdv && (
        <>
          {showMonster && (
            <>
              <RangeRow label={t("filter.level")} min={filters.levelMin} max={filters.levelMax} hi={13}
                phMin={t("filter.min")} phMax={t("filter.max")}
                onMin={(v) => onChange({ ...filters, levelMin: v })}
                onMax={(v) => onChange({ ...filters, levelMax: v })} />
              <RangeRow label={t("filter.atk")} min={filters.atkMin} max={filters.atkMax}
                phMin={t("filter.min")} phMax={t("filter.max")}
                onMin={(v) => onChange({ ...filters, atkMin: v })}
                onMax={(v) => onChange({ ...filters, atkMax: v })} />
              <RangeRow label={t("filter.def")} min={filters.defMin} max={filters.defMax}
                phMin={t("filter.min")} phMax={t("filter.max")}
                onMin={(v) => onChange({ ...filters, defMin: v })}
                onMax={(v) => onChange({ ...filters, defMax: v })} />

              <div className="filter-row">
                <span className="filter-label">{t("filter.link")}</span>
                <div className="filter-toggles">
                  {["1", "2", "3", "4", "5", "6"].map((v) => (
                    <Toggle key={v} on={filters.link === v} label={`LINK-${v}`}
                      onClick={() => onChange({ ...filters, link: filters.link === v ? "" : v })} />
                  ))}
                </div>
              </div>

              <div className="filter-row">
                <span className="filter-label">{t("filter.scale")}</span>
                <div className="filter-toggles range-row">
                  <input className="range-input" type="number" inputMode="numeric" placeholder="0–13"
                    value={filters.scale} min={0} max={13}
                    onChange={(e) => onChange({ ...filters, scale: e.target.value })} />
                </div>
              </div>

              <div className="filter-row">
                <span className="filter-label">{t("filter.subtype")}</span>
                <div className="filter-toggles">
                  {SUBTYPE_OPTIONS.map((o) => (
                    <Toggle key={o.value} on={filters.subtype.has(o.value)} label={subtypeName(o.value, lang)}
                      onClick={() => onChange({ ...filters, subtype: toggle(filters.subtype, o.value) })} />
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="filter-row">
            <span className="filter-label">{t("filter.mdRarity")}</span>
            <div className="filter-toggles">
              {MD_RARITY_OPTIONS.map((o) => (
                <Toggle key={o.value} on={filters.mdRarity.has(o.value)} label={o.label}
                  onClick={() => onChange({ ...filters, mdRarity: toggle(filters.mdRarity, o.value) })} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="filter-row">
        <span className="filter-label">{t("filter.sort")}</span>
        <div className="filter-toggles">
          {([["", "sort.default"], ["atk", "sort.atk"], ["level", "sort.level"]] as const).map(([v, k]) => (
            <Toggle key={v} on={filters.sort === v} label={t(k)}
              onClick={() => onChange({ ...filters, sort: v })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// URL 参数名与后端 /api/search 参数名保持一致，使搜索页地址可直接分享/还原
export function filtersToParams(f: Filters) {
  return {
    frame: [...f.frame].join(","),
    attribute: [...f.attribute].join(","),
    race: [...f.race].join(","),
    subtype: [...f.subtype].join(","),
    md_rarity: [...f.mdRarity].join(","),
    format: [...f.format].join(","),
    type: f.type,
    level_min: f.levelMin,
    level_max: f.levelMax,
    atk_min: f.atkMin,
    atk_max: f.atkMax,
    def_min: f.defMin,
    def_max: f.defMax,
    link: f.link,
    scale: f.scale,
    sort: f.sort,
  };
}

export function filtersFromParams(sp: URLSearchParams): Filters {
  const list = (k: string) => new Set((sp.get(k) || "").split(",").filter(Boolean));
  return {
    frame: list("frame"),
    attribute: list("attribute"),
    race: list("race"),
    subtype: list("subtype"),
    mdRarity: list("md_rarity"),
    format: list("format"),
    type: sp.get("type") || "",
    levelMin: sp.get("level_min") || "",
    levelMax: sp.get("level_max") || "",
    atkMin: sp.get("atk_min") || "",
    atkMax: sp.get("atk_max") || "",
    defMin: sp.get("def_min") || "",
    defMax: sp.get("def_max") || "",
    link: sp.get("link") || "",
    scale: sp.get("scale") || "",
    sort: sp.get("sort") || "",
  };
}
