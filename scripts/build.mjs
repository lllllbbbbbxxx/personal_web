import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "dist");

const rootStaticExtensions = new Set([
  ".css",
  ".html",
  ".ico",
  ".js",
  ".json",
  ".map",
  ".md",
  ".txt",
  ".webmanifest",
  ".xml",
]);

const excludedRootFiles = new Set(["package.json", "package-lock.json"]);

function getSourceFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: projectRoot },
  ).toString();

  return output
    .split("\0")
    .filter(Boolean)
    .filter((file) => {
      if (file.startsWith("assets/")) {
        return path.basename(file) !== ".gitkeep";
      }

      return (
        !file.includes("/") &&
        !excludedRootFiles.has(file) &&
        rootStaticExtensions.has(path.extname(file).toLowerCase())
      );
    });
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const sourceFiles = getSourceFiles();

for (const relativePath of sourceFiles) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

if (!sourceFiles.includes("index.html")) {
  throw new Error("Build failed: index.html was not included in dist.");
}

if (!sourceFiles.includes("项目档案.md")) {
  throw new Error("Build failed: project case data was not included in dist.");
}

console.log(`Build complete: ${sourceFiles.length} files written to dist/`);
