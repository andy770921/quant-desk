import { ASSET } from '../../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../../strategy.types';

/**
 * Improved RSI(2): graduated entry (deeper oversold → bigger position) and an
 * idle bond sleeve instead of zero-yield cash on the many flat days.
 */
export const rsi2MeanReversionPlus: StrategyDefinition = {
  id: 'rsi2-mean-reversion-plus',
  name: 'RSI(2) 均值回歸（改良版）',
  shortName: 'RSI(2) 抄底+',
  category: 'mean-reversion',
  description: '分級進場：越超賣部位越大；空手時把資金停泊在趨勢向上的中期公債而非零息現金。',
  longDescription:
    '原版 RSI(2) 抄底的改良。把二元的「RSI<10 才滿倉」改為分級進場——RSI 越低部位越大（<5 滿倉、<10 七成五、<15 五成），' +
    '提升交易品質與 Sharpe；同時在空手或部分持股的日子，把閒置資金停泊在趨勢向上的中期公債，' +
    '消除大量空手日的現金拖累，提升總報酬而幾乎不增加回撤。',
  rules: [
    '趨勢濾網：僅在標普 500 站上 200 日均線時做多。',
    '分級進場：RSI(2) < 5 → 100%；< 10 → 75%；< 15 → 50% 美國大型股。',
    '其餘資金停泊於中期公債（若趨勢且其動能 > 0）否則現金。',
    '每月最多交易 3 次。',
  ],
  caveats: ['仍無停損，超賣後若崩盤會受傷。', '債券停泊在股債齊跌時亦有風險。'],
  signalFormula: [
    'trend = level(USLC) > sma(USLC, 200); r = rsi(USLC, 2)',
    'wE = (trend and r<15) ? (r<5 ? 1.0 : r<10 ? 0.75 : 0.50) : 0',
    'weight = { USLC: wE }',
    'rem = 1 - wE',
    'if rem > 0:',
    '    safe = (trend and score13612W(ITT) > 0) ? ITT : CASH',
    '    weight[safe] += rem',
  ].join('\n'),
  tags: ['均值回歸', '分級進場', '改良版'],
  rebalance: 'daily',
  universe: ['美國大型股', '中期公債', '現金'],
  assets: [ASSET.USLC, ASSET.ITT, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 260,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma200 = ctx.sma(ASSET.USLC, 200);
    const r = ctx.rsi(ASSET.USLC, 2);
    const trend = price !== undefined && ma200 !== undefined && price > ma200;
    let wE = 0;
    if (trend && r !== undefined && r < 15) {
      wE = r < 5 ? 1 : r < 10 ? 0.75 : 0.5;
    }
    const weights: Weights = {};
    if (wE > 0) weights[ASSET.USLC] = wE;
    const rem = 1 - wE;
    if (rem > 0.001) {
      const ittScore = ctx.score13612W(ASSET.ITT);
      if (trend && ittScore !== undefined && ittScore > 0) {
        weights[ASSET.ITT] = Number(rem.toFixed(2));
      }
      // else: remainder stays in cash (engine default).
    }
    return weights;
  },
};
