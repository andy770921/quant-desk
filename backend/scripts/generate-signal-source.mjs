#!/usr/bin/env node
/**
 * Generate `src/strategies/definitions/signal-source.generated.ts` from the
 * REAL source of each strategy's `decide()` function (plus the helper / indicator
 * functions it calls). This is what the UI shows as the "buy/sell formula", so it
 * can never drift from the code that actually runs.
 *
 *   node scripts/generate-signal-source.mjs           # (re)write the file
 *   node scripts/generate-signal-source.mjs --check    # fail (exit 1) if stale
 *
 * The extraction is a dependency-free, string/comment-aware scanner so it stays
 * byte-for-byte deterministic — `signal-source.spec.ts` relies on that to guard
 * against drift in CI.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFS_DIR = join(__dirname, '..', 'src', 'strategies', 'definitions');
const INDICATORS = join(__dirname, '..', 'src', 'strategies', 'indicators.ts');
const HELPERS = join(DEFS_DIR, '_helpers.ts');
const OUT = join(DEFS_DIR, 'signal-source.generated.ts');

/** Context method name → indicator function name (most map 1:1). */
const CTX_TO_INDICATOR = { accel: 'accelMomentum' };

/**
 * Walk `text` from the `{` at `open` and return the index of its matching `}`,
 * skipping braces inside line/block comments and string/template literals.
 */
function matchBrace(text, open) {
  let depth = 0;
  let line = false;
  let block = false;
  let str = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (line) {
      if (c === '\n') line = false;
      continue;
    }
    if (block) {
      if (c === '*' && n === '/') {
        block = false;
        i++;
      }
      continue;
    }
    if (str) {
      if (c === '\\') i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '/' && n === '/') {
      line = true;
      i++;
    } else if (c === '/' && n === '*') {
      block = true;
      i++;
    } else if (c === "'" || c === '"' || c === '`') {
      str = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unbalanced braces while scanning source');
}

/** End index (inclusive) of a statement starting at `start`, i.e. the `;` at depth 0. */
function endOfStatement(text, start) {
  let depth = 0;
  let line = false;
  let block = false;
  let str = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (line) {
      if (c === '\n') line = false;
      continue;
    }
    if (block) {
      if (c === '*' && n === '/') {
        block = false;
        i++;
      }
      continue;
    }
    if (str) {
      if (c === '\\') i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '/' && n === '/') {
      line = true;
      i++;
    } else if (c === '/' && n === '*') {
      block = true;
      i++;
    } else if (c === "'" || c === '"' || c === '`') {
      str = c;
    } else if (c === '{' || c === '(' || c === '[') {
      depth++;
    } else if (c === '}' || c === ')' || c === ']') {
      depth--;
    } else if (c === ';' && depth === 0) {
      return i;
    }
  }
  throw new Error('No statement terminator found');
}

/** Extract a single `export function NAME` / `export const NAME` declaration's source. */
function extractDeclaration(text, kind, nameStart) {
  if (kind === 'function') {
    const open = text.indexOf('{', nameStart);
    const close = matchBrace(text, open);
    return text.slice(nameStart, close + 1).trim();
  }
  const end = endOfStatement(text, nameStart);
  return text.slice(nameStart, end + 1).trim();
}

/** Index every exported function/const in a module: name → source text. */
function indexExports(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const index = {};
  const re = /export\s+(function|const)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(text))) {
    index[m[2]] = extractDeclaration(text, m[1], m.index);
  }
  return index;
}

/** Pull the `decide(...) { ... }` method source out of a strategy definition file. */
function extractDecide(text) {
  const m = /\bdecide\s*\(/.exec(text);
  if (!m) throw new Error('No decide() found');
  const open = text.indexOf('{', m.index);
  const close = matchBrace(text, open);
  return text.slice(m.index, close + 1);
}

/** Find which indexed helpers/indicators a decide() body references, in first-use order. */
function findRefs(decideSrc, registry) {
  const refs = [];
  const seen = new Set();
  const idRe = /[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = idRe.exec(decideSrc))) {
    const name = CTX_TO_INDICATOR[m[0]] ?? m[0];
    if (registry[name] && !seen.has(name)) {
      seen.add(name);
      refs.push({ name, source: registry[name] });
    }
  }
  return refs;
}

function build() {
  const registry = { ...indexExports(INDICATORS), ...indexExports(HELPERS) };
  const files = readdirSync(DEFS_DIR)
    .filter((f) => /^\d\d-.*\.ts$/.test(f))
    .sort();

  const entries = files.map((file) => {
    const text = readFileSync(join(DEFS_DIR, file), 'utf8');
    const id = /\bid:\s*'([^']+)'/.exec(text)?.[1];
    if (!id) throw new Error(`No id found in ${file}`);
    const decide = extractDecide(text);
    const refs = findRefs(decide, registry);
    return { id, decide, refs };
  });

  const body = entries
    .map(({ id, decide, refs }) => {
      const refLines = refs
        .map(
          (r) => `      { name: ${JSON.stringify(r.name)}, source: ${JSON.stringify(r.source)} },`,
        )
        .join('\n');
      return [
        `  ${JSON.stringify(id)}: {`,
        `    decide: ${JSON.stringify(decide)},`,
        refs.length ? `    refs: [\n${refLines}\n    ],` : `    refs: [],`,
        `  },`,
      ].join('\n');
    })
    .join('\n');

  return `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * The verbatim source of each strategy's decide() (and the helper / indicator
 * functions it calls), surfaced to the UI as the buy/sell signal formula so the
 * displayed math can never drift from the code that runs.
 *
 * Regenerate after editing any decide():
 *   cd backend && node scripts/generate-signal-source.mjs
 *
 * signal-source.spec.ts fails CI if this file is stale.
 */
import type { SignalSource } from '@repo/shared';

export const SIGNAL_SOURCE: Record<string, SignalSource> = {
${body}
};
`;
}

const generated = build();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    /* missing → stale */
  }
  if (current !== generated) {
    console.error(
      '✗ signal-source.generated.ts is out of date.\n  Run: cd backend && node scripts/generate-signal-source.mjs',
    );
    process.exit(1);
  }
  console.log('✓ signal-source.generated.ts is up to date.');
} else {
  writeFileSync(OUT, generated);
  console.log(`✓ Wrote ${OUT}`);
}
