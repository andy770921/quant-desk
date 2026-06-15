import { ASSET, AssetKey } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { rankBy } from './_helpers';

/** Strategy 8: Defensive Asset Allocation (Keller & Keuning). */
export const defensiveAssetAllocation: StrategyDefinition = {
  id: 'defensive-asset-allocation',
  name: '防禦資產配置 DAA',
  shortName: '防禦配置 DAA',
  category: 'diversified',
  description: '用「金絲雀」資產偵測風險，在攻擊型動能組合與防禦型債券之間切換。',
  longDescription:
    'Keller & Keuning 的 Defensive Asset Allocation。用反應快速的「金絲雀」資產（國際股與債券）做為市場廣度的預警：' +
    '兩個金絲雀動能皆為正時全力進攻，持有攻擊池中 13612W 動能最強的數檔；只要其中一個轉負就降風險，兩個都轉負則全數防禦。' +
    '這套早期預警機制在金融危機時防守特別出色。',
  rules: [
    '每月底以 13612W 動能 = 12×1月 + 4×3月 + 2×6月 + 1×12月 報酬計分。',
    '金絲雀（國際股、債券）皆 > 0 → 進攻：持有攻擊池前段班，等權。',
    '一個金絲雀 ≤ 0 → 半攻半守（50% 攻擊前段 + 50% 最佳防禦資產）。',
    '兩個金絲雀皆 ≤ 0 → 100% 最佳防禦資產（現金 / 中期 / 長期公債）。',
  ],
  caveats: [
    '部分標的歷史較短，早期以可得資產縮減版運作。',
    '金絲雀偶有假警報，於淺回檔時被洗到現金。',
  ],
  signalFormula: [
    'score(x) = 12*ret(x,21) + 4*ret(x,63) + 2*ret(x,126) + ret(x,252)  // 13612W',
    'canary   = [INTL(or USLC), ITT]; nGood = count(score(c) > 0)',
    'bestDef  = argmax over {CASH, ITT, LTT} of score(.)',
    'offense  = sort {USLC,NASDAQ,SMALL,INTL,GOLD,LTT} by score desc',
    '',
    'if nGood == 2: weight = equal-weight top 6 of offense',
    'elif nGood == 1: weight = 50% (equal top 3 of offense) + 50% bestDef',
    'else: weight = { [bestDef]: 1.0 }',
  ].join('\n'),
  tags: ['資產配置', '動能', '危機防護'],
  rebalance: 'monthly',
  universe: ['多資產攻擊池', '公債防禦池'],
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
    const offensivePool: AssetKey[] = [
      ASSET.USLC,
      ASSET.NASDAQ,
      ASSET.SMALL,
      ASSET.INTL,
      ASSET.GOLD,
      ASSET.LTT,
    ];
    const defensivePool: AssetKey[] = [ASSET.CASH, ASSET.ITT, ASSET.LTT];
    const canaryEquity = ctx.has(ASSET.INTL) ? ASSET.INTL : ASSET.USLC;
    const cEq = ctx.score13612W(canaryEquity) ?? 0;
    const cBond = ctx.score13612W(ASSET.ITT) ?? 0;
    const goodCanaries = (cEq > 0 ? 1 : 0) + (cBond > 0 ? 1 : 0);

    const bestDefensive = rankBy(defensivePool, (a) => ctx.score13612W(a))[0]?.asset ?? ASSET.CASH;
    const offensive = rankBy(offensivePool, (a) => ctx.score13612W(a));

    if (goodCanaries === 2) {
      const top = offensive.slice(0, 6);
      if (top.length === 0) return { [bestDefensive]: 1 };
      const w: Weights = {};
      for (const { asset } of top) w[asset] = 1 / top.length;
      return w;
    }
    if (goodCanaries === 1) {
      const top = offensive.slice(0, 3);
      const w: Weights = { [bestDefensive]: 0.5 };
      const per = top.length ? 0.5 / top.length : 0;
      for (const { asset } of top) w[asset] = (w[asset] ?? 0) + per;
      if (top.length === 0) w[bestDefensive] = 1;
      return w;
    }
    return { [bestDefensive]: 1 };
  },
};
