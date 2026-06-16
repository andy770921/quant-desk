import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, bestDefensive } from './_helpers';

/**
 * Strategy 2: Dual Momentum (GEM-style), UNLEVERAGED. Gary Antonacci's Global
 * Equities Momentum: relative momentum picks the strongest equity sleeve,
 * absolute momentum rotates to bonds when even that is weaker than cash. No
 * leverage, no borrowing — it beats buy-and-hold by sidestepping deep bear
 * markets, not by gearing up.
 */
export const dualMomentumGem: StrategyDefinition = {
  id: 'dual-momentum-gem',
  name: '雙動能輪動 GEM',
  shortName: '雙動能 GEM',
  category: 'momentum',
  description:
    '每月比較那斯達克、標普、小型股、國際股的 12 個月報酬，買進最強者（相對動能）；但若最強者仍跑輸現金（國庫券），則全數轉入趨勢最強的中長期公債或黃金（絕對動能）。不使用槓桿。',
  longDescription:
    'Gary Antonacci 的全球股市動能 (Global Equities Momentum) 改良版，完全不使用槓桿。' +
    '每月底以「相對動能」在那斯達克 100、標普 500、小型股 (Russell 2000)、已開發國際股之間挑出近 12 個月報酬最高者；' +
    '再用「絕對動能」把關：若這個最強者的 12 個月報酬仍低於同期國庫券（現金）報酬，代表整體股市趨勢轉弱，' +
    '就全數退出股市、轉入中期公債、長期公債、黃金、現金中近半年趨勢最強的避險資產。' +
    '靠著在空頭時離場（而非加槓桿），長期報酬贏過買進持有，且最大回撤遠低於大盤。',
  rules: [
    '每月底計算那斯達克、標普、小型股、國際股的近 12 個月報酬。',
    '相對動能：買進其中報酬最高的單一資產（100%）。',
    '絕對動能：若最強者 12 個月報酬 ≤ 國庫券報酬，改買中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿（總曝險 ≤ 1 倍）。',
  ],
  caveats: [
    '月頻判斷，市場急速反轉時會落後約一個月。',
    '盤整且無明顯趨勢時，相對動能容易在資產間來回換手。',
    '單一資產持有，集中度高於分散型配置。',
  ],
  tags: ['動能', '資產配置', '不使用槓桿', '避險'],
  rebalance: 'monthly',
  universe: ['那斯達克100', '標普500', '小型股', '國際股', '中/長期公債', '黃金', '現金'],
  assets: [
    ASSET.NASDAQ,
    ASSET.USLC,
    ASSET.SMALL,
    ASSET.INTL,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC, ASSET.NASDAQ],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const best = bestBy(
      [ASSET.NASDAQ, ASSET.USLC, ASSET.INTL, ASSET.SMALL],
      (a) => ctx.ret(a, DAYS.YEAR),
      ASSET.USLC,
    );
    const rBest = ctx.ret(best, DAYS.YEAR) ?? -1;
    const rCash = ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0;
    return rBest <= rCash ? { [bestDefensive(ctx)]: 1 } : { [best]: 1 };
  },
};
