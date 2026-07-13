#!/bin/bash
cd "$(dirname "$0")/.."

echo "开始批量上传所有卡图..."
echo "时间: $(date)"
echo

echo "=== 第1步: 简中缩略图 ==="
python3 -u scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_cn_hd/pics_small \
  --r2-prefix cards_cn_small \
  --workers 8
echo "简中缩略图完成: $(date)"
echo

echo "=== 第2步: 简中高清图 ==="
python3 -u scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_cn_hd/pics \
  --r2-prefix cards_cn \
  --workers 4
echo "简中高清图完成: $(date)"
echo

echo "=== 第3步: 日文卡图 ==="
python3 -u scripts/upload_r2_cards.py \
  --local-dir ./cards/_merged_jp/pics \
  --r2-prefix cards_jp \
  --workers 6
echo "日文卡图完成: $(date)"
echo

echo "全部完成! $(date)"
