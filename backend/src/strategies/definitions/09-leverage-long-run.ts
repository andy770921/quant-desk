import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equityExposureWeights, trendExposure, volTargetExposure } from './_helpers';

/**
 * Strategy 9 (S8) — Leverage for the Long Run (graduated). Source: Gayed &
 * Bilello (2016). Trend-gated leveraged S&P, but GRADUATED: instead of a binary
 * 200-day gate (a whole-book flip on one day), exposure scales with an ENSEMBLE
 * of 50/100/150/200/250-day trend signals, so the book moves in ~20% steps. Daily.
 *
 * Exposure = (fraction of MA windows the price is above) × vol-target, capped at
 * 3x, expressed via the S&P 1x/2x/3x ETF blend; the un-invested remainder is
 * parked defensively. Graduation cut max drawdown vs the binary version at a
 * small return cost — the realism trade-off. Bias-free (index only).
 */
export const leverageLongRun: StrategyDefinition = {
  id: 's8-leverage-long-run',
  name: '長線槓桿（漸進趨勢）',
  shortName: '長線槓桿',
  category: 'trend-following',
  description:
    '趨勢過濾的槓桿標普，但採「漸進式」而非全有全無：用 50/100/150/200/250 五條均線的集合，計算價格站上幾條（0～1），曝險 = 該比例 × 波動目標（上限 3 倍），以 1x/2x/3x 標普 ETF 組成；未投入部分停泊在趨勢最強的避險資產。',
  longDescription:
    'Gayed–Bilello「Leverage for the Long Run」(2016) 指出：槓桿要長期可行，關鍵是只在趨勢向上時加碼、避開空頭裡的波動耗損。本策略採用論文的「漸進式」版本，避免單日全進全出的劇烈翻轉。' +
    '每日用 50、100、150、200、250 五條移動平均線組成趨勢集合，計算標普 500 價格站上幾條（趨勢強度 0～1，每條約 20%）。趨勢強度為 0 時全數轉入避險資產；否則曝險 = 趨勢強度 × 波動目標（30% ÷ 近 3 個月波動），上限 3 倍。' +
    '曝險透過 1x／2x／3x 標普 ETF 的組合表達（買 ETF，不融資）；未投入的資金停泊在中期/長期公債、黃金、現金中近半年趨勢最強者，形成「漸進式」的風險開關。' +
    '漸進式相較二元式（0%↔100%）把最大回撤明顯降低，代價是略低的報酬——這是換取真實可執行性的取捨。純指數，無存活者偏誤。',
  rules: [
    '趨勢強度 = 標普價格站上 {50,100,150,200,250} 五條均線的比例（0～1）。',
    '強度為 0 → 全數轉入趨勢最強的公債/黃金/現金。',
    '否則曝險 = 強度 × (30% ÷ 近 3 個月波動)，上限 3 倍，以 1x/2x/3x 標普 ETF 組成。',
    '未投入部分停泊避險資產；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '3 倍槓桿波動極大，急殺或跳空無法靠日線濾網完全避開。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
    '漸進式換取較低回撤，代價是多頭時報酬略低於滿倉槓桿。',
  ],
  tags: ['槓桿', '趨勢', '漸進', '標普500'],
  rebalance: 'daily',
  universe: ['標普500 (1x/2x/3x)', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.USLC3X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    // Graduated trend strength over an ensemble of MA windows (0..1, ~20% steps).
    const tf = trendExposure(ctx, ASSET.USLC, [50, 100, 150, 200, 250]);
    if (tf <= 0) return { [bestDefensive(ctx)]: 1 };
    // Exposure = trend strength × vol-target, capped at 3x.
    const E = tf * volTargetExposure(ctx, ASSET.USLC, 0.3, 3);
    const eq = equityExposureWeights(E, ASSET.USLC, ASSET.USLC2X, ASSET.USLC3X);
    const invested = Object.values(eq).reduce<number>((s, x) => s + (x ?? 0), 0);
    // Graduated risk-off: defensive sleeve takes the un-invested remainder.
    if (invested < 0.999) eq[bestDefensive(ctx)] = Number((1 - invested).toFixed(4));
    return eq;
  },
};
