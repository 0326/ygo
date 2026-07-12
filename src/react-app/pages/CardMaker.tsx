// M2.1 自定义制卡器：左侧实时卡面预览 + 右侧表单控件。
// 表单支持卡名/卡密搜索联想预填；卡框为色块芯片；种族/类别/能力下拉全覆盖。
// 每次表单变化都通过共享渲染器重绘 canvas；支持打印级导出与「从现有卡片预填」。
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import type {
  Attribute,
  Frame,
  LinkMarker,
  MonsterSubtype,
  CardSummary,
} from "../../shared/types";
import { getCard, searchCards } from "../lib/api";
import {
  ATTR_OPTIONS,
  FRAME_CN,
  FRAME_COLOR,
  RACE_CN,
  SUBTYPE_OPTIONS,
  ST_SUBTYPE_OPTIONS,
} from "../lib/labels";
import {
  CARD_RATIO,
  exportCardPng,
  preloadCardAssets,
  renderCardSync,
  type CardModel,
} from "../canvas/CardCanvasRenderer";
import "./CardMaker.css";

const RARITIES = ["普通", "金字", "闪", "烫金"] as const;

// 怪兽卡框芯片（连接也在其中：选中即连接怪兽）
const FRAME_CHIPS: Frame[] = [
  "normal", "effect", "ritual", "fusion", "synchro", "xyz", "link", "token",
];
// 可叠加灵摆的卡框（连接/衍生物无灵摆变体）
const PEND_OK: Frame[] = ["normal", "effect", "ritual", "fusion", "synchro", "xyz"];

// 怪兽种族（英文 key -> 简中显示复用 RACE_CN）
const MONSTER_RACES: string[] = [
  "Dragon", "Spellcaster", "Warrior", "Beast-Warrior", "Beast", "Winged Beast",
  "Fiend", "Fairy", "Zombie", "Machine", "Aqua", "Fish", "Sea Serpent",
  "Reptile", "Dinosaur", "Wyrm", "Insect", "Plant", "Rock", "Pyro", "Thunder",
  "Psychic", "Cyberse", "Illusion", "Divine-Beast", "Creator-God",
];
// 陷阱仅有 通常/永续/反击
const TRAP_KINDS = new Set(["Normal", "Continuous", "Counter"]);

const MARKER_GRID: (LinkMarker | null)[] = [
  "top-left", "top", "top-right",
  "left", null, "right",
  "bottom-left", "bottom", "bottom-right",
];
const MARKER_ARROW: Record<LinkMarker, string> = {
  "top-left": "↖", top: "↑", "top-right": "↗", left: "←",
  right: "→", "bottom-left": "↙", bottom: "↓", "bottom-right": "↘",
};

interface State {
  frame: Frame;
  cardType: "monster" | "spell" | "trap";
  isPendulum: boolean;
  isLink: boolean;
  name: string;
  attribute: Attribute | null;
  level: string; // 输入态保持字符串
  scale: string;
  race: string;
  subtype: MonsterSubtype | "";
  effect: string;
  pendulumEffect: string;
  atk: string; // "" 隐藏，"?" => -1
  def: string;
  passcode: string;
  rarity: string;
  setCode: string;
  linkMarkers: LinkMarker[];
}

const DEFAULT_STATE: State = {
  frame: "effect",
  cardType: "monster",
  isPendulum: false,
  isLink: false,
  name: "无尽的同人创作",
  attribute: "DARK",
  level: "4",
  scale: "4",
  race: "Spellcaster",
  subtype: "",
  effect:
    "①：这张卡可以由你随意书写效果。\n②：这是一张由「游戏王集卡社」制卡器生成的同人卡，仅供创作与欣赏，不可用于任何官方比赛。",
  pendulumEffect: "",
  atk: "1800",
  def: "1200",
  passcode: "00000000",
  rarity: "普通",
  setCode: "HJMK-CN001",
  linkMarkers: [],
};

