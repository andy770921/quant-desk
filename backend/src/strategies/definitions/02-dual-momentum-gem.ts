import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';

/** Strategy 2: Global Equities Momentum (Antonacci). */
export const dualMomentumGem: StrategyDefinition = {
  id: 'dual-momentum-gem',
  name: '雙動能 GEM',
  shortName: '雙動能 GEM',
  category: 'momentum',
  description:
    'Antonacci 的全球股票動能：用 12 個月絕對動能避開空頭，用相對動能在美股與國際股之間擇優。',
  longDescription:
    'Gary Antonacci 提出的 Global Equities Momentum。先用「絕對動能」判斷美股過去 12 個月報酬是否高於國庫券：' +
    '若不及國庫券就全數轉入債券避險；若通過，再用「相對動能」在美國大型股與國際股之間，選過去 12 個月報酬較高者全額持有。' +
    '每月底重新評估一次，兼顧參與多頭與躲避大型空頭。',
  rules: [
    '每月底計算美國大型股、國際股、現金的過去 12 個月（約 252 日）報酬。',
    '絕對動能：若美股 12 個月報酬 ≤ 現金報酬 → 100% 中期公債。',
    '相對動能：若美股通過上述濾網，則持有美股與國際股中報酬較高者 100%。',
    '每月再平衡一次。',
  ],
  caveats: [
    '盤整或 V 型反轉時，月頻調整可能反應較慢而錯失反彈。',
    '國際股資料自 2001 年起；早期僅以美股 vs 公債運作。',
  ],
  signalFormula: [
    'rUS   = ret(USLC, 252)   // 12 個月報酬',
    'rCash = ret(CASH, 252)',
    'rIntl = ret(INTL, 252)',
    '',
    'if rUS <= rCash:          // 絕對動能濾網',
    '    weight = { ITT: 1.0 } // 轉入中期公債',
    'elif rIntl > rUS:         // 相對動能',
    '    weight = { INTL: 1.0 }',
    'else:',
    '    weight = { USLC: 1.0 }',
  ].join('\n'),
  tags: ['動能', '資產配置', '避險'],
  rebalance: 'monthly',
  universe: ['美國大型股', '國際股', '中期公債'],
  assets: [ASSET.USLC, ASSET.INTL, ASSET.ITT, ASSET.CASH],
  coreAssets: [ASSET.USLC, ASSET.ITT],
  warmupDays: DAYS.YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const rUs = ctx.ret(ASSET.USLC, DAYS.YEAR);
    const rCash = ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0;
    if (rUs === undefined) return { [ASSET.ITT]: 1 };
    if (rUs <= rCash) return { [ASSET.ITT]: 1 };
    const rIntl = ctx.ret(ASSET.INTL, DAYS.YEAR);
    if (rIntl !== undefined && rIntl > rUs) return { [ASSET.INTL]: 1 };
    return { [ASSET.USLC]: 1 };
  },
};
