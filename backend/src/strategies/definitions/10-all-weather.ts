import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equalWeight, topStocksByMomentum, trendUp } from './_helpers';

/**
 * Strategy 10: Broad Stock Momentum (top 75), UNLEVERAGED. The widest, lowest-
 * turnover momentum book on the platform — equal-weighting the 75 strongest
 * 12-1 momentum names is close to a "momentum-tilted large-cap index", which
 * keeps single-name and survivorship-bias impact lower than concentrated books.
 * Trend-gated to bonds when the market is below its 200-day average.
 */
export const allWeather: StrategyDefinition = {
  id: 'stock-momentum-broad-75',
  name: '廣度個股動能 75',
  shortName: '廣度動能75',
  category: 'momentum',
  description:
    '大盤多頭時等權持有 12-1 動能最強的 75 檔個股（最廣、最分散的動能組合，近似「動能傾斜的大型股指數」）；大盤跌破 200 日均線則轉入公債/黃金/現金。換手與集中度都最低。',
  longDescription:
    '與「個股動能 50」同樣是橫斷面動能，但持有更廣的 75 檔，是平台上最分散、最低換手的動能策略。' +
    '持股越廣，越接近「動能傾斜的大型股指數」，單一個股風險與存活者偏誤的影響也相對較低，績效更貼近動能因子本身（而非少數明星股）。' +
    '每月底等權買進 12-1 動能最強的 75 檔，並以大盤 200 日均線為總開關：跌破時全數轉入中期/長期公債、黃金、現金中趨勢最強者。' +
    '相較「個股動能 50」報酬略低、但更穩、回撤更小。全程不使用槓桿。',
  rules: [
    '每月底計算股票池中每檔的 12-1 動能。',
    '大盤站上 200 日均線：等權買進動能最強的 75 檔個股。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，歷史績效偏樂觀（但廣度越大影響越小）。',
    '持股廣、貼近大盤，超額報酬會低於集中型動能。',
    '動能崩潰期（如 2009 反轉）仍會回撤，靠 200 日均線總開關緩解。',
  ],
  tags: ['動能', '選股', '廣度', '低換手', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['S&P 500 個股（約 500 檔）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const top = topStocksByMomentum(ctx, 75);
    return top.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);
  },
};
