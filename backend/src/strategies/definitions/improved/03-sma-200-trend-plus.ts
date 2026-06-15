import { ASSET } from '../../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../../strategy.types';
import { bestBy, clamp, equityExposureWeights } from '../_helpers';

/**
 * Improved 200-SMA trend: vol-scaled equity exposure when in trend (steadier
 * risk → higher Sharpe), and a dual safe-asset (best-trending Treasury) off-trend.
 */
export const sma200TrendPlus: StrategyDefinition = {
  id: 'sma-200-trend-plus',
  name: '200 日均線（改良版）',
  shortName: '200 日均線+',
  category: 'trend-following',
  description: '趨勢向上時以波動度目標調整曝險（0.5～1.5 倍），跌破則轉入最強趨勢公債。',
  longDescription:
    '原版 200 日均線濾網的改良。趨勢向上時不再固定 100% 持股，而是用波動度目標（15%）動態調整曝險，' +
    '上限 1.5 倍、下限 0.5 倍，讓投資組合風險更穩定、提升 Sharpe；跌破 200 日均線時，避險端在中期與長期公債中選趨勢較強者。',
  rules: [
    '每日檢查標普 500 與其 200 日均線。',
    '站上均線：曝險 = clamp(15% ÷ 20 日波動度, 0.5, 1.5)。',
    '跌破均線：轉入中期/長期公債中 13612W 動能較強者 100%。',
    '每月最多交易 3 次。',
  ],
  caveats: [
    '波動度目標使用落後資料；偶有 1.5 倍曝險於波動突升時放大短期回撤。',
    '為配合無狀態引擎，未加入遲滯帶 (hysteresis)。',
  ],
  signalFormula: [
    'if level(USLC) > sma(USLC, 200):',
    '    E = clamp(0.15 / vol(USLC, 20), 0.5, 1.5)   // 目標曝險',
    '    // >1 倍以 SSO(2x)+1x 達成，不融資',
    '    weight = E<=1 ? { USLC: E } : { SSO: E-1, USLC: 2-E }',
    'else:',
    '    safe = score13612W(LTT) > score13612W(ITT) ? LTT : ITT',
    '    weight = { [safe]: 1.0 }',
  ].join('\n'),
  tags: ['趨勢', '波動度', '改良版'],
  rebalance: 'daily',
  universe: ['美國大型股', '2x 標普500 (SSO)', '中/長期公債'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.ITT, ASSET.LTT],
  coreAssets: [ASSET.USLC, ASSET.ITT, ASSET.LTT],
  warmupDays: 260,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    if (price === undefined || ma === undefined) {
      return { [ASSET.ITT]: 1 };
    }
    if (price > ma) {
      const rv = ctx.vol(ASSET.USLC, 20);
      const e = rv && rv > 0 ? clamp(0.15 / rv, 0.5, 1.5) : 1;
      return equityExposureWeights(e, ASSET.USLC, ASSET.USLC2X);
    }
    const safe = bestBy([ASSET.LTT, ASSET.ITT], (a) => ctx.score13612W(a), ASSET.ITT);
    return { [safe]: 1 };
  },
};
