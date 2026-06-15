import { ASSET, SECTOR_ASSETS } from '../../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../../strategy.types';
import { bestBy, rankBy } from '../_helpers';

/**
 * Improved sector rotation: market-wide 200-SMA crash filter, multi-timeframe
 * (13612W) ranking, concentrate in top-2 with a Treasury safety sleeve.
 */
export const sectorMomentumPlus: StrategyDefinition = {
  id: 'sector-momentum-plus',
  name: '產業動能輪動（改良版）',
  shortName: '產業輪動+',
  category: 'momentum',
  description:
    '加上大盤 200 日均線崩盤濾網，改用 13612W 複合動能選前 2 強產業，並保留 20% 公債安全墊。',
  longDescription:
    '原版產業輪動的改良。先用標普 500 的 200 日均線作為大盤崩盤濾網——大盤跌破均線時全數轉入趨勢最強的公債；' +
    '大盤多頭時，改用 13612W 複合動能替產業排名，集中持有最強的前兩名（各 40%），其餘 20% 配置在趨勢向上的中期公債或現金作為安全墊，' +
    '同時降低回撤並提升 Sharpe。',
  rules: [
    '大盤濾網：標普 500 跌破 200 日均線 → 100% 趨勢最強公債（中/長期）。',
    '大盤多頭：以 13612W 複合動能替 9 大產業排名，取前 2 名各 40%（動能為負則該部位轉現金）。',
    '其餘 20% 配置於中期公債（若其動能 > 0）否則現金。',
    '每月再平衡一次。',
  ],
  caveats: ['產業 ETF 資料自 1998 年底起。', '集中前 2 名，單一產業反轉的衝擊較大。'],
  signalFormula: [
    'if level(USLC) <= sma(USLC, 200):',
    '    safe = score13612W(LTT) > score13612W(ITT) ? LTT : ITT',
    '    weight = { [safe]: 1.0 }',
    'else:',
    '    top2 = top 2 sectors by score13612W',
    '    for s in top2: if score13612W(s) > 0: weight[s] = 0.40',
    '    sleeve = score13612W(ITT) > 0 ? ITT : CASH',
    '    weight[sleeve] += 0.20',
  ].join('\n'),
  tags: ['動能', '產業輪動', '改良版'],
  rebalance: 'monthly',
  universe: ['9 大產業類股', '中/長期公債', '現金'],
  assets: [...SECTOR_ASSETS, ASSET.USLC, ASSET.ITT, ASSET.LTT, ASSET.CASH],
  coreAssets: SECTOR_ASSETS,
  warmupDays: 260,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    if (price !== undefined && ma !== undefined && price <= ma) {
      const safe = bestBy([ASSET.LTT, ASSET.ITT], (a) => ctx.score13612W(a), ASSET.ITT);
      return { [safe]: 1 };
    }
    const ranked = rankBy([...SECTOR_ASSETS], (a) => ctx.score13612W(a));
    const top = ranked.slice(0, 2);
    const weights: Weights = {};
    for (const { asset, score } of top) {
      if (score > 0) weights[asset] = 0.4;
    }
    const ittScore = ctx.score13612W(ASSET.ITT);
    const sleeve = ittScore !== undefined && ittScore > 0 ? ASSET.ITT : ASSET.CASH;
    if (sleeve === ASSET.ITT) weights[sleeve] = (weights[sleeve] ?? 0) + 0.2;
    // CASH sleeve is left unallocated (engine treats remainder as cash).
    return weights;
  },
};
