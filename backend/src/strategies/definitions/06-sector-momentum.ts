import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equalWeight, topStocksByMomentum, trendUp } from './_helpers';

/**
 * Strategy 6: Stock Cross-Sectional Momentum (top 50), UNLEVERAGED. Each month,
 * equal-weight the 50 S&P-500 names with the highest 12-1 momentum, but only
 * while the broad market is above its 200-day trend; otherwise step aside into
 * bonds. A broad (50-name) book keeps it diversified and curbs single-stock risk.
 */
export const sectorMomentum: StrategyDefinition = {
  id: 'stock-momentum-50',
  name: '個股動能 50',
  shortName: '個股動能50',
  category: 'momentum',
  description:
    '大盤站上 200 日均線時，等權持有 S&P 500 中 12-1 動能最強的 50 檔個股；大盤跌破 200 日均線就全數轉入趨勢最強的公債/黃金/現金。橫斷面動能因子，不使用槓桿。',
  longDescription:
    '經典的橫斷面動能 (cross-sectional momentum)：動能因子是學術與實務上最穩健的超額報酬來源之一 (Jegadeesh-Titman)。' +
    '每月底計算約 500 檔 S&P 500 成分股的 12-1 動能（跳過最近一個月的 12 個月報酬），等權買進最強的 50 檔；' +
    '並用大盤（標普 500）的 200 日均線當作「絕對動能」總開關：大盤跌破 200 日均線時全數離場，轉入中期/長期公債、黃金、現金中趨勢最強者，' +
    '藉此避開 2008、2022 這類動能崩潰 (momentum crash) 的時期。持有 50 檔分散個股風險，全程不使用槓桿。',
  rules: [
    '每月底計算股票池中每檔的 12-1 動能（1 個月前 ÷ 12 個月前 − 1）。',
    '大盤站上 200 日均線：等權買進動能最強的 50 檔個股。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '股票池為「目前」的 S&P 500 成分股，存在存活者偏誤 (survivorship bias)，歷史績效會被高估，僅供示意。',
    '僅有價量資料，無基本面，無法做品質/估值篩選。',
    '動能在市場反轉時會集體崩跌；200 日均線總開關可降低但無法消除此風險。',
  ],
  tags: ['動能', '選股', '橫斷面', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['S&P 500 個股（約 500 檔）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const top = topStocksByMomentum(ctx, 50);
    return top.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);
  },
};
