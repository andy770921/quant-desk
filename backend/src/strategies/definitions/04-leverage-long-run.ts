import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, clamp, equityExposureWeights } from './_helpers';

/**
 * Strategy 4: Leverage for the Long Run (Gayed). Leverage stays behind a trend
 * + short-term confirmation, but is vol-throttled (target ~30% vol, 1x–3x) so
 * 3x only applies in calm uptrends.
 */
export const leverageLongRun: StrategyDefinition = {
  id: 'leverage-long-run',
  name: '長線槓桿 (Gayed)',
  shortName: '長線槓桿',
  category: 'trend-following',
  description:
    '只在趨勢向上且短線翻多時動用槓桿，並以波動度目標 (30%) 調整槓桿倍數，平靜期才放大到 3 倍。',
  longDescription:
    'Michael Gayed 的「Leverage for the Long Run」，波動節流版本。除了 200 日均線濾網外，再加上短期動能確認（過去一個月為正），' +
    '並用波動度目標（30%）把曝險限制在 1～3 倍之間——只有在波動低的多頭才放大到 3 倍，波動升高時自動降槓桿，' +
    '大幅降低高波動下跌期的災難式回撤，在保留多數上漲的同時顯著提升 Sharpe；跌破均線或短線翻空時退到趨勢最強的公債。',
  rules: [
    '每日檢查 200 日均線與過去 1 個月報酬。',
    '兩者皆為多頭：曝險 = clamp(30% ÷ 20 日波動度, 1.0, 3.0)，以 1x/SSO(2x)/UPRO(3x) 混合達成，不融資。',
    '否則：轉入中期/長期公債中 13612W 動能較強者 100%。',
    '每月最多交易 3 次。',
  ],
  caveats: ['仍有開盤跳空風險，但波動節流可降低高波動期的回撤。', '對借貸成本與波動估計敏感。'],
  tags: ['槓桿', '趨勢', '標普500'],
  rebalance: 'daily',
  universe: ['美國大型股', '2x 標普500 (SSO)', '3x 標普500 (UPRO)', '中/長期公債'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.USLC3X, ASSET.ITT, ASSET.LTT],
  coreAssets: [ASSET.USLC, ASSET.ITT, ASSET.LTT],
  warmupDays: 260,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    const mom = ctx.ret(ASSET.USLC, DAYS.MONTH);
    if (price === undefined || ma === undefined || mom === undefined) {
      return { [ASSET.ITT]: 1 };
    }
    if (price > ma && mom > 0) {
      const rv = ctx.vol(ASSET.USLC, 20);
      const e = rv && rv > 0 ? clamp(0.3 / rv, 1, 3) : 1;
      return equityExposureWeights(e, ASSET.USLC, ASSET.USLC2X, ASSET.USLC3X);
    }
    const safe = bestBy([ASSET.LTT, ASSET.ITT], (a) => ctx.score13612W(a), ASSET.ITT);
    return { [safe]: 1 };
  },
};
