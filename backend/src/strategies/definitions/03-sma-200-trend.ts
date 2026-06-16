import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, clamp, equityExposureWeights } from './_helpers';

/**
 * Strategy 3: 200-day SMA trend filter with vol-scaled equity exposure when in
 * trend (steadier risk → higher Sharpe) and a dual safe-asset
 * (best-trending Treasury) off-trend.
 */
export const sma200Trend: StrategyDefinition = {
  id: 'sma-200-trend',
  name: '200 日均線趨勢濾網',
  shortName: '200 日均線',
  category: 'trend-following',
  description: '趨勢向上時以波動度目標調整曝險（0.5～1.5 倍），跌破則轉入最強趨勢公債。',
  longDescription:
    '經典的 200 日均線長線趨勢濾網。趨勢向上時不固定 100% 持股，而是用波動度目標（15%）動態調整曝險，' +
    '上限 1.5 倍、下限 0.5 倍，讓投資組合風險更穩定、提升 Sharpe；跌破 200 日均線時，避險端在中期與長期公債中選趨勢較強者。' +
    '歷史上最大的跌幅幾乎都發生在 200 日均線之下，這條濾網能把最大回撤砍掉約一半，讓資金曲線更平滑。',
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
  tags: ['趨勢', '波動度', '擇時'],
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
