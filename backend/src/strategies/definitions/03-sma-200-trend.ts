import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/** Strategy 3: classic 200-day SMA trend filter. */
export const sma200Trend: StrategyDefinition = {
  id: 'sma-200-trend',
  name: '200 日均線趨勢濾網',
  shortName: '200 日均線',
  category: 'trend-following',
  description: '經典擇時：站上 200 日均線持有標普 500，跌破則轉入中期公債。',
  longDescription:
    '最廣為人知的長線趨勢濾網。當標普 500 收盤價高於 200 日均線時，市場處於多頭，便 100% 持有股票；' +
    '一旦跌破 200 日均線就轉入中期公債避險。歷史上最大的跌幅幾乎都發生在 200 日均線之下，因此這條濾網能把最大回撤砍掉約一半，' +
    '讓資金曲線更平滑。',
  rules: [
    '每日檢查標普 500 收盤價與 200 日均線。',
    '收盤價 > 200 日均線 → 100% 美國大型股。',
    '收盤價 < 200 日均線 → 100% 中期公債。',
    '每月最多交易 3 次。',
  ],
  caveats: [
    '盤整年份（如 2011、2015、2018）容易來回被巴。',
    '均線落後，重新進場通常較慢，會錯過反彈初段。',
  ],
  signalFormula: [
    'price = level(USLC)',
    'ma200 = sma(USLC, 200)',
    '',
    'if price > ma200:',
    '    weight = { USLC: 1.0 }',
    'else:',
    '    weight = { ITT: 1.0 }   // 轉入中期公債避險',
  ].join('\n'),
  tags: ['趨勢', '擇時', '低槓桿'],
  rebalance: 'daily',
  universe: ['美國大型股', '中期公債'],
  assets: [ASSET.USLC, ASSET.ITT],
  coreAssets: [ASSET.USLC, ASSET.ITT],
  warmupDays: 205,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    if (price === undefined || ma === undefined) return { [ASSET.ITT]: 1 };
    return price > ma ? { [ASSET.USLC]: 1 } : { [ASSET.ITT]: 1 };
  },
};
