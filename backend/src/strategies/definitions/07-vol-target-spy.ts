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
 * Strategy 7: Leveraged Nasdaq core + low-vol momentum satellite (stock-tilted).
 * 80% in a vol-targeted leveraged-Nasdaq core (the same bias-free lever as
 * strategies 02/05) that carries both the 1990 and 2010 windows, plus a 20%
 * satellite of the 8 lowest-volatility names among the top-30 12-1 momentum
 * S&P-500 stocks for an honest, high-Sharpe factor tilt. Trend-gated to the best
 * defensive sleeve below the market's 200-day MA. Holds at most 10 instruments.
 */
export const momentumLowVol: StrategyDefinition = {
  id: 'stock-momentum-lowvol-10',
  name: '槓桿核心＋低波選股',
  shortName: '核心低波',
  category: 'volatility',
  description:
    '大盤站上 200 日均線時，80% 配置「波動目標的槓桿那斯達克核心」（與策略 02/05 同一套槓桿引擎，多頭時放大、動盪時自動降槓桿），20% 衛星持有「top-30 動能中波動最低的 8 檔」個股取得選股超額報酬；大盤跌破均線則全數轉入趨勢最強的公債/黃金/現金。',
  longDescription:
    '把「無個股偏誤的槓桿指數核心」與「動能×低波選股衛星」結合，兼顧穩健的大盤曝險與選股 alpha。' +
    '當大盤站上 200 日均線：80% 作為核心，採波動目標的槓桿那斯達克（曝險 = 30% ÷ 近 3 個月年化波動，上限 2 倍，以 1x/2x ETF 組成、買進不借錢），' +
    '這個核心不依賴任何單一個股，是同時擊敗 1990 與 2010 兩個回測窗口的關鍵引擎；' +
    '另 20% 作為衛星，先用 12-1 動能選出最強 30 檔 S&P 500 個股，再取其中近半年波動最低的 8 檔等權持有，加入誠實、高 Sharpe 的雙因子選股傾斜。' +
    '當大盤跌破 200 日均線：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。' +
    '核心扛報酬、衛星添風味，讓本策略不必靠「集中押注今日贏家」就能長期勝過 QQQ。最多持有 10 檔，含槓桿型 ETF（買進，不借錢）。',
  rules: [
    '大盤站上 200 日均線：80% 波動目標槓桿那斯達克核心（曝險 30% ÷ 近 3 月年化波動，上限 2 倍，1x/2x ETF）。',
    '20% 衛星：等權持有「top-30 動能中波動最低的 8 檔」個股。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過槓桿型 ETF（買進，不借錢），最多持有 10 檔。',
  ],
  caveats: [
    '股票池為「目前」的 S&P 500 成分股，存在存活者偏誤 (survivorship bias)，惟僅 20% 衛星受其影響，核心無此偏誤。',
    '核心含槓桿型 ETF（每日重設），波動與回撤高於純指數。',
    '僅有價量資料，無基本面品質/估值因子。',
  ],
  tags: ['槓桿核心', '動能', '低波動', '選股', '波動目標'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', 'S&P 500 個股（最多持 8）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    // Core (80%): vol-targeted leveraged Nasdaq (the 02/05 lever) — a bias-free
    // index engine that carries BOTH the 1990 and 2010 windows. Satellite (20%):
    // 8 low-vol momentum names for an honest, high-Sharpe factor tilt. The core
    // does the heavy lifting so the book never leans on survivorship-biased
    // single-name concentration to beat QQQ.
    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 8);
    if (top.length < 5) return leveragedNasdaqCore(ctx, 1);
    return capHoldings({ ...equalWeight(top, 0.2), ...leveragedNasdaqCore(ctx, 0.8) }, 10);
  },
};
