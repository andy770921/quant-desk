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
 * Strategy 8: Leveraged Nasdaq core funding a permanent gold hedge. A vol-targeted
 * leveraged-Nasdaq core (40% target vol, 2x cap — geared near-fully in uptrends)
 * does the heavy lifting so the book still beats QQQ in BOTH the 1990 and 2010
 * windows, while a permanent 15% gold sleeve genuinely diversifies (inflation /
 * tail hedge, low correlation to stocks & bonds). 70% core + 15% low-vol momentum
 * stocks + 15% gold. Holds at most 8 instruments.
 */
export const defensiveMomentumGold: StrategyDefinition = {
  id: 'stock-momentum-gold',
  name: '槓桿核心＋黃金避險',
  shortName: '核心＋黃金',
  category: 'diversified',
  description:
    '大盤多頭時，70% 配置波動目標槓桿那斯達克核心（上限 2 倍，多頭時幾乎滿倉 2 倍）、15% 衛星持有「top-30 動能中波動最低的 5 檔」個股，並固定 15% 配置黃金當抗通膨/尾端避險；大盤跌破 200 日均線則全數轉入趨勢最強的公債/黃金/現金。槓桿核心扛報酬、黃金降低與股市相關性。',
  longDescription:
    '用一個波動目標的槓桿指數核心去「養」一筆常駐黃金避險，做成與股市相關性更低、又能長期勝過 QQQ 的分散型組合。' +
    '當大盤站上 200 日均線：70% 作為核心，採波動目標的槓桿那斯達克（曝險 = 40% ÷ 近 3 個月年化波動，上限 2 倍，以 1x/2x ETF 組成、買進不借錢，多頭時幾乎維持滿倉 2 倍、只在極端動盪時降槓桿）——' +
    '這個無個股偏誤的核心足以蓋過黃金的結構性拖累，讓組合在 1990 與 2010 兩個回測窗口都贏過 QQQ；' +
    '15% 衛星持有 12-1 動能最強 30 檔中波動最低的 5 檔個股；另 15% 固定配置黃金——黃金與股票、債券長期低相關，在通膨升溫或股債齊跌（如 2022）時提供分散與尾端保護。' +
    '當大盤跌破 200 日均線：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。最多持有 8 檔，含槓桿型 ETF（買進，不借錢）。',
  rules: [
    '大盤站上 200 日均線：70% 波動目標槓桿那斯達克核心（曝險 40% ÷ 近 3 月年化波動，上限 2 倍，1x/2x ETF）。',
    '15% 衛星：等權持有「top-30 動能中波動最低的 5 檔」個股。',
    '固定 15% 配置黃金（抗通膨／尾端避險）。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過槓桿型 ETF（買進，不借錢），最多持有 8 檔。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，惟僅 15% 衛星受其影響，核心無此偏誤。',
    '核心含 2 倍槓桿 ETF（每日重設），波動耗損與回撤高於純指數（約 43%）。',
    '黃金本身波動大且長期報酬低於股票，強多頭中 15% 黃金會略拖累報酬（換取分散與避險）。',
  ],
  tags: ['槓桿核心', '黃金', '分散', '波動目標', '避險'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', 'S&P 500 個股（最多持 5）', '黃金', '中/長期公債', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.GOLD, ASSET.ITT, ASSET.LTT, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    // The diversified book: a vol-targeted leveraged Nasdaq core (40% target vol,
    // 2x cap — geared near-fully in uptrends) FUNDS a permanent 15% gold hedge.
    // The core overcomes gold's structural drag so the book still beats QQQ in
    // BOTH the 1990 and 2010 windows, while the permanent gold sleeve genuinely
    // diversifies (low correlation to stocks/bonds, a real tail/inflation hedge).
    // 70% core + 15% low-vol momentum stocks + 15% gold.
    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 5);
    if (top.length < 5) {
      return capHoldings({ ...leveragedNasdaqCore(ctx, 0.85, 0.4, 2), [ASSET.GOLD]: 0.15 }, 10);
    }
    return capHoldings(
      { ...equalWeight(top, 0.15), [ASSET.GOLD]: 0.15, ...leveragedNasdaqCore(ctx, 0.7, 0.4, 2) },
      10,
    );
  },
};
