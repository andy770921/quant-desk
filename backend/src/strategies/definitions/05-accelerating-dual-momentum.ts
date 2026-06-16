import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equityExposureWeights, trendUp, volTargetExposure } from './_helpers';

/**
 * Strategy 5: Aggressive Volatility-Targeted Leveraged Nasdaq (up to 3x). The
 * higher-octane sibling of strategy 2: same 200-day trend gate, but a higher vol
 * target and a 3x cap (blending 1x / 2x / 3x Nasdaq ETFs). For investors who want
 * maximum trend-following upside and can stomach deeper drawdowns. Steps fully
 * aside to the best defensive sleeve below the 200-day MA. Holds at most 2.
 */
export const aggressiveVolTargetNasdaq: StrategyDefinition = {
  id: 'aggressive-leveraged-nasdaq',
  name: '積極波動目標槓桿那斯達克',
  shortName: '積極槓桿Ndx',
  category: 'trend-following',
  description:
    '與「波動目標槓桿那斯達克」同樣的 200 日趨勢濾網，但目標波動更高、槓桿上限拉到 3 倍（用 1x/2x/3x 那斯達克 ETF 組成）。追求趨勢多頭的最大上漲，回撤也更深。跌破均線一樣全數轉入趨勢最強的避險資產。',
  longDescription:
    '策略 2 的積極版，給能承受較深回撤、想吃滿趨勢的投資人。同樣只在那斯達克站上 200 日均線時進場，' +
    '但波動目標設得更高（年化約 45%），槓桿上限放寬到 3 倍，透過 1x、2x、3x 那斯達克 ETF（TQQQ 類）的組合達成（買 ETF，不借錢）。' +
    '波動目標仍會在市場動盪時自動降低槓桿，避免在高波動裡被耗損吃乾，但整體曝險明顯高於穩健版，' +
    '長期報酬最高、最大回撤也最深（約 55%）。一旦跌破 200 日均線，立即全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。' +
    '只在趨勢確認時動用高槓桿、空頭完全離場，是定期定額長期擊敗 QQQ 的關鍵。',
  rules: [
    '每日檢查那斯達克 100 是否站上 200 日均線。',
    '站上：曝險 = 45% ÷ 近 3 個月年化波動（上限 3 倍），以 1x/2x/3x ETF 組成。',
    '跌破：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過槓桿型 ETF（買進，不借錢），最多持有 2 檔。',
  ],
  caveats: [
    '3 倍 ETF 每日重設，波動耗損明顯，回撤可達 55% 以上。',
    '200 日均線盤整時來回穿越，假訊號成本較高。',
    '波動最大，定期定額過程中的帳面起伏需要強心臟。',
  ],
  tags: ['槓桿', '趨勢', '波動目標', '積極'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x/3x)', '中/長期公債', '黃金', '現金'],
  assets: [
    ASSET.NASDAQ,
    ASSET.NASDAQ2X,
    ASSET.NASDAQ3X,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 210,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };
    const exposure = volTargetExposure(ctx, ASSET.NASDAQ, 0.45, 3, DAYS.QUARTER);
    return equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.NASDAQ3X);
  },
};
