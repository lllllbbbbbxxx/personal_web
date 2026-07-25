import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  cacheControlFor,
  hasContentHash,
  isCacheManagedAsset,
} from "./cache-policy.mjs";

const distDir = path.resolve("dist");

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath, key)));
    } else if (entry.isFile()) {
      files.push(key);
    }
  }

  return files;
}

const files = (await walk(distDir)).sort();
const managedFiles = files.filter(
  (key) =>
    path.extname(key).toLowerCase() === ".html" ||
    isCacheManagedAsset(key),
);

let immutableCount = 0;
let hourlyCount = 0;
let htmlCount = 0;

console.log("Cache policy report:");

for (const key of managedFiles) {
  const policy = cacheControlFor(key);
  const hashed = hasContentHash(key);

  if (path.extname(key).toLowerCase() === ".html") {
    htmlCount += 1;
  } else if (hashed) {
    immutableCount += 1;
  } else {
    hourlyCount += 1;
  }

  console.log(`  ${key}`);
  console.log(`    content-hash: ${hashed ? "yes" : "no"}`);
  console.log(`    Cache-Control: ${policy}`);
}

if (cacheControlFor("index.html") !== "no-cache, must-revalidate") {
  throw new Error("index.html cache policy is invalid.");
}

for (const key of managedFiles) {
  const extension = path.extname(key).toLowerCase();
  const expected =
    extension === ".html"
      ? "no-cache, must-revalidate"
      : hasContentHash(key)
        ? "public,max-age=31536000,immutable"
        : "public,max-age=3600";
  const actual = cacheControlFor(key);

  if (actual !== expected) {
    throw new Error(
      `Invalid cache policy for ${key}: expected "${expected}", got "${actual}".`,
    );
  }
}

console.log(
  `Cache policy verified: ${htmlCount} HTML, ${immutableCount} hashed immutable asset(s), ${hourlyCount} unhashed hourly asset(s).`,
);
