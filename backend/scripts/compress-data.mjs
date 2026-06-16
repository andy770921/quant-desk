// @ts-check
/**
 * Gzip-compresses the large market-data JSON files in `backend/data/` in place,
 * replacing each `*.json` with a `*.json.gz` (and removing the original), so the
 * deployed Vercel serverless function bundle stays under the 250 MB unzipped
 * limit. The bundle counts files at their on-disk size, and Vercel does NOT
 * decompress our data files — so a committed `.json.gz` only costs its
 * compressed bytes (~3-4x smaller for this dataset).
 *
 * `MarketDataService` reads these transparently: it prefers a plain `.json`
 * (fresh from a fetch script) and falls back to `.json.gz` (see readJsonFile).
 *
 * Manifests and per-stock `meta.json` are intentionally left uncompressed:
 * they are tiny and `manifest.json` is the marker resolveDataDir() looks for.
 *
 * Usage:
 *   node scripts/compress-data.mjs           # compress data/ in place
 *
 * Workflow: run AFTER any fetch (fetch-market-data / fetch-stocks), then commit
 * the resulting `.json.gz` files before deploying.
 */
import { readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');

/** Files we never compress (kept as plain JSON markers / tiny metadata). */
const SKIP = new Set(['manifest.json', 'meta.json']);

/** Recursively yield every file path under `dir`. */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  let files = 0;
  let origBytes = 0;
  let gzBytes = 0;

  for await (const file of walk(DATA_DIR)) {
    if (!file.endsWith('.json')) continue; // skip already-compressed .gz and others
    const base = file.slice(file.lastIndexOf('/') + 1);
    if (SKIP.has(base)) continue;

    const raw = await readFile(file);
    const gz = gzipSync(raw, { level: 9 });
    await writeFile(`${file}.gz`, gz);
    await unlink(file);

    files++;
    origBytes += raw.length;
    gzBytes += gz.length;
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  const ratio = gzBytes ? (origBytes / gzBytes).toFixed(1) : '0';
  console.log(
    `Compressed ${files} files: ${mb(origBytes)} MB -> ${mb(gzBytes)} MB (${ratio}x smaller)`,
  );

  // Report the resulting on-disk size of the whole data dir (what counts toward
  // the 250 MB function limit).
  let total = 0;
  for await (const f of walk(DATA_DIR)) total += (await stat(f)).size;
  console.log(`data/ on-disk total now: ${mb(total)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
