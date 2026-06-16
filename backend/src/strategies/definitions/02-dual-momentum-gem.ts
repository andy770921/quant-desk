import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equityExposureWeights, trendUp, volTargetExposure } from './_helpers';

/**
 * Strategy 2: Volatility-Targeted Leveraged Nasdaq Trend. A retail-friendly take
 * on Michael Gayed's "Leverage for the Long Run": only gear up while the Nasdaq
 * is in a confirmed uptrend (above its 200-day MA), and size the leverage by
 * recent volatility (target ~30% annualized, capped at 2x) so the book de-gears
 * in turbulent markets. Below the 200-day MA it steps fully aside into the
 * best-trending Treasury / gold / cash. Holds at most 2 instruments.
 */
export const volTargetLeveragedNasdaq: StrategyDefinition = {
  id: 'vol-target-leveraged-nasdaq',
  name: '波動目標槓桿那斯達克',
  shortName: '波動槓桿Ndx',
  category: 'trend-following',
  description:
    '那斯達克站上 200 日均線時才動用槓桿，並依近 3 個月波動度調整曝險（目標年化波動約 30%，最高 2 倍，用 1x 指數＋2x ETF 組成）；跌破均線就全數轉入趨勢最強的公債/黃金/現金。趨勢＋波動雙重風控的槓桿策略。',
  longDescription:
    'Michael Gayed「Leverage for the Long Run」的零售版：槓桿的最大殺手是空頭裡的波動耗損，因此只在「趨勢向上」時才加槓桿。' +
    '每日檢查未槓桿那斯達克是否站上 200 日均線——站上才進場，並用「波動目標」決定要用多少槓桿：' +
    '曝險 = 目標波動(30%) ÷ 近 3 個月實現波動，上限 2 倍，透過持有 1x 那斯達克指數與 2x 那斯達克 ETF (QLD) 的組合達成（買 ETF，不借錢）。' +
    '市場越平靜曝險越高、越動盪曝險越低，自動在 2000、2008、2022 之前縮手。一旦跌破 200 日均線，全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。' +
    '相較固定 3 倍槓桿，定期定額的複利在較淺的回撤下得以存活，長期報酬與 Sharpe 都優於買進持有 QQQ。',
  rules: [
    '每日檢查那斯達克 100 是否站上 200 日均線。',
    '站上：曝險 = 30% ÷ 近 3 個月年化波動（上限 2 倍），以 1x 指數＋2x ETF 組成。',
    '跌破：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過持有槓桿型 ETF（買進，不借錢），最多持有 2 檔。',
  ],
  caveats: [
    '槓桿型 ETF 每日重設，盤整或急殺時會有波動耗損，回撤仍可能達 40%。',
    '200 日均線在盤整時會來回穿越，造成數次假訊號 (whipsaw)。',
    '跳空大跌（如 2020 年 3 月）當日無法靠日線濾網即時避開。',
  ],
  tags: ['槓桿', '趨勢', '波動目標', '那斯達克'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 210,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };
    const exposure = volTargetExposure(ctx, ASSET.NASDAQ, 0.3, 2, DAYS.QUARTER);
    return equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X);
  },
};
