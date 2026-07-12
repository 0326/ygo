// SEO 注入：根据路由动态生成 meta 标签、JSON-LD、canonical，注入到 index.html 中。
// 由 Worker 在 run_worker_first 模式下拦截 HTML 页面请求时调用。

interface SeoMeta {
  title: string;
  description: string;
  image?: string;       // 绝对 URL，用于 og:image
  canonical: string;    // 绝对 URL
  jsonLd?: unknown;     // JSON-LD 对象
}

const SITE_NAME = "游戏王集卡社";

const DEFAULT_SEO: SeoMeta = {
  title: `${SITE_NAME} · 游戏王卡图 / 图鉴 / 制卡器`,
  description: "全网最美的游戏王卡图与系列图鉴，含在线制卡器与分享长图工具。抖音号 ygoclub。",
  canonical: "/",
};

// 路由级默认 SEO
const ROUTE_SEO: Record<string, Partial<SeoMeta>> = {
  "/search": {
    title: `搜索卡牌 · ${SITE_NAME}`,
    description: "搜索游戏王卡牌，支持按名称、属性、种族、等级、攻守、赛制等多维度筛选。",
  },
  "/archetypes": {
    title: `系列图鉴 · ${SITE_NAME}`,
    description: "浏览所有游戏王卡牌系列，查看每个系列的完整卡表、卡图和效果。",
  },
  "/sets": {
    title: `卡包列表 · ${SITE_NAME}`,
    description: "浏览所有游戏王卡包，查看每个卡包的卡牌列表与详情。",
  },
  "/maker": {
    title: `在线制卡器 · ${SITE_NAME}`,
    description: "在线制作游戏王风格卡牌，自定义卡名、效果、属性、图片，一键生成分享。",
  },
  "/share": {
    title: `分享长图 · ${SITE_NAME}`,
    description: "将卡牌组合生成分享长图，适用于社交媒体传播。",
  },
  "/deck": {
    title: `卡组构建器 · ${SITE_NAME}`,
    description: "在线构建游戏王卡组，支持 OCG / TCG / Master Duel 赛制，一键分享卡组码。",
  },
  "/wallpapers": {
    title: `游戏王壁纸 · ${SITE_NAME}`,
    description: "全网游戏王壁纸、原画、角色图库，高清下载。",
  },
};

// 静态资源后缀（直接透传 ASSETS，不做 SEO 注入）
const STATIC_EXT = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|map|wasm|json|txt|webmanifest)$/;

export function isStaticAsset(path: string): boolean {
  return STATIC_EXT.test(path);
}

// HTML 属性值转义
function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 截断文本用于 meta description
function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

