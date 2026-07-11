// M10 账号体系：注册/登录/会话。所有用户态 SQL 集中于此。
// 口令：PBKDF2-SHA256 加随机盐（Workers 免费档 CPU 预算内的迭代数）。
// 会话：随机 token 存 D1，HttpOnly+Secure+SameSite=Lax Cookie 持有，30 天有效，可吊销。

export interface AuthUser {
  id: number;
  username: string;
  role: "user" | "admin";
  created_at: number;
}

const SESSION_TTL = 30 * 24 * 3600; // 30 天
const PBKDF2_ITER = 10_000;
export const SESSION_COOKIE = "ygo_session";

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER },
    key,
    256,
  );
  return toHex(bits);
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

/** 常量时间比较，避免时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const USERNAME_RE = /^[\w一-鿿぀-ヿ-]{2,20}$/;

export function validateCredentials(username: string, password: string): string | null {
  if (!USERNAME_RE.test(username)) return "用户名需 2-20 位，仅限中日文/字母/数字/_-";
  if (password.length < 6 || password.length > 72) return "密码需 6-72 位";
  return null;
}

export async function register(
  db: D1Database, username: string, password: string,
): Promise<{ user?: AuthUser; error?: string }> {
  const err = validateCredentials(username, password);
  if (err) return { error: err };
  const exists = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) return { error: "用户名已被占用" };
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt);
  const now = Math.floor(Date.now() / 1000);
  // 站点冷启动引导：首个注册用户自动成为管理员
  const cnt = await db.prepare("SELECT count(*) AS n FROM users").first<{ n: number }>();
  const role = (cnt?.n ?? 0) === 0 ? "admin" : "user";
  const r = await db
    .prepare("INSERT INTO users (username, pass_hash, pass_salt, role, created_at, last_login) VALUES (?,?,?,?,?,?)")
    .bind(username, hash, salt, role, now, now)
    .run();
  const id = r.meta.last_row_id as number;
  return { user: { id, username, role: role as AuthUser["role"], created_at: now } };
}

export async function login(
  db: D1Database, username: string, password: string,
): Promise<{ user?: AuthUser; error?: string }> {
  const row = await db
    .prepare("SELECT id, username, pass_hash, pass_salt, role, created_at FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; username: string; pass_hash: string; pass_salt: string; role: string; created_at: number }>();
  if (!row) return { error: "用户名或密码错误" };
  const hash = await pbkdf2(password, row.pass_salt);
  if (!safeEqual(hash, row.pass_hash)) return { error: "用户名或密码错误" };
  const now = Math.floor(Date.now() / 1000);
  await db.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now, row.id).run();
  return { user: { id: row.id, username: row.username, role: row.role as AuthUser["role"], created_at: row.created_at } };
}

export async function createSession(db: D1Database, userId: number): Promise<{ token: string; expires: number }> {
  const token = randomHex(16);
  const now = Math.floor(Date.now() / 1000);
  const expires = now + SESSION_TTL;
  await db
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)")
    .bind(token, userId, now, expires)
    .run();
  return { token, expires };
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

/** 从请求 Cookie 解析当前用户；无效/过期返回 null */
export async function userFromRequest(db: D1Database, req: Request): Promise<AuthUser | null> {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f]{32})`));
  if (!m) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`,
    )
    .bind(m[1], now)
    .first<AuthUser>();
  return row ?? null;
}

export function sessionCookie(token: string, expires: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expires * 1000).toUTCString()}`;
}
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ---------------- 收藏 ----------------
export type FavKind = "card" | "set" | "wallpaper";
const FAV_KINDS: FavKind[] = ["card", "set", "wallpaper"];

export function isFavKind(k: string): k is FavKind {
  return (FAV_KINDS as string[]).includes(k);
}

export async function listFavorites(db: D1Database, userId: number, kind: FavKind): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT ref_id FROM favorites WHERE user_id = ? AND kind = ? ORDER BY created_at DESC")
    .bind(userId, kind)
    .all<{ ref_id: string }>();
  return (results || []).map((r) => r.ref_id);
}

export async function addFavorite(db: D1Database, userId: number, kind: FavKind, refId: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO favorites (user_id, kind, ref_id, created_at) VALUES (?,?,?,?)")
    .bind(userId, kind, refId, Math.floor(Date.now() / 1000))
    .run();
}

export async function removeFavorite(db: D1Database, userId: number, kind: FavKind, refId: string): Promise<void> {
  await db
    .prepare("DELETE FROM favorites WHERE user_id = ? AND kind = ? AND ref_id = ?")
    .bind(userId, kind, refId)
    .run();
}

// ---------------- 用户卡组 ----------------
export interface UserDeck {
  id: number;
  name: string;
  deck_code: string;
  format: string;
  created_at: number;
  updated_at: number;
}

export async function listDecks(db: D1Database, userId: number): Promise<UserDeck[]> {
  const { results } = await db
    .prepare("SELECT id, name, deck_code, format, created_at, updated_at FROM user_decks WHERE user_id = ? ORDER BY updated_at DESC")
    .bind(userId)
    .all<UserDeck>();
  return results || [];
}

export async function saveDeck(
  db: D1Database, userId: number,
  d: { id?: number; name: string; deck_code: string; format: string },
): Promise<{ id: number } | { error: string }> {
  const name = d.name.trim().slice(0, 40);
  if (!name) return { error: "卡组需要一个名字" };
  if (!d.deck_code || d.deck_code.length > 4000) return { error: "卡组数据无效" };
  const now = Math.floor(Date.now() / 1000);
  if (d.id) {
    const r = await db
      .prepare("UPDATE user_decks SET name = ?, deck_code = ?, format = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(name, d.deck_code, d.format, now, d.id, userId)
      .run();
    if (!r.meta.changes) return { error: "卡组不存在" };
    return { id: d.id };
  }
  const cnt = await db.prepare("SELECT count(*) AS n FROM user_decks WHERE user_id = ?").bind(userId).first<{ n: number }>();
  if ((cnt?.n ?? 0) >= 100) return { error: "卡组数量已达上限 100" };
  const r = await db
    .prepare("INSERT INTO user_decks (user_id, name, deck_code, format, created_at, updated_at) VALUES (?,?,?,?,?,?)")
    .bind(userId, name, d.deck_code, d.format, now, now)
    .run();
  return { id: r.meta.last_row_id as number };
}

export async function deleteDeck(db: D1Database, userId: number, id: number): Promise<void> {
  await db.prepare("DELETE FROM user_decks WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

// ---------------- 管理端 ----------------
export interface AdminUserRow {
  id: number;
  username: string;
  role: string;
  created_at: number;
  last_login: number | null;
  fav_count: number;
  deck_count: number;
}

export async function adminListUsers(db: D1Database): Promise<AdminUserRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at, u.last_login,
        (SELECT count(*) FROM favorites f WHERE f.user_id = u.id) AS fav_count,
        (SELECT count(*) FROM user_decks d WHERE d.user_id = u.id) AS deck_count
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
    )
    .all<AdminUserRow>();
  return results || [];
}
