import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import COS from "cos-nodejs-sdk-v5";
import { cacheControlFor, isCacheManagedAsset } from "./cache-policy.mjs";

const requiredEnvironment = [
  "TENCENT_SECRET_ID",
  "TENCENT_SECRET_KEY",
  "COS_BUCKET",
  "COS_REGION",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;
const mebibyte = 1024 * 1024;
const multipartThreshold = 5 * mebibyte;
const maxUploadAttempts = 4;
const transientCosErrorCodes = new Set([
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ESOCKETTIMEDOUT",
  "ETIMEDOUT",
  "InternalError",
  "RequestTimeout",
  "ServiceUnavailable",
  "SlowDown",
  "UserNetworkTooSlow",
]);
const distDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);

if (!/^[a-z0-9][a-z0-9-]*-\d+$/.test(bucket)) {
  throw new Error(
    "COS_BUCKET must be the full BucketName-APPID value.",
  );
}

const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY,
  ChunkRetryTimes: 3,
  FileParallelLimit: 3,
  ChunkParallelLimit: 3,
});

const contentTypes = new Map([
  [".bin", "application/octet-stream"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
  [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function callCos(method, parameters) {
  return new Promise((resolve, reject) => {
    cos[method](parameters, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isTransientCosError(error) {
  const statusCode = Number(error?.statusCode);

  return (
    transientCosErrorCodes.has(error?.code) ||
    statusCode === 408 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

function tagUploadError(error, fileKey) {
  const taggedError = new Error(
    error?.message ?? String(error ?? "Unknown COS upload error"),
    { cause: error },
  );
  taggedError.code = error?.code;
  taggedError.statusCode = error?.statusCode;
  taggedError.fileKey = fileKey;
  return taggedError;
}

async function withUploadRetry(fileKey, operation) {
  for (let attempt = 1; attempt <= maxUploadAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientCosError(error) || attempt === maxUploadAttempts) {
        throw tagUploadError(error, fileKey);
      }

      const delay = 1000 * 2 ** (attempt - 1);
      const code = error?.code ?? `HTTP ${error?.statusCode ?? "unknown"}`;
      console.warn(
        `Upload retry ${attempt}/${maxUploadAttempts - 1} for ${fileKey} after ${code}; waiting ${delay}ms.`,
      );
      await sleep(delay);
    }
  }

  throw new Error(`Upload retry loop ended unexpectedly for ${fileKey}.`);
}

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath, key)));
    } else if (entry.isFile()) {
      files.push({ key, absolutePath });
    }
  }

  return files;
}

async function md5File(filename) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function listRemoteObjects() {
  const objects = new Map();
  let marker;

  do {
    const response = await callCos("getBucket", {
      Bucket: bucket,
      Region: region,
      Marker: marker,
      MaxKeys: 1000,
    });

    for (const object of response.Contents ?? []) {
      objects.set(object.Key, String(object.ETag ?? "").replaceAll('"', ""));
    }

    const truncated =
      response.IsTruncated === true || response.IsTruncated === "true";
    marker = truncated ? response.NextMarker : undefined;
  } while (marker);

  return objects;
}

async function uploadFile(file) {
  const fileStat = await stat(file.absolutePath);
  const extension = path.extname(file.key).toLowerCase();

  await withUploadRetry(file.key, () =>
    callCos("uploadFile", {
      Bucket: bucket,
      Region: region,
      Key: file.key,
      FilePath: file.absolutePath,
      ContentLength: fileStat.size,
      ContentType:
        contentTypes.get(extension) ?? "application/octet-stream",
      ContentDisposition: "inline",
      CacheControl: cacheControlFor(file.key),
      SliceSize: multipartThreshold,
      ChunkSize: multipartThreshold,
    }),
  );

  const uploadMode =
    fileStat.size > multipartThreshold ? "multipart" : "single request";
  console.log(`Uploaded (${uploadMode}): ${file.key}`);
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  let firstError;

  async function runWorker() {
    while (!firstError && nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      try {
        await worker(item);
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  await Promise.allSettled(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      runWorker,
    ),
  );

  if (firstError) {
    throw firstError;
  }
}

async function deleteRemoteObjects(keys) {
  for (let index = 0; index < keys.length; index += 1000) {
    const batch = keys.slice(index, index + 1000);
    const response = await callCos("deleteMultipleObject", {
      Bucket: bucket,
      Region: region,
      Objects: batch.map((Key) => ({ Key })),
      Quiet: "false",
    });

    if (response.Error?.length) {
      const failedKeys = response.Error.map((item) => item.Key).join(", ");
      throw new Error(`COS failed to delete: ${failedKeys}`);
    }
  }
}

try {
  const localFiles = await walk(distDir);
  if (
    localFiles.length < 10 ||
    !localFiles.some((file) => file.key === "index.html")
  ) {
    throw new Error(
      "Safety check failed: dist is unexpectedly small or has no index.html; COS was not changed.",
    );
  }

  const remoteObjects = await listRemoteObjects();
  const localKeys = new Set(localFiles.map((file) => file.key));
  const staleKeys = [...remoteObjects.keys()]
    .filter((key) => !localKeys.has(key))
    .sort();

  console.log("Remote deletion preview (printed before any delete request):");
  if (staleKeys.length === 0) {
    console.log("  No stale COS objects will be deleted.");
  } else {
    for (const key of staleKeys) {
      console.log(`  DELETE ${key}`);
    }
  }

  const filesToUpload = [];
  let unchangedCount = 0;

  for (const file of localFiles) {
    const extension = path.extname(file.key).toLowerCase();
    const alwaysRefreshHeaders =
      extension === ".html" || isCacheManagedAsset(file.key);
    const localMd5 = await md5File(file.absolutePath);
    if (!alwaysRefreshHeaders && remoteObjects.get(file.key) === localMd5) {
      unchangedCount += 1;
    } else {
      filesToUpload.push(file);
    }
  }

  const htmlFiles = filesToUpload.filter(
    (file) => path.extname(file.key).toLowerCase() === ".html",
  );
  const assetFiles = filesToUpload.filter(
    (file) => path.extname(file.key).toLowerCase() !== ".html",
  );
  const largeAssetFiles = [];
  const regularAssetFiles = [];

  for (const file of assetFiles) {
    const fileStat = await stat(file.absolutePath);
    if (fileStat.size > multipartThreshold) {
      largeAssetFiles.push(file);
    } else {
      regularAssetFiles.push(file);
    }
  }

  console.log(
    `Sync plan: ${filesToUpload.length} upload(s), ${unchangedCount} unchanged, ${staleKeys.length} deletion(s).`,
  );
  console.log(
    `Upload plan: ${largeAssetFiles.length} multipart asset(s), ${regularAssetFiles.length} regular asset(s), ${htmlFiles.length} HTML file(s).`,
  );

  // Upload assets first and HTML last so new pages do not reference missing assets.
  await runWithConcurrency(largeAssetFiles, 2, uploadFile);
  await runWithConcurrency(regularAssetFiles, 4, uploadFile);
  await runWithConcurrency(htmlFiles, 4, uploadFile);

  // Stale objects are deleted only after their names were printed and uploads succeeded.
  if (staleKeys.length > 0) {
    await deleteRemoteObjects(staleKeys);
    console.log(`Deleted ${staleKeys.length} stale COS object(s).`);
  }

  console.log(
    `Deployment successful: ${localFiles.length} local object(s) synchronized to COS.`,
  );
} catch (error) {
  const code = error?.code ? ` [${error.code}]` : "";
  const message = error?.message ?? "Unknown COS deployment error";
  const file = error?.fileKey ? ` while uploading "${error.fileKey}"` : "";
  console.error(`Deployment failed${code}${file}: ${message}`);
  process.exitCode = 1;
}
