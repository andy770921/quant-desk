import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equalWeight, topStocksByMomentum, trendUp } from './_helpers';

/**
 * Strategy 8: Stock Momentum + Bond Ballast, UNLEVERAGED. A 65/35 split between
 * the top-40 momentum stocks and intermediate Treasuries (trend-gated to bonds
 * when the market is weak). The permanent bond sleeve is the lowest-drawdown
 * stock strategy on the platform — a balanced "growth + ballast" book.
 */
export const defensiveAssetAllocation: StrategyDefinition = {
  id: 'stock-momentum-bond-ballast',
  name: '個股動能+債券壓艙',
  shortName: '動能+債券',
  category: 'diversified',
  description:
    '大盤多頭時，65% 等權持有動能最強的 40 檔個股，固定 35% 配置中期公債當壓艙石；大盤跌破 200 日均線則全數轉入公債/黃金/現金。本平台回撤最低的選股策略。',
  longDescription:
    '把橫斷面動能選股與固定債券壓艙石結合，做成一個攻守均衡、低回撤的「成長+壓艙」組合。' +
    '當大盤站上 200 日均線：以 65% 等權買進 12-1 動能最強的 40 檔個股，另 35% 固定配置中期公債——' +
    '債券部位在股市回檔時提供緩衝，把最大回撤壓到約 23%（純動能約 35%、大盤逾 50%）。' +
    '當大盤跌破 200 日均線：全數轉入中期/長期公債、黃金、現金中趨勢最強者。' +
    '適合想參與個股動能、但更在意波動與回撤的投資人。全程不使用槓桿。',
  rules: [
    '大盤站上 200 日均線：65% 等權持有動能最強的 40 檔 + 35% 中期公債。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，歷史績效偏樂觀。',
    '固定 35% 債券在強多頭中會略微拖累報酬（換取較低回撤）。',
    '股債同跌的環境（如 2022）壓艙效果會打折。',
  ],
  tags: ['動能', '選股', '債券壓艙', '低回撤', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['S&P 500 個股（約 500 檔）', '中期公債', '長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const top = topStocksByMomentum(ctx, 40);
    if (top.length < 10) return { [ASSET.NASDAQ]: 0.65, [ASSET.ITT]: 0.35 };
    return { ...equalWeight(top, 0.65), [ASSET.ITT]: 0.35 };
  },
};
