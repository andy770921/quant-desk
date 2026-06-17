import { ASSET, SECTOR_ASSETS } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import {
  addW,
  bestDefensive,
  capHoldings,
  equalWeight,
  leveragedEquity,
  rankBy,
  trendUp,
} from './_helpers';

/**
 * Strategy 6 (S5) — Sector Momentum Rotation. Source: Faber (2007), GTAA. Rotate
 * into the strongest SPDR sectors while the broad market is in an uptrend.
 * Monthly. Bias-free (sector ETFs + index only).
 *
 * Below the S&P's 200-day MA it goes risk-off. In an uptrend it puts 70% in the
 * 3 strongest sectors (by 13612W, keeping only positive-momentum ones) and 30% in
 * a vol-targeted leveraged S&P core (gross capped at 1, since no 2x sector ETFs
 * exist — leverage is expressed only through the broad-index core). Pre-1998,
 * before sector ETFs exist, it holds the leveraged Nasdaq core.
 */
export const sectorMomentum: StrategyDefinition = {
  id: 's5-sector-momentum',
  name: '產業動能輪動',
  shortName: '產業輪動',
  category: 'momentum',
  description:
    'S&P 500 站上 200 日均線時，把 70% 資金輪入 13612W 動能最強的 3 個 SPDR 類股（僅留動能為正者），另 30% 配置波動目標槓桿的標普核心；跌破均線就全數轉入趨勢最強的公債/黃金/現金。類股無 2 倍 ETF，故槓桿只透過標普核心表達（總曝險上限約 1）。',
  longDescription:
    'Mebane Faber「A Quantitative Approach to Tactical Asset Allocation」(2007) 的產業版本：在大盤多頭時，資金集中到相對強勢的產業，能擷取產業輪動的動能溢酬。' +
    '每月檢查 S&P 500 是否站上 200 日均線——跌破就全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者避險。' +
    '站上均線時，計算九大 SPDR 類股（科技、金融、能源、醫療、非必需消費、必需消費、工業、原物料、公用事業）的 13612W 動能分數，選出最強 3 個（且分數須為正），等權重配置 70%；另 30% 配置波動目標槓桿的標普 500 核心（30% ÷ 近 3 個月波動，上限 2 倍，1x＋2x ETF）。' +
    '由於市場沒有 2 倍的單一類股 ETF，槓桿只透過標普核心表達，整體總曝險約 1。1998 年類股 ETF 問世前，改持有槓桿那斯達克核心。無存活者偏誤。',
  rules: [
    'S&P 500 < 200 日均線 → 全數轉入趨勢最強的公債/黃金/現金。',
    '站上均線：選 13612W 分數最高且為正的 3 個類股，等權重 70%。',
    '另 30% 配置波動目標槓桿標普核心（上限 2 倍）；類股 ETF 問世前改持槓桿那斯達克核心。',
    '每月再評估一次；每月最多交易 3 次，最多持有 10 檔。',
  ],
  caveats: [
    '產業動能在輪動快速的市場會頻繁換股，受每月 3 次交易上限節制。',
    '集中於 3 個類股，單一產業利空時波動較大。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
  ],
  tags: ['動能', '產業輪動', '相對強度'],
  rebalance: 'monthly',
  universe: [
    '9 大 SPDR 類股',
    '標普500 (1x/2x)',
    '那斯達克 (1x/2x)',
    '中/長期公債',
    '黃金',
    '現金',
  ],
  assets: [
    ...SECTOR_ASSETS,
    ASSET.NASDAQ,
    ASSET.NASDAQ2X,
    ASSET.USLC,
    ASSET.USLC2X,
    ASSET.ITT,
    ASSET.LTT,
    ASSET.GOLD,
    ASSET.CASH,
  ],
  coreAssets: [ASSET.USLC],
  warmupDays: 262,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const avail = SECTOR_ASSETS.filter((a) => ctx.has(a));
    // Sectors not available pre-1998 → leveraged broad index (correct ETF-based leverage).
    if (avail.length < 3)
      return leveragedEquity(ctx, ASSET.NASDAQ, ASSET.NASDAQ2X, undefined, 1, 0.3, 2);
    const top = rankBy(avail, (a) => ctx.score13612W(a))
      .slice(0, 3)
      .map((x) => x.asset)
      .filter((a) => (ctx.score13612W(a) ?? -1) > 0);
    if (!top.length) return { [bestDefensive(ctx)]: 1 };
    // 70% into the strongest sectors + a 30% vol-targeted leveraged S&P core (gross = 1).
    const sectors = equalWeight(top, 0.7);
    const core = leveragedEquity(ctx, ASSET.USLC, ASSET.USLC2X, undefined, 0.3, 0.3, 2);
    return capHoldings(addW(sectors, core), 10);
  },
};
