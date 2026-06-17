import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { addW, bestBy, bestDefensive, capHoldings, clamp, leveragedEquity } from './_helpers';

/**
 * Strategy 10 (S9) — Defensive Asset Allocation (canary breadth). Source: Keller
 * & Keuning (2018). A "canary" universe (early-warning assets) scales risk OFF as
 * breadth-momentum deteriorates — before the equity sleeve itself breaks trend —
 * giving early, graduated crash protection. Monthly. Bias-free.
 *
 * Canary = {INTL, LTT}; cash fraction = (# canary assets with non-positive 13612W
 * momentum) / 2 ∈ {0, 0.5, 1}. The risky fraction goes to the stronger of Nasdaq
 * vs S&P (relative momentum), vol-targeted leveraged (cap 2x); the cash fraction
 * goes to the best-trending defensive sleeve.
 */
export const defensiveAssetAllocation: StrategyDefinition = {
  id: 's9-defensive-asset-allocation',
  name: '防禦資產配置（金絲雀）',
  shortName: '防禦配置',
  category: 'diversified',
  description:
    '用「金絲雀」資產（國際股 EAFE、長期公債）作為早期預警：每有一個金絲雀的 13612W 動能轉負，就把 50% 資金轉入避險（現金比例 0%、50%、100% 三段）。風險部位投入那斯達克與標普中相對動能較強者並施加波動目標槓桿（上限 2 倍），避險部位投入趨勢最強的公債/黃金/現金。',
  longDescription:
    'Keller–Keuning「Breadth Momentum and the Canary Universe: Defensive Asset Allocation (DAA)」(2018)：用一小組對景氣最敏感的「金絲雀」資產提早示警，在主要持股本身跌破趨勢之前就先分段降風險。' +
    '金絲雀宇宙設為 EAFE（國際股）與長期公債兩者。每月計算其 13612W 動能分數：每有一個轉為非正，現金比例就 +50%——因此現金比例為 0%、50% 或 100% 三段，提供漸進的崩盤保護。' +
    '風險部位（1 − 現金比例）投入「進攻腿」：比較那斯達克與標普 500 的 13612W 動能，持有較強者，並以波動目標槓桿（30% ÷ 近 3 個月波動，上限 2 倍，1x＋2x ETF）放大。' +
    '現金部位投入中期/長期公債、黃金、現金中近半年趨勢最強者。金絲雀讓策略在趨勢真正轉壞前就先降風險，研究中報酬與 Sharpe 俱佳、三個起算窗都勝過 VOO。純指數，無存活者偏誤。',
  rules: [
    '金絲雀 = {國際股 EAFE, 長期公債}；每有一個 13612W 動能非正，現金比例 +50%。',
    '風險部位（1 − 現金比例）投入那斯達克/標普中 13612W 較強者，波動目標槓桿（上限 2 倍）。',
    '現金部位投入趨勢最強的公債/黃金/現金。',
    '每月再評估一次；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '金絲雀僅兩個資產，現金比例只有 0/50/100 三段，較粗。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '月頻訊號，金絲雀示警與實際崩盤的領先時間不固定。',
  ],
  tags: ['防禦', '動能廣度', '崩盤保護', '資產配置'],
  rebalance: 'monthly',
  universe: [
    '那斯達克100 (1x/2x)',
    '標普500 (1x/2x)',
    '國際股 EAFE',
    '中/長期公債',
    '黃金',
    '現金',
  ],
  assets: [
    ASSET.USLC,
    ASSET.USLC2X,
    ASSET.NASDAQ,
    ASSET.NASDAQ2X,
    ASSET.INTL,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    // Canary breadth: count canary assets with non-positive 13612W momentum.
    const canary = [ASSET.INTL, ASSET.LTT].filter((a) => ctx.has(a));
    const bad = canary.filter((a) => (ctx.score13612W(a) ?? -1) <= 0).length;
    const cashFrac = clamp(bad / (canary.length || 1), 0, 1);
    const riskyFrac = 1 - cashFrac;
    // Risky sleeve: stronger of Nasdaq vs S&P by relative momentum, vol-targeted leveraged.
    const offense = bestBy([ASSET.NASDAQ, ASSET.USLC], (a) => ctx.score13612W(a), ASSET.USLC);
    const twoX = offense === ASSET.NASDAQ ? ASSET.NASDAQ2X : ASSET.USLC2X;
    const risky = leveragedEquity(ctx, offense, twoX, undefined, riskyFrac, 0.3, 2);
    // Defensive sleeve: best-trending bond/gold/cash takes the cash fraction.
    return capHoldings(addW(risky, { [bestDefensive(ctx)]: cashFrac }), 10);
  },
};