function parseStat(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  if (t === "?" || t === "？") return -1;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function parseNum(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function buildModel(s: State, art: HTMLImageElement | null): CardModel {
  return {
    frame: s.isLink ? "link" : s.frame,
    isPendulum: s.cardType === "monster" && s.isPendulum && !s.isLink,
    cardType: s.cardType,
    name: s.name,
    attribute: s.cardType === "monster" ? s.attribute : null,
    level: s.cardType === "monster" && !s.isLink ? parseNum(s.level) : null,
    isRank: s.frame === "xyz",
    isLink: s.cardType === "monster" && s.isLink,
    linkMarkers: s.linkMarkers,
    scale: s.isPendulum ? parseNum(s.scale) : null,
    race: s.race,
    subtype: s.cardType === "monster" ? s.subtype : "",
    effect: s.effect,
    pendulumEffect: s.isPendulum ? s.pendulumEffect : null,
    atk: s.cardType === "monster" ? parseStat(s.atk) : null,
    def: s.cardType === "monster" && !s.isLink ? parseStat(s.def) : null,
    passcode: s.passcode,
    rarity: s.rarity,
    setCode: s.setCode,
    artImage: art,
  };
}

export default function CardMaker() {
  useEffect(() => { document.title = "在线制卡器 · 游戏王集卡社"; }, []);
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const [prefillId, setPrefillId] = useState("");
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [prefillMsg, setPrefillMsg] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const set = useCallback(
    <K extends keyof State>(key: K, value: State[K]) => {
      setState((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  const model = useMemo(() => buildModel(state, art), [state, art]);

  // 重绘预览（高 DPI）。素材/字体需异步加载，故 preload → 同步绘制，并用 cancelled 防竞态。
  // 首次加载素材较大（高清卡框+字体约 10MB），超过 150ms 未就绪则显示加载浮层。
  const [assetsLoading, setAssetsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let done = false;
    const cssW = 360;
    const slowTimer = setTimeout(() => { if (!done && !cancelled) setAssetsLoading(true); }, 150);
    const draw = () => {
      done = true;
      clearTimeout(slowTimer);
      if (cancelled) return;
      setAssetsLoading(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * CARD_RATIO * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssW * CARD_RATIO}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      renderCardSync(ctx, model, { width: cssW });
      ctx.restore();
    };
    // 已缓存时立即绘制，避免闪烁；未缓存则加载后绘制
    preloadCardAssets(model).then(draw);
    return () => { cancelled = true; clearTimeout(slowTimer); };
  }, [model]);

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setArt(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // 素材原生分辨率 1394×2031（打印级），不做无谓放大
      const { blob } = await exportCardPng(model);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.name || "fan-card"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const runPrefill = async (rawId: string) => {
    const id = rawId.trim();
    if (!id) return;
    setPrefillBusy(true);
    setPrefillMsg("");
    try {
      const c = await getCard(id);
      const isLink = c.frame === "link";
      const isPend = c.scale != null;
      setState((s) => ({
        ...s,
        cardType: c.card_type,
        frame: c.frame,
        isLink,
        isPendulum: isPend,
        name: c.cn_name,
        attribute: c.attribute,
        level: c.level != null ? String(c.level) : "",
        scale: c.scale != null ? String(c.scale) : s.scale,
        race: c.race ?? "",
        subtype: (c.subtypes?.[0] as MonsterSubtype) ?? "",
        effect: c.effect_cn ?? "",
        pendulumEffect: c.pendulum_effect_cn ?? "",
        atk: c.atk === -1 ? "?" : c.atk != null ? String(c.atk) : "",
        def: c.def === -1 ? "?" : c.def != null ? String(c.def) : "",
        passcode: String(c.id),
        linkMarkers: c.link_markers ?? [],
      }));
      // 载入裁剪卡图（cards_cropped 仅美术区，避免整卡套进卡图框；same-origin 不污染画布）
      const key = (c.artworks?.find((a) => a.is_default) ?? c.artworks?.[0])?.image_key ?? String(c.id);
      if (key) {
        const img = new Image();
        img.onload = () => setArt(img);
        // art 变体缺图时回退整卡图
        img.onerror = () => {
          const fb = new Image();
          fb.onload = () => setArt(fb);
          fb.src = `/img/${key}`;
        };
        img.src = `/img/${key}/art`;
      }
      setPrefillMsg(`已预填：${c.cn_name}`);
    } catch {
      setPrefillMsg("未找到该卡片，请检查卡名 / 卡密");
    } finally {
      setPrefillBusy(false);
    }
  };

  // ---- 搜索联想（卡名/卡密皆可；纯数字直接按卡密预填） ----
  const [sug, setSug] = useState<CardSummary[]>([]);
  const [showSug, setShowSug] = useState(false);
  useEffect(() => {
    const q = prefillId.trim();
    if (!q || /^\d+$/.test(q)) { setSug([]); setShowSug(false); return; }
    const t = setTimeout(() => {
      searchCards({ q, size: 8 })
        .then((r) => { setSug(r.items); setShowSug(r.items.length > 0); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [prefillId]);

  const pickSuggestion = (c: CardSummary) => {
    setPrefillId(c.cn_name || c.en_name);
    setShowSug(false);
    void runPrefill(String(c.id));
  };

  const onPrefill = () => {
    const q = prefillId.trim();
    if (!q) return;
    if (/^\d+$/.test(q)) {
      void runPrefill(q);
    } else if (sug.length > 0) {
      pickSuggestion(sug[0]);
    } else {
      // 名称搜索兜底：取第一条结果
      searchCards({ q, size: 1 })
        .then((r) => (r.items[0] ? pickSuggestion(r.items[0]) : setPrefillMsg("未找到该卡片，请检查卡名 / 卡密")))
        .catch(() => setPrefillMsg("搜索失败，请稍后重试"));
    }
  };

  // 从卡片详情页跳转预填：/maker?from=:id
  const [sp] = useSearchParams();
  useEffect(() => {
    const from = sp.get("from");
    if (from) {
      setPrefillId(from);
      void runPrefill(from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMarker = (m: LinkMarker) => {
    setState((s) => ({
      ...s,
      linkMarkers: s.linkMarkers.includes(m)
        ? s.linkMarkers.filter((x) => x !== m)
        : [...s.linkMarkers, m],
    }));
  };

  // 卡种切换：魔陷的类别复用 race 字段，切换时纠正到合法值
  const switchCardType = (t: "monster" | "spell" | "trap") => {
    setState((s) => {
      let race = s.race;
      if (t === "monster") {
        if (!MONSTER_RACES.includes(race)) race = "Dragon";
      } else if (t === "trap") {
        if (!TRAP_KINDS.has(race)) race = "Normal";
      } else {
        if (!ST_SUBTYPE_OPTIONS.some((o) => o.value === race)) race = "Normal";
      }
      return { ...s, cardType: t, race };
    });
  };

  // 卡框芯片：选中「连接」即连接怪兽；连接/衍生物不可叠灵摆
  const pickFrame = (f: Frame) => {
    setState((s) => ({
      ...s,
      frame: f,
      isLink: f === "link",
      isPendulum: PEND_OK.includes(f) ? s.isPendulum : false,
      subtype: f === "token" ? "" : s.subtype,
    }));
  };

  const isMonster = state.cardType === "monster";
  const canPendulum = isMonster && PEND_OK.includes(state.frame);

  return (
    <div className="page maker-page fade-in">
      <div className="container">
        <div className="page-head">
          <h1>自定义制卡器</h1>
          <p className="muted">
            打造你的专属同人卡，实时预览 · 高清导出 · 一键转发。所有作品均带「@游戏王集卡社同人卡」标识。
          </p>
        </div>

        <div className="maker-layout">
          {/* 左：实时预览 */}
          <aside className="maker-preview">
            <div className="maker-canvas-wrap">
              <canvas ref={canvasRef} className="maker-canvas" />
              {assetsLoading && (
                <div className="maker-loading">
                  <div className="spinner" />
                  <p>正在加载高清卡面素材…<br /><span>首次约 10MB，之后有缓存秒开</span></p>
                </div>
              )}
            </div>
            <button className="btn btn-primary maker-export" onClick={onExport} disabled={exporting || assetsLoading}>
              {exporting ? "导出中…" : "高清导出 PNG"}
            </button>
            <p className="muted maker-hint">导出 1394×2031 打印级 PNG，适合打印与分享</p>
          </aside>

          {/* 右：表单 */}
          <section className="maker-form">
            {/* 搜索预填 */}
            <fieldset className="maker-fs">
              <legend>搜索卡片预填</legend>
              <div className="maker-row maker-suggest-wrap">
                <input
                  className="maker-input"
                  placeholder="输入卡名或卡密，如 青眼白龙 / 89631139"
                  value={prefillId}
                  onChange={(e) => setPrefillId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onPrefill()}
                  onFocus={() => sug.length > 0 && setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 150)}
                />
                <button className="btn" onClick={onPrefill} disabled={prefillBusy}>
                  {prefillBusy ? "载入中…" : "预填"}
                </button>
                {showSug && (
                  <ul className="maker-suggest">
                    {sug.map((c) => (
                      <li key={c.id}>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(c); }}>
                          <img src={c.thumb_url} alt="" loading="lazy" />
                          <span className="ms-name">{c.cn_name || c.en_name}</span>
                          <span className="ms-id">{c.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {prefillMsg && <p className="maker-msg muted">{prefillMsg}</p>}
            </fieldset>

            {/* 卡片类型 + 卡框 */}
            <fieldset className="maker-fs">
              <legend>卡片类型</legend>
              <div className="maker-seg">
                {(["monster", "spell", "trap"] as const).map((t) => (
                  <button
                    key={t}
                    className={`maker-seg-btn ${state.cardType === t ? "on" : ""}`}
                    onClick={() => switchCardType(t)}
                  >
                    {t === "monster" ? "怪兽" : t === "spell" ? "魔法" : "陷阱"}
                  </button>
                ))}
              </div>

              {isMonster && (
                <div className="maker-field">
                  <span>卡框（选「连接」即连接怪兽）</span>
                  <div className="maker-frames">
                    {FRAME_CHIPS.map((f) => (
                      <button
                        key={f}
                        className={`maker-frame-chip ${state.frame === f ? "on" : ""}`}
                        style={{ "--fc": FRAME_COLOR[f].base, "--fg": FRAME_COLOR[f].glow } as React.CSSProperties}
                        onClick={() => pickFrame(f)}
                      >
                        <i />{FRAME_CN[f]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isMonster && canPendulum && (
                <label className="maker-check" style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={state.isPendulum}
                    onChange={(e) => set("isPendulum", e.target.checked)}
                  />
                  灵摆怪兽 (Pendulum)
                </label>
              )}

              {!isMonster && (
                <label className="maker-field">
                  <span>类别（决定名条右侧图标）</span>
                  <select
                    className="maker-input"
                    value={state.race}
                    onChange={(e) => set("race", e.target.value)}
                  >
                    {ST_SUBTYPE_OPTIONS
                      .filter((o) => state.cardType === "spell" || TRAP_KINDS.has(o.value))
                      .map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                  </select>
                </label>
              )}
            </fieldset>

            {/* 基本信息 */}
            <fieldset className="maker-fs">
              <legend>基本信息</legend>
              <label className="maker-field">
                <span>卡名</span>
                <input
                  className="maker-input"
                  value={state.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="卡片名称"
                />
              </label>

              {isMonster && (
                <div className="maker-row">
                  <label className="maker-field">
                    <span>属性</span>
                    <select
                      className="maker-input"
                      value={state.attribute ?? ""}
                      onChange={(e) =>
                        set("attribute", (e.target.value || null) as Attribute | null)
                      }
                    >
                      <option value="">（无）</option>
                      {ATTR_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="maker-field">
                    <span>种族</span>
                    <select
                      className="maker-input"
                      value={MONSTER_RACES.includes(state.race) ? state.race : ""}
                      onChange={(e) => set("race", e.target.value)}
                    >
                      {!MONSTER_RACES.includes(state.race) && <option value="">（选择种族）</option>}
                      {MONSTER_RACES.map((r) => (
                        <option key={r} value={r}>{RACE_CN[r] || r}族</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {isMonster && state.frame !== "token" && (
                <label className="maker-field">
                  <span>能力子类型</span>
                  <select
                    className="maker-input"
                    value={state.subtype}
                    onChange={(e) => set("subtype", e.target.value as MonsterSubtype | "")}
                  >
                    <option value="">（无）</option>
                    {SUBTYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>

            {/* 怪兽数值 */}
            {isMonster && (
              <fieldset className="maker-fs">
                <legend>数值</legend>
                <div className="maker-row">
                  {!state.isLink && (
                    <label className="maker-field">
                      <span>{state.frame === "xyz" ? "阶级" : "等级"}</span>
                      <input
                        className="maker-input"
                        type="number"
                        min={0}
                        max={13}
                        value={state.level}
                        onChange={(e) => set("level", e.target.value)}
                      />
                    </label>
                  )}
                  {state.isPendulum && (
                    <label className="maker-field">
                      <span>灵摆刻度</span>
                      <input
                        className="maker-input"
                        type="number"
                        min={0}
                        max={13}
                        value={state.scale}
                        onChange={(e) => set("scale", e.target.value)}
                      />
                    </label>
                  )}
                  <label className="maker-field">
                    <span>攻击力</span>
                    <input
                      className="maker-input"
                      value={state.atk}
                      onChange={(e) => set("atk", e.target.value)}
                      placeholder="数字 / ? / 留空"
                    />
                  </label>
                  {!state.isLink && (
                    <label className="maker-field">
                      <span>守备力</span>
                      <input
                        className="maker-input"
                        value={state.def}
                        onChange={(e) => set("def", e.target.value)}
                        placeholder="数字 / ? / 留空"
                      />
                    </label>
                  )}
                </div>

                {state.isLink && (
                  <div className="maker-field">
                    <span>连接标记（点击切换，LINK 值 = 已选数量）</span>
                    <div className="maker-marker-grid">
                      {MARKER_GRID.map((m, i) =>
                        m === null ? (
                          <div key={i} className="maker-marker-center">
                            LINK
                            <br />
                            {state.linkMarkers.length}
                          </div>
                        ) : (
                          <button
                            key={i}
                            className={`maker-marker ${state.linkMarkers.includes(m) ? "on" : ""}`}
                            onClick={() => toggleMarker(m)}
                            title={m}
                          >
                            {MARKER_ARROW[m]}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </fieldset>
            )}

            {/* 效果 */}
            <fieldset className="maker-fs">
              <legend>{isMonster ? "怪兽效果 / 描述" : "卡片效果"}</legend>
              <textarea
                className="maker-input maker-textarea"
                rows={5}
                value={state.effect}
                onChange={(e) => set("effect", e.target.value)}
                placeholder="效果文本将自动断行并适配卡面"
              />
            </fieldset>

            {/* 灵摆效果（画进灵摆框） */}
            {state.isPendulum && isMonster && !state.isLink && (
              <fieldset className="maker-fs">
                <legend>灵摆效果</legend>
                <textarea
                  className="maker-input maker-textarea"
                  rows={3}
                  value={state.pendulumEffect}
                  onChange={(e) => set("pendulumEffect", e.target.value)}
                  placeholder="显示在卡图下方的灵摆框内"
                />
              </fieldset>
            )}

            {/* 卡图 */}
            <fieldset className="maker-fs">
              <legend>卡图</legend>
              <label className="maker-upload btn">
                上传卡图
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    e.target.files?.[0] && onUpload(e.target.files[0])
                  }
                />
              </label>
              {art && (
                <button className="btn btn-ghost" onClick={() => setArt(null)}>
                  移除卡图
                </button>
              )}
            </fieldset>

            {/* 收藏信息 */}
            <fieldset className="maker-fs">
              <legend>收藏信息</legend>
              <label className="maker-field">
                <span>罕贵度</span>
                <div className="maker-seg">
                  {RARITIES.map((r) => (
                    <button
                      key={r}
                      className={`maker-seg-btn ${state.rarity === r ? "on" : ""}`}
                      onClick={() => set("rarity", r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </label>
              <div className="maker-row">
                <label className="maker-field">
                  <span>卡片密码</span>
                  <input
                    className="maker-input"
                    value={state.passcode}
                    onChange={(e) => set("passcode", e.target.value)}
                    maxLength={8}
                  />
                </label>
                <label className="maker-field">
                  <span>套牌编号</span>
                  <input
                    className="maker-input"
                    value={state.setCode}
                    onChange={(e) => set("setCode", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          </section>
        </div>
      </div>
    </div>
  );
}
