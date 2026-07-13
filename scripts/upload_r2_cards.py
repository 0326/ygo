#!/usr/bin/env python3
"""
Cloudflare R2 卡图批量上传脚本

功能：
- 支持断点续传（跳过已上传的文件，本地进度记录）
- 多线程并发上传
- 进度显示和 ETA 预估
- 支持目录配置
- 失败自动重试
- 自动清理 wrangler 日志

使用方式：
    python3 scripts/upload_r2_cards.py --local-dir ./cards/_merged_cn_hd/pics_small --r2-prefix cards_cn_small

需要环境：
    - Node.js + wrangler (已登录 Cloudflare)
    - Python 3.8+
"""

import os
import sys
import subprocess
import threading
import time
import argparse
import queue
import json
import tempfile
from pathlib import Path

progress_lock = threading.Lock()
total_uploaded = 0
total_skipped = 0
total_failed = 0
total_files = 0
failed_files = []
uploaded_set = set()
log_cleanup_counter = 0
LOG_CLEANUP_INTERVAL = 20


def get_progress_file(local_dir, r2_prefix):
    """获取进度记录文件路径"""
    safe_name = f"{Path(local_dir).name}_{r2_prefix}".replace("/", "_")
    return Path(__file__).parent / f".upload_progress_{safe_name}.json"


def load_progress(progress_file):
    """加载已上传文件列表"""
    if progress_file.exists():
        try:
            with open(progress_file, "r") as f:
                data = json.load(f)
                return set(data.get("uploaded", []))
        except Exception:
            pass
    return set()


def save_progress(progress_file, uploaded):
    """保存已上传文件列表"""
    try:
        with open(progress_file, "w") as f:
            json.dump({"uploaded": list(uploaded)}, f)
    except Exception:
        pass


def check_wrangler():
    """检查 wrangler 是否可用"""
    try:
        result = subprocess.run(
            ["npx", "wrangler", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except Exception:
        return False


def cleanup_wrangler_logs():
    """清理 wrangler 日志文件"""
    # 清理项目内的 wrangler 日志
    log_dir = Path(__file__).parent.parent / ".wrangler_home" / "Library" / "Preferences" / ".wrangler" / "logs"
    if log_dir.exists():
        try:
            for log_file in log_dir.glob("*.log"):
                try:
                    log_file.unlink()
                except Exception:
                    pass
        except Exception:
            pass


def log_cleanup_worker(interval=10):
    """后台定时清理日志的线程"""
    while not _stop_cleanup.is_set():
        cleanup_wrangler_logs()
        time.sleep(interval)


_stop_cleanup = threading.Event()


def get_wrangler_env():
    """获取 wrangler 运行环境，将日志重定向到项目内临时目录"""
    env = os.environ.copy()
    env["WRANGLER_LOG"] = "error"
    # macOS 上 wrangler 用 $HOME/Library/Preferences/.wrangler/ 作为配置目录
    wrangler_home = Path(__file__).parent.parent / ".wrangler_home"
    wrangler_config_dir = wrangler_home / "Library" / "Preferences" / ".wrangler"
    wrangler_log_dir = wrangler_config_dir / "logs"
    wrangler_log_dir.mkdir(parents=True, exist_ok=True)
    # 复制认证配置
    config_src = Path.home() / "Library" / "Preferences" / ".wrangler" / "config"
    config_dst = wrangler_config_dir / "config"
    config_dst.mkdir(exist_ok=True)
    if config_src.exists():
        import shutil
        for f in config_src.iterdir():
            dst_file = config_dst / f.name
            if not dst_file.exists():
                try:
                    shutil.copy2(f, dst_file)
                except Exception:
                    pass
    env["HOME"] = str(wrangler_home)
    return env


def upload_file(bucket, local_path, r2_key, progress_file, max_retries=3):
    """上传单个文件，支持重试"""
    global total_uploaded, total_skipped, total_failed, failed_files
    global uploaded_set, log_cleanup_counter

    filename = Path(r2_key).name
    if filename in uploaded_set:
        with progress_lock:
            total_skipped += 1
        return True

    env = get_wrangler_env()

    for attempt in range(max_retries):
        try:
            result = subprocess.run(
                [
                    "npx", "wrangler", "r2", "object", "put",
                    f"{bucket}/{r2_key}",
                    "--file", local_path,
                    "--remote"
                ],
                capture_output=True,
                text=True,
                timeout=60,
                env=env
            )
            if result.returncode == 0:
                with progress_lock:
                    total_uploaded += 1
                    uploaded_set.add(filename)
                    log_cleanup_counter += 1
                    if log_cleanup_counter >= LOG_CLEANUP_INTERVAL:
                        log_cleanup_counter = 0
                        cleanup_wrangler_logs()
                        save_progress(progress_file, uploaded_set)
                return True
        except subprocess.TimeoutExpired:
            pass
        except Exception:
            pass

        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)

    with progress_lock:
        total_failed += 1
        failed_files.append(r2_key)
    return False


def worker(bucket, file_queue, progress_file):
    """工作线程"""
    while True:
        item = file_queue.get()
        if item is None:
            break
        local_path, r2_key = item
        upload_file(bucket, local_path, r2_key, progress_file)
        file_queue.task_done()


def progress_monitor(progress_interval):
    """进度监控线程"""
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

    parser = argparse.ArgumentParser(description="批量上传卡图到 Cloudflare R2")
    parser.add_argument("--local-dir", required=True, help="本地卡图目录")
    parser.add_argument("--r2-prefix", required=True, help="R2 前缀（如 cards_cn_small）")
    parser.add_argument("--bucket", default="ygo-cards", help="R2 Bucket 名称 (默认: ygo-cards)")
    parser.add_argument("--workers", type=int, default=4, help="并发线程数 (默认: 4)")
    parser.add_argument("--progress-interval", type=int, default=5, help="进度刷新间隔秒数 (默认: 5)")
    parser.add_argument("--pattern", default="*.jpg", help="文件匹配模式 (默认: *.jpg)")
    parser.add_argument("--reset-progress", action="store_true", help="重置上传进度，重新上传所有文件")
    args = parser.parse_args()

    if not check_wrangler():
        print("错误: 找不到 wrangler，请先安装 Node.js 并运行 npm install")
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

    cleanup_wrangler_logs()
    _stop_cleanup.clear()
    cleanup_thread = threading.Thread(target=log_cleanup_worker, args=(5,), daemon=True)
    cleanup_thread.start()

    file_queue = queue.Queue(maxsize=args.workers * 2)

    threads = []
    for _ in range(args.workers):
        t = threading.Thread(target=worker, args=(args.bucket, file_queue, progress_file))
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

    _stop_cleanup.set()
    save_progress(progress_file, uploaded_set)
    cleanup_wrangler_logs()

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
    print("重新运行脚本会自动跳过已上传的文件", flush=True)


if __name__ == "__main__":
    main()
