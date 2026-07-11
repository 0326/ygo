import { NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLang, LANGS } from "../lib/i18n";

const links = [
  { to: "/search", key: "nav.search" },
  { to: "/archetypes", key: "nav.archetypes" },
  { to: "/sets", key: "nav.sets" },
  { to: "/wallpapers", key: "nav.wallpapers" },
  { to: "/maker", key: "nav.maker" },
  { to: "/deck", key: "nav.deck" },
  { to: "/share", key: "nav.share" },
] as const;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS: Record<string, string> = {
  "/search": "M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3",
  "/archetypes": "M4 5h16M4 12h16M4 19h10",
  "/sets": "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7",
  "/maker": "M12 19l7-7 3 3-7 7-3-3zM2 2l7.5 7.5M11 11l-9 9",
  "/deck": "M4 7h10v13H4zM9 4h11v13",
  "/share": "M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14",
  "/wallpapers": "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 5",
};

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  // 全局快捷键：按 "/" 聚焦当前页搜索框（无搜索框则跳查卡页）
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>(".searchbar input");
      if (input) {
        input.focus();
      } else {
        navigate("/search");
        // 等路由渲染完成后聚焦新页面的搜索框
        setTimeout(() => document.querySelector<HTMLInputElement>(".searchbar input")?.focus(), 100);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate]);

  return (
    <>
      <header className="topnav">
        <div className="container" style={{ display: "flex", alignItems: "center", gap: 24, width: "100%" }}>
          <Link to="/" className="brand">🃏 <span>游戏王<b>集卡社</b></span></Link>
          <nav>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {t(l.key)}
              </NavLink>
            ))}
          </nav>
          <span className="spacer" />
          <span className="lang-switch">
            {LANGS.map((l) => (
              <button
                key={l.value}
                className={`lang-btn${lang === l.value ? " on" : ""}`}
                onClick={() => setLang(l.value)}
                title={{ cn: "简体中文", jp: "日本語", en: "English" }[l.value]}
              >
                {l.label}
              </button>
            ))}
          </span>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="sf-brand">🃏 游戏王<b>集卡社</b></div>
          <div className="sf-copy">© {new Date().getFullYear()} 游戏王集卡社 · {t("footer.copy")}</div>
          <div className="sf-social">@游戏王集卡社 · 抖音号 <b>ygoclub</b></div>
        </div>
      </footer>

      <nav className="bottomnav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon d={ICONS[l.to]} />
            {t(l.key)}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
