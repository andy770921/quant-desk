import { ASSET, SECTOR_ASSETS } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { rankBy } from './_helpers';

/** Strategy 6: top-3 sector relative-strength rotation. */
export const sectorMomentum: StrategyDefinition = {
  id: 'sector-momentum',
  name: '產業動能輪動',
  shortName: '產業輪動',
  category: 'momentum',
  description: '每月挑選 6 個月相對強度最高的前 3 大產業類股等權持有，動能轉負則轉現金。',
  longDescription:
    '跨產業的相對強度輪動。每月底依過去 6 個月報酬替 9 大 SPDR 產業類股排名，等權持有最強的前三名；' +
    '若某入選產業的 6 個月報酬為負，則該部位改持現金。產業領導地位通常能延續數月，集中於領先者可捕捉動能溢酬，' +
    '絕對動能濾網則提供下跌保護。',
  rules: [
    '每月底依過去 6 個月（約 126 日）報酬替 9 大產業排名。',
    '等權持有前 3 名（各約 33%）。',
    '若入選產業 6 個月報酬 < 0，該部位轉為現金。',
    '每月再平衡一次。',
  ],
  caveats: [
    '產業 ETF 資料自 1998 年底起，回測起點較晚。',
    '換手率高；動能崩潰（領先者急轉直下）時傷害較大。',
  ],
  signalFormula: [
    'ranked = sort 9 sectors by ret(sector, 126) desc',
    'top3   = ranked[0..2]',
    '',
    'for each s in top3:',
    '    if ret(s, 126) > 0: weight[s] = 1/3',
    '    else:               // 該 1/3 轉為現金（不配置）',
  ].join('\n'),
  tags: ['動能', '產業輪動', '相對強度'],
  rebalance: 'monthly',
  universe: ['9 大產業類股', '現金'],
  assets: [...SECTOR_ASSETS, ASSET.CASH],
  coreAssets: SECTOR_ASSETS,
  warmupDays: DAYS.HALF_YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const ranked = rankBy(SECTOR_ASSETS, (a) => ctx.ret(a, DAYS.HALF_YEAR));
    const top = ranked.slice(0, 3);
    if (top.length === 0) return {};
    const weights: Weights = {};
    const slice = 1 / 3;
    for (const { asset, score } of top) {
      if (score > 0) weights[asset] = slice;
    }
    return weights;
  },
};
