import { NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";

const links = [
  { to: "/search", label: "查卡" },
  { to: "/archetypes", label: "系列图鉴" },
  { to: "/sets", label: "卡包" },
  { to: "/maker", label: "制卡器" },
  { to: "/deck", label: "组卡" },
  { to: "/share", label: "长图" },
];

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
};

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

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
          <Link to="/" className="brand">🃏 <span>哈基米<b>卡库</b></span></Link>
          <nav>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="spacer" />
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottomnav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon d={ICONS[l.to]} />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
