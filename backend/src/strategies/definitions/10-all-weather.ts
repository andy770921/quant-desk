import { ASSET, AssetKey } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/** Strategy 10: static All-Weather diversified allocation. */
export const allWeather: StrategyDefinition = {
  id: 'all-weather',
  name: '全天候風險平衡',
  shortName: '全天候',
  category: 'diversified',
  description: 'Dalio 風格的靜態多資產配置：股票、長短期公債與黃金分散持有，定期再平衡。',
  longDescription:
    'Ray Dalio 的全天候 (All-Weather) 靜態配置，是這組策略中的被動分散基準。固定權重分散於美國大型股、長期公債、' +
    '中期公債與黃金，這些資產對成長與通膨意外的反應不同，能在各種總經環境中互相緩衝。當任一資產偏離目標超過設定門檻便再平衡回目標。',
  rules: [
    '目標權重：美國大型股 30%、長期公債 40%、中期公債 15%、黃金 15%。',
    '當資產權重偏離目標逾門檻時再平衡（約每季一次）。',
    '無槓桿；黃金資料不足的早期年份按比例調整其餘資產。',
  ],
  caveats: [
    '債券權重高，升息／通膨環境（如 2022）表現最差。',
    '黃金資料自 2000 年起；早期以股債為主。',
    '報酬與波動皆偏低，屬穩健型。',
  ],
  signalFormula: [
    'target = { USLC: 0.30, LTT: 0.40, ITT: 0.15, GOLD: 0.15 }',
    '',
    '// 保留資料可得的資產，其餘按比例正規化使總和 = 1',
    'available = { a in target : has(a) }',
    'weight    = normalize(available)',
  ].join('\n'),
  tags: ['資產配置', '分散', '穩健'],
  rebalance: 'quarterly',
  universe: ['美國大型股', '長期公債', '中期公債', '黃金'],
  assets: [ASSET.USLC, ASSET.LTT, ASSET.ITT, ASSET.GOLD],
  coreAssets: [ASSET.USLC, ASSET.LTT, ASSET.ITT],
  warmupDays: 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const target: { asset: AssetKey; w: number }[] = [
      { asset: ASSET.USLC, w: 0.3 },
      { asset: ASSET.LTT, w: 0.4 },
      { asset: ASSET.ITT, w: 0.15 },
      { asset: ASSET.GOLD, w: 0.15 },
    ];
    const available = target.filter((t) => ctx.has(t.asset));
    const total = available.reduce((s, t) => s + t.w, 0);
    const weights: Weights = {};
    for (const t of available) weights[t.asset] = t.w / total;
    return weights;
  },
};
