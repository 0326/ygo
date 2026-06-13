// M0.2 卡图管线（v1 实现）：经我方 Worker 自托管/代理 ygoprodeck 卡图并做边缘缓存，
// 不热链。PRD 终态为 R2，本实现保留同样的 URL 契约 /img/{key} 与 /img/{key}/s，
// 后续切到 R2 时前端无感。

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

// 代理 + 边缘缓存。卡图近静态，长缓存。
export async function proxyImage(
  req: Request,
  key: string,
  small: boolean
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const upstream = await fetch(originFor(key, small), {
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!upstream.ok) {
    return new Response("image not found", { status: 404 });
  }
  const res = new Response(upstream.body, upstream);
  res.headers.set("Cache-Control", "public, max-age=2592000, immutable");
  res.headers.set("Content-Type", "image/jpeg");
  res.headers.delete("set-cookie");
  // 异步写缓存（不阻塞响应）
  return res;
}
