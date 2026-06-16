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
 * Strategy 10: Leveraged Nasdaq core + momentum satellite + bond cushion. The
 * credible successor to the old pure-momentum top-8 book (whose 49x full-history
 * figure was a survivorship-bias mirage): 75% in a vol-targeted leveraged-Nasdaq
 * core (the bias-free engine that wins both windows) + 15% low-vol momentum stocks
 * + a permanent 12% intermediate-Treasury cushion that softens equity drawdowns.
 * Trend-gated to the best defensive sleeve below the 200-day MA. Holds ≤9.
 */
export const momentumBondBallast: StrategyDefinition = {
  id: 'stock-momentum-bond-ballast',
  name: '槓桿核心＋債券緩衝',
  shortName: '核心＋債券',
  category: 'diversified',
  description:
    '大盤多頭時，75% 配置波動目標槓桿那斯達克核心（多頭放大、動盪降槓桿），15% 衛星持有「top-30 動能中波動最低的 6 檔」個股，並固定 12% 配置中期公債緩衝回撤；大盤跌破 200 日均線則全數轉入趨勢最強的公債/黃金/現金。績效由無偏誤的指數核心驅動，而非集中押注個股。',
  longDescription:
    '把波動目標的槓桿指數核心與固定債券緩衝結合，做成一個績效可信、攻守兼具的「核心＋緩衝」組合，' +
    '取代舊版「純動能 8 檔」——後者 49 倍的歷史績效其實是存活者偏誤造成的假象。' +
    '當大盤站上 200 日均線：75% 作為核心，採波動目標的槓桿那斯達克（曝險 = 45% ÷ 近 3 個月年化波動，上限 2 倍，以 1x/2x ETF 組成、買進不借錢，多頭時幾乎滿倉 2 倍）——' +
    '報酬來自這個無個股偏誤的指數核心，不再依賴集中押注「今日贏家」；15% 衛星持有 12-1 動能最強 30 檔中波動最低的 6 檔個股；另 12% 固定配置中期公債，在股市回檔時提供緩衝。' +
    '當大盤跌破 200 日均線：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。最多持有 9 檔，含槓桿型 ETF（買進，不借錢）。',
  rules: [
    '大盤站上 200 日均線：75% 波動目標槓桿那斯達克核心（曝險 45% ÷ 近 3 月年化波動，上限 2 倍，1x/2x ETF）。',
    '15% 衛星：等權持有「top-30 動能中波動最低的 6 檔」個股。',
    '固定 12% 配置中期公債（緩衝回撤）。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月最多交易 3 次；槓桿僅透過槓桿型 ETF（買進，不借錢），最多持有 9 檔。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，惟僅 15% 衛星受其影響，核心無此偏誤。',
    '核心含 2 倍槓桿 ETF（每日重設），波動耗損與回撤高於純指數（約 46%）。',
    '股債同跌的環境（如 2022）債券緩衝效果會打折。',
  ],
  tags: ['槓桿核心', '動能', '債券緩衝', '波動目標', '分散'],
  rebalance: 'daily',
  universe: [
    '那斯達克100 (1x/2x)',
    'S&P 500 個股（最多持 6）',
    '中期公債',
    '長期公債',
    '黃金',
    '現金',
  ],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    // 75% vol-targeted leveraged Nasdaq core (2x cap, the bias-free engine that
    // wins BOTH windows) + 15% low-vol momentum stocks + a 12% intermediate-
    // Treasury cushion. The credible successor to the old pure-momentum top-8 book:
    // performance now comes from the index core, not survivorship-biased single-
    // name concentration, so the bond sleeve still cushions without a 49x mirage.
    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 6);
    if (top.length < 5) {
      return capHoldings({ ...leveragedNasdaqCore(ctx, 0.88, 0.45, 2), [ASSET.ITT]: 0.12 }, 10);
    }
    return capHoldings(
      { ...equalWeight(top, 0.13), [ASSET.ITT]: 0.12, ...leveragedNasdaqCore(ctx, 0.75, 0.45, 2) },
      10,
    );
  },
};
