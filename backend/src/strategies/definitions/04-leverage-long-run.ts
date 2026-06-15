import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/** Strategy 4: Leverage for the Long Run (Gayed). */
export const leverageLongRun: StrategyDefinition = {
  id: 'leverage-long-run',
  name: '長線槓桿 (Gayed)',
  shortName: '長線槓桿',
  category: 'trend-following',
  description: 'Michael Gayed 的方法：站上 200 日均線時用 3 倍槓桿做多標普，跌破則轉公債。',
  longDescription:
    'Michael Gayed 的「Leverage for the Long Run」。只在 200 日均線之上、也就是相對平靜的多頭趨勢中才動用 3 倍槓桿，' +
    '把槓桿最致命的高波動下跌期排除在外；跌破 200 日均線就退到中期公債。如此一來，槓桿的路徑依賴反而成為順風。',
  rules: [
    '每日檢查標普 500 與其 200 日均線。',
    '收盤價 > 200 日均線 → 100% 資金買入 UPRO（3 倍標普 ETF，不融資）。',
    '收盤價 < 200 日均線 → 100% 中期公債。',
    '每月最多交易 3 次。',
  ],
  caveats: [
    '開盤跳空大跌（如 1987、2020 年 3 月）日線濾網無法避免。',
    '盤整時槓桿仍會耗損；對借貸成本敏感。',
  ],
  signalFormula: [
    'price = level(USLC)',
    'ma200 = sma(USLC, 200)',
    '',
    'if price > ma200:',
    '    weight = { UPRO: 1.0 }   // 100% 買入 3x 標普 ETF（趨勢向上時）',
    'else:',
    '    weight = { ITT: 1.0 }    // 退到中期公債',
  ].join('\n'),
  tags: ['槓桿', '趨勢', '標普500'],
  rebalance: 'daily',
  universe: ['3x 標普500 (UPRO)', '中期公債'],
  assets: [ASSET.USLC3X, ASSET.ITT],
  coreAssets: [ASSET.USLC3X, ASSET.ITT],
  warmupDays: 205,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    if (price === undefined || ma === undefined) return { [ASSET.ITT]: 1 };
    return price > ma ? { [ASSET.USLC3X]: 1 } : { [ASSET.ITT]: 1 };
  },
};
