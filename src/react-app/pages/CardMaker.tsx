// M2.1 自定义制卡器：左侧实时卡面预览 + 右侧表单控件。
// 每次表单变化都通过共享渲染器重绘 canvas；支持高 DPI 导出与「从现有卡片预填」。
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
} from "../../shared/types";
import { getCard } from "../lib/api";
import {
  ATTR_OPTIONS,
  FRAME_OPTIONS,
} from "../lib/labels";
import {
  CARD_RATIO,
  exportCardPng,
  renderCard,
  type CardModel,
} from "../canvas/CardCanvasRenderer";
import "./CardMaker.css";

const RARITIES = ["普通", "金字", "闪", "烫金"] as const;

// 怪兽卡框（决定 level/atk/def 等怪兽专属字段是否可用）
const MONSTER_FRAMES: Frame[] = [
  "normal",
  "effect",
  "ritual",
  "fusion",
  "synchro",
  "xyz",
  "link",
];

const MARKER_GRID: (LinkMarker | null)[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  null, // 中心占位
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

const MARKER_ARROW: Record<LinkMarker, string> = {
  "top-left": "↖",
  top: "↑",
  "top-right": "↗",
  left: "←",
  right: "→",
  "bottom-left": "↙",
  bottom: "↓",
  "bottom-right": "↘",
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
  effect: string;
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
  effect:
    "①：这张卡可以由你随意书写效果。\n②：这是一张由「哈基米卡库」制卡器生成的同人卡，仅供创作与欣赏，不可用于任何官方比赛。",
  atk: "1800",
  def: "1200",
  passcode: "00000000",
  rarity: "烫金",
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
    effect: s.effect,
    atk: s.cardType === "monster" ? parseStat(s.atk) : null,
    def: s.cardType === "monster" && !s.isLink ? parseStat(s.def) : null,
    passcode: s.passcode,
    rarity: s.rarity,
    setCode: s.setCode,
    artImage: art,
  };
}

