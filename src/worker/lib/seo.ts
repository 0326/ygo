// SEO / GEO：根据路由动态生成 meta、JSON-LD、可抓取正文与 sitemap。
// Worker 在 run_worker_first 模式下拦截 HTML 页面请求时调用。

interface SeoMeta {
  title: string;
  description: string;
  image?: string;       // 绝对 URL，用于 og:image
  canonical: string;    // 绝对 URL
  jsonLd?: unknown;     // JSON-LD 对象
  bodyHtml?: string;    // 首屏可抓取正文；React 启动后会替换 #root 内容
  robots?: string;
  status?: number;
}

const SITE_NAME = "游戏王集卡社";
const SITE_TAGLINE = "游戏王卡牌数据库、高清卡图、系列图鉴、卡包、卡组构建与在线制卡工具";
const DEFAULT_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

const DEFAULT_SEO: SeoMeta = {
  title: `${SITE_NAME} · 游戏王卡牌数据库 / 卡图 / 图鉴 / 制卡器`,
  description: `${SITE_TAGLINE}。支持简中、日文、英文卡图与 OCG / TCG / Master Duel 信息。`,
  canonical: "/",
  robots: DEFAULT_ROBOTS,
};

// 路由级默认 SEO。用户态页面不放在这里，统一在 NOINDEX_ROUTES 中治理。
const ROUTE_SEO: Record<string, Partial<SeoMeta>> = {
  "/search": {
    title: `游戏王查卡 · 卡牌搜索与筛选 · ${SITE_NAME}`,
    description: "搜索游戏王卡牌，支持名称、属性、种族、等级、攻守、卡框、子类型、赛制与 Master Duel 罕贵度等多维筛选。",
  },
  "/archetypes": {
    title: `游戏王系列图鉴 · ${SITE_NAME}`,
    description: "浏览游戏王卡牌系列（Archetype），查看系列卡表、高清卡图、中文名称和卡牌效果。",
  },
  "/sets": {
    title: `游戏王卡包列表 · ${SITE_NAME}`,
    description: "浏览游戏王 OCG / TCG 卡包与收录卡牌，查看卡包编号、卡牌列表和详情。",
  },
  "/maker": {
    title: `游戏王在线制卡器 · ${SITE_NAME}`,
    description: "在线制作游戏王风格同人卡，自定义卡名、效果、属性、卡图、灵摆与连接信息，高分辨率导出。",
  },
  "/deck": {
    title: `游戏王卡组构建器 · OCG / TCG / Master Duel · ${SITE_NAME}`,
    description: "在线构建游戏王卡组，支持 OCG / TCG / Master Duel、禁限校验、YDK 导入导出和卡组统计。",
  },
  "/wallpapers": {
    title: `游戏王壁纸 / 原画 / 角色图库 · ${SITE_NAME}`,
    description: "浏览游戏王高清壁纸、卡牌原画和角色图片，支持桌面与手机壁纸筛选。",
  },
};

const NOINDEX_ROUTES = new Set(["/login", "/me", "/admin", "/feedback"]);

// 静态资源后缀（直接透传 ASSETS，不做 SEO 注入）
const STATIC_EXT = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|map|wasm|json|txt|webmanifest)$/;

