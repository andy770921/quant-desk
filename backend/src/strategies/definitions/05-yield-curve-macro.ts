import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, leveragedEquity, trendUp } from './_helpers';

/**
 * Strategy 5 (S4) — Yield-Curve Macro Regime. Source: Estrella & Mishkin — the
 * 10y−3m Treasury spread is the premier recession predictor (it inverts ~12–18
 * months before recessions). Use it as a macro risk gate. Monthly.
 *
 * Risk-OFF (best-trending Treasury/gold/cash) when the curve inverts (10y < 3m)
 * OR the S&P breaks its 200-day trend; otherwise risk-ON with vol-targeted
 * leveraged S&P (cap 2x via the 1x/2x ETF blend). Rates + index only ⇒ bias-free,
 * and a genuinely different (macro/rates) mechanism from the other books.
 */
export const yieldCurveMacro: StrategyDefinition = {
  id: 's4-yield-curve-macro',
  name: '殖利率曲線總經',
  shortName: '殖利率曲線',
  category: 'diversified',
  description:
    '用美國公債殖利率曲線（10 年期 − 3 個月期利差）作為總經風險閘門：曲線倒掛（10 年 < 3 月，衰退前兆）或 S&P 500 跌破 200 日均線時，全數轉入趨勢最強的公債/黃金/現金；曲線正常且趨勢向上時，以波動目標槓桿做多 S&P 500（上限 2 倍）。',
  longDescription:
    'Estrella–Mishkin 的研究指出，10 年期減 3 個月期公債殖利率「利差」是最可靠的衰退領先指標——曲線通常在衰退前 12–18 個月就倒掛。本策略把它當成總經風險開關。' +
    '每月檢查：①殖利率曲線 = 10 年期殖利率 − 3 個月期殖利率。若 < 0（真正倒掛）→ 衰退警訊，全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者；②即使曲線正常，若 S&P 500 跌破 200 日均線（趨勢已壞）→ 同樣轉入避險資產。' +
    '只有當「曲線為正 且 趨勢向上」時才承擔風險，以波動目標（30% ÷ 近 3 個月波動，上限 2 倍，1x＋2x ETF）做多 S&P 500。' +
    '只用利率與指數資料，無存活者偏誤，且是九個策略中唯一以「利率/總經」為核心訊號者，與其他趨勢/動能策略低度相關。倒掛門檻在 −0.5～+0.5 之間都能勝過 VOO，採用最標準的 0。',
  rules: [
    '殖利率曲線 = 10 年期殖利率 − 3 個月期殖利率。',
    '曲線 < 0（倒掛）或 S&P 500 < 200 日均線 → 全數轉入趨勢最強的公債/黃金/現金。',
    '曲線 ≥ 0 且趨勢向上 → 曝險 = 30% ÷ 近 3 個月波動（上限 2 倍），1x＋2x 標普 ETF 組成。',
    '每月再評估一次；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '殖利率曲線領先時間長且不固定，倒掛後市場可能仍續漲一段時間。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '月頻訊號，無法即時反映盤中急跌。',
  ],
  tags: ['總經', '利率', '殖利率曲線', '槓桿'],
  rebalance: 'monthly',
  universe: ['標普500 (1x/2x)', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const tnx = ctx.yieldVal('TNX');
    const irx = ctx.yieldVal('IRX');
    const curve = tnx !== undefined && irx !== undefined ? tnx - irx : undefined;
    // Inverted curve (10y < 3m) → recession warning → risk-off.
    if (curve !== undefined && curve < 0) return { [bestDefensive(ctx)]: 1 };
    // Broken trend → risk-off.
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    // Healthy curve + uptrend → vol-targeted leveraged S&P.
    return leveragedEquity(ctx, ASSET.USLC, ASSET.USLC2X, undefined, 1, 0.3, 2);
  },
};