export default function CardMaker() {
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

  // 重绘预览（高 DPI）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = 360;
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
    renderCard(ctx, model, { width: cssW });
    ctx.restore();
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

  const onExport = async () => {
    const { blob } = await exportCardPng(model, 1400);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.name || "fan-card"}.png`;
    a.click();
    URL.revokeObjectURL(url);
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
        effect: c.effect_cn ?? "",
        atk: c.atk === -1 ? "?" : c.atk != null ? String(c.atk) : "",
        def: c.def === -1 ? "?" : c.def != null ? String(c.def) : "",
        passcode: String(c.id),
        linkMarkers: c.link_markers ?? [],
      }));
      // 载入卡图（same-origin，不污染画布）
      const url = c.artworks?.find((a) => a.is_default)?.url ?? c.artworks?.[0]?.url;
      if (url) {
        const img = new Image();
        img.onload = () => setArt(img);
        img.src = url;
      }
      setPrefillMsg(`已预填：${c.cn_name}`);
    } catch {
      setPrefillMsg("未找到该卡片，请检查密码 / ID");
    } finally {
      setPrefillBusy(false);
    }
  };

  const onPrefill = () => runPrefill(prefillId);

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

  const isMonster = state.cardType === "monster";
  const canPendulum =
    isMonster && !state.isLink && MONSTER_FRAMES.includes(state.frame);

  return (
    <div className="page maker-page fade-in">
      <div className="container">
        <div className="page-head">
          <h1>自定义制卡器</h1>
          <p className="muted">
            打造你的专属同人卡，实时预览 · 高清导出 · 一键转发。所有作品均带「非官方·同人卡」标识。
          </p>
        </div>

        <div className="maker-layout">
          {/* 左：实时预览 */}
          <aside className="maker-preview">
            <div className="maker-canvas-wrap">
              <canvas ref={canvasRef} className="maker-canvas" />
            </div>
            <button className="btn btn-primary maker-export" onClick={onExport}>
              高 DPI 导出 PNG
            </button>
            <p className="muted maker-hint">导出宽度 1400px，适合打印与分享</p>
          </aside>

          {/* 右：表单 */}
          <section className="maker-form">
            {/* 预填 */}
            <fieldset className="maker-fs">
              <legend>从现有卡片预填</legend>
              <div className="maker-row">
                <input
                  className="maker-input"
                  placeholder="输入卡片密码 / ID"
                  value={prefillId}
                  onChange={(e) => setPrefillId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onPrefill()}
                />
                <button
                  className="btn"
                  onClick={onPrefill}
                  disabled={prefillBusy}
                >
                  {prefillBusy ? "载入中…" : "预填"}
                </button>
              </div>
              {prefillMsg && <p className="maker-msg muted">{prefillMsg}</p>}
            </fieldset>

            {/* 卡类型 / 卡框 */}
            <fieldset className="maker-fs">
              <legend>卡片类型</legend>
              <div className="maker-seg">
                {(["monster", "spell", "trap"] as const).map((t) => (
                  <button
                    key={t}
                    className={`maker-seg-btn ${state.cardType === t ? "on" : ""}`}
                    onClick={() => set("cardType", t)}
                  >
                    {t === "monster" ? "怪兽" : t === "spell" ? "魔法" : "陷阱"}
                  </button>
                ))}
              </div>
              {isMonster && (
                <label className="maker-field">
                  <span>卡框模板</span>
                  <select
                    className="maker-input"
                    value={state.frame}
                    onChange={(e) => set("frame", e.target.value as Frame)}
                  >
                    {FRAME_OPTIONS.filter((o) =>
                      MONSTER_FRAMES.includes(o.value),
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
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
                <label className="maker-field">
                  <span>属性</span>
                  <select
                    className="maker-input"
                    value={state.attribute ?? ""}
                    onChange={(e) =>
                      set(
                        "attribute",
                        (e.target.value || null) as Attribute | null,
                      )
                    }
                  >
                    <option value="">（无）</option>
                    {ATTR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="maker-field">
                <span>{isMonster ? "种族" : "类别"}</span>
                <input
                  className="maker-input"
                  value={state.race}
                  onChange={(e) => set("race", e.target.value)}
                  placeholder={isMonster ? "如 Dragon / 龙" : "如 Continuous / 永续"}
                />
              </label>
            </fieldset>

            {/* 怪兽数值 */}
            {isMonster && (
              <fieldset className="maker-fs">
                <legend>怪兽设定</legend>
                <div className="maker-toggles">
                  <label className="maker-check">
                    <input
                      type="checkbox"
                      checked={state.isLink}
                      onChange={(e) => set("isLink", e.target.checked)}
                    />
                    连接怪兽 (Link)
                  </label>
                  {canPendulum && (
                    <label className="maker-check">
                      <input
                        type="checkbox"
                        checked={state.isPendulum}
                        onChange={(e) => set("isPendulum", e.target.checked)}
                      />
                      灵摆怪兽 (Pendulum)
                    </label>
                  )}
                </div>

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

                <div className="maker-row">
                  <label className="maker-field">
                    <span>攻击力</span>
                    <input
                      className="maker-input"
                      value={state.atk}
                      onChange={(e) => set("atk", e.target.value)}
                      placeholder="数字 / ? / 留空隐藏"
                    />
                  </label>
                  {!state.isLink && (
                    <label className="maker-field">
                      <span>守备力</span>
                      <input
                        className="maker-input"
                        value={state.def}
                        onChange={(e) => set("def", e.target.value)}
                        placeholder="数字 / ? / 留空隐藏"
                      />
                    </label>
                  )}
                </div>

                {state.isLink && (
                  <div className="maker-field">
                    <span>连接标记（点击切换，至少选 1）</span>
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
                            className={`maker-marker ${
                              state.linkMarkers.includes(m) ? "on" : ""
                            }`}
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
