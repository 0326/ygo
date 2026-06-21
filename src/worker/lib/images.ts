// M0.2 卡图管线：R2 自托管（懒回填）。请求时优先读 R2；未命中则回源 ygoprodeck，
// 即时返回并异步写入 R2 —— 首次访问后即自托管，避免长期热链，也无需一次性批量拉 1.4 万张。
// URL 契约不变：/img/{key} 与 /img/{key}/s。

const ORIGIN = "https://images.ygoprodeck.com/images";

export function thumbUrl(imageKey: string | number): string {
  return `/img/${imageKey}/s`;
}
export function fullUrl(imageKey: string | number): string {
  return `/img/${imageKey}`;
}

export function originFor(key: string, small: boolean): string {
  const safe = key.replace(/[^0-9]/g, "");
  return small
    ? `${ORIGIN}/cards_small/${safe}.jpg`
    : `${ORIGIN}/cards/${safe}.jpg`;
}

// R2 对象 key：cards/{id}.jpg 或 cards_small/{id}.jpg
function r2Key(key: string, small: boolean): string {
  const safe = key.replace(/[^0-9]/g, "");
  return small ? `cards_small/${safe}.jpg` : `cards/${safe}.jpg`;
}

const IMG_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
  "Content-Type": "image/jpeg",
};

export async function proxyImage(
  req: Request,
  key: string,
  small: boolean,
  bucket?: R2Bucket,
  ctx?: ExecutionContext
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const objKey = r2Key(key, small);

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
  const upstream = await fetch(originFor(key, small), {
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!upstream.ok) {
    return new Response("image not found", { status: 404 });
  }

  // 3) 回填 R2（自托管）。冷路径同步写入以确保落库，仅每张图首位访问者承担一次。
  // 回填 R2（自托管）。冷路径同步写入确保落库，仅每张图首位访问者承担一次。
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
