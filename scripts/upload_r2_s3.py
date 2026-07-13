#!/usr/bin/env python3
"""
Cloudflare R2 卡图批量上传脚本 - S3 API 版本（更快）

使用 Cloudflare R2 的 S3 兼容 API 直接上传，避免每次启动 wrangler 进程的开销。

功能：
- 支持断点续传（本地进度记录 + R2 存在性检查）
- 多线程并发上传
- 进度显示和 ETA 预估
- 失败自动重试

使用方式：
    python3 scripts/upload_r2_s3.py --local-dir ./cards/_merged_cn_hd/pics_small --r2-prefix cards_cn_small

需要环境：
    - Python 3.8+
    - boto3 (pip install boto3)
    - 环境变量 CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
"""

import os
import sys
import threading
import time
import argparse
import queue
import json
from pathlib import Path

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
except ImportError:
    print("错误: 缺少 boto3，请先运行: pip install boto3")
    sys.exit(1)

progress_lock = threading.Lock()
total_uploaded = 0
total_skipped = 0
total_failed = 0
total_files = 0
failed_files = []
uploaded_set = set()


def get_progress_file(local_dir, r2_prefix):
    safe_name = f"{Path(local_dir).name}_{r2_prefix}".replace("/", "_")
    return Path(__file__).parent / f".upload_progress_{safe_name}.json"


def load_progress(progress_file):
    if progress_file.exists():
        try:
            with open(progress_file, "r") as f:
                data = json.load(f)
                return set(data.get("uploaded", []))
        except Exception:
            pass
    return set()


def save_progress(progress_file, uploaded):
    try:
        with open(progress_file, "w") as f:
            json.dump({"uploaded": list(uploaded)}, f)
    except Exception:
        pass


def create_s3_client(account_id, access_key, secret_key):
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )


