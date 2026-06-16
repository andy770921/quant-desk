import { ASSET, SECTOR_ASSETS } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, rankBy } from './_helpers';

/**
 * Strategy 6: sector relative-strength rotation with a market-wide 200-SMA
 * crash filter, multi-timeframe (13612W) ranking, concentrated in the top-2
 * with a Treasury safety sleeve.
 */
export const sectorMomentum: StrategyDefinition = {
  id: 'sector-momentum',
  name: '產業動能輪動',
  shortName: '產業輪動',
  category: 'momentum',
  description:
    '加上大盤 200 日均線崩盤濾網，以 13612W 複合動能選前 2 強產業，並保留 20% 公債安全墊。',
  longDescription:
    '跨產業的相對強度輪動。先用標普 500 的 200 日均線作為大盤崩盤濾網——大盤跌破均線時全數轉入趨勢最強的公債；' +
    '大盤多頭時，改用 13612W 複合動能替 9 大 SPDR 產業排名，集中持有最強的前兩名（各 40%），其餘 20% 配置在趨勢向上的中期公債或現金作為安全墊，' +
    '同時降低回撤並提升 Sharpe。',
  rules: [
    '大盤濾網：標普 500 跌破 200 日均線 → 100% 趨勢最強公債（中/長期）。',
    '大盤多頭：以 13612W 複合動能替 9 大產業排名，取前 2 名各 40%（動能為負則該部位轉現金）。',
    '其餘 20% 配置於中期公債（若其動能 > 0）否則現金。',
    '每月再平衡一次。',
  ],
  caveats: ['產業 ETF 資料自 1998 年底起。', '集中前 2 名，單一產業反轉的衝擊較大。'],
  tags: ['動能', '產業輪動', '相對強度'],
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
