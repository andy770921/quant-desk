import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { equityExposureWeights } from './_helpers';

/** Strategy 7: volatility-targeted S&P 500 exposure. */
export const volTargetSpy: StrategyDefinition = {
  id: 'vol-target-spy',
  name: '波動度目標 (標普500)',
  shortName: '波動度目標',
  category: 'volatility',
  description: '以 15% 年化波動為目標調整標普曝險：低波動時最多加到 2 倍，高波動時降低曝險。',
  longDescription:
    '波動度目標策略。每月以過去 20 日的已實現波動度估算市場風險，曝險 = 目標波動 (15%) ÷ 已實現波動，' +
    '上限 2 倍、下限 0。波動具有群聚與持續性，高波動往往預告較大回撤，因此在高波動時自動降風險、低波動時適度加槓桿，' +
    '能改善風險調整後報酬並讓資金曲線更平滑。',
  rules: [
    '每月計算標普 500 過去 20 日的年化已實現波動度。',
    '目標曝險 = 15% ÷ 已實現波動度，限制在 0～2 倍之間。',
    '曝險 ≤ 1 倍：標普 ETF + 現金；> 1 倍：買入 SSO（2x 標普 ETF）+ 標普 ETF，不融資。',
    '每月再平衡一次。',
  ],
  caveats: [
    '使用落後的已實現波動，崩盤啟動後才降風險。',
    '平靜期加碼 2x ETF 會在波動突升時放大尾端風險。',
  ],
  signalFormula: [
    'rv = vol(USLC, 20)             // 年化已實現波動度',
    'E  = clamp(0.15 / rv, 0, 2)    // 目標曝險（0~2 倍）',
    '',
    '// 以 ETF 表達曝險，不融資：',
    'if E <= 1: weight = { USLC: E }              // 其餘現金',
    'else:      weight = { SSO: E-1, USLC: 2-E }  // 混合 2x 與 1x',
  ].join('\n'),
  tags: ['波動度', '風險控管', '動態槓桿'],
  rebalance: 'monthly',
  universe: ['美國大型股', '2x 標普500 (SSO)', '現金'],
  assets: [ASSET.USLC, ASSET.USLC2X, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 25,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const rv = ctx.vol(ASSET.USLC, 20);
    if (rv === undefined || rv === 0) return { [ASSET.USLC]: 1 };
    const e = Math.max(0, Math.min(2, 0.15 / rv));
    return equityExposureWeights(e, ASSET.USLC, ASSET.USLC2X);
  },
};