export function isStaticAsset(path: string): boolean {
  return STATIC_EXT.test(path);
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escAttr(s: string): string {
  return escHtml(s);
}

function escXml(s: string): string {
  return escHtml(s);
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function jsonForHtml(value: unknown): string {
  // 避免数据库文本里出现 </script> 提前闭合 JSON-LD script。
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function normalizePath(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function breadcrumb(origin: string, items: Array<{ name: string; path: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

function pageGraph(origin: string, canonical: string, title: string, description: string, extra: unknown[] = []) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: "zh-CN",
        isPartOf: { "@id": `${origin}/#website` },
      },
      ...extra,
    ],
  };
}

function staticBody(path: string, title: string, description: string): string {
  const links: Record<string, Array<[string, string]>> = {
    "/search": [["系列图鉴", "/archetypes"], ["卡包列表", "/sets"], ["卡组构建器", "/deck"]],
    "/archetypes": [["查卡", "/search"], ["卡包列表", "/sets"], ["游戏王壁纸", "/wallpapers"]],
    "/sets": [["查卡", "/search"], ["系列图鉴", "/archetypes"], ["卡组构建器", "/deck"]],
    "/maker": [["查卡", "/search"], ["系列图鉴", "/archetypes"], ["卡组构建器", "/deck"]],
    "/deck": [["查卡", "/search"], ["系列图鉴", "/archetypes"], ["卡包列表", "/sets"]],
    "/wallpapers": [["查卡", "/search"], ["系列图鉴", "/archetypes"], ["在线制卡器", "/maker"]],
  };
  const nav = (links[path] || [])
    .map(([label, href]) => `<a href="${escAttr(href)}">${escHtml(label)}</a>`)
    .join(" · ");

  return `<main class="container page" data-seo-prerender="true">
    <article>
      <h1>${escHtml(title.replace(` · ${SITE_NAME}`, ""))}</h1>
      <p>${escHtml(description)}</p>
      ${nav ? `<nav aria-label="相关页面">${nav}</nav>` : ""}
    </article>
  </main>`;
}

async function buildSeo(env: Env, url: URL): Promise<SeoMeta> {
  const path = normalizePath(url.pathname);
  const origin = url.origin;

  // 首页：直接输出站点定位与核心入口，避免 app-shell 空正文。
  if (path === "/" || path === "/index.html") {
    const canonical = `${origin}/`;
    const title = DEFAULT_SEO.title;
    const description = DEFAULT_SEO.description;
    return {
      ...DEFAULT_SEO,
      canonical,
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${origin}/#website`,
            url: canonical,
            name: SITE_NAME,
            description,
            inLanguage: "zh-CN",
          },
          {
            "@type": "WebPage",
            "@id": `${canonical}#webpage`,
            url: canonical,
            name: title,
            description,
            inLanguage: "zh-CN",
            isPartOf: { "@id": `${origin}/#website` },
          },
        ],
      },
      bodyHtml: `<main class="container page" data-seo-prerender="true">
        <article>
          <h1>${SITE_NAME}</h1>
          <p>${escHtml(SITE_TAGLINE)}。本站为非官方爱好者站点，提供卡牌资料检索与创作工具。</p>
          <nav aria-label="核心功能">
            <a href="/search">游戏王查卡</a> ·
            <a href="/archetypes">系列图鉴</a> ·
            <a href="/sets">卡包列表</a> ·
            <a href="/deck">卡组构建器</a> ·
            <a href="/maker">在线制卡器</a> ·
            <a href="/wallpapers">游戏王壁纸</a>
          </nav>
        </article>
      </main>`,
    };
  }

  // 卡片详情 /card/:id
  const cardMatch = path.match(/^\/card\/(\d+)$/);
  if (cardMatch) {
    const id = parseInt(cardMatch[1], 10);
    const row = await env.ygo_db
      .prepare(
        `SELECT c.cn_name, c.jp_name, c.en_name, c.card_type, c.frame, c.effect_cn,
          (SELECT image_key FROM card_artworks a WHERE a.card_id=c.id ORDER BY a.is_default DESC, a.id LIMIT 1) AS default_key
         FROM cards c WHERE c.id=?`
      )
      .bind(id)
      .first<{ cn_name: string; jp_name: string | null; en_name: string; card_type: string; frame: string; effect_cn: string; default_key: string | null }>();

    const canonical = `${origin}/card/${id}`;
    if (row) {
      const name = row.cn_name || row.en_name;
      const effectText = row.effect_cn || "";
      const desc = truncate(
        effectText || `${name} - 游戏王卡牌详情，查看高清卡图、中文效果、异画与收录卡包。`,
        160,
      );
      const imgKey = row.default_key || String(id);
      const imgUrl = `${origin}/img/${encodeURIComponent(imgKey)}`;
      const title = `${name}｜游戏王卡牌详情 · ${SITE_NAME}`;
      const altNames = [row.jp_name, row.en_name].filter(Boolean).join(" / ");

      return {
        title,
        description: desc,
        image: imgUrl,
        canonical,
        jsonLd: pageGraph(origin, canonical, title, desc, [
          {
            "@type": "Product",
            "@id": `${canonical}#card`,
            name,
            alternateName: [row.jp_name, row.en_name].filter(Boolean),
            description: desc,
            image: imgUrl,
            url: canonical,
            category: "Yu-Gi-Oh! Trading Card",
          },
          breadcrumb(origin, [
            { name: SITE_NAME, path: "/" },
            { name: "游戏王查卡", path: "/search" },
            { name, path: `/card/${id}` },
          ]),
        ]),
        bodyHtml: `<main class="container page" data-seo-prerender="true">
          <article>
            <nav aria-label="面包屑"><a href="/">${SITE_NAME}</a> › <a href="/search">游戏王查卡</a> › ${escHtml(name)}</nav>
            <h1>${escHtml(name)}</h1>
            ${altNames ? `<p>${escHtml(altNames)}</p>` : ""}
            <img src="${escAttr(imgUrl)}" alt="${escAttr(`${name} 游戏王卡图`)}" width="420" loading="eager" />
            <dl>
              <dt>卡牌类型</dt><dd>${escHtml(row.card_type || "-")}</dd>
              <dt>卡框</dt><dd>${escHtml(row.frame || "-")}</dd>
            </dl>
            <h2>卡牌效果</h2>
            <p>${escHtml(effectText || "暂无简中效果文本")}</p>
          </article>
        </main>`,
      };
    }

    return {
      ...DEFAULT_SEO,
      title: `卡牌不存在 · ${SITE_NAME}`,
      description: "未找到对应的游戏王卡牌。",
      canonical,
      robots: "noindex, nofollow",
      status: 404,
      bodyHtml: `<main class="container page" data-seo-prerender="true"><h1>卡牌不存在</h1><p><a href="/search">返回游戏王查卡</a></p></main>`,
    };
  }

  // 系列详情 /archetypes/:id
  const archMatch = path.match(/^\/archetypes\/(\d+)$/);
  if (archMatch) {
    const id = parseInt(archMatch[1], 10);
    const row = await env.ygo_db
      .prepare("SELECT id, cn_name, en_name, card_count FROM archetypes WHERE id=?")
      .bind(id)
      .first<{ id: number; cn_name: string; en_name: string; card_count: number }>();
    const canonical = `${origin}/archetypes/${id}`;

    if (row) {
      const name = row.cn_name || row.en_name;
      const description = `${name}系列共有 ${row.card_count} 张游戏王卡牌，查看完整卡表、高清卡图和卡牌效果。`;
      const title = `${name}系列卡表 / 图鉴 · ${SITE_NAME}`;
      return {
        title,
        description,
        canonical,
        jsonLd: pageGraph(origin, canonical, title, description, [
          {
            "@type": "CollectionPage",
            "@id": `${canonical}#collection`,
            name: `${name}系列`,
            description,
            url: canonical,
            numberOfItems: row.card_count,
          },
          breadcrumb(origin, [
            { name: SITE_NAME, path: "/" },
            { name: "系列图鉴", path: "/archetypes" },
            { name: `${name}系列`, path: `/archetypes/${id}` },
          ]),
        ]),
        bodyHtml: `<main class="container page" data-seo-prerender="true">
          <article>
            <nav aria-label="面包屑"><a href="/">${SITE_NAME}</a> › <a href="/archetypes">系列图鉴</a> › ${escHtml(name)}</nav>
            <h1>${escHtml(name)}系列图鉴</h1>
            <p>${escHtml(description)}</p>
            ${row.en_name ? `<p>英文名称：${escHtml(row.en_name)}</p>` : ""}
            <p><a href="/search?archetype=${id}">搜索该系列卡牌</a></p>
          </article>
        </main>`,
      };
    }

    return {
      ...DEFAULT_SEO,
      title: `系列不存在 · ${SITE_NAME}`,
      description: "未找到对应的游戏王卡牌系列。",
      canonical,
      robots: "noindex, nofollow",
      status: 404,
      bodyHtml: `<main class="container page" data-seo-prerender="true"><h1>系列不存在</h1><p><a href="/archetypes">返回系列图鉴</a></p></main>`,
    };
  }

  // 卡包详情 /sets/:code
  const setMatch = path.match(/^\/sets\/([^/]+)$/);
  if (setMatch) {
    const code = decodeURIComponent(setMatch[1]);
    const row = await env.ygo_db
      .prepare("SELECT code, cn_name, en_name, release_date FROM sets WHERE code=?")
      .bind(code)
      .first<{ code: string; cn_name: string; en_name: string; release_date: number | null }>();
    const canonical = `${origin}/sets/${encodeURIComponent(code)}`;

    if (row) {
      const name = row.cn_name || row.en_name || code;
      const releaseYear = row.release_date ? new Date(row.release_date * 1000).getUTCFullYear() : null;
      const description = `${name}（${code}）游戏王卡包的收录卡牌列表与详情${releaseYear ? `，发行年份 ${releaseYear}` : ""}。`;
      const title = `${name}（${code}）卡包 · ${SITE_NAME}`;
      return {
        title,
        description,
        canonical,
        jsonLd: pageGraph(origin, canonical, title, description, [
          {
            "@type": "CollectionPage",
            "@id": `${canonical}#collection`,
            name: `${name}（${code}）`,
            description,
            url: canonical,
          },
          breadcrumb(origin, [
            { name: SITE_NAME, path: "/" },
            { name: "卡包列表", path: "/sets" },
            { name, path: `/sets/${encodeURIComponent(code)}` },
          ]),
        ]),
        bodyHtml: `<main class="container page" data-seo-prerender="true">
          <article>
            <nav aria-label="面包屑"><a href="/">${SITE_NAME}</a> › <a href="/sets">卡包列表</a> › ${escHtml(name)}</nav>
            <h1>${escHtml(name)}（${escHtml(code)}）</h1>
            <p>${escHtml(description)}</p>
            ${row.en_name ? `<p>英文名称：${escHtml(row.en_name)}</p>` : ""}
          </article>
        </main>`,
      };
    }

    return {
      ...DEFAULT_SEO,
      title: `卡包不存在 · ${SITE_NAME}`,
      description: "未找到对应的游戏王卡包。",
      canonical,
      robots: "noindex, nofollow",
      status: 404,
      bodyHtml: `<main class="container page" data-seo-prerender="true"><h1>卡包不存在</h1><p><a href="/sets">返回卡包列表</a></p></main>`,
    };
  }

  // 用户态/管理态页面允许访问，但禁止进入搜索索引。
  if (NOINDEX_ROUTES.has(path)) {
    return {
      ...DEFAULT_SEO,
      title: `${SITE_NAME}`,
      description: "游戏王集卡社用户功能页面。",
      canonical: `${origin}${path}`,
      robots: "noindex, nofollow",
      bodyHtml: `<main class="container page" data-seo-prerender="true"><p>${SITE_NAME}</p></main>`,
    };
  }

  // 路由级静态页面
  const routeSeo = ROUTE_SEO[path];
  if (routeSeo) {
    const title = routeSeo.title || DEFAULT_SEO.title;
    const description = routeSeo.description || DEFAULT_SEO.description;
    const canonical = `${origin}${path}`;
    return {
      ...DEFAULT_SEO,
      ...routeSeo,
      canonical,
      jsonLd: pageGraph(origin, canonical, title, description, [
        breadcrumb(origin, [
          { name: SITE_NAME, path: "/" },
          { name: title.replace(` · ${SITE_NAME}`, ""), path },
        ]),
      ]),
      bodyHtml: staticBody(path, title, description),
    };
  }

  // 未知 SPA 路由必须返回真实 404，避免 soft-404 被索引。
  return {
    ...DEFAULT_SEO,
    title: `页面不存在 · ${SITE_NAME}`,
    description: "页面不存在，请返回首页或使用游戏王查卡。",
    canonical: `${origin}${path}`,
    robots: "noindex, nofollow",
    status: 404,
    bodyHtml: `<main class="container page" data-seo-prerender="true"><h1>页面不存在</h1><p><a href="/">返回首页</a> · <a href="/search">游戏王查卡</a></p></main>`,
  };
}