// 根据路径构建 SEO 元数据
async function buildSeo(env: Env, url: URL): Promise<SeoMeta> {
  const path = url.pathname;
  const origin = url.origin;

  // 首页
  if (path === "/" || path === "/index.html") {
    return { ...DEFAULT_SEO, canonical: `${origin}/` };
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

    if (row) {
      const name = row.cn_name || row.en_name;
      const effectText = row.effect_cn || "";
      const desc = truncate(
        effectText || `${name} - 游戏王卡牌详情，查看卡图、效果、异画、收录卡包等信息。`,
        160
      );
      const imgKey = row.default_key || String(id);
      const imgUrl = `${origin}/img/${imgKey}`;
      return {
        title: `${name} · ${SITE_NAME}`,
        description: desc,
        image: imgUrl,
        canonical: `${origin}/card/${id}`,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description: desc,
          image: imgUrl,
          url: `${origin}/card/${id}`,
          category: "Trading Card Game",
        },
      };
    }
    return { ...DEFAULT_SEO, canonical: `${origin}/card/${id}` };
  }

  // 系列详情 /archetypes/:id
  const archMatch = path.match(/^\/archetypes\/(\d+)$/);
  if (archMatch) {
    const id = parseInt(archMatch[1], 10);
    const row = await env.ygo_db
      .prepare("SELECT id, cn_name, en_name, card_count FROM archetypes WHERE id=?")
      .bind(id)
      .first<{ id: number; cn_name: string; en_name: string; card_count: number }>();

    if (row) {
      const name = row.cn_name || row.en_name;
      return {
        title: `${name}系列 · ${SITE_NAME}`,
        description: `${name}系列共有 ${row.card_count} 张卡牌，查看完整卡表、卡图和效果。`,
        canonical: `${origin}/archetypes/${id}`,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${name}系列`,
          description: `${name}系列共有 ${row.card_count} 张卡牌。`,
          url: `${origin}/archetypes/${id}`,
        },
      };
    }
    return { ...DEFAULT_SEO, canonical: `${origin}/archetypes/${id}` };
  }

  // 卡包详情 /sets/:code
  const setMatch = path.match(/^\/sets\/([^/]+)$/);
  if (setMatch) {
    const code = decodeURIComponent(setMatch[1]);
    const row = await env.ygo_db
      .prepare("SELECT code, cn_name, en_name, release_date FROM sets WHERE code=?")
      .bind(code)
      .first<{ code: string; cn_name: string; en_name: string; release_date: number | null }>();

    if (row) {
      const name = row.cn_name || row.en_name || code;
      return {
        title: `${name}卡包 · ${SITE_NAME}`,
        description: `${name}（${code}）卡包的卡牌列表与详情。`,
        canonical: `${origin}/sets/${encodeURIComponent(code)}`,
      };
    }
    return { ...DEFAULT_SEO, canonical: `${origin}/sets/${encodeURIComponent(code)}` };
  }

  // 路由级默认
  const routeSeo = ROUTE_SEO[path];
  if (routeSeo) {
    return { ...DEFAULT_SEO, ...routeSeo, canonical: `${origin}${path}` };
  }

  // 兜底
  return { ...DEFAULT_SEO, canonical: `${origin}${path}` };
}

// 将 SEO 元数据注入 HTML 字符串
function injectMeta(html: string, seo: SeoMeta): string {
  let h = html;

  // 替换 <title>
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(seo.title)}</title>`);

  // 替换 meta description
  h = h.replace(
    /<meta\s+name="description"\s+content="[^"]*"/,
    `<meta name="description" content="${escAttr(seo.description)}"`
  );

  // 替换 og:title / og:description
  h = h.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"/,
    `<meta property="og:title" content="${escAttr(seo.title)}"`
  );
  h = h.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"/,
    `<meta property="og:description" content="${escAttr(seo.description)}"`
  );

  // 替换 twitter:title / twitter:description
  h = h.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"/,
    `<meta name="twitter:title" content="${escAttr(seo.title)}"`
  );
  h = h.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"/,
    `<meta name="twitter:description" content="${escAttr(seo.description)}"`
  );

  // 替换 JSON-LD（data-seo="website" 标记的块）
  if (seo.jsonLd) {
    h = h.replace(
      /<script\s+type="application\/ld\+json"\s+data-seo="website">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`
    );
  }

  // 在 </head> 前注入 canonical / og:url / og:image
  const extra: string[] = [
    `<link rel="canonical" href="${escAttr(seo.canonical)}" />`,
    `<meta property="og:url" content="${escAttr(seo.canonical)}" />`,
  ];
  if (seo.image) {
    extra.push(`<meta property="og:image" content="${escAttr(seo.image)}" />`);
    extra.push(`<meta name="twitter:image" content="${escAttr(seo.image)}" />`);
  }
  h = h.replace(/<\/head>/, `\t\t${extra.join("\n\t\t")}\n\t</head>`);

  return h;
}

// 主入口：获取 index.html 并注入 SEO，返回 Response
export async function renderSeoHtml(env: Env, url: URL): Promise<Response> {
  const indexReq = new Request(new URL("/index.html", url.origin), { method: "GET" });
  const assetRes = await env.ASSETS.fetch(indexReq);
  if (!assetRes.ok) return assetRes;

  const html = await assetRes.text();

  let seo: SeoMeta;
  try {
    seo = await buildSeo(env, url);
  } catch {
    seo = { ...DEFAULT_SEO, canonical: url.toString() };
  }

  const modified = injectMeta(html, seo);
  return new Response(modified, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

// 生成 sitemap.xml
export async function sitemapXml(env: Env, origin: string): Promise<string> {
  const urls: string[] = [];

  // 静态页面
  const staticPages = ["/", "/search", "/archetypes", "/sets", "/maker", "/wallpapers", "/deck", "/share"];
  for (const p of staticPages) {
    urls.push(`  <url><loc>${origin}${p}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  // 卡片
  const cards = await env.ygo_db.prepare("SELECT id FROM cards ORDER BY id").all<{ id: number }>();
  for (const c of cards.results || []) {
    urls.push(`  <url><loc>${origin}/card/${c.id}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  }

  // 系列
  const archs = await env.ygo_db.prepare("SELECT id FROM archetypes ORDER BY id").all<{ id: number }>();
  for (const a of archs.results || []) {
    urls.push(`  <url><loc>${origin}/archetypes/${a.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }

  // 卡包
  const sets = await env.ygo_db.prepare("SELECT code FROM sets ORDER BY code").all<{ code: string }>();
  for (const s of sets.results || []) {
    urls.push(`  <url><loc>${origin}/sets/${encodeURIComponent(s.code)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}
