// M2.2 分享长图生成器：搜索/粘贴密码挑选卡片 -> 合成竖向海报长图 -> 导出 PNG。
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardSummary } from "../../shared/types";
import { useSearchParams } from "react-router-dom";
import { getCard, searchCards, getArchetype } from "../lib/api";
import { FRAME_CN, raceCn, statStr } from "../lib/labels";
import {
  composeShareImage,
  exportShareImage,
  type ShareItem,
  type ShareOptions,
} from "../canvas/ShareImageComposer";
import "./ShareImage.css";

type Layout = ShareOptions["layout"];

const LAYOUTS: { value: Layout; label: string; hint: string }[] = [
  { value: "list", label: "清单", hint: "卡图 + 名称 + 数值，适合配卡参考" },
  { value: "grid", label: "网格", hint: "紧凑卡图墙，适合收藏展示" },
  { value: "cards", label: "卡面", hint: "渲染为同人卡面，最具冲击力" },
];

// 把同一张图按 url 缓存，避免重复加载
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function ShareImage() {
  useEffect(() => { document.title = "分享长图 · 游戏王集卡社"; }, []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CardSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [tray, setTray] = useState<CardSummary[]>([]);
  const [paste, setPaste] = useState("");

  const [title, setTitle] = useState("我的精选卡组");
  const [subtitle, setSubtitle] = useState(
    "来自游戏王集卡社 · 卡图最美的游戏王卡库",
  );
  const [layout, setLayout] = useState<Layout>("list");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // 搜索（防抖）
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchCards({ q: term, size: 24 });
        if (alive) setResults(res.items);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const inTray = useCallback(
    (id: number) => tray.some((c) => c.id === id),
    [tray],
  );

  const addCard = (c: CardSummary) => {
    setTray((t) => (t.some((x) => x.id === c.id) ? t : [...t, c]));
  };
  const removeCard = (id: number) => {
    setTray((t) => t.filter((c) => c.id !== id));
  };

  // 从系列图鉴跳转：/share?archetype=:id —— 预载该系列卡片
  const [sp] = useSearchParams();
  useEffect(() => {
    const aid = sp.get("archetype");
    if (!aid) return;
    let alive = true;
    getArchetype(aid)
      .then((d) => {
        if (!alive) return;
        setTray(d.cards.slice(0, 24));
        setTitle(`${d.archetype.cn_name} 系列图鉴`);
        setLayout("grid");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (id: number, dir: -1 | 1) => {
    setTray((t) => {
      const i = t.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= t.length) return t;
      const next = [...t];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // 粘贴密码批量添加（逗号/空格/换行分隔）
  const onPaste = async () => {
    const ids = paste
      .split(/[\s,，、]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const loaded: CardSummary[] = [];
    for (const id of ids) {
      try {
        const c = await getCard(id);
        loaded.push(c);
      } catch {
        /* 跳过无效 */
      }
    }
    if (loaded.length) {
      setTray((t) => {
        const seen = new Set(t.map((c) => c.id));
        return [...t, ...loaded.filter((c) => !seen.has(c.id))];
      });
    }
    setPaste("");
  };

  const getImg = async (src: string): Promise<HTMLImageElement | null> => {
    const cache = imgCache.current;
    const hit = cache.get(src);
    if (hit) return hit;
    try {
      const img = await loadImage(src);
      cache.set(src, img);
      return img;
    } catch {
      return null;
    }
  };

  const onGenerate = async () => {
    if (!tray.length) return;
    setGenerating(true);
    try {
      // 卡面模式用大图(url)，其余用缩略(thumb_url)
      const useFull = layout === "cards";
      const items: ShareItem[] = await Promise.all(
        tray.map(async (c) => ({
          card: c,
          image: await getImg(useFull ? `/img/${c.id}` : c.thumb_url),
        })),
      );
      const canvas = await composeShareImage(items, {
        title,
        subtitle,
        layout,
      });
      const { dataUrl, blob } = await exportShareImage(canvas);
      setPreviewUrl(dataUrl);
      blobRef.current = blob;
    } finally {
      setGenerating(false);
    }
  };

  const onDownload = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "share"}-长图.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page share-page fade-in">
      <div className="container">
        <div className="page-head">
          <h1>分享长图生成器</h1>
          <p className="muted">
            挑选卡片，一键生成「天生适合截图转发」的精美长图 ——
            发抖音、小红书、QQ 群都好看。
          </p>
        </div>

        <div className="share-layout">
          {/* 左：挑选 + 设置 */}
          <section className="share-controls">
            <fieldset className="share-fs">
              <legend>搜索卡片</legend>
              <input
                className="share-input"
                placeholder="输入卡名 / 关键词搜索"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="share-results">
                {searching && <p className="muted share-tip">搜索中…</p>}
                {!searching &&
                  results.map((c) => (
                    <button
                      key={c.id}
                      className={`share-result ${inTray(c.id) ? "added" : ""}`}
                      onClick={() => addCard(c)}
                      disabled={inTray(c.id)}
                      title={c.cn_name}
                    >
                      <img src={c.thumb_url} alt={c.cn_name} loading="lazy" />
                      <span className="share-result-name">{c.cn_name}</span>
                      <span className="share-result-add">
                        {inTray(c.id) ? "已加入" : "+ 加入"}
                      </span>
                    </button>
                  ))}
                {!searching && q.trim() && results.length === 0 && (
                  <p className="muted share-tip">无结果</p>
                )}
              </div>
            </fieldset>

            <fieldset className="share-fs">
              <legend>粘贴密码批量添加</legend>
              <textarea
                className="share-input share-textarea"
                rows={2}
                placeholder="多个卡片密码 / ID，用逗号或空格分隔"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <button className="btn" onClick={onPaste}>
                添加到候选
              </button>
            </fieldset>

            <fieldset className="share-fs">
              <legend>海报设置</legend>
              <label className="share-field">
                <span>主标题</span>
                <input
                  className="share-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="share-field">
                <span>副标题</span>
                <input
                  className="share-input"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </label>
              <div className="share-field">
                <span>排版样式</span>
                <div className="share-layouts">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      className={`share-layout-btn ${layout === l.value ? "on" : ""}`}
                      onClick={() => setLayout(l.value)}
                      title={l.hint}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className="muted share-tip">
                  {LAYOUTS.find((l) => l.value === layout)?.hint}
                </p>
              </div>
            </fieldset>
          </section>

          {/* 中：候选托盘 */}
          <section className="share-tray">
            <div className="share-tray-head">
              <h2>已选 {tray.length} 张</h2>
              {tray.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setTray([])}>
                  清空
                </button>
              )}
            </div>
            {tray.length === 0 ? (
              <p className="muted share-empty">
                从左侧搜索或粘贴密码，把卡片加入这里
              </p>
            ) : (
              <ul className="share-tray-list">
                {tray.map((c, i) => (
                  <li key={c.id} className="share-tray-item">
                    <span className="share-tray-idx">{i + 1}</span>
                    <img src={c.thumb_url} alt={c.cn_name} loading="lazy" />
                    <div className="share-tray-info">
                      <strong>{c.cn_name}</strong>
                      <span className="muted">
                        {FRAME_CN[c.frame]}
                        {c.card_type === "monster" &&
                          ` · ${raceCn(c.race)} · 攻${statStr(c.atk)}`}
                      </span>
                    </div>
                    <div className="share-tray-actions">
                      <button onClick={() => move(c.id, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        onClick={() => move(c.id, 1)}
                        disabled={i === tray.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        className="share-tray-del"
                        onClick={() => removeCard(c.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn btn-primary share-generate"
              onClick={onGenerate}
              disabled={!tray.length || generating}
            >
              {generating ? "生成中…" : "生成长图"}
            </button>
          </section>

          {/* 右：预览 / 下载 */}
          <aside className="share-preview">
            <h2>预览</h2>
            {previewUrl ? (
              <>
                <div className="share-preview-img">
                  <img src={previewUrl} alt="分享长图预览" />
                </div>
                <button
                  className="btn btn-primary share-download"
                  onClick={onDownload}
                >
                  下载 PNG
                </button>
              </>
            ) : (
              <p className="muted share-empty">点击「生成长图」后在此预览</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
