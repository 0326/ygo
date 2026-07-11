-- M0.1 共享数据 Schema（契约 4.1，冻结版 v1）
-- 卡密(passcode)为主键。所有 feature 模块只读消费，禁止私改。

DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS card_artworks;
DROP TABLE IF EXISTS archetypes;
DROP TABLE IF EXISTS sets;
DROP TABLE IF EXISTS card_prints;
DROP TABLE IF EXISTS banlist;
DROP TABLE IF EXISTS cards_fts;
DROP TABLE IF EXISTS cards_bigram;

-- 卡片主表
CREATE TABLE cards (
  id           INTEGER PRIMARY KEY,        -- passcode / 卡密
  cn_name      TEXT,
  jp_name      TEXT,
  en_name      TEXT,
  card_type    TEXT,                        -- monster | spell | trap
  frame        TEXT,                        -- normal|effect|ritual|fusion|synchro|xyz|link|pendulum|spell|trap|token
  attribute    TEXT,                        -- LIGHT|DARK|WATER|FIRE|EARTH|WIND|DIVINE
  race         TEXT,                        -- 种族(英文 key)
  level        INTEGER,                     -- 星/阶
  link_val     INTEGER,
  link_markers TEXT,                        -- JSON 数组: ["top-left",...]
  scale        INTEGER,                     -- 灵摆刻度
  atk          INTEGER,                     -- -1 表示 ?(不确定)
  def          INTEGER,                     -- -1 表示 ?
  effect_cn    TEXT,                         -- 怪兽效果/卡片效果（灵摆卡为怪兽侧）
  pendulum_effect_cn TEXT,                   -- 灵摆效果（仅灵摆卡）
  effect_jp    TEXT,                         -- 日文效果（来源 ygopro ja-JP cdb）
  pendulum_effect_jp TEXT,
  effect_en    TEXT,                         -- 英文效果（来源 ygoprodeck desc）
  pendulum_effect_en TEXT,
  formats      TEXT,                         -- 赛制归属: "ocg,tcg,md" 逗号串（来源 ygoprodeck misc_info.formats）
  subtypes     TEXT,                         -- JSON 数组: ["tuner","flip",...]
  md_rarity    TEXT,                         -- Master Duel 罕贵: N|R|SR|UR (来源 ygoprodeck)
  archetype_id INTEGER,
  alias_of     INTEGER,                     -- 异画/勘误归一到主卡
  updated_at   INTEGER
);
CREATE INDEX idx_cards_frame      ON cards(frame);
CREATE INDEX idx_cards_attribute  ON cards(attribute);
CREATE INDEX idx_cards_race       ON cards(race);
CREATE INDEX idx_cards_level      ON cards(level);
CREATE INDEX idx_cards_type       ON cards(card_type);
CREATE INDEX idx_cards_archetype  ON cards(archetype_id);
CREATE INDEX idx_cards_atk        ON cards(atk);

-- 一卡多图（异画画廊 + 制卡器预填的基础）
CREATE TABLE card_artworks (
  id           INTEGER PRIMARY KEY,
  card_id      INTEGER NOT NULL,            -- -> cards.id
  image_key    TEXT,                        -- 资源 key（此处为 passcode 印张 id）
  is_default   INTEGER DEFAULT 0,
  variant_name TEXT,
  source       TEXT
);
CREATE INDEX idx_artworks_card ON card_artworks(card_id);

-- 系列（archetype）
CREATE TABLE archetypes (
  id            INTEGER PRIMARY KEY,
  cn_name       TEXT,
  en_name       TEXT,
  cover_card_id INTEGER,
  card_count    INTEGER DEFAULT 0
);

-- 卡包
CREATE TABLE sets (
  code         TEXT PRIMARY KEY,
  cn_name      TEXT,
  en_name      TEXT,
  release_date INTEGER
);

-- 收录 / 罕贵
CREATE TABLE card_prints (
  card_id     INTEGER NOT NULL,
  set_code    TEXT NOT NULL,
  rarity      TEXT,
  card_number TEXT NOT NULL,
  PRIMARY KEY (card_id, set_code, card_number)
);
CREATE INDEX idx_prints_card ON card_prints(card_id);
CREATE INDEX idx_prints_set  ON card_prints(set_code);

-- 禁限卡表（赛制分离）
CREATE TABLE banlist (
  card_id    INTEGER NOT NULL,             -- -> cards.id
  format     TEXT NOT NULL,                -- 'ocg' | 'tcg' | 'md'
  status     INTEGER NOT NULL,             -- 0=禁止 1=限制 2=准限制
  updated_at INTEGER,
  PRIMARY KEY (card_id, format)
);
CREATE INDEX idx_banlist_card ON banlist(card_id);

-- FTS5 全文搜索：覆盖中/日/英名 + 中文效果文本（内容表外置）
CREATE VIRTUAL TABLE cards_fts USING fts5(
  cn_name, jp_name, en_name, effect_cn,
  content='cards', content_rowid='id',
  tokenize='trigram'
);

-- 双字 CJK 检索（trigram 需 ≥3 字）：cn_name/jp_name 的相邻二元组，独立 FTS（rowid=卡密）
CREATE VIRTUAL TABLE cards_bigram USING fts5(bg, tokenize='unicode61');
