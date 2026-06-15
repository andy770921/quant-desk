import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/** Strategy 9: Connors RSI(2) mean reversion gated by the 200-day SMA. */
export const rsi2MeanReversion: StrategyDefinition = {
  id: 'rsi2-mean-reversion',
  name: 'RSI(2) 均值回歸',
  shortName: 'RSI(2) 抄底',
  category: 'mean-reversion',
  description: 'Connors 短線抄底：在 200 日均線之上、RSI(2) 超賣時買進標普，反彈後轉現金。',
  longDescription:
    'Larry Connors 的短線均值回歸。只在主趨勢向上（標普 500 站上 200 日均線）時操作，當 2 日 RSI 跌破 10 代表短線超賣，' +
    '買進標普；待短線回穩後轉回現金。買「上升趨勢中的急跌」歷史上有不錯的勝率，多數時間持有現金。',
  rules: [
    '趨勢濾網：僅在標普 500 收盤價 > 200 日均線時做多。',
    '進場：2 日 RSI < 10 → 100% 美國大型股。',
    '出場：條件不再成立 → 100% 現金。',
    '每月最多交易 3 次。',
  ],
  caveats: [
    '市場曝險低，總報酬通常較低。',
    '無停損，超賣後若演變成崩盤（如 2020 年 2 月）會受傷。',
    '此異常自 2010 年代起已逐漸式微。',
  ],
  signalFormula: [
    'trend = level(USLC) > sma(USLC, 200)',
    'r     = rsi(USLC, 2)',
    '',
    'if trend and r < 10:',
    '    weight = { USLC: 1.0 }   // 超賣抄底',
    'else:',
    '    weight = { }             // 100% 現金',
  ].join('\n'),
  tags: ['均值回歸', '短線', '抄底'],
  rebalance: 'daily',
  universe: ['美國大型股', '現金'],
  assets: [ASSET.USLC, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 205,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma200 = ctx.sma(ASSET.USLC, 200);
    const r = ctx.rsi(ASSET.USLC, 2);
    if (price === undefined || ma200 === undefined || r === undefined) return {};
    return price > ma200 && r < 10 ? { [ASSET.USLC]: 1 } : {};
  },
};
