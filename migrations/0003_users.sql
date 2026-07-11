-- M10 账号体系 Schema（增量迁移，用户数据必须可重复执行且不丢失 —— 全部 IF NOT EXISTS）
-- users: 账号（PBKDF2-SHA256 加盐哈希；首个注册用户自动成为 admin）
-- sessions: 服务端会话（HttpOnly Cookie 持有随机 token，可吊销）
-- favorites: 通用收藏（kind = card | set | wallpaper，ref_id 为对应主键字符串）
-- user_decks: 用户保存的卡组（deck_code 与分享链接同构的紧凑编码）

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash  TEXT NOT NULL,               -- PBKDF2-SHA256 hex
  pass_salt  TEXT NOT NULL,               -- 随机盐 hex
  role       TEXT NOT NULL DEFAULT 'user',-- user | admin
  created_at INTEGER NOT NULL,
  last_login INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,            -- 随机 128bit hex
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,               -- card | set | wallpaper
  ref_id     TEXT NOT NULL,               -- card: 卡密 / set: 卡包 code / wallpaper: 图 id
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_user ON favorites(user_id, kind);

CREATE TABLE IF NOT EXISTS user_decks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  deck_code  TEXT NOT NULL,               -- 与 /deck?d= 相同的 base64url 编码
  format     TEXT DEFAULT 'ocg',          -- ocg | tcg | md
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_udecks_user ON user_decks(user_id, updated_at DESC);
