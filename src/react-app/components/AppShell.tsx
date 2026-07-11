import { NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLang, LANGS } from "../lib/i18n";
import { useUser } from "../lib/user";

const links = [
  { to: "/search", key: "nav.search" },
  { to: "/archetypes", key: "nav.archetypes" },
  { to: "/sets", key: "nav.sets" },
  { to: "/wallpapers", key: "nav.wallpapers" },
  { to: "/maker", key: "nav.maker" },
  { to: "/deck", key: "nav.deck" },
  { to: "/share", key: "nav.share" },
] as const;

// 友情链接：全量收录游戏王官方站点 / 游戏 / 模拟器 / 资料库 / 卡查 / Meta / 市场，聚合成 5 类
const friendLinks: { groupKey: string; items: { name: string; url: string }[] }[] = [
  {
    groupKey: "footer.grpOfficial",
    items: [
      { name: "游戏王卡游总站 (JP)", url: "https://www.konami.com/yugioh/" },
      { name: "官方海外站 TCG", url: "https://www.yugioh-card.com/en/" },
      { name: "官方 OCG (日本)", url: "https://www.yugioh-card.com/japan/" },
      { name: "官方简中卡查", url: "https://db.yugioh-card-cn.com/" },
      { name: "官方卡查 Neuron (EN)", url: "https://www.db.yugioh-card.com/yugiohdb/?request_locale=en" },
      { name: "官方卡查 Neuron (JP)", url: "https://www.db.yugioh-card.com/yugiohdb/?request_locale=ja" },
      { name: "禁限卡表", url: "https://www.db.yugioh-card.com/yugiohdb/forbidden_limited.action" },
      { name: "YU-GI-OH.jp 资讯/动画", url: "https://yu-gi-oh.jp/" },
    ],
  },
  {
    groupKey: "footer.grpGames",
    items: [
      { name: "Master Duel 大师决斗", url: "https://www.konami.com/yugioh/masterduel/" },
      { name: "Duel Links 决斗链接", url: "https://www.konami.com/yugioh/duel_links/" },
      { name: "Rush Duel 高速决斗", url: "https://www.konami.com/yugioh/rushduel/" },
      { name: "YGO Omega", url: "https://omega.duelistsunite.org/" },
      { name: "Project Ignis · EDOPro", url: "https://projectignis.github.io/" },
      { name: "Dueling Book", url: "https://www.duelingbook.com/" },
      { name: "Dueling Nexus", url: "https://duelingnexus.com/" },
      { name: "MyCard 萌卡 · YGOPro", url: "https://mycard.moe/" },
    ],
  },
  {
    groupKey: "footer.grpWiki",
    items: [
      { name: "Yugipedia", url: "https://yugipedia.com/" },
      { name: "Yu-Gi-Oh! Wiki (Fandom)", url: "https://yugioh.fandom.com/" },
      { name: "YGOPRODeck", url: "https://ygoprodeck.com/" },
      { name: "YGOrganization 资讯", url: "https://ygorganization.com/" },
      { name: "Format Library", url: "https://www.formatlibrary.com/" },
    ],
  },
  {
    groupKey: "footer.grpCommunity",
    items: [
      { name: "百鸽 · YGOCDB", url: "https://ygocdb.com/" },
      { name: "我们的 OCG · Ourocg", url: "https://www.ourocg.cn/" },
      { name: "DuelMeta 上位卡组", url: "https://db.duelmeta.com/" },
      { name: "NGA 游戏王", url: "https://bbs.nga.cn/thread.php?fid=-152678" },
      { name: "Reddit r/yugioh", url: "https://www.reddit.com/r/yugioh/" },
    ],
  },
  {
    groupKey: "footer.grpMeta",
    items: [
      { name: "Yu-Gi-Oh! Meta", url: "https://www.yugiohmeta.com/" },
      { name: "Master Duel Meta", url: "https://www.masterduelmeta.com/" },
      { name: "Cardcluster 组卡", url: "https://cardcluster.com/" },
      { name: "TCGplayer 卡价", url: "https://www.tcgplayer.com/categories/trading-and-collectible-card-games/yugioh" },
      { name: "Cardmarket (EU)", url: "https://www.cardmarket.com/en/YuGiOh" },
      { name: "Pojo 论坛", url: "https://www.pojo.biz/board/" },
    ],
  },
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
          <AuthEntry />
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="sf-links">
            <div className="sf-links-title">{t("footer.links")}</div>
            <div className="sf-links-grid">
              {friendLinks.map((col) => (
                <div key={col.groupKey} className="sf-links-col">
                  <div className="sf-links-group">{t(col.groupKey as Parameters<typeof t>[0])}</div>
                  <ul>
                    {col.items.map((it) => (
                      <li key={it.url}>
                        <a href={it.url} target="_blank" rel="noopener noreferrer">
                          {it.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
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

// M10：顶栏账号入口 —— 未登录显示登录按钮，已登录显示用户名（点击进用户中心）
function AuthEntry() {
  const { me } = useUser();
  const { t } = useLang();
  if (me === undefined) return <span className="auth-entry" />;
  if (!me) return <Link className="auth-entry btn" to="/login">{t("auth.login")}</Link>;
  return (
    <Link className="auth-entry btn" to="/me" title={t("me.title")}>
      <span className="auth-avatar">{me.username.slice(0, 1).toUpperCase()}</span>
      <span className="auth-name">{me.username}</span>
    </Link>
  );
}
