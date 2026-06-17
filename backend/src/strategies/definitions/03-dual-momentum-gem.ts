import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, leveragedEquity } from './_helpers';

/**
 * Strategy 3 (S2) — Dual Momentum (GEM). Source: Gary Antonacci, "Dual Momentum
 * Investing" (2014). Combines absolute momentum (a risk-on/off gate vs cash) with
 * relative momentum (pick the stronger equity market). Monthly.
 *
 * 1) Absolute-momentum gate: if US equity's trailing 12-month return does not beat
 *    cash, step fully into the best-trending defensive asset (Treasuries/gold/cash).
 * 2) Relative momentum: otherwise hold whichever of US growth (Nasdaq) vs developed-
 *    international (EAFE) has the higher 13612W momentum score; the US-growth winner
 *    is expressed with vol-targeted leverage (cap 2x). Bias-free (indices only).
 */
export const dualMomentumGem: StrategyDefinition = {
  id: 's2-dual-momentum-gem',
  name: '雙動能 GEM',
  shortName: '雙動能GEM',
  category: 'momentum',
  description:
    '每月檢查：①絕對動能閘門——美股近 12 個月報酬若沒贏現金，就全數轉入趨勢最強的公債/黃金/現金避險；②相對動能——美股動能若過關，則比較美國成長股（那斯達克）與已開發國際股（EAFE）的 13612W 動能分數，持有較強者，美股勝出時再以波動目標槓桿（上限 2 倍）放大。',
  longDescription:
    'Gary Antonacci「Dual Momentum」(2014) 的經典雙動能：先用「絕對動能」決定要不要承擔風險，再用「相對動能」決定買哪個市場。' +
    '第一步（絕對動能閘門）：若 S&P 500 近 252 日報酬 ≤ 現金（國庫券）報酬，代表股市趨勢轉弱，全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者避險。' +
    '第二步（相對動能）：股市動能過關時，比較那斯達克（美國成長）與 EAFE（已開發國際）的 13612W 動能分數，持有分數較高者；當美國成長股勝出，以波動目標槓桿（30% ÷ 近 3 個月波動，上限 2 倍，1x＋2x ETF）放大曝險。' +
    '只用指數與利率資料，無存活者偏誤。GEM 對單一 12 個月回看窗較敏感，crash 保護主要來自「對現金的絕對動能閘門」與趨勢避險腿。',
  rules: [
    '絕對動能：S&P 500 近 252 日報酬 ≤ 現金報酬 → 全數轉入趨勢最強的公債/黃金/現金。',
    '相對動能：股市過關時，比較那斯達克 vs EAFE 的 13612W 分數，持有較強者。',
    '那斯達克勝出 → 曝險 = 30% ÷ 近 3 個月波動（上限 2 倍），1x＋2x ETF 組成。',
    '每月再評估一次；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '單一 12 個月回看窗在某些轉折點會有「時點脆弱性」（Newfound 研究）。',
    'EAFE 資料較晚才有，早期僅在美股/避險之間切換。',
    '月頻換股，反轉當月可能慢一步出場。',
  ],
  tags: ['動能', '雙動能', '資產輪動'],
  rebalance: 'monthly',
  universe: ['那斯達克100 (1x/2x)', '國際股 EAFE', '中/長期公債', '黃金', '現金'],
  assets: [
    ASSET.USLC,
    ASSET.NASDAQ,
    ASSET.INTL,
    ASSET.NASDAQ2X,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    // Absolute-momentum gate: is US equity beating cash over 12 months?
    const eqMom = ctx.ret(ASSET.USLC, 252);
    const cashMom = ctx.ret(ASSET.CASH, 252);
    if (eqMom === undefined || cashMom === undefined || eqMom <= cashMom) {
      return { [bestDefensive(ctx)]: 1 };
    }
    // Relative momentum: stronger of US growth (Nasdaq) vs developed-international.
    const us = ctx.score13612W(ASSET.NASDAQ) ?? ctx.score13612W(ASSET.USLC) ?? -1;
    const intl = ctx.has(ASSET.INTL) ? (ctx.score13612W(ASSET.INTL) ?? -1) : -Infinity;
    if (us >= intl) return leveragedEquity(ctx, ASSET.NASDAQ, ASSET.NASDAQ2X, undefined, 1, 0.3, 2);
    return { [ASSET.INTL]: 1 };
  },
};
