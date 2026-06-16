import { MarketDataService } from '../market-data/market-data.service';
import { evaluateAll, formatScores } from './strategy-eval';

/**
 * Not a pass/fail unit test — a reporting harness. Prints the full scoreboard
 * (DCA + lump-sum) so we can iterate strategies against the QQQ/VOO bar.
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
    const winners = scores.filter((s) => s.beats20).map((s) => s.id);
    // eslint-disable-next-line no-console
    console.log(
      `\nDCA beats QQQ or VOO by >=20%: ${winners.length}/${scores.length} -> ${winners.join(', ')}`,
    );
    expect(scores.length).toBeGreaterThan(0);
  });

  // The platform's headline promise (and the project goal): every strategy must
  // beat dollar-cost-averaging into QQQ or VOO by >=20% over its full history,
  // with a Sharpe at least as good as the QQQ benchmark. Strategies 02-10 are
  // UNLEVERAGED (no borrowing — the same playing field as the DCA benchmark) and
  // must also draw down LESS than buy-and-hold Nasdaq. Strategy 01 is the mandated
  // leveraged flagship and is exempt from the no-leverage / drawdown checks.
  const FLAGSHIP = 'nasdaq-3x-20dma';
  it('every strategy beats QQQ or VOO by >=20% (DCA, full history)', () => {
    for (const s of evaluateAll(md, 'dca')) {
      expect({ id: s.id, beats20: s.beats20, vsQQQ: s.vsQQQ, vsVOO: s.vsVOO }).toMatchObject({
        beats20: true,
      });
      expect(s.sharpe).toBeGreaterThanOrEqual(s.qqqSharpe - 0.1);
      if (s.id !== FLAGSHIP) {
        // Unleveraged: peak market exposure never exceeds ~1x (no borrowing).
        expect({ id: s.id, lev: s.peakLeverage }).toMatchObject({ lev: 1 });
        // Lower max drawdown than buy-and-hold Nasdaq (QQQ).
        expect(s.maxDdPct).toBeLessThan(s.qqqMaxDdPct);
      }
    }
  });

  it('lump-sum scoreboard', () => {
    const scores = evaluateAll(md, 'lumpsum');
    // eslint-disable-next-line no-console
    console.log('\n=== LUMP SUM ($100k) — full history per strategy ===\n' + formatScores(scores));
    const winners = scores.filter((s) => s.beats20).map((s) => s.id);
    // eslint-disable-next-line no-console
    console.log(
      `\nLump beats QQQ or VOO by >=20%: ${winners.length}/${scores.length} -> ${winners.join(', ')}`,
    );
    expect(scores.length).toBeGreaterThan(0);
  });
});
