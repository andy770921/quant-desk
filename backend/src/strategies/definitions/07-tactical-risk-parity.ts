import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { addW, capHoldings, invVol, leveragedEquity, trendUp } from './_helpers';

/**
 * Strategy 7 (S6) — Tactical Leveraged Risk Parity. Source: Dalio All-Weather /
 * HFEA. Equalize risk contribution across equity / long Treasuries / gold using
 * inverse-volatility weights, gate each sleeve by its own 200-day trend, then
 * apply a vol-targeted leverage on the equity sleeve (the HFEA idea). Monthly.
 *
 * Highest Sharpe / lowest drawdown of the family in research, because the
 * inverse-vol weighting keeps any one sleeve from dominating risk. Bias-free.
 */
export const tacticalRiskParity: StrategyDefinition = {
  id: 's6-risk-parity',
  name: '戰術槓桿風險平價',
  shortName: '風險平價',
  category: 'diversified',
  description:
    '對「那斯達克、長期公債、黃金」三腿各自做 200 日趨勢過濾，僅保留趨勢向上者，並以反向波動度（風險平價）配權，使每腿貢獻相近的風險；股票腿再以波動目標槓桿（上限 2 倍）放大。三腿皆未過關則持有現金。',
  longDescription:
    'Ray Dalio 全天候（All-Weather）與 HFEA 的戰術版本：核心是「風險平價」——不是等金額，而是讓股票、長債、黃金每一腿貢獻相近的風險，避免高波動的股票主導整個組合。' +
    '每月檢查三腿（那斯達克、長期公債、黃金）的 200 日趨勢，只保留站上均線者；對保留的腿以「反向波動度」配權（近半年波動越低、權重越高），達成風險平價。' +
    '接著對股票腿施加波動目標槓桿（30% ÷ 近 3 個月波動，上限 2 倍，1x＋2x ETF），這正是 HFEA「對風險平價組合加槓桿」的精神。三腿皆跌破均線時全數轉現金。' +
    '反向波動配權讓單一資產不會主導風險，研究中是九個策略裡 Sharpe 最高、回撤最低者。只用指數與合成債/金，無存活者偏誤。',
  rules: [
    '三腿（那斯達克、長期公債、黃金）各自需站上 200 日均線才納入。',
    '對保留的腿以反向波動度（近半年）配權，達成風險平價。',
    '股票腿曝險 = 30% ÷ 近 3 個月波動（上限 2 倍），1x＋2x 那斯達克 ETF 組成。',
    '三腿皆未過關 → 全數轉現金。每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '股債同跌時（如 2022）風險平價的分散效果會減弱。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '月頻趨勢過濾，反轉當月可能慢一步。',
  ],
  tags: ['風險平價', '全天候', '分散', '槓桿'],
  rebalance: 'monthly',
  universe: ['那斯達克100 (1x/2x)', '長期公債', '黃金', '現金'],
  assets: [
    ASSET.USLC,
    ASSET.NASDAQ,
    ASSET.NASDAQ2X,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.LTT3X,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    // Risk-parity sleeves: equity, long bonds, gold — kept only if trending up.
    const sleeves = [ASSET.NASDAQ, ASSET.LTT, ASSET.GOLD].filter(
      (a) => ctx.has(a) && trendUp(ctx, a, 200),
    );
    if (!sleeves.length) return { [ASSET.CASH]: 1 };
    let w = invVol(ctx, sleeves, DAYS.HALF_YEAR, 1);
    // Lever the equity sleeve by vol-target (the HFEA idea: lever the risk-parity book).
    const eqBudget = w[ASSET.NASDAQ];
    if (eqBudget) {
      delete w[ASSET.NASDAQ];
      w = addW(w, leveragedEquity(ctx, ASSET.NASDAQ, ASSET.NASDAQ2X, undefined, eqBudget, 0.3, 2));
    }
    return capHoldings(w, 10);
  },
};
