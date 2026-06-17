import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { addW, capHoldings, equalWeight, leveragedEquity, trendUp } from './_helpers';

/**
 * Strategy 2 (S1) — Diversified Time-Series Momentum (managed futures).
 * Source: Moskowitz, Ooi & Pedersen, "Time Series Momentum" (JFE 2012).
 *
 * Hold each sleeve (equity / long Treasuries / gold) only while its OWN 12-month
 * absolute momentum is positive AND it trades above its 200-day MA; equal-risk
 * across the sleeves that pass, and express the equity sleeve with vol-targeted
 * leverage (cap 2x, via the Nasdaq 1x/2x ETF blend, held with cash). When no
 * sleeve qualifies it sits in cash. Its return engine is bonds + gold + stocks
 * each gated by its own trend, so it earns in non-equity regimes (e.g. 2022) and
 * trails QQQ in equity bulls by design — a genuine diversifier, bias-free.
 */
export const diversifiedTsmom: StrategyDefinition = {
  id: 's1-tsmom-managed-futures',
  name: '多元時間序列動能',
  shortName: '多元TSMOM',
  category: 'diversified',
  description:
    '對「那斯達克、長期公債、黃金」三個資產各自獨立判斷：唯有該資產近 12 個月絕對動能為正、且站上 200 日均線時才持有；通過者等權重配置，股票腿再以波動目標槓桿（上限 2 倍，買 ETF 不融資）放大。三腿都不合格就全數轉現金。',
  longDescription:
    'Moskowitz–Ooi–Pedersen「Time Series Momentum」(2012) 的跨資產管理期貨版本：每個資產腿都用「自己的趨勢」決定要不要持有，因此報酬引擎是股票、長債、黃金三者的組合，而非單押股市。' +
    '每日檢查那斯達克、長期公債、黃金三腿——只有「近 12 個月報酬 > 0」且「價格站上 200 日均線」的腿才納入，並對通過的腿等權重（等風險預算）配置。' +
    '股票腿不只買 1x：以波動目標（目標年化 30% ÷ 近 3 個月實現波動，上限 2 倍）決定槓桿，透過 1x 那斯達克＋2x 那斯達克 ETF 的組合達成。' +
    '當三腿全部不合格（如 2008、2022 同時空頭）就全數退場至現金。它在股市多頭時刻意落後 QQQ，但能在非股市行情（2022 通膨年）靠債/金獲利，是真正分散、且無存活者偏誤的策略。',
  rules: [
    '檢查那斯達克、長期公債、黃金三腿：各自需「近 252 日報酬 > 0」且「價格 > 200 日均線」才納入。',
    '通過的腿等權重配置（等風險預算）。',
    '股票腿曝險 = 30% ÷ 近 3 個月年化波動（上限 2 倍），以 1x＋2x 那斯達克 ETF 組成。',
    '三腿皆不合格 → 全數轉現金。每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '趨勢策略在 V 型反轉中容易兩面挨耳光：跌破時退場、剛買回又拉回。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '多頭時因分散到債/金，報酬會明顯落後純股市指數。',
  ],
  tags: ['動能', '管理期貨', '分散', '趨勢'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', '長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.LTT, ASSET.GOLD, ASSET.ITT, ASSET.USLC, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const sleeves = [ASSET.NASDAQ, ASSET.LTT, ASSET.GOLD];
    // Each sleeve held only if its own 12-month absolute momentum is positive AND in uptrend.
    const on = sleeves.filter(
      (a) => (ctx.ret(a, 252) ?? -1) > 0 && trendUp(ctx, a, 200) && ctx.has(a),
    );
    if (!on.length) return { [ASSET.CASH]: 1 };
    let w = equalWeight(on, 1);
    // Express the equity sleeve (Nasdaq) with vol-targeted leverage to lift compounding.
    const eqBudget = w[ASSET.NASDAQ];
    if (eqBudget) {
      delete w[ASSET.NASDAQ];
      w = addW(w, leveragedEquity(ctx, ASSET.NASDAQ, ASSET.NASDAQ2X, undefined, eqBudget, 0.3, 2));
    }
    return capHoldings(w, 10);
  },
};
