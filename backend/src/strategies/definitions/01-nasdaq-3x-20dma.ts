import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/**
 * Strategy 1 (flagship, do not modify): 3x Nasdaq-100 gated by the 20-day MA.
 */
export const nasdaq3x20dma: StrategyDefinition = {
  id: 'nasdaq-3x-20dma',
  name: '3 倍槓桿那斯達克 × 20 日均線',
  shortName: '3x 那斯達克 20MA',
  category: 'trend-following',
  description: '當那斯達克 100 站上 20 日均線時，以 3 倍槓桿做多；跌破則全數轉為現金。',
  longDescription:
    '這是平台的旗艦策略：用 3 倍槓桿放大那斯達克 100 指數的報酬，並用 QQQ（那斯達克 100，非槓桿）最簡單的 20 日移動平均線作為進出場濾網。' +
    '訊號一律以未槓桿的 QQQ／那斯達克 100 計算，而非 TQQQ 本身——當 QQQ 收盤價高於 20 日均線代表短期動能向上，便以 3 倍曝險（TQQQ）參與上漲；一旦跌破 20 日均線就立刻全數轉為現金，' +
    '避免槓桿在下跌與盤整時造成的價值耗損 (volatility decay)。槓桿報酬以指數每日報酬 ×3、並扣除借貸成本與費用模擬，' +
    '因此可一路回測到 1990 年（早於 TQQQ 於 2010 年問世）。',
  rules: [
    '訊號標的：QQQ（那斯達克 100，非槓桿）的 20 日均線，而非 TQQQ 本身；槓桿曝險以買入 TQQQ 這檔 3 倍 ETF 達成，不融資。',
    '進場：QQQ 收盤價 > 20 日簡單移動平均線 → 100% 資金買入 TQQQ（3 倍那斯達克）。',
    '出場：QQQ 收盤價 < 20 日均線 → 全數賣出轉為現金（賺取國庫券利息）。',
    '每月最多交易 3 次，超過則延後到下個月。',
  ],
  caveats: [
    '3 倍槓桿波動極大，單日大跌或開盤跳空無法靠日線濾網完全避開。',
    '盤整時 20 日均線容易來回穿越，造成多次小幅虧損 (whipsaw)。',
    '歷史最大回撤仍可能達 40% 以上。',
  ],
  signalFormula: [
    'price = level(NASDAQ)        // NASDAQ = QQQ／那斯達克100（非槓桿），不是 TQQQ',
    'ma20  = sma(NASDAQ, 20)',
    '',
    'if price > ma20:',
    '    weight = { TQQQ: 1.0 }   // 100% 資金買入 3x ETF（不融資）',
    'else:',
    '    weight = { }             // 100% 現金',
  ].join('\n'),
  tags: ['槓桿', '趨勢', '那斯達克'],
  rebalance: 'daily',
  universe: ['3x 那斯達克 (TQQQ)', '現金'],
  assets: [ASSET.NASDAQ3X, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ3X],
  warmupDays: 25,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.NASDAQ);
    const ma = ctx.sma(ASSET.NASDAQ, 20);
    if (price === undefined || ma === undefined) return {};
    return price > ma ? { [ASSET.NASDAQ3X]: 1 } : {};
  },
};
