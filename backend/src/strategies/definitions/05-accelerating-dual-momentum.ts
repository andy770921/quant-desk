import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { rankBy } from './_helpers';

/** Strategy 5: Accelerating Dual Momentum. */
export const acceleratingDualMomentum: StrategyDefinition = {
  id: 'accelerating-dual-momentum',
  name: '加速雙動能 ADM',
  shortName: '加速雙動能',
  category: 'momentum',
  description: '用 1/3/6 個月混合動能在小型股與國際股間擇優，動能轉負時轉入長期公債。',
  longDescription:
    'Accelerating Dual Momentum。對美國小型股與國際股計算 1、3、6 個月報酬的平均作為「加速動能」分數，' +
    '選分數較高者持有；若連最佳者的分數都 ≤ 0，代表風險資產失速，就全數轉入長期公債避險。' +
    '較短的混合回看期讓它比 12 個月動能反應更快。',
  rules: [
    '每月底計算各風險資產的加速動能 = (1 月 + 3 月 + 6 月報酬) / 3。',
    '選加速動能最高的風險資產；若最高分 > 0 → 100% 持有。',
    '若最高分 ≤ 0 → 100% 長期公債。',
    '每月再平衡一次。',
  ],
  caveats: ['短回看期換手較高、假訊號較多。', '高度仰賴股債負相關，於 2022 年通膨環境會失靈。'],
  signalFormula: [
    'accel(x) = (ret(x,21) + ret(x,63) + ret(x,126)) / 3',
    'best = argmax over {SMALL, INTL} of accel(.)',
    '',
    'if accel(best) > 0:',
    '    weight = { [best]: 1.0 }',
    'else:',
    '    weight = { LTT: 1.0 }   // 失速轉長期公債',
  ].join('\n'),
  tags: ['動能', '小型股', '避險'],
  rebalance: 'monthly',
  universe: ['美國小型股', '國際股', '長期公債'],
  assets: [ASSET.SMALL, ASSET.INTL, ASSET.LTT],
  coreAssets: [ASSET.SMALL, ASSET.LTT],
  warmupDays: DAYS.HALF_YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const candidates = rankBy([ASSET.SMALL, ASSET.INTL], (a) => ctx.accel(a));
    if (candidates.length === 0) return { [ASSET.LTT]: 1 };
    const best = candidates[0];
    return best.score > 0 ? { [best.asset]: 1 } : { [ASSET.LTT]: 1 };
  },
};
