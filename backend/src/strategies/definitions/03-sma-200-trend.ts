import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, bestDefensive } from './_helpers';

/**
 * Strategy 3: Defensive Asset Allocation (Keller-style canary), UNLEVERAGED.
 * Two "canary" assets (US + international equities) decide the regime: if BOTH
 * have positive 13612W momentum the portfolio goes offensive into the strongest
 * equity sleeve; otherwise it goes fully defensive into the best bond/gold/cash.
 * Designed for a low max-drawdown while still beating the S&P over the long run.
 */
export const sma200Trend: StrategyDefinition = {
  id: 'defensive-asset-allocation',
  name: '防禦資產配置 DAA',
  shortName: '防禦配置 DAA',
  category: 'diversified',
  description:
    '以美股與國際股當「金絲雀」：兩者 13612W 動能皆為正才進攻（買最強股票指數），只要任一翻負就全面防禦（買最強的公債/黃金/現金）。重視低回撤的資產配置。',
  longDescription:
    'Wouter Keller 的防禦資產配置 (Defensive Asset Allocation) 精神：用「金絲雀」資產提早偵測風險。' +
    '每月底檢查美國大型股與已開發國際股的 13612W 複合動能，只有當兩者都為正（市場廣泛健康）才進攻，' +
    '在那斯達克、標普、小型股中買進 13612W 動能最強者；只要任一金絲雀翻負，立即全面防禦，' +
    '轉入中期公債、長期公債、黃金、現金中近半年趨勢最強者。這套「雙金絲雀」濾網讓本策略在 2000、2008、2022 等空頭提早離場，' +
    '最大回撤僅約 30%（大盤逾 50%），同時長期仍勝過標普 500。全程不使用槓桿。',
  rules: [
    '金絲雀：每月底檢查美股與國際股的 13612W 複合動能。',
    '進攻（兩者皆 > 0）：買進那斯達克、標普、小型股中 13612W 動能最強者。',
    '防禦（任一 ≤ 0）：買進中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '雙金絲雀偏保守，強多頭中偶爾會過早轉防禦而少賺。',
    '月頻判斷，急漲急跌會落後約一個月。',
    '防禦端的公債在升息環境（如 2022）也可能下跌，但黃金/現金可分流。',
  ],
  tags: ['資產配置', '防禦', '低回撤', '不使用槓桿'],
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
  coreAssets: [ASSET.USLC, ASSET.ITT],
  warmupDays: DAYS.YEAR + 20,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const riskOn =
      (ctx.score13612W(ASSET.USLC) ?? -1) > 0 && (ctx.score13612W(ASSET.INTL) ?? -1) > 0;
    if (riskOn) {
      return {
        [bestBy([ASSET.NASDAQ, ASSET.USLC, ASSET.SMALL], (a) => ctx.score13612W(a), ASSET.USLC)]: 1,
      };
    }
    return { [bestDefensive(ctx)]: 1 };
  },
};
