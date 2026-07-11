// M0.3 数据 API（Workers 动态查询）+ M0.2 卡图代理。契约见 src/shared/types.ts。
import { Hono } from "hono";
import * as Q from "./lib/queries";
import * as W from "./lib/wallpapers";
import * as A from "./lib/auth";
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
// 批量卡片摘要（M10 收藏页）：/api/cards?ids=1,2,3
app.get("/api/cards", (c) =>
  cached(c, 3600, async () => {
    const ids = (c.req.query("ids") || "").split(",").map((s) => parseInt(s, 10));
    return { items: await Q.cardsByIds(c.env.ygo_db, ids) };
  })
);
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

// ---------- 壁纸（M9：全网游戏王壁纸/原画/角色图库） ----------
app.get("/api/wallpapers/tags", (c) =>
  cached(c, 3600, () => W.wallpaperTags(c.env.ygo_db))
);
app.get("/api/wallpapers/stats", (c) =>
  cached(c, 3600, () => W.wallpaperStats(c.env.ygo_db))
);
app.get("/api/wallpapers", (c) =>
  cached(c, 300, () => {
    const q = c.req.query();
    return W.listWallpapers(c.env.ygo_db, {
      q: q.q, device: q.device, category: q.category, tag: q.tag, sort: q.sort,
      page: intParam(q.page, 1),
      size: intParam(q.size, 24),
    });
  })
);
app.get("/wp-img/:id/s", (c) =>
  W.proxyWallpaperImage(c.req.raw, c.env.ygo_db, c.req.param("id"), true, c.env.IMG_BUCKET, c.executionCtx)
);
app.get("/wp-img/:id", (c) =>
  W.proxyWallpaperImage(c.req.raw, c.env.ygo_db, c.req.param("id"), false, c.env.IMG_BUCKET, c.executionCtx)
);

// ---------- 账号体系（M10：用户态路由一律不走边缘缓存） ----------
const json = (data: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => ({} as Record<string, never>));
  const r = await A.register(c.env.ygo_db, String(body.username || "").trim(), String(body.password || ""));
  if (r.error || !r.user) return json({ error: r.error || "注册失败" }, 400);
  const s = await A.createSession(c.env.ygo_db, r.user.id);
  return json({ user: r.user }, 200, { "set-cookie": A.sessionCookie(s.token, s.expires) });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => ({} as Record<string, never>));
  const r = await A.login(c.env.ygo_db, String(body.username || "").trim(), String(body.password || ""));
  if (r.error || !r.user) return json({ error: r.error || "登录失败" }, 401);
  const s = await A.createSession(c.env.ygo_db, r.user.id);
  return json({ user: r.user }, 200, { "set-cookie": A.sessionCookie(s.token, s.expires) });
});

app.post("/api/auth/logout", async (c) => {
  const cookie = c.req.raw.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${A.SESSION_COOKIE}=([0-9a-f]{32})`));
  if (m) await A.destroySession(c.env.ygo_db, m[1]);
  return json({ ok: true }, 200, { "set-cookie": A.clearSessionCookie() });
});

app.get("/api/auth/me", async (c) => {
  const user = await A.userFromRequest(c.env.ygo_db, c.req.raw);
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ user });
});

// 用户态守卫
async function requireUser(c: { env: Env; req: { raw: Request } }): Promise<A.AuthUser | Response> {
  const user = await A.userFromRequest(c.env.ygo_db, c.req.raw);
  return user ?? json({ error: "请先登录" }, 401);
}
async function requireAdmin(c: { env: Env; req: { raw: Request } }): Promise<A.AuthUser | Response> {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  return u.role === "admin" ? u : json({ error: "需要管理员权限" }, 403);
}

// ---------- 收藏 ----------
app.get("/api/me/favorites", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  const kind = c.req.query("kind") || "";
  if (!A.isFavKind(kind)) return json({ error: "kind 无效" }, 400);
  return json({ items: await A.listFavorites(c.env.ygo_db, u.id, kind) });
});
app.put("/api/me/favorites/:kind/:ref", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  const kind = c.req.param("kind");
  if (!A.isFavKind(kind)) return json({ error: "kind 无效" }, 400);
  await A.addFavorite(c.env.ygo_db, u.id, kind, c.req.param("ref").slice(0, 40));
  return json({ ok: true });
});
app.delete("/api/me/favorites/:kind/:ref", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  const kind = c.req.param("kind");
  if (!A.isFavKind(kind)) return json({ error: "kind 无效" }, 400);
  await A.removeFavorite(c.env.ygo_db, u.id, kind, c.req.param("ref").slice(0, 40));
  return json({ ok: true });
});

// ---------- 用户卡组 ----------
app.get("/api/me/decks", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  return json({ items: await A.listDecks(c.env.ygo_db, u.id) });
});
app.post("/api/me/decks", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  const body = await c.req.json<{ id?: number; name?: string; deck_code?: string; format?: string }>().catch(() => ({} as Record<string, never>));
  const r = await A.saveDeck(c.env.ygo_db, u.id, {
    id: body.id, name: String(body.name || ""), deck_code: String(body.deck_code || ""),
    format: ["ocg", "tcg", "md"].includes(String(body.format)) ? String(body.format) : "ocg",
  });
  if ("error" in r) return json(r, 400);
  return json(r);
});
app.delete("/api/me/decks/:id", async (c) => {
  const u = await requireUser(c);
  if (u instanceof Response) return u;
  await A.deleteDeck(c.env.ygo_db, u.id, intParam(c.req.param("id"), 0));
  return json({ ok: true });
});

// ---------- 管理端（M10：用户概览 + 壁纸 CRUD） ----------
app.get("/api/admin/users", async (c) => {
  const u = await requireAdmin(c);
  if (u instanceof Response) return u;
  return json({ items: await A.adminListUsers(c.env.ygo_db) });
});
app.post("/api/admin/wallpapers", async (c) => {
  const u = await requireAdmin(c);
  if (u instanceof Response) return u;
  const body = await c.req.json<W.WallpaperUpsert>().catch(() => null);
  if (!body) return json({ error: "请求体无效" }, 400);
  const r = await W.adminCreateWallpaper(c.env.ygo_db, body);
  return json(r, "error" in r ? 400 : 200);
});
app.put("/api/admin/wallpapers/:id", async (c) => {
  const u = await requireAdmin(c);
  if (u instanceof Response) return u;
  const body = await c.req.json<Partial<W.WallpaperUpsert>>().catch(() => null);
  if (!body) return json({ error: "请求体无效" }, 400);
  const r = await W.adminUpdateWallpaper(c.env.ygo_db, c.req.param("id"), body);
  return json(r, "error" in r ? 400 : 200);
});
app.delete("/api/admin/wallpapers/:id", async (c) => {
  const u = await requireAdmin(c);
  if (u instanceof Response) return u;
  const r = await W.adminDeleteWallpaper(c.env.ygo_db, c.req.param("id"), c.env.IMG_BUCKET);
  return json(r, "error" in r ? 400 : 200);
});

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
