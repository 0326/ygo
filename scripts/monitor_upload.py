#!/usr/bin/env python3
"""
上传监控脚本 - 检查上传进度，必要时自动重启

用法: python3 scripts/monitor_upload.py <本地目录> <R2前缀> [并发数]
"""

import sys
import os
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
UPLOAD_SCRIPT = SCRIPT_DIR / "upload_r2_cards.py"


def get_progress_count(local_dir, r2_prefix):
    """读取进度文件中的已上传数量"""
    safe_name = f"{Path(local_dir).name}_{r2_prefix}".replace("/", "_")
    progress_file = SCRIPT_DIR / f".upload_progress_{safe_name}.json"
    try:
        import json
        with open(progress_file, "r") as f:
            data = json.load(f)
            return len(data.get("uploaded", []))
    except Exception:
        return 0


def is_process_running(local_dir):
    """检查是否有正在运行的上传进程"""
    try:
        result = subprocess.run(
            ["pgrep", "-f", f"upload_r2_cards.py.*{Path(local_dir).name}"],
            capture_output=True,
            text=True
        )
        return result.returncode == 0 and result.stdout.strip() != ""
    except Exception:
        return False


def start_upload(local_dir, r2_prefix, workers=32):
    """启动上传进程"""
    log_file = SCRIPT_DIR / f"upload_{Path(local_dir).name}.log"
    cmd = [
        sys.executable, "-u", str(UPLOAD_SCRIPT),
        "--local-dir", local_dir,
        "--r2-prefix", r2_prefix,
        "--workers", str(workers),
    ]
    print(f"启动上传: {' '.join(cmd)}")
    print(f"日志文件: {log_file}")
    with open(log_file, "a") as f:
        f.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} 启动 ===\n")
    subprocess.Popen(cmd, stdout=open(log_file, "a"), stderr=subprocess.STDOUT)


def main():
    if len(sys.argv) < 3:
        print("用法: python3 scripts/monitor_upload.py <本地目录> <R2前缀> [并发数]")
        sys.exit(1)

    local_dir = sys.argv[1]
    r2_prefix = sys.argv[2]
    workers = int(sys.argv[3]) if len(sys.argv) > 3 else 32

    local_dir = str(Path(local_dir).resolve())
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 检查上传状态...")
    print(f"  本地目录: {local_dir}")
    print(f"  R2 前缀: {r2_prefix}")

    progress_count = get_progress_count(local_dir, r2_prefix)
    print(f"  已上传: {progress_count}")

    running = is_process_running(local_dir)
    print(f"  进程运行中: {running}")

    if not running:
        print("  进程未运行，正在启动...")
        start_upload(local_dir, r2_prefix, workers)
        print("  启动完成")
    else:
        print("  进程运行正常")


if __name__ == "__main__":
    main()
