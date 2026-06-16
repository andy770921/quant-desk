import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { clamp, equityExposureWeights } from './_helpers';

/**
 * Strategy 7: volatility-targeted S&P 500 exposure with a 200-SMA trend gate
 * that throttles the target vol off-trend (cuts bear-market exposure); idle
 * capital sits in a trending Treasury.
 */
export const volTargetSpy: StrategyDefinition = {
  id: 'vol-target-spy',
  name: '波動度目標 (標普500)',
  shortName: '波動度目標',
  category: 'volatility',
  description:
    '以 200 日均線趨勢閘門調整目標波動：趨勢向上 15%、跌破降為 5%；閒置資金改持趨勢公債。',
  longDescription:
    '波動度目標策略。每月以過去 20 日的已實現波動度估算市場風險，曝險 = 目標波動 ÷ 已實現波動，上限 2 倍、下限 0。' +
    '單純波動度目標在空頭仍可能滿倉，因此加上 200 日均線趨勢閘門：趨勢向上時目標波動 15%，跌破均線時把目標波動降到 5%（大幅縮減曝險）；' +
    '未投入的資金不再閒置於現金，而是配置到趨勢向上的中期公債，提升閒置資金報酬，兼顧降低回撤與提升 Sharpe。',
  rules: [
    '目標波動：標普 500 站上 200 日均線 → 15%；跌破 → 5%。',
    '股票曝險 = clamp(目標波動 ÷ 20 日波動度, 0, 2)，> 1 倍以 SSO(2x)+1x 達成，不融資。',
    '未投入部分（1 − min(曝險,1)）配置於中期公債（若動能 > 0）否則現金。',
    '每月再平衡一次。',
  ],
  caveats: ['波動度與趨勢皆為落後指標。', '高波動突升時 2 倍曝險仍有尾端風險。'],
  signalFormula: [
    'targetVol = level(USLC) > sma(USLC,200) ? 0.15 : 0.05  // 趨勢閘門',
    'E = clamp(targetVol / vol(USLC, 20), 0, 2)             // 目標曝險',
    '// 曝險用 ETF 表達，不融資：',
    'weight = E<=1 ? { USLC: E } : { SSO: E-1, USLC: 2-E }',
    'if E < 1:  // 剩餘資金停泊趨勢公債',
    '    safe = score13612W(ITT) > 0 ? ITT : CASH',
    '    weight[safe] += 1 - E',
  ].join('\n'),
  tags: ['波動度', '風險控管', '動態槓桿'],
  rebalance: 'monthly',
  universe: ['美國大型股', '2x 標普500 (SSO)', '中期公債', '現金'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.ITT, ASSET.CASH],
  coreAssets: [ASSET.USLC, ASSET.ITT],
  warmupDays: 260,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    const rv = ctx.vol(ASSET.USLC, 20);
    const inTrend = price !== undefined && ma !== undefined && price > ma;
    const targetVol = inTrend ? 0.15 : 0.05;
    const e = rv && rv > 0 ? clamp(targetVol / rv, 0, 2) : 1;
    const weights = equityExposureWeights(e, ASSET.USLC, ASSET.USLC2X);
    if (e < 1) {
      const rem = 1 - e;
      const ittScore = ctx.score13612W(ASSET.ITT);
      if (ittScore !== undefined && ittScore > 0) weights[ASSET.ITT] = Number(rem.toFixed(4));
      // else: remainder stays in cash (engine default).
    }
    return weights;
  },
};
