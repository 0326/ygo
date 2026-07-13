import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, readdir, stat } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const BUCKET = "ygo-cards";
const CONCURRENCY = parseInt(process.env.UPLOAD_WORKERS || "32");

async function loadProgress(progressFile) {
  try {
    const data = await readFile(progressFile, "utf-8");
    return new Set(JSON.parse(data).uploaded);
  } catch {
    return new Set();
  }
}

async function saveProgress(progressFile, uploaded) {
  try {
    await writeFile(progressFile, JSON.stringify({ uploaded: [...uploaded] }));
  } catch {}
}

function getProgressFile(localDir, r2Prefix) {
  const safeName = `${basename(localDir)}_${r2Prefix}`.replace(/\//g, "_");
  return join(import.meta.dirname, `.upload_progress_${safeName}.json`);
}

async function checkExists(s3, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw e;
  }
}

async function uploadFile(s3, filePath, key, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const stream = createReadStream(filePath);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: stream,
      }));
      return true;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  return false;
}

async function main() {
  const localDir = process.argv[2];
  const r2Prefix = process.argv[3];

  if (!localDir || !r2Prefix) {
    console.error("用法: node scripts/upload_r2_fast.mjs <本地目录> <R2前缀>");
    console.error("");
    console.error("需要环境变量:");
    console.error("  R2_ACCOUNT_ID  - Cloudflare Account ID");
    console.error("  R2_ACCESS_KEY  - R2 Access Key ID");
    console.error("  R2_SECRET_KEY  - R2 Secret Access Key");
    process.exit(1);
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY;
  const secretKey = process.env.R2_SECRET_KEY;

  if (!accountId || !accessKey || !secretKey) {
    console.error("错误: 缺少 R2 凭证环境变量");
    console.error("请设置 R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY");
    process.exit(1);
  }

  console.log(`扫描目录: ${localDir}`);
  const files = (await readdir(localDir))
    .filter(f => f.endsWith(".jpg"))
    .sort();

  console.log(`共 ${files.length} 个文件`);
  console.log(`并发数: ${CONCURRENCY}`);

  const progressFile = getProgressFile(localDir, r2Prefix);
  const uploadedSet = await loadProgress(progressFile);
  console.log(`已记录上传: ${uploadedSet.size} 个`);
  console.log();

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedFiles = [];
  const startTime = Date.now();
  let lastSave = 0;

  const queue = [...files];
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const i = index++;
      const file = queue[i];
      const key = `${r2Prefix}/${file}`;

      if (uploadedSet.has(file)) {
        skipped++;
        continue;
      }

      try {
        const exists = await checkExists(s3, key);
        if (exists) {
          skipped++;
          uploadedSet.add(file);
          continue;
        }
      } catch {}

      const ok = await uploadFile(s3, join(localDir, file), key);
      if (ok) {
        uploaded++;
        uploadedSet.add(file);
      } else {
        failed++;
        failedFiles.push(file);
      }

      const now = Date.now();
      if (now - lastSave > 5000) {
        await saveProgress(progressFile, uploadedSet);
        lastSave = now;
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());

  const monitor = setInterval(() => {
    const done = uploaded + skipped + failed;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const remaining = files.length - done;
    const eta = rate > 0 ? remaining / rate : 0;
    const pct = (done / files.length * 100).toFixed(1);
    process.stdout.write(
      `\r进度: ${done}/${files.length} (${pct}%) | 新传: ${uploaded} | 跳过: ${skipped} | 失败: ${failed} | 速度: ${rate.toFixed(1)}/秒 | ETA: ${eta.toFixed(0)}秒`
    );
  }, 500);

  await Promise.all(workers);
  clearInterval(monitor);

  await saveProgress(progressFile, uploadedSet);

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n\n完成!`);
  console.log(`新传: ${uploaded}`);
  console.log(`跳过: ${skipped}`);
  console.log(`失败: ${failed}`);
  if (failedFiles.length > 0) {
    console.log(`失败文件 (前20):`);
    failedFiles.slice(0, 20).forEach(f => console.log(`  - ${f}`));
    if (failedFiles.length > 20) {
      console.log(`  ... 还有 ${failedFiles.length - 20} 个`);
    }
  }
  console.log(`耗时: ${elapsed.toFixed(1)}秒`);
  console.log(`速度: ${(uploaded / elapsed).toFixed(1)}/秒`);
  console.log(`进度文件: ${progressFile}`);
}

main().catch(console.error);
