-- M9 壁纸模块 Schema（增量迁移，不触碰 0001 卡片数据表）
-- 数据来源：scripts/collect-wallpapers.mjs 采集全网游戏王壁纸/原画/角色高清图。

DROP TABLE IF EXISTS wallpapers;

CREATE TABLE wallpapers (
  id          TEXT PRIMARY KEY,             -- 来源站图片 id（wallhaven 短 id）
  title       TEXT,
  tags        TEXT,                         -- 逗号分隔英文标签（搜索用）
  category    TEXT NOT NULL,                -- wallpaper=综合壁纸 | artwork=原画/怪兽 | character=角色
  device      TEXT NOT NULL,                -- pc=横屏 | mobile=竖屏
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  ratio       REAL,                         -- 宽高比
  file_type   TEXT,                         -- image/jpeg | image/png
  file_size   INTEGER,
  colors      TEXT,                         -- JSON 数组：主色
  favorites   INTEGER DEFAULT 0,            -- 来源站收藏数（热度排序）
  views       INTEGER DEFAULT 0,
  source      TEXT,                         -- 来源站点标识
  source_url  TEXT,                         -- 来源页面 URL
  image_url   TEXT NOT NULL,                -- 原图直链（经 /wp-img 代理 + R2 回填自托管）
  thumb_url   TEXT,                         -- 缩略图直链
  created_at  TEXT
);

CREATE INDEX idx_wp_device    ON wallpapers(device);
CREATE INDEX idx_wp_category  ON wallpapers(category);
CREATE INDEX idx_wp_favorites ON wallpapers(favorites DESC);
