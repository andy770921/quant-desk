import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, trendUp } from './_helpers';

/**
 * Strategy 4: Balanced Leveraged Growth (2x Nasdaq + Long Treasury). A leveraged
 * take on the classic 60/40: while the Nasdaq is above its 200-day MA, hold 65%
 * in a 2x Nasdaq ETF and 35% in long Treasuries — the bond sleeve dampens the
 * leveraged-equity drawdowns. Below the 200-day MA it rotates fully defensive.
 * Lower volatility than a pure leveraged-equity book. Holds at most 2 instruments.
 */
export const balancedLeveragedGrowth: StrategyDefinition = {
  id: 'balanced-leveraged-growth',
  name: '槓桿平衡成長',
  shortName: '槓桿平衡',
  category: 'diversified',
  description:
    '那斯達克站上 200 日均線時，65% 持有 2 倍那斯達克 ETF (QLD)、35% 持有長期公債當壓艙石；跌破均線就全數轉入趨勢最強的公債/黃金/現金。槓桿版的「股六債四」，用債券緩衝槓桿股的回撤。',
  longDescription:
    '把「股六債四」的平衡精神套到槓桿上：在那斯達克站上 200 日均線的多頭期間，' +
    '以 65% 部位持有 2 倍那斯達克 ETF（QLD，買進不借錢），另 35% 配置長期公債當壓艙石。' +
    '股債通常負相關，債券部位能在股市回檔時提供緩衝，把 2 倍槓桿股的回撤從 60%+ 壓到更可接受的水準，' +
    '同時保留足夠的成長動能。一旦那斯達克跌破 200 日均線，立即全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。' +
    '長期報酬高於買進持有 QQQ，但波動與回撤因債券壓艙而更平順，適合想要槓桿成長、又重視睡得著覺的投資人。',
  rules: [
    '每日檢查那斯達克 100 是否站上 200 日均線。',
    '站上：65% 持有 2 倍那斯達克 ETF (QLD) + 35% 長期公債。',
    '跌破：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過 2x ETF（買進，不借錢），最多持有 2 檔。',
  ],
  caveats: [
    '2 倍 ETF 每日重設，盤整時有波動耗損。',
    '股債同跌的環境（如 2022）壓艙效果會打折。',
    '固定 65/35 比例在強多頭中會略輸純槓桿股（換取較低回撤）。',
  ],
  tags: ['槓桿', '平衡', '債券壓艙', '低回撤'],
  rebalance: 'daily',
  universe: ['那斯達克100 (2x)', '長期公債', '中期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ, ASSET.LTT],
  warmupDays: 210,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };
    return { [ASSET.NASDAQ2X]: 0.65, [ASSET.LTT]: 0.35 };
  },
};
