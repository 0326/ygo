// M0.2 卡图管线：R2 自托管（懒回填）。请求时优先读 R2；未命中则回源 ygoprodeck，
// 即时返回并异步写入 R2 —— 首次访问后即自托管，避免长期热链，也无需一次性批量拉 1.4 万张。
// URL 契约：/img/{key}（整卡）、/img/{key}/s（缩略）、/img/{key}/art（裁剪卡图，M8 制卡器用）。

const ORIGIN = "https://images.ygoprodeck.com/images";

// 图片变体：full=整卡 / small=整卡缩略 / art=裁剪卡图（仅美术区）
export type ImgVariant = "full" | "small" | "art";
const VARIANT_DIR: Record<ImgVariant, string> = {
  full: "cards", small: "cards_small", art: "cards_cropped",
};

export function thumbUrl(imageKey: string | number): string {
  return `/img/${imageKey}/s`;
}
export function fullUrl(imageKey: string | number): string {
  return `/img/${imageKey}`;
}
export function artUrl(imageKey: string | number): string {
  return `/img/${imageKey}/art`;
}

export function originFor(key: string, variant: ImgVariant): string {
  const safe = key.replace(/[^0-9]/g, "");
  return `${ORIGIN}/${VARIANT_DIR[variant]}/${safe}.jpg`;
}

// R2 对象 key：cards/{id}.jpg、cards_small/{id}.jpg 或 cards_cropped/{id}.jpg
function r2Key(key: string, variant: ImgVariant): string {
  const safe = key.replace(/[^0-9]/g, "");
  return `${VARIANT_DIR[variant]}/${safe}.jpg`;
}

const IMG_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
  "Content-Type": "image/jpeg",
};

export async function proxyImage(
  req: Request,
  key: string,
  variant: ImgVariant,
  bucket?: R2Bucket,
  ctx?: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const objKey = r2Key(key, variant);

  // 1) 优先 R2 自托管
  if (bucket) {
    const obj = await bucket.get(objKey);
    if (obj) {
      const res = new Response(obj.body, { headers: IMG_HEADERS });
      res.headers.set("x-r2", "hit");
      if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }
  }

  // 2) 回源 ygoprodeck
  const upstream = await fetch(originFor(key, variant), {
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!upstream.ok) {
    return new Response("image not found", { status: 404 });
  }

  // 3) 回填 R2（自托管）。冷路径同步写入以确保落库，仅每张图首位访问者承担一次。
  const buf = await upstream.arrayBuffer();
  const res = new Response(buf, { headers: IMG_HEADERS });
  res.headers.set("x-r2", "miss");
  if (bucket) {
    try {
      await bucket.put(objKey, buf, { httpMetadata: { contentType: "image/jpeg" } });
    } catch { /* 回填失败不影响本次返回 */ }
  }
  if (ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
