import { ASSET } from '../../../market-data/assets';
import { DAYS } from '../../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../../strategy.types';
import { bestBy } from '../_helpers';

/**
 * Improved GEM: multi-timeframe (13612W) momentum gate to cut whipsaw, and a
 * dual safe-asset (best-trending Treasury / cash) instead of always ITT.
 */
export const dualMomentumGemPlus: StrategyDefinition = {
  id: 'dual-momentum-gem-plus',
  name: '雙動能 GEM（改良版）',
  shortName: '雙動能 GEM+',
  category: 'momentum',
  description:
    '以 13612W 複合動能取代單一 12 個月動能減少雜訊，並讓避險端在現金/中/長期公債中擇優趨勢。',
  longDescription:
    '原版 GEM 的改良。用 13612W 複合動能（混合 1/3/6/12 個月）取代單一 12 個月絕對動能，降低盤整時的假訊號；' +
    '當複合動能轉負時，避險端不再固定買中期公債，而是在現金、中期、長期公債中選 13612W 動能最強者，' +
    '在債券多頭時也能參與，提升風險調整後報酬 (Sharpe)。',
  rules: [
    '每月底計算 13612W 複合動能 = 12×1月 + 4×3月 + 2×6月 + 1×12月 報酬。',
    '絕對動能：美股複合動能 ≤ 0 → 轉入現金/中期/長期公債中動能最強者。',
    '相對動能：美股通過濾網時，持有美股與國際股中複合動能較高者 100%。',
    '每月再平衡一次。',
  ],
  caveats: ['仍為月頻，急轉時會落後一個月。', '債券避險於股債齊跌（如 2022）仍可能受傷。'],
  signalFormula: [
    'score(x) = 12*ret(x,21)+4*ret(x,63)+2*ret(x,126)+ret(x,252)',
    '',
    'if score(USLC) <= 0:',
    '    safe = argmax over {CASH, ITT, LTT} of score(.)',
    '    weight = { [safe]: 1.0 }',
    'else:',
    '    riskOn = score(INTL) > score(USLC) ? INTL : USLC',
    '    weight = { [riskOn]: 1.0 }',
  ].join('\n'),
  tags: ['動能', '資產配置', '改良版'],
  rebalance: 'monthly',
  universe: ['美國大型股', '國際股', '中/長期公債'],
  assets: [ASSET.USLC, ASSET.INTL, ASSET.ITT, ASSET.LTT, ASSET.CASH],
  coreAssets: [ASSET.USLC, ASSET.ITT, ASSET.LTT],
  warmupDays: DAYS.YEAR + 5,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const absMom = ctx.score13612W(ASSET.USLC);
    if (absMom === undefined || absMom <= 0) {
      const safe = bestBy([ASSET.CASH, ASSET.ITT, ASSET.LTT], (a) => ctx.score13612W(a), ASSET.ITT);
      return { [safe]: 1 };
    }
    const sUs = absMom;
    const sIntl = ctx.score13612W(ASSET.INTL);
    if (sIntl !== undefined && sIntl > sUs) return { [ASSET.INTL]: 1 };
    return { [ASSET.USLC]: 1 };
  },
};
