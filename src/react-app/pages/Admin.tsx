// M10 管理后台（站长内部工具，界面固定中文）：用户概览 + 壁纸增删改查。
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminUserRow, WallpaperItem } from "../../shared/types";
import {
  adminListUsers, listWallpapers, adminCreateWallpaper, adminUpdateWallpaper, adminDeleteWallpaper,
} from "../lib/api";
import { useUser } from "../lib/user";
import { Spinner, Empty } from "../components/common";

type Tab = "users" | "wallpapers";

export default function Admin() {
  const { me } = useUser();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (me === null) nav("/login?next=/admin", { replace: true });
    else if (me && me.role !== "admin") nav("/me", { replace: true });
  }, [me, nav]);

  if (!me || me.role !== "admin") return <div className="container page"><Spinner /></div>;

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>管理后台</h1>
          <div className="sub">用户概览 · 壁纸管理</div>
        </div>
      </div>
      <div className="me-tabs">
        <button className={`fmt-tab${tab === "users" ? " on" : ""}`} onClick={() => setTab("users")}>用户</button>
        <button className={`fmt-tab${tab === "wallpapers" ? " on" : ""}`} onClick={() => setTab("wallpapers")}>壁纸管理</button>
      </div>
      {tab === "users" ? <UsersPanel /> : <WallpapersPanel />}
    </div>
  );
}

function fmtTime(ts: number | null): string {
  return ts ? new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    adminListUsers().then((r) => setUsers(r.items)).catch((e) => { setErr(String(e.message || e)); setUsers([]); });
  }, []);
  if (!users) return <Spinner />;
  if (err) return <Empty text={err} />;
  if (!users.length) return <Empty text="还没有注册用户" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="prints-table admin-table">
        <thead>
          <tr><th>ID</th><th>用户名</th><th>角色</th><th>注册时间</th><th>最后登录</th><th>收藏</th><th>卡组</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="muted">{u.id}</td>
              <td><b>{u.username}</b></td>
              <td>{u.role === "admin" ? <span style={{ color: "var(--gold-soft)" }}>admin</span> : "user"}</td>
              <td className="muted">{fmtTime(u.created_at)}</td>
              <td className="muted">{fmtTime(u.last_login)}</td>
              <td>{u.fav_count}</td>
              <td>{u.deck_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface WpForm {
  id?: string;
  title: string;
  tags: string;
  category: string;
  device: string;
  image_url: string;
  thumb_url: string;
  source_url: string;
}
const EMPTY_FORM: WpForm = { title: "", tags: "", category: "wallpaper", device: "pc", image_url: "", thumb_url: "", source_url: "" };

function WallpapersPanel() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<WallpaperItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WpForm | null>(null);  // null=关闭 {}=新增/编辑
  const [msg, setMsg] = useState("");

  const load = (pg = page, kw = q) => {
    setItems(null);
    listWallpapers({ q: kw.trim() || undefined, sort: "newest", page: pg, size: 24 })
      .then((r) => { setItems(r.items); setTotal(r.total); setPage(r.page); })
      .catch(() => { setItems([]); setTotal(0); });
  };
  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const submit = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await adminUpdateWallpaper(editing.id, {
          title: editing.title, tags: editing.tags, category: editing.category,
          device: editing.device, source_url: editing.source_url,
          ...(editing.image_url ? { image_url: editing.image_url } : {}),
          ...(editing.thumb_url ? { thumb_url: editing.thumb_url } : {}),
        });
        flash(`已更新 ${editing.id}`);
      } else {
        const r = await adminCreateWallpaper({
          title: editing.title, tags: editing.tags, category: editing.category,
          device: editing.device, image_url: editing.image_url,
          thumb_url: editing.thumb_url || undefined, source_url: editing.source_url || undefined,
        });
        flash(`已新增 ${r.id}`);
      }
      setEditing(null);
      load();
    } catch (e) {
      flash(String((e as Error).message || e));
    }
  };

  const del = async (w: WallpaperItem) => {
    if (!confirm(`删除壁纸「${w.title}」(${w.id})？不可恢复`)) return;
    try {
      await adminDeleteWallpaper(w.id);
      flash(`已删除 ${w.id}`);
      load();
    } catch (e) {
      flash(String((e as Error).message || e));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          className="login-input" style={{ maxWidth: 320, margin: 0 }}
          placeholder="搜索标签 / 标题 / id…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1)}
        />
        <button className="btn" onClick={() => load(1)}>搜索</button>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY_FORM })}>+ 新增壁纸</button>
        <span className="muted" style={{ alignSelf: "center" }}>共 {total} 张{msg && ` · ${msg}`}</span>
      </div>

      {editing && (
        <div className="admin-form">
          <h3>{editing.id ? `编辑 ${editing.id}` : "新增壁纸"}</h3>
          <div className="admin-form-grid">
            <label>标题<input className="login-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
            <label>标签（逗号分隔）<input className="login-input" value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} /></label>
            <label>分类
              <select className="login-input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                <option value="wallpaper">综合壁纸</option>
                <option value="artwork">原画/怪兽</option>
                <option value="character">角色</option>
              </select>
            </label>
            <label>设备
              <select className="login-input" value={editing.device} onChange={(e) => setEditing({ ...editing, device: e.target.value })}>
                <option value="pc">电脑（横屏）</option>
                <option value="mobile">手机（竖屏）</option>
              </select>
            </label>
            <label>原图直链{!editing.id && " *"}<input className="login-input" placeholder="https://…" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></label>
            <label>缩略图直链<input className="login-input" placeholder="留空则用原图" value={editing.thumb_url} onChange={(e) => setEditing({ ...editing, thumb_url: e.target.value })} /></label>
            <label>来源页面<input className="login-input" value={editing.source_url} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={submit} disabled={!editing.id && !editing.image_url}>保存</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      )}

      {!items ? <Spinner /> : !items.length ? <Empty text="没有匹配的壁纸" /> : (
        <div className="admin-wp-grid">
          {items.map((w) => (
            <div key={w.id} className="admin-wp">
              <a href={w.url} target="_blank" rel="noreferrer">
                <img src={w.thumb_url} alt={w.title} loading="lazy" />
              </a>
              <div className="admin-wp-meta">
                <b title={w.title}>{w.title}</b>
                <span className="muted">{w.id} · {w.device} · {w.category} · {w.width}×{w.height}</span>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    className="btn"
                    onClick={() => setEditing({
                      id: w.id, title: w.title, tags: w.tags.join(","), category: w.category,
                      device: w.device, image_url: "", thumb_url: "", source_url: w.source_url || "",
                    })}
                  >编辑</button>
                  <button className="btn btn-ghost" onClick={() => void del(w)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pager">
          <button className="btn" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</button>
          <span className="cur">{page} / {totalPages}</span>
          <button className="btn" disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}
