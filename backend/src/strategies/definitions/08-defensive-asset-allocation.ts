import { ASSET, AssetKey } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, inverseVolWeights } from './_helpers';

/**
 * Strategy 8: Defensive Asset Allocation (Keller & Keuning). Same canary/breadth
 * defense, but the offensive sleeve is sized by inverse volatility instead of
 * equal weight so high-vol assets don't dominate the risk budget — smoother
 * curve, higher Sharpe.
 */
export const defensiveAssetAllocation: StrategyDefinition = {
  id: 'defensive-asset-allocation',
  name: '防禦資產配置 DAA',
  shortName: '防禦配置 DAA',
  category: 'diversified',
  description: '用「金絲雀」資產偵測風險切換攻守，攻擊端以反波動度權重配置，避免高波動資產主導風險。',
  longDescription:
    'Keller & Keuning 的 Defensive Asset Allocation。用反應快速的「金絲雀」資產（國際股與中期公債）做為市場廣度的預警：' +
    '兩個金絲雀動能皆為正時全力進攻，只要其中一個轉負就降風險，兩個都轉負則全數防禦。攻擊端不採等權，而是以反波動度權重配置——' +
    '波動高的資產（如那斯達克、黃金）權重較低，使各資產對組合風險的貢獻更平衡，讓資金曲線更平滑、Sharpe 更高，回撤維持相近水準。',
  rules: [
    '每月底以 13612W 動能 = 12×1月 + 4×3月 + 2×6月 + 1×12月 報酬計分，金絲雀為國際股與中期公債。',
    '兩金絲雀皆 > 0 → 攻擊池前 6 名，依反波動度權重配置。',
    '一個 > 0 → 50% 攻擊前 3 名（反波動度權重）+ 50% 最佳防禦資產。',
    '皆 ≤ 0 → 100% 最佳防禦資產（現金/中/長期公債）。',
  ],
  caveats: ['反波動度權重對波動估計敏感。', '部分標的歷史較短，早期以可得資產運作。'],
  tags: ['資產配置', '風險平衡', '危機防護'],
  rebalance: 'monthly',
  universe: ['多資產攻擊池（反波動度）', '公債防禦池'],
  assets: [
    ASSET.USLC,
    ASSET.NASDAQ,
    ASSET.SMALL,
    ASSET.INTL,
    ASSET.GOLD,
    ASSET.LTT,
    ASSET.ITT,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC, ASSET.ITT, ASSET.LTT],
  warmupDays: DAYS.YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const offensive: AssetKey[] = [
      ASSET.USLC,
      ASSET.NASDAQ,
      ASSET.SMALL,
      ASSET.INTL,
      ASSET.GOLD,
      ASSET.LTT,
    ];
    const defensive: AssetKey[] = [ASSET.CASH, ASSET.ITT, ASSET.LTT];
    const canaryEquity = ctx.has(ASSET.INTL) ? ASSET.INTL : ASSET.USLC;
    const cEq = ctx.score13612W(canaryEquity) ?? 0;
    const cBond = ctx.score13612W(ASSET.ITT) ?? 0;
    const goodCanaries = (cEq > 0 ? 1 : 0) + (cBond > 0 ? 1 : 0);
    const bestDef = bestBy(defensive, (a) => ctx.score13612W(a), ASSET.CASH);

    if (goodCanaries === 2) {
      const w = inverseVolWeights(ctx, offensive, 6, 20, 1);
      return Object.keys(w).length ? w : { [bestDef]: 1 };
    }
    if (goodCanaries === 1) {
      const w = inverseVolWeights(ctx, offensive, 3, 20, 0.5);
      w[bestDef] = (w[bestDef] ?? 0) + 0.5;
      return w;
    }
    return { [bestDef]: 1 };
  },
};
