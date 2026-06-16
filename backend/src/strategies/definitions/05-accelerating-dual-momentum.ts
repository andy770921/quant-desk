import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, bestDefensive, trendUp } from './_helpers';

/**
 * Strategy 5: Dual Momentum with a Bond-Blend brake, UNLEVERAGED. Like strategy 2
 * but smoother: it picks the strongest equity by 12-month momentum, then — if that
 * leader has slipped below its own 200-day trend — only half-commits and parks the
 * rest in intermediate Treasuries, and goes fully defensive when momentum is
 * negative. Trades a little upside for a lower drawdown.
 */
export const acceleratingDualMomentum: StrategyDefinition = {
  id: 'dual-momentum-bond-blend',
  name: '雙動能債券緩衝',
  shortName: '雙動能緩衝',
  category: 'momentum',
  description:
    '挑 12 個月報酬最強的股票指數；若它仍跑輸現金 → 全面防禦買公債/黃金；若它領先但已跌破自身 200 日均線 → 只投一半、另一半放中期公債當緩衝。用「半倉+債券」降低回撤。',
  longDescription:
    '在雙動能 GEM 的基礎上加一層「趨勢緩衝」，讓持股更平順、回撤更低。每月底先用相對動能在那斯達克、標普、小型股中選 12 個月報酬最強者：' +
    '(1) 若最強者報酬仍 ≤ 現金 → 絕對動能濾網啟動，全面防禦轉入中期/長期公債、黃金、現金中趨勢最強者；' +
    '(2) 若最強者領先且仍站上自身 200 日均線 → 100% 持有；' +
    '(3) 若最強者領先但已跌破 200 日均線（動能還在、趨勢轉弱）→ 只投 50%，另外 50% 放中期公債當緩衝。' +
    '這個半倉設計在頭部反轉時先降風險，最大回撤低於純雙動能。全程不使用槓桿。',
  rules: [
    '每月底以 12 個月報酬在那斯達克、標普、小型股中選最強者。',
    '最強者 ≤ 現金報酬：全面防禦（公債/黃金/現金中趨勢最強者）。',
    '最強者領先且站上 200 日均線：100% 持有。',
    '最強者領先但跌破 200 日均線：50% 持有 + 50% 中期公債緩衝。每月再平衡、不使用槓桿。',
  ],
  caveats: [
    '緩衝機制在強多頭中會因為半倉而少賺一些。',
    '月頻判斷，急轉時落後約一個月。',
    '同時用動能與趨勢兩個訊號，盤整時換手略多。',
  ],
  tags: ['動能', '趨勢緩衝', '低回撤', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['那斯達克100', '標普500', '小型股', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.USLC, ASSET.SMALL, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC, ASSET.NASDAQ],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const best = bestBy(
      [ASSET.NASDAQ, ASSET.USLC, ASSET.SMALL],
      (a) => ctx.ret(a, DAYS.YEAR),
      ASSET.USLC,
    );
    if ((ctx.ret(best, DAYS.YEAR) ?? -1) <= (ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0)) {
      return { [bestDefensive(ctx)]: 1 };
    }
    return trendUp(ctx, best, 200) ? { [best]: 1 } : { [best]: 0.5, [ASSET.ITT]: 0.5 };
  },
};
