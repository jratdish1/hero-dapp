import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const outputRoot = path.resolve(process.cwd(), "dist/public");
const manifestPath = path.join(outputRoot, ".vite/manifest.json");
const budgetBytes = Number.parseInt(
  process.env.LANDING_GZIP_BUDGET_BYTES || "400000",
  10,
);

if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
  throw new Error("LANDING_GZIP_BUDGET_BYTES must be a positive integer");
}
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Vite manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entryRecord =
  Object.entries(manifest).find(
    ([, chunk]) =>
      chunk?.isEntry &&
      (chunk.src === "src/main.tsx" || chunk.src === "client/src/main.tsx"),
  ) || Object.entries(manifest).find(([, chunk]) => chunk?.isEntry);

if (!entryRecord) throw new Error("Unable to identify the Vite entry chunk");

const [entryKey] = entryRecord;
const visitedChunks = new Set();
const outputFiles = new Set();

function visitStaticChunk(key) {
  if (visitedChunks.has(key)) return;
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Manifest references missing static chunk: ${key}`);
  visitedChunks.add(key);
  if (chunk.file) outputFiles.add(chunk.file);
  for (const cssFile of chunk.css || []) outputFiles.add(cssFile);
  for (const importedKey of chunk.imports || []) visitStaticChunk(importedKey);
}

visitStaticChunk(entryKey);

const forbiddenPattern = /(web3|connect-evm|wagmi|walletconnect|reown|data-layer)/i;
const forbiddenFiles = [...outputFiles].filter((file) => forbiddenPattern.test(file));
if (forbiddenFiles.length > 0) {
  throw new Error(
    `Landing static graph includes prohibited DApp chunks: ${forbiddenFiles.join(", ")}`,
  );
}

const details = [...outputFiles]
  .sort()
  .map((relativeFile) => {
    const absoluteFile = path.join(outputRoot, relativeFile);
    if (!fs.existsSync(absoluteFile)) {
      throw new Error(`Landing graph output is missing: ${relativeFile}`);
    }
    const source = fs.readFileSync(absoluteFile);
    return {
      file: relativeFile,
      rawBytes: source.byteLength,
      gzipBytes: gzipSync(source, { level: 9 }).byteLength,
    };
  });

const totalGzipBytes = details.reduce((sum, item) => sum + item.gzipBytes, 0);
console.log(`Landing entry: ${entryKey}`);
for (const item of details) {
  console.log(`${item.file}: raw=${item.rawBytes} gzip=${item.gzipBytes}`);
}
console.log(`Landing static gzip total: ${totalGzipBytes} bytes`);
console.log(`Landing static gzip budget: ${budgetBytes} bytes`);

if (totalGzipBytes > budgetBytes) {
  throw new Error(
    `Landing static graph exceeds gzip budget by ${totalGzipBytes - budgetBytes} bytes`,
  );
}

console.log("Landing bundle gate: PASS");