def check_file_exists(s3, bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def upload_file(s3, bucket, local_path, r2_key, progress_file, max_retries=3):
    global total_uploaded, total_skipped, total_failed, failed_files, uploaded_set

    filename = Path(r2_key).name
    if filename in uploaded_set:
        with progress_lock:
            total_skipped += 1
        return True

    try:
        if check_file_exists(s3, bucket, r2_key):
            with progress_lock:
                total_skipped += 1
                uploaded_set.add(filename)
            return True
    except Exception:
        pass

    for attempt in range(max_retries):
        try:
            s3.upload_file(local_path, bucket, r2_key)
            with progress_lock:
                total_uploaded += 1
                uploaded_set.add(filename)
                if total_uploaded % 100 == 0:
                    save_progress(progress_file, uploaded_set)
            return True
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    with progress_lock:
        total_failed += 1
        failed_files.append(r2_key)
    return False


def worker(s3, bucket, file_queue, progress_file):
    while True:
        item = file_queue.get()
        if item is None:
            break
        local_path, r2_key = item
        upload_file(s3, bucket, local_path, r2_key, progress_file)
        file_queue.task_done()


def progress_monitor(progress_interval):
    global total_uploaded, total_skipped, total_failed, total_files
    start_time = time.time()
    last_count = 0
    last_time = start_time

    while True:
        time.sleep(progress_interval)
        with progress_lock:
            current = total_uploaded + total_skipped + total_failed
            uploaded = total_uploaded
            skipped = total_skipped
            failed = total_failed

        if current >= total_files:
            break

        elapsed = time.time() - start_time
        rate = (current - last_count) / (time.time() - last_time) if time.time() - last_time > 0 else 0
        last_count = current
        last_time = time.time()

        remaining = total_files - current
        eta = remaining / rate if rate > 0 else 0

        pct = current / total_files * 100 if total_files > 0 else 0
        print(
            f"\r进度: {current}/{total_files} ({pct:.1f}%) | "
            f"新传: {uploaded} | 跳过: {skipped} | 失败: {failed} | "
            f"速度: {rate:.1f}/秒 | ETA: {eta:.0f}秒",
            end="",
            flush=True
        )


def main():
    global total_files, uploaded_set

    parser = argparse.ArgumentParser(description="批量上传卡图到 Cloudflare R2 (S3 API 版本)")
    parser.add_argument("--local-dir", required=True, help="本地卡图目录")
    parser.add_argument("--r2-prefix", required=True, help="R2 前缀（如 cards_cn_small）")
    parser.add_argument("--bucket", default="ygo-cards", help="R2 Bucket 名称 (默认: ygo-cards)")
    parser.add_argument("--workers", type=int, default=8, help="并发线程数 (默认: 8)")
    parser.add_argument("--progress-interval", type=int, default=2, help="进度刷新间隔秒数 (默认: 2)")
    parser.add_argument("--pattern", default="*.jpg", help="文件匹配模式 (默认: *.jpg)")
    parser.add_argument("--reset-progress", action="store_true", help="重置上传进度")
    parser.add_argument("--account-id", help="Cloudflare Account ID (或环境变量 CLOUDFLARE_ACCOUNT_ID)")
    parser.add_argument("--access-key", help="R2 Access Key ID (或环境变量 R2_ACCESS_KEY_ID)")
    parser.add_argument("--secret-key", help="R2 Secret Access Key (或环境变量 R2_SECRET_ACCESS_KEY)")
    args = parser.parse_args()

    account_id = args.account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    access_key = args.access_key or os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = args.secret_key or os.environ.get("R2_SECRET_ACCESS_KEY")

    if not account_id:
        print("错误: 缺少 Account ID，请设置 CLOUDFLARE_ACCOUNT_ID 环境变量或使用 --account-id 参数")
        sys.exit(1)
    if not access_key:
        print("错误: 缺少 Access Key，请设置 R2_ACCESS_KEY_ID 环境变量或使用 --access-key 参数")
        sys.exit(1)
    if not secret_key:
        print("错误: 缺少 Secret Key，请设置 R2_SECRET_ACCESS_KEY 环境变量或使用 --secret-key 参数")
        sys.exit(1)

    local_dir = Path(args.local_dir).resolve()
    if not local_dir.exists():
        print(f"错误: 目录不存在: {local_dir}")
        sys.exit(1)

    progress_file = get_progress_file(args.local_dir, args.r2_prefix)
    if args.reset_progress and progress_file.exists():
        progress_file.unlink()
        print("已重置上传进度", flush=True)

    uploaded_set = load_progress(progress_file)
    print(f"已记录上传: {len(uploaded_set)} 个文件", flush=True)

    print("扫描文件...", flush=True)
    all_files = []
    for f in sorted(local_dir.glob(args.pattern)):
        if f.is_file():
            r2_key = f"{args.r2_prefix}/{f.name}"
            all_files.append((str(f), r2_key))

    total_files = len(all_files)
    print(f"共 {total_files} 个文件待处理", flush=True)
    print(f"本地目录: {local_dir}", flush=True)
    print(f"R2 路径: {args.bucket}/{args.r2_prefix}/", flush=True)
    print(f"并发数: {args.workers}", flush=True)
    print(f"进度文件: {progress_file}", flush=True)
    print("开始上传...", flush=True)
    print()

    s3 = create_s3_client(account_id, access_key, secret_key)

    file_queue = queue.Queue(maxsize=args.workers * 2)

    threads = []
    for _ in range(args.workers):
        t = threading.Thread(target=worker, args=(s3, args.bucket, file_queue, progress_file))
        t.start()
        threads.append(t)

    monitor = threading.Thread(target=progress_monitor, args=(args.progress_interval,))
    monitor.daemon = True
    monitor.start()

    for item in all_files:
        file_queue.put(item)

    for _ in range(args.workers):
        file_queue.put(None)

    for t in threads:
        t.join()

    save_progress(progress_file, uploaded_set)

    print(f"\n\n{'='*50}", flush=True)
    print("上传完成!", flush=True)
    print(f"  新上传: {total_uploaded}", flush=True)
    print(f"  跳过(已存在): {total_skipped}", flush=True)
    print(f"  失败: {total_failed}", flush=True)
    if failed_files:
        print(f"  失败列表:", flush=True)
        for f in failed_files[:20]:
            print(f"    - {f}", flush=True)
        if len(failed_files) > 20:
            print(f"    ... 还有 {len(failed_files) - 20} 个", flush=True)
    print(f"\n进度已保存到: {progress_file}", flush=True)


if __name__ == "__main__":
    main()
