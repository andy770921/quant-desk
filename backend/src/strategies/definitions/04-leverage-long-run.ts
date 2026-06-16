import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, trendUp } from './_helpers';

/**
 * Strategy 4: Nasdaq Trend-Following + Treasury ballast, UNLEVERAGED. Classic
 * time-series momentum: hold the Nasdaq-100 (1x) while it is above its 200-day
 * moving average, rotate to the best-trending Treasury/gold/cash when it breaks
 * below. Captures the Nasdaq's high long-run return while cutting its brutal
 * bear-market drawdowns — no leverage involved.
 */
export const leverageLongRun: StrategyDefinition = {
  id: 'nasdaq-trend-bonds',
  name: '那斯達克趨勢避險',
  shortName: '那斯達克趨勢',
  category: 'trend-following',
  description:
    '那斯達克 100 站上 200 日均線時持有那斯達克（1 倍，不加槓桿）；跌破均線就全數轉入趨勢最強的公債/黃金/現金。用趨勢濾網把那斯達克的高報酬留下、把大空頭的深回撤砍掉。',
  longDescription:
    '時間序列動能 (time-series momentum) 的經典應用，標的選波動與長期報酬都最高的那斯達克 100。' +
    '當未槓桿那斯達克收盤價站上 200 日移動平均線（多頭趨勢），就 100% 持有那斯達克指數本身（1 倍，不使用槓桿）；' +
    '一旦跌破 200 日均線，立即全數轉入中期公債、長期公債、黃金、現金中近半年趨勢最強的避險資產，避開 2000、2008、2022 的主跌段。' +
    '長期報酬遠勝標普 500（那斯達克本身就強），但因為會在空頭離場，最大回撤明顯低於買進持有那斯達克。完全不使用槓桿。',
  rules: [
    '每日檢查那斯達克 100 是否站上 200 日均線。',
    '站上：100% 持有那斯達克 100 指數（1 倍，不加槓桿）。',
    '跌破：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月最多交易 3 次；全程不使用槓桿。',
  ],
  caveats: [
    '200 日均線在盤整時會來回穿越，造成數次假訊號 (whipsaw)。',
    '單壓那斯達克，集中度高、波動大於分散型策略。',
    '突發跳空大跌（如 2020 年 3 月）當日無法靠日線濾網即時避開。',
  ],
  tags: ['趨勢', '那斯達克', '時間序列動能', '不使用槓桿'],
  rebalance: 'daily',
  universe: ['那斯達克100', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 210,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    return trendUp(ctx, ASSET.NASDAQ, 200) ? { [ASSET.NASDAQ]: 1 } : { [bestDefensive(ctx)]: 1 };
  },
};
