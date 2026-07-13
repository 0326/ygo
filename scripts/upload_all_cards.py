#!/usr/bin/env python3
"""
一键上传所有卡图到 Cloudflare R2

使用方式：
    python3 scripts/upload_all_cards.py
    python3 scripts/upload_all_cards.py --cards-dir ./cards

需要环境：
    - Node.js + wrangler (已登录 Cloudflare)
    - Python 3.8+
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
UPLOAD_SCRIPT = SCRIPT_DIR / "upload_r2_cards.py"

DEFAULT_UPLOADS = [
    {
        "name": "简中缩略图",
        "subdir": "_merged_cn_hd/pics_small",
        "r2_prefix": "cards_cn_small",
    },
    {
        "name": "简中高清图",
        "subdir": "_merged_cn_hd/pics",
        "r2_prefix": "cards_cn",
    },
    {
        "name": "日文卡图",
        "subdir": "_merged_jp/pics",
        "r2_prefix": "cards_jp",
    },
]


def run_upload(cards_dir, upload_config, bucket, workers):
    """运行单个上传任务"""
    local_dir = cards_dir / upload_config["subdir"]
    if not local_dir.exists():
        print(f"\n跳过 {upload_config['name']}: 目录不存在 {local_dir}")
        return False

    print(f"\n{'='*60}")
    print(f"开始上传: {upload_config['name']}")
    print(f"本地目录: {local_dir}")
    print(f"R2 前缀: {upload_config['r2_prefix']}")
    print(f"{'='*60}")

    cmd = [
        sys.executable,
        str(UPLOAD_SCRIPT),
        "--local-dir", str(local_dir),
        "--r2-prefix", upload_config["r2_prefix"],
        "--bucket", bucket,
        "--workers", str(workers),
    ]

    result = subprocess.run(cmd)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="一键上传所有卡图到 Cloudflare R2")
    parser.add_argument("--cards-dir", default="./cards", help="卡图根目录 (默认: ./cards)")
    parser.add_argument("--bucket", default="ygo-cards", help="R2 Bucket 名称 (默认: ygo-cards)")
    parser.add_argument("--workers", type=int, default=4, help="并发线程数 (默认: 4)")
    args = parser.parse_args()

    cards_dir = Path(args.cards_dir).resolve()

    print(f"卡图根目录: {cards_dir}")
    print(f"R2 Bucket: {args.bucket}")
    print(f"并发数: {args.workers}")
    print()

    success_count = 0
    for config in DEFAULT_UPLOADS:
        if run_upload(cards_dir, config, args.bucket, args.workers):
            success_count += 1

    print(f"\n\n{'='*60}")
    print(f"全部完成! 成功 {success_count}/{len(DEFAULT_UPLOADS)} 个任务")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
