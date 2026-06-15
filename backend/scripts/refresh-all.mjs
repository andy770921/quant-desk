// @ts-check
/**
 * Convenience entry point for the scheduled (cron) data refresh: re-fetches the
 * core index/ETF/yield series, then re-fetches whatever individual stocks are
 * already tracked (from data/stocks/manifest.json). One command for cron to call.
 *
 *   node scripts/refresh-all.mjs
 *
 * See README.md in this folder for the recommended schedule.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const run = (script, args = []) =>
  execFileSync('node', [join(__dirname, script), ...args], { stdio: 'inherit' });

console.log('[refresh-all] 1/2 core index/ETF/yield series…');
run('fetch-market-data.mjs');

const stocksManifest = join(__dirname, '..', 'data', 'stocks', 'manifest.json');
if (existsSync(stocksManifest)) {
  const symbols = JSON.parse(readFileSync(stocksManifest, 'utf8')).map((s) => s.symbol);
  if (symbols.length) {
    console.log(`[refresh-all] 2/2 ${symbols.length} tracked stocks…`);
    run('fetch-stocks.mjs', symbols);
  }
} else {
  console.log('[refresh-all] 2/2 no stocks tracked yet — skipping.');
}
console.log('[refresh-all] done.');
