import { ASSET } from '../../../market-data/assets';
import { DAYS } from '../../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../../strategy.types';
import { bestBy, rankBy } from '../_helpers';

/**
 * Improved ADM: broader offensive universe (US large/Nasdaq/small/intl) for
 * better leader selection, and a best-trending Treasury/cash safe asset.
 */
export const acceleratingDualMomentumPlus: StrategyDefinition = {
  id: 'accelerating-dual-momentum-plus',
  name: '加速雙動能（改良版）',
  shortName: '加速雙動能+',
  category: 'momentum',
  description:
    '擴大攻擊池（大型股/那斯達克/小型股/國際股）擇優，並讓避險端在現金/中/長債中選趨勢最強者。',
  longDescription:
    '原版加速雙動能的改良。把攻擊池從「小型股 vs 國際股」擴大為大型股、那斯達克、小型股、國際股四者，' +
    '用加速動能挑出最強的市場；當最強者加速動能仍 ≤ 0 時，避險端在現金、中期、長期公債中選 13612W 動能最強者，' +
    '改善防禦腳本，提升整體報酬與 Sharpe。',
  rules: [
    '每月底計算各攻擊資產的加速動能 = (1 月 + 3 月 + 6 月報酬) / 3。',
    '選加速動能最高者；若 > 0 → 100% 持有。',
    '若 ≤ 0 → 轉入現金/中期/長期公債中 13612W 動能最強者。',
    '每月再平衡一次。',
  ],
  caveats: ['攻擊池擴大後換手仍偏高。', '依賴股債負相關的避險效果。'],
  signalFormula: [
    'accel(x) = (ret(x,21)+ret(x,63)+ret(x,126)) / 3',
    'best = argmax over {USLC, NASDAQ, SMALL, INTL} of accel(.)',
    '',
    'if accel(best) > 0:',
    '    weight = { [best]: 1.0 }',
    'else:',
    '    safe = argmax over {CASH, ITT, LTT} of score13612W(.)',
    '    weight = { [safe]: 1.0 }',
  ].join('\n'),
  tags: ['動能', '多市場', '改良版'],
  rebalance: 'monthly',
  universe: ['大型股/那斯達克/小型股/國際股', '現金/中/長債'],
  assets: [ASSET.USLC, ASSET.NASDAQ, ASSET.SMALL, ASSET.INTL, ASSET.LTT, ASSET.ITT, ASSET.CASH],
  coreAssets: [ASSET.USLC, ASSET.LTT, ASSET.ITT],
  warmupDays: DAYS.YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const universe = [ASSET.USLC, ASSET.NASDAQ, ASSET.SMALL, ASSET.INTL];
    const best = rankBy(universe, (a) => ctx.accel(a))[0];
    if (best && best.score > 0) return { [best.asset]: 1 };
    const safe = bestBy([ASSET.CASH, ASSET.ITT, ASSET.LTT], (a) => ctx.score13612W(a), ASSET.LTT);
    return { [safe]: 1 };
  },
};
