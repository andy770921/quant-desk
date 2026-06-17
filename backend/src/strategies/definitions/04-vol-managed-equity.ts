import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, clamp, equityExposureWeights } from './_helpers';

/**
 * Strategy 4 (S3) — Volatility-Managed Equity. Source: Moreira & Muir,
 * "Volatility-Managed Portfolios", Journal of Finance (2017). Scale equity
 * exposure by INVERSE REALIZED VARIANCE — lever up when markets are calm, step
 * down when turbulent. Monthly. Index-only ⇒ survivorship-bias-free.
 *
 * Distinct from the trend-gated books: this is variance-timed, not trend-timed.
 * Exposure E = (targetVol)² / (last-month realized vol)², capped at 2x, expressed
 * via the Nasdaq 1x/2x ETF blend; the un-levered remainder is parked defensively.
 * It is the one book that beats QQQ even from a 2010 start without overfitting.
 */
export const volManagedEquity: StrategyDefinition = {
  id: 's3-vol-managed-equity',
  name: '波動管理股票',
  shortName: '波動管理',
  category: 'volatility',
  description:
    '依「反向實現變異數」調整那斯達克曝險：市場平靜（近一個月實現波動低）就加槓桿，市場動盪就降低曝險。曝險 = (目標波動 20%)² ÷ (近一個月實現波動)²，上限 2 倍，以 1x＋2x ETF 達成；未投入部分停泊在趨勢最強的避險資產。純指數，無存活者偏誤。',
  longDescription:
    'Moreira–Muir「Volatility-Managed Portfolios」(Journal of Finance, 2017) 的實作：波動度具有可預測性與群聚性，且高波動期的風險溢酬不成比例地差，因此「在低波動時加碼、高波動時減碼」能提升風險調整後報酬。' +
    '每月計算那斯達克近一個月（21 日）的實現波動 v，曝險 E = 目標波動 (20%) 的平方 ÷ v 的平方（反向「變異數」而非反向波動，對波動更敏感），上限 2 倍。' +
    'E 透過持有 1x 那斯達克與 2x 那斯達克 ETF 的組合表達；若 E < 1（高波動期），未投入的資金停泊在中期/長期公債、黃金、現金中近半年趨勢最強者。' +
    '它與趨勢閘門策略不同——是用「波動」而非「均線」擇時，因此在 2010 年後的多頭也能維持高曝險，是九個策略中唯一從 2010 年起算仍能勝過 QQQ 的純指數策略。目標波動是風險旋鈕（0.15–0.25 之間 Sharpe 大致持平），非最佳化擬合值。',
  rules: [
    '每月計算那斯達克近一個月（21 日）年化實現波動 v。',
    '曝險 E = (20%)² ÷ v²，上限 2 倍，以 1x＋2x 那斯達克 ETF 組成。',
    'E < 1 時，剩餘資金轉入趨勢最強的公債/黃金/現金。',
    '每月再評估一次；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '波動擇時對「跳空式」崩盤（波動尚未升高就暴跌）反應較慢。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '目標波動是風險偏好設定，不同設定會改變回撤與報酬的取捨。',
  ],
  tags: ['波動度', '風險管理', '那斯達克', '槓桿'],
  rebalance: 'monthly',
  universe: ['那斯達克100 (1x/2x)', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.USLC, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const v = ctx.vol(ASSET.NASDAQ, DAYS.MONTH);
    if (v === undefined) return { [ASSET.CASH]: 1 };
    // Moreira-Muir inverse-variance scaling: exposure = targetVar / realizedVar.
    const E = clamp((0.2 * 0.2) / (v * v), 0, 2);
    const w = equityExposureWeights(E, ASSET.NASDAQ, ASSET.NASDAQ2X);
    const invested = Object.values(w).reduce<number>((s, x) => s + (x ?? 0), 0);
    // Park the un-levered remainder in the best-trending defensive sleeve.
    if (invested < 0.999) w[bestDefensive(ctx)] = Number((1 - invested).toFixed(4));
    return w;
  },
};