function injectMeta(html: string, seo: SeoMeta): string {
  let h = html;

  h = h.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(seo.title)}</title>`);
  h = h.replace(
    /<meta\s+name="description"\s+content="[^"]*"/,
    `<meta name="description" content="${escAttr(seo.description)}"`,
  );
  h = h.replace(
    /<meta\s+name="robots"\s+content="[^"]*"/,
    `<meta name="robots" content="${escAttr(seo.robots || DEFAULT_ROBOTS)}"`,
  );
  h = h.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"/,
    `<meta property="og:title" content="${escAttr(seo.title)}"`,
  );
  h = h.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"/,
    `<meta property="og:description" content="${escAttr(seo.description)}"`,
  );
  h = h.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"/,
    `<meta name="twitter:title" content="${escAttr(seo.title)}"`,
  );
  h = h.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"/,
    `<meta name="twitter:description" content="${escAttr(seo.description)}"`,
  );

  if (seo.jsonLd) {
    h = h.replace(
      /<script\s+type="application\/ld\+json"\s+data-seo="website">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${jsonForHtml(seo.jsonLd)}</script>`,
    );
  }

  const extra: string[] = [
    `<link rel="canonical" href="${escAttr(seo.canonical)}" />`,
    `<meta property="og:url" content="${escAttr(seo.canonical)}" />`,
  ];
  if (seo.image) {
    extra.push(`<meta property="og:image" content="${escAttr(seo.image)}" />`);
    extra.push(`<meta property="og:image:alt" content="${escAttr(seo.title)}" />`);
    extra.push(`<meta name="twitter:image" content="${escAttr(seo.image)}" />`);
  }
  h = h.replace(/<\/head>/, `\t\t${extra.join("\n\t\t")}\n\t</head>`);

  // 把与 React 页面一致的核心正文注入 #root。浏览器执行 React 后会替换，
  // 不执行 JS 的搜索引擎 / AI crawler 也能直接读取标题、正文、链接和主图。
  if (seo.bodyHtml) {
    h = h.replace(/<div id="root"><\/div>/, `<div id="root">${seo.bodyHtml}</div>`);
  }

  return h;
}

