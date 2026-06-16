import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy, bestDefensive, trendUp } from './_helpers';

/**
 * Strategy 3: Leveraged Dual-Momentum Rotation. Combines relative momentum
 * (which index is stronger — Nasdaq-100 vs S&P 500) with absolute momentum and a
 * 200-day trend gate, then expresses the winner at 2x via a leveraged ETF while
 * the trend holds. When neither index is trending up (or is weaker than cash) it
 * rotates fully to the best-trending Treasury / gold / cash. Holds 1 instrument.
 */
export const leveragedDualMomentum: StrategyDefinition = {
  id: 'leveraged-dual-momentum',
  name: '槓桿雙動能輪動',
  shortName: '槓桿雙動能',
  category: 'momentum',
  description:
    '每月比較那斯達克與標普近 12 個月報酬，挑強者；若強者領先現金且仍站上自身 200 日均線，就以 2 倍槓桿 ETF 持有（QLD 或 SSO）；否則全數轉入趨勢最強的公債/黃金/現金。相對動能＋絕對動能＋趨勢三重把關的槓桿輪動。',
  longDescription:
    '把 Antonacci 的雙動能與槓桿結合：先用「相對動能」在那斯達克 100 與標普 500 之間挑近 12 個月報酬最強者，' +
    '再用「絕對動能」與「200 日趨勢」雙重把關——只有當強者報酬高於現金、且收盤仍站上自身 200 日均線時，' +
    '才以 2 倍槓桿 ETF（那斯達克 → QLD、標普 → SSO）持有，吃滿多頭趨勢；只要任一條件不成立，立即全數退場，' +
    '轉入中期/長期公債、黃金、現金中近半年趨勢最強的避險資產。靠著只在「最強且趨勢確認」時動用槓桿，' +
    '在多頭放大報酬、在空頭完全離場，定期定額長期勝過買進持有 QQQ，且回撤遠低於固定槓桿。',
  rules: [
    '每日計算那斯達克、標普近 12 個月報酬，挑出較強者。',
    '進攻條件：強者報酬 > 現金報酬，且強者站上自身 200 日均線 → 持有其 2 倍槓桿 ETF。',
    '否則：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過 2x ETF（買進，不借錢），最多持有 1 檔。',
  ],
  caveats: [
    '2 倍槓桿 ETF 每日重設，盤整時有波動耗損。',
    '月初急轉時，相對/絕對動能會落後約一個月。',
    '單一標的持有，集中度高、波動大於分散型配置。',
  ],
  tags: ['槓桿', '雙動能', '輪動', '趨勢'],
  rebalance: 'daily',
  universe: ['那斯達克100 (2x)', '標普500 (2x)', '中/長期公債', '黃金', '現金'],
  assets: [
    ASSET.NASDAQ,
    ASSET.USLC,
    ASSET.NASDAQ2X,
    ASSET.USLC2X,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.NASDAQ, ASSET.USLC],
  warmupDays: DAYS.YEAR + 20,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    const best = bestBy([ASSET.NASDAQ, ASSET.USLC], (a) => ctx.ret(a, DAYS.YEAR), ASSET.USLC);
    const beatsCash = (ctx.ret(best, DAYS.YEAR) ?? -1) > (ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0);
    if (!beatsCash || !trendUp(ctx, best, 200)) return { [bestDefensive(ctx)]: 1 };
    return { [best === ASSET.NASDAQ ? ASSET.NASDAQ2X : ASSET.USLC2X]: 1 };
  },
};
