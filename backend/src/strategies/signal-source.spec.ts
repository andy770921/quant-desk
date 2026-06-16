import { execFileSync } from 'child_process';
import { join } from 'path';
import { SIGNAL_SOURCE } from './definitions/signal-source.generated';
import { STRATEGY_DEFINITIONS } from './definitions';

const GENERATOR = join(__dirname, '..', '..', 'scripts', 'generate-signal-source.mjs');

describe('signal-source.generated.ts', () => {
  it('is in sync with the real decide() source (run the generator to fix)', () => {
    // --check regenerates in-memory and exits non-zero if the committed file is
    // stale. This is the guard: no one can change a decide() without the UI
    // formula following, because CI fails until the file is regenerated.
    expect(() => execFileSync('node', [GENERATOR, '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('covers every registered strategy with a non-empty decide source', () => {
    for (const def of STRATEGY_DEFINITIONS) {
      const entry = SIGNAL_SOURCE[def.id];
      expect(entry).toBeDefined();
      expect(entry.decide).toContain('decide(');
      expect(Array.isArray(entry.refs)).toBe(true);
    }
  });
});