export async function renderSeoHtml(env: Env, url: URL): Promise<Response> {
  const indexReq = new Request(new URL("/index.html", url.origin), { method: "GET" });
  const assetRes = await env.ASSETS.fetch(indexReq);
  if (!assetRes.ok) return assetRes;

  const html = await assetRes.text();

  let seo: SeoMeta;
  try {
    seo = await buildSeo(env, url);
  } catch {
    seo = {
      ...DEFAULT_SEO,
      canonical: url.toString(),
      robots: "noindex, nofollow",
      status: 500,
    };
  }

  const modified = injectMeta(html, seo);
  return new Response(modified, {
    status: seo.status || 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-robots-tag": seo.robots || DEFAULT_ROBOTS,
    },
  });
}

// 生成 sitemap.xml。卡牌页同时写入主卡图，帮助图片搜索发现 JS 页面中的图片。
export async function sitemapXml(env: Env, origin: string): Promise<string> {
  const urls: string[] = [];

  // 只包含实际存在、值得索引的公开页面；/share 已下线，不再写入 sitemap。
  const staticPages = ["/", "/search", "/archetypes", "/sets", "/maker", "/wallpapers", "/deck"];
  for (const p of staticPages) {
    urls.push(`  <url><loc>${escXml(`${origin}${p}`)}</loc></url>`);
  }

  const cards = await env.ygo_db
    .prepare(
      `SELECT c.id,
        (SELECT image_key FROM card_artworks a WHERE a.card_id=c.id ORDER BY a.is_default DESC, a.id LIMIT 1) AS image_key
       FROM cards c ORDER BY c.id`,
    )
    .all<{ id: number; image_key: string | null }>();
  for (const c of cards.results || []) {
    const imageKey = c.image_key || String(c.id);
    urls.push(
      `  <url><loc>${escXml(`${origin}/card/${c.id}`)}</loc><image:image><image:loc>${escXml(`${origin}/img/${encodeURIComponent(imageKey)}`)}</image:loc></image:image></url>`,
    );
  }

  const archs = await env.ygo_db.prepare("SELECT id FROM archetypes ORDER BY id").all<{ id: number }>();
  for (const a of archs.results || []) {
    urls.push(`  <url><loc>${escXml(`${origin}/archetypes/${a.id}`)}</loc></url>`);
  }

  const sets = await env.ygo_db.prepare("SELECT code FROM sets ORDER BY code").all<{ code: string }>();
  for (const s of sets.results || []) {
    urls.push(`  <url><loc>${escXml(`${origin}/sets/${encodeURIComponent(s.code)}`)}</loc></url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`;
}
