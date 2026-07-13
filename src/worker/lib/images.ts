// M0.2 卡图管线：R2 自托管（懒回填）。请求时优先读 R2；未命中则回源 ygoprodeck，
// 即时返回并异步写入 R2 —— 首次访问后即自托管，避免长期热链，也无需一次性批量拉 1.4 万张。
// URL 契约：/img/{key}（整卡）、/img/{key}/s（缩略）、/img/{key}/art（裁剪卡图，M8 制卡器用）。
// 支持 ?lang=cn|jp|en 按语言选卡图，回退链 cn→en、jp→en。

const ORIGIN = "https://images.ygoprodeck.com/images";

export type ImgVariant = "full" | "small" | "art";
const VARIANT_DIR: Record<ImgVariant, string> = {
  full: "cards", small: "cards_small", art: "cards_cropped",
};

export type Lang = "cn" | "jp" | "en";

// 各语言 R2 目录映射：full 和 small 分开，art 语言无关
// 日文只有 484×700 一种分辨率，full 和 small 共用 cards_jp/
const LANG_DIRS: Record<Lang, Partial<Record<ImgVariant, string>>> = {
  en: { full: "cards", small: "cards_small", art: "cards_cropped" },
  cn: { full: "cards_cn", small: "cards_cn_small" },
  jp: { full: "cards_jp", small: "cards_jp" },
};

// 回退链
const FALLBACK: Record<Lang, Lang[]> = {
  cn: ["cn", "en"],
  jp: ["jp", "en"],
  en: ["en"],
};

export function thumbUrl(imageKey: string | number, lang?: Lang): string {
  const q = lang && lang !== "en" ? `?lang=${lang}` : "";
  return `/img/${imageKey}/s${q}`;
}
export function fullUrl(imageKey: string | number, lang?: Lang): string {
  const q = lang && lang !== "en" ? `?lang=${lang}` : "";
  return `/img/${imageKey}${q}`;
}
export function artUrl(imageKey: string | number): string {
  return `/img/${imageKey}/art`;
}

export function originFor(key: string, variant: ImgVariant): string {
  const safe = key.replace(/[^0-9]/g, "");
  return `${ORIGIN}/${VARIANT_DIR[variant]}/${safe}.jpg`;
}

function r2KeyEn(key: string, variant: ImgVariant): string {
  const safe = key.replace(/[^0-9]/g, "");
  return `${VARIANT_DIR[variant]}/${safe}.jpg`;
}

function r2KeyForLang(key: string, variant: ImgVariant, lang: Lang): string | null {
  const dir = LANG_DIRS[lang]?.[variant];
  if (!dir) return null;
  const safe = key.replace(/[^0-9]/g, "");
  return `${dir}/${safe}.jpg`;
}

const IMG_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
  "Content-Type": "image/jpeg",
};

// 缓存版本号：修改此值可强制刷新所有 CDN 缓存
const CACHE_VERSION = "v3";

export async function proxyImage(
  req: Request,
  key: string,
  variant: ImgVariant,
  bucket?: R2Bucket,
  ctx?: ExecutionContext,
  lang: Lang = "en"
): Promise<Response> {
  const cache = caches.default;
  // 在 URL 中注入缓存版本号，旧缓存自动失效
  const u = new URL(req.url);
  u.searchParams.set("_cv", CACHE_VERSION);
  const cacheKey = new Request(u.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const chain = FALLBACK[lang] || ["en"];

  // 1) 按语言回退链查 R2 自托管
  if (bucket) {
    for (const l of chain as Lang[]) {
      const objKey = r2KeyForLang(key, variant, l);
      if (!objKey) continue;
      const obj = await bucket.get(objKey);
      if (obj) {
        const res = new Response(obj.body, { headers: IMG_HEADERS });
        res.headers.set("x-r2", "hit");
        res.headers.set("x-img-lang", l);
        if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
      }
    }
  }

  // 2) 回源 ygoprodeck（仅英文）
  const upstream = await fetch(originFor(key, variant), {
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!upstream.ok) {
    return new Response("image not found", { status: 404 });
  }

  // 3) 回填 R2 英文目录（自托管）
  const buf = await upstream.arrayBuffer();
  const res = new Response(buf, { headers: IMG_HEADERS });
  res.headers.set("x-r2", "miss");
  res.headers.set("x-img-lang", "en");
  if (bucket) {
    const enKey = r2KeyEn(key, variant);
    try {
      await bucket.put(enKey, buf, { httpMetadata: { contentType: "image/jpeg" } });
    } catch { /* 回填失败不影响本次返回 */ }
  }
  if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
