import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

const execAsync = promisify(exec);

const BUCKET = "ygo-cards";
const CONCURRENCY = parseInt(process.env.UPLOAD_WORKERS || "8");

async function uploadFile(localPath, r2Key) {
  try {
    await execAsync(
      `npx wrangler r2 object put ${BUCKET}/${r2Key} --file "${localPath}" --remote`,
      { timeout: 60000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function* chunks(arr, n) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

async function main() {
  const localDir = process.argv[2];
  const r2Prefix = process.argv[3];

  if (!localDir || !r2Prefix) {
    console.error("用法: node upload_r2.mjs <本地目录> <R2前缀>");
    process.exit(1);
  }

  console.log(`扫描目录: ${localDir}`);
  const files = (await readdir(localDir))
    .filter(f => f.endsWith(".jpg"))
    .sort();

  console.log(`共 ${files.length} 个文件`);
  console.log(`并发数: ${CONCURRENCY}`);
  console.log();

  let uploaded = 0;
  let failed = 0;
  const startTime = Date.now();
  let lastPrint = startTime;

  for await (const batch of chunks(files, CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(async (file) => {
        const localPath = join(localDir, file);
        const r2Key = `${r2Prefix}/${file}`;
        const ok = await uploadFile(localPath, r2Key);
        return { file, ok };
      })
    );

    for (const r of results) {
      if (r.ok) uploaded++;
      else failed++;
    }

    const now = Date.now();
    if (now - lastPrint > 2000) {
      const elapsed = (now - startTime) / 1000;
      const rate = uploaded / elapsed;
      const remaining = files.length - uploaded - failed;
      const eta = rate > 0 ? remaining / rate : 0;
      const pct = ((uploaded + failed) / files.length * 100).toFixed(1);
      process.stdout.write(
        `\r进度: ${uploaded + failed}/${files.length} (${pct}%) | 成功: ${uploaded} | 失败: ${failed} | 速度: ${rate.toFixed(1)}/秒 | ETA: ${eta.toFixed(0)}秒`
      );
      lastPrint = now;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n\n完成!`);
  console.log(`成功: ${uploaded}`);
  console.log(`失败: ${failed}`);
  console.log(`耗时: ${elapsed.toFixed(1)}秒`);
  console.log(`速度: ${(uploaded / elapsed).toFixed(1)}/秒`);
}

main().catch(console.error);
