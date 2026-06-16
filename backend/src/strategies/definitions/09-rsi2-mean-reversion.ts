import { ASSET, AssetKey } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import {
  bestDefensive,
  capHoldings,
  equalWeight,
  leveragedNasdaqCore,
  lowVolMomentumStocks,
  trendUp,
} from './_helpers';

/**
 * Strategy 9: Leveraged index core + momentum satellite (index-anchored). The
 * most index-like of the stock books: 85% in a vol-targeted leveraged-Nasdaq core
 * (the bias-free engine that wins both windows) that anchors the book to the broad
 * market and dilutes single-name / survivorship risk, plus a 15% satellite of the
 * 6 lowest-vol of the top-30 momentum names for a modest selection tilt.
 * Trend-gated to the best defensive sleeve below the 200-day MA. Holds at most 8.
 */
export const momentumIndexCore: StrategyDefinition = {
  id: 'stock-momentum-index-core',
  name: '槓桿指數核心＋動能',
  shortName: '指數核心動能',
  category: 'momentum',
  description:
    '指數錨定的核心衛星配置：85% 核心採波動目標的槓桿那斯達克（多頭放大、動盪降槓桿），錨定大盤並稀釋單一個股與存活者偏誤風險；15% 衛星持有「top-30 動能中波動最低的 6 檔」個股取得選股傾斜；大盤跌破 200 日均線則全數轉入避險資產。',
  longDescription:
    '把無個股偏誤的槓桿指數核心放大到 85%，做成本系列中最貼近大盤、最可複製的核心衛星策略：' +
    '當大盤站上 200 日均線，以 85% 作為「核心」，採波動目標的槓桿那斯達克（曝險 = 30% ÷ 近 3 個月年化波動，上限 2 倍，以 1x/2x ETF 組成、買進不借錢）——' +
    '把組合錨定在廣泛市場、稀釋單一個股風險，也大幅降低「只押今日贏家」的存活者偏誤影響，是同時擊敗 1990 與 2010 兩窗口的關鍵；' +
    '另 15% 作為「衛星」，持有 12-1 動能最強 30 檔中波動最低的 6 檔個股，加入溫和的選股 alpha。' +
    '當大盤跌破 200 日均線：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。最多持有 8 檔，含槓桿型 ETF（買進，不借錢）。',
  rules: [
    '大盤站上 200 日均線：85% 波動目標槓桿那斯達克核心（曝險 30% ÷ 近 3 月年化波動，上限 2 倍，1x/2x ETF）。',
    '15% 衛星：等權持有「top-30 動能中波動最低的 6 檔」個股。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過槓桿型 ETF（買進，不借錢），最多持有 8 檔。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，惟僅 15% 衛星受其影響，85% 指數核心無此偏誤。',
    '核心含 2 倍槓桿 ETF（每日重設），波動與回撤高於純指數。',
    '急轉時動能/趨勢訊號落後約一個月。',
  ],
  tags: ['槓桿核心', '指數', '動能', '核心衛星', '波動目標'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', 'S&P 500 個股（最多持 6）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    // Index-anchored core/satellite: 85% vol-targeted leveraged Nasdaq core
    // anchors the book to the broad market (the bias-free engine that wins both
    // the 1990 and 2010 windows); 15% low-vol momentum stock satellite (6 names)
    // supplies a modest selection tilt without survivorship-biased concentration.
    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 6);
    if (top.length < 5) return leveragedNasdaqCore(ctx, 1);
    return capHoldings({ ...equalWeight(top, 0.15), ...leveragedNasdaqCore(ctx, 0.85) }, 10);
  },
};
