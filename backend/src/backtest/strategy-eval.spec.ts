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
    const winners = scores.filter((s) => Math.max(s.vsQQQ, s.vsVOO) >= 1.1).map((s) => s.id);
    // eslint-disable-next-line no-console
    console.log(
      `\nDCA beats QQQ or VOO by >=10%: ${winners.length}/${scores.length} -> ${winners.join(', ')}`,
    );
    expect(scores.length).toBeGreaterThan(0);
  });

  // The platform's headline promise (and the project goal): every strategy 02-10
  // simulates investing $2000/month and must beat dollar-cost-averaging into the
  // market — QQQ OR VOO — by >=10% in final value over its full history, with a
  // Sharpe at least as good as the benchmark. Each also holds AT MOST 10
  // instruments and trades on at most 3 days a month (the engine enforces the
  // trade cap). All nine (02-10) are the survivorship-bias-free research books
  // (S1-S9); none selects individual stocks. Leverage is via leveraged ETFs held
  // with cash (never on margin — the user-approved lever). Strategy 01 is the
  // mandated leveraged flagship and is exempt from the benchmark / holdings checks.
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

  it('every strategy 02-10 beats QQQ or VOO by >=10% at a Sharpe >= benchmark (DCA, full history)', () => {
    const scores = evaluateAll(md, 'dca');
    for (const s of scores) {
      if (s.id === FLAGSHIP) continue;
      // Beat the market (QQQ or VOO) by >=10% in final value over full history.
      const vsMarket = Math.max(s.vsQQQ, s.vsVOO);
      expect({ id: s.id, vsQQQ: s.vsQQQ, vsVOO: s.vsVOO }).toMatchObject({
        vsQQQ: expect.any(Number),
        vsVOO: expect.any(Number),
      });
      expect(vsMarket).toBeGreaterThanOrEqual(1.1);
      // Every bias-free book also clears VOO (the broad market) by >=10%.
      expect(s.vsVOO).toBeGreaterThanOrEqual(1.1);
      // Risk-adjusted: Sharpe no worse than the (lower) benchmark, small tolerance.
      expect(s.sharpe).toBeGreaterThanOrEqual(Math.min(s.qqqSharpe, s.vooSharpe) - 0.1);
    }
    // A meaningful subset clears the QQQ-specific bar (the hardest benchmark of the 2010s).
    const beatQQQ = scores.filter((s) => s.id !== FLAGSHIP && s.vsQQQ >= 1.15);
    expect(beatQQQ.length).toBeGreaterThanOrEqual(4);
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

  it('a subset still beats QQQ or VOO by >=10% from a 2010 start (the QQQ-dominant decade)', () => {
    // The 2010s were QQQ's best decade ever, so beating it from 2010 is the hardest
    // test; the honest research result is that only a few bias-free books clear the
    // bar (variance-timing and the defensive/mean-reversion books). We assert that
    // floor rather than pretend every book wins the 2010s.
    const from2010 = STRATEGY_DEFINITIONS.filter((d) => d.id !== FLAGSHIP).map((d) =>
      evaluate(md, d, 'dca', 2000, 100000, '2010-01-01'),
    );
    const winners2010 = from2010.filter((s) => Math.max(s.vsQQQ, s.vsVOO) >= 1.1);
    // eslint-disable-next-line no-console
    console.log(
      `\nDCA from 2010 beats QQQ or VOO by >=10%: ${winners2010.length}/${from2010.length} -> ` +
        winners2010.map((s) => s.id).join(', '),
    );
    expect(winners2010.length).toBeGreaterThanOrEqual(3);
  });

  it('lump-sum scoreboard', () => {
    const scores = evaluateAll(md, 'lumpsum');
    // eslint-disable-next-line no-console
    console.log('\n=== LUMP SUM ($100k) — full history per strategy ===\n' + formatScores(scores));
    expect(scores.length).toBeGreaterThan(0);
  });
});
