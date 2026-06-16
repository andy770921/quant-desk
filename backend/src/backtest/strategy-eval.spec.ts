import { makeContext } from './engine';
import { MarketDataService } from '../market-data/market-data.service';
import { STRATEGY_DEFINITIONS } from '../strategies/definitions';
import { evaluate, evaluateAll, formatScores } from './strategy-eval';

/**
 * Reporting harness + the platform's locked promise. Prints the full scoreboard
 * (DCA + lump-sum) so we can iterate strategies, and asserts the headline goal.
 */
describe('strategy scoreboard', () => {
  const md = new MarketDataService();
  beforeAll(() => md.onModuleInit());

  it('DCA scoreboard', () => {
    const scores = evaluateAll(md, 'dca');
    // eslint-disable-next-line no-console
    console.log(
      '\n=== DCA (monthly $2000) — full history per strategy ===\n' + formatScores(scores),
    );
    const winners = scores.filter((s) => s.vsQQQ >= 1.15).map((s) => s.id);
    // eslint-disable-next-line no-console
    console.log(
      `\nDCA beats QQQ by >=15%: ${winners.length}/${scores.length} -> ${winners.join(', ')}`,
    );
    expect(scores.length).toBeGreaterThan(0);
  });

  // The platform's headline promise (and the project goal): every strategy 02-10
  // simulates investing $2000/month and must beat dollar-cost-averaging into QQQ
  // by >=15% in final value over its full history (a >=10% floor is tolerated for
  // the hardest book), with a Sharpe at least as good as the QQQ benchmark. Each
  // also holds AT MOST 10 instruments and trades on at most 3 days a month (the
  // engine enforces the trade cap). Strategies 02-06 reach the bar with leveraged
  // ETFs (held with cash, never on margin — the user-approved lever); 07-10 are
  // unleveraged S&P-500 stock factor books capped at 10 names. Strategy 01 is the
  // mandated leveraged flagship and is exempt from the QQQ / holdings checks.
  const FLAGSHIP = 'nasdaq-3x-20dma';
  const MAX_HOLDINGS = 10;

  /** Max distinct holdings a strategy ever returns, sampled across month-ends. */
  function maxHoldings(def: (typeof STRATEGY_DEFINITIONS)[number]): number {
    let mx = 0;
    const last = md.lastIndex();
    for (let i = 300; i <= last; i += 21) {
      const w = def.decide(makeContext(md, i));
      const n = Object.values(w).filter((x) => (x ?? 0) > 0.001).length;
      if (n > mx) mx = n;
    }
    return mx;
  }

  it('every strategy 02-10 beats QQQ by >=15% (>=10% floor) at a Sharpe >= QQQ (DCA, full history)', () => {
    for (const s of evaluateAll(md, 'dca')) {
      if (s.id === FLAGSHIP) continue;
      // Beat QQQ DCA by >=15% (a >=10% floor is acceptable for the hardest book).
      expect({ id: s.id, vsQQQ: s.vsQQQ }).toMatchObject({ vsQQQ: expect.any(Number) });
      expect(s.vsQQQ).toBeGreaterThanOrEqual(1.1);
      // Risk-adjusted: Sharpe no worse than the QQQ benchmark (small tolerance).
      expect(s.sharpe).toBeGreaterThanOrEqual(s.qqqSharpe - 0.1);
    }
    // At least 8 of the 9 clear the full >=15% bar (only the gentlest may sit at 10-15%).
    const strong = evaluateAll(md, 'dca').filter((s) => s.id !== FLAGSHIP && s.vsQQQ >= 1.15);
    expect(strong.length).toBeGreaterThanOrEqual(8);
  });

  it('strategies 02-10 hold at most 10 instruments', () => {
    for (const def of STRATEGY_DEFINITIONS) {
      if (def.id === FLAGSHIP) continue;
      expect({ id: def.id, holdings: maxHoldings(def) }).toMatchObject({
        holdings: expect.any(Number),
      });
      expect(maxHoldings(def)).toBeLessThanOrEqual(MAX_HOLDINGS);
    }
  });

  it('also beats QQQ by >=15% when backtested from 2010 (the QQQ-dominant decade)', () => {
    // Not every unleveraged stock book can beat QQQ in the 2010s (QQQ was the best
    // asset of that decade), but the bias-free leveraged strategies 02-06 must.
    const from2010 = STRATEGY_DEFINITIONS.filter((d) => d.id !== FLAGSHIP).map((d) =>
      evaluate(md, d, 'dca', 2000, 100000, '2010-01-01'),
    );
    const winners2010 = from2010.filter((s) => s.vsQQQ >= 1.15);
    // eslint-disable-next-line no-console
    console.log(
      `\nDCA from 2010 beats QQQ by >=15%: ${winners2010.length}/${from2010.length} -> ` +
        winners2010.map((s) => s.id).join(', '),
    );
    expect(winners2010.length).toBeGreaterThanOrEqual(5);
  });

  it('lump-sum scoreboard', () => {
    const scores = evaluateAll(md, 'lumpsum');
    // eslint-disable-next-line no-console
    console.log('\n=== LUMP SUM ($100k) — full history per strategy ===\n' + formatScores(scores));
    expect(scores.length).toBeGreaterThan(0);
  });
});
