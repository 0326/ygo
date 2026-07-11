// M0.3 数据 API（Workers 动态查询）+ M0.2 卡图代理。契约见 src/shared/types.ts。
import { Hono } from "hono";
import * as Q from "./lib/queries";
import { proxyImage } from "./lib/images";

const app = new Hono<{ Bindings: Env }>();

// ---- 边缘缓存包装：卡片数据近静态，重缓存避免打爆 D1 ----
async function cached(
  c: { req: { raw: Request }; executionCtx: ExecutionContext },
  ttl: number,
  build: () => Promise<unknown>
): Promise<Response> {
  const cache = caches.default;
  const key = new Request(new URL(c.req.raw.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const data = await build();
  if (data === null) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  const res = new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}`,
    },
  });
  try {
    c.executionCtx.waitUntil(cache.put(key, res.clone()));
  } catch {
    /* local dev: executionCtx 可能不可用 */
  }
  return res;
}

const intParam = (v: string | undefined, def: number) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : def;
};

// ---------- 搜索 ----------
app.get("/api/search", (c) =>
  cached(c, 300, () => {
    const q = c.req.query();
    return Q.search(c.env.ygo_db, {
      q: q.q, frame: q.frame, attribute: q.attribute, race: q.race,
      level: q.level, archetype: q.archetype, type: q.type, sort: q.sort,
      level_min: q.level_min, level_max: q.level_max,
      atk_min: q.atk_min, atk_max: q.atk_max, def_min: q.def_min, def_max: q.def_max,
      link: q.link, scale: q.scale, subtype: q.subtype, md_rarity: q.md_rarity,
      format: q.format,
      page: intParam(q.page, 1),
      size: intParam(q.size, 24),
    });
  })
);

// ---------- 卡片详情 / 异画 ----------
app.get("/api/cards/:id", (c) =>
  cached(c, 3600, () => Q.cardDetail(c.env.ygo_db, intParam(c.req.param("id"), 0)))
);
app.get("/api/cards/:id/artworks", (c) =>
  cached(c, 3600, () => Q.getArtworks(c.env.ygo_db, intParam(c.req.param("id"), 0)))
);

// ---------- 系列图鉴 ----------
app.get("/api/archetypes", (c) =>
  cached(c, 3600, () => Q.listArchetypes(c.env.ygo_db, intParam(c.req.query("min"), 6)))
);
app.get("/api/archetypes/:id", (c) =>
  cached(c, 3600, () => Q.archetypeDetail(c.env.ygo_db, intParam(c.req.param("id"), 0)))
);

// ---------- 卡包 ----------
app.get("/api/sets", (c) => cached(c, 3600, () => Q.listSets(c.env.ygo_db)));
app.get("/api/sets/:code", (c) =>
  cached(c, 3600, () => Q.setDetail(c.env.ygo_db, c.req.param("code")))
);

// ---------- 站点统计 ----------
app.get("/api/stats", (c) => cached(c, 3600, () => Q.stats(c.env.ygo_db)));

// ---------- 卡图（M0.2：R2 自托管 + 懒回填） ----------
app.get("/img/:key/s", (c) =>
  proxyImage(c.req.raw, c.req.param("key"), "small", c.env.IMG_BUCKET, c.executionCtx)
);
app.get("/img/:key/art", (c) =>
  proxyImage(c.req.raw, c.req.param("key"), "art", c.env.IMG_BUCKET, c.executionCtx)
);
app.get("/img/:key", (c) =>
  proxyImage(c.req.raw, c.req.param("key"), "full", c.env.IMG_BUCKET, c.executionCtx)
);

app.get("/api/*", (c) => c.json({ error: "unknown endpoint" }, 404));

export default app;
