-- M11 反馈建议 + 注册防垃圾（增量迁移，全部 IF NOT EXISTS）
-- feedback: 用户反馈建议（未登录可读，登录可提交；管理员可回复/标记已处理）
-- signup_log: 注册行为日志，用于按 IP 限流防垃圾注册

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,                  -- 提交者 user_id（冗余 username 便于展示）
  username   TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'other',     -- bug | feature | other
  content    TEXT NOT NULL,
  reply      TEXT,                              -- 管理员回复（NULL 表示未回复）
  status     TEXT NOT NULL DEFAULT 'open',      -- open | resolved
  created_at INTEGER NOT NULL,
  replied_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

CREATE TABLE IF NOT EXISTS signup_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  username   TEXT NOT NULL,
  success    INTEGER NOT NULL,                  -- 1=成功 0=失败
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_ip_time ON signup_log(ip, created_at DESC);
