import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, trendUp } from './_helpers';

/**
 * Strategy 6: Leveraged Risk Parity (HFEA-style, trend-gated). The "Hedgefundie"
 * 3x-stock / 3x-bond risk-parity book, made survivable: while the Nasdaq is above
 * its 200-day MA, hold 55% 3x Nasdaq and 45% in a leveraged long-Treasury sleeve
 * — but the bond leg only uses 3x Treasuries while bonds are themselves trending
 * up, falling back to gold (the 2022 rate-shock hedge) otherwise. Below the
 * 200-day MA it goes fully defensive. Holds at most 2 instruments.
 */
export const leveragedRiskParity: StrategyDefinition = {
  id: 'leveraged-risk-parity',
  name: '槓桿風險平價 HFEA',
  shortName: '槓桿風險平價',
  category: 'diversified',
  description:
    '那斯達克多頭時，55% 持有 3 倍那斯達克 ETF、45% 持有槓桿長債（債券趨勢轉弱時改持黃金避開升息衝擊）；跌破 200 日均線就全數轉入趨勢最強的避險資產。經典 HFEA「3 倍股＋3 倍債」風險平價的改良版。',
  longDescription:
    "知名的 HFEA（Hedgefundie's Excellent Adventure）風險平價：用 3 倍股票與 3 倍長債做負相關配置，" +
    '多頭時股債齊漲、回檔時長債通常上漲對沖。本策略在此之上加兩道防護：' +
    '(1) 以那斯達克 200 日均線為總開關，跌破時 100% 退場轉入避險資產；' +
    '(2) 債券部位只在長債自身趨勢向上時用 3 倍槓桿長債，否則改持黃金——避開 2022 年那種升息把長債與 3 倍長債一起打趴的情境。' +
    '多頭時 55% 3 倍那斯達克 + 45% 槓桿長債/黃金，靠槓桿與股債對沖同時放大報酬、平滑波動，定期定額長期大幅領先 QQQ。' +
    '本策略槓桿與回撤都偏高，是平台上最積極的配置之一。',
  rules: [
    '每日檢查那斯達克 100 是否站上 200 日均線。',
    '站上：55% 持有 3 倍那斯達克 ETF。',
    '債券部位（45%）：長債趨勢向上 → 3 倍長債 ETF；否則 → 黃金。',
    '跌破：全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者。每月最多交易 3 次，最多持有 2 檔。',
  ],
  caveats: [
    '3 倍 ETF 每日重設、波動耗損大，最大回撤可達 70% 以上（2000 年科技泡沫期）。',
    '股債同跌（如 2022）時，即使有黃金備援也可能兩頭受傷。',
    '槓桿與波動最高，僅適合風險承受度高、長期定期定額的投資人。',
  ],
  tags: ['槓桿', '風險平價', 'HFEA', '股債配置'],
  rebalance: 'daily',
  universe: ['那斯達克100 (3x)', '長期公債 (3x)', '黃金', '中期公債', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ3X, ASSET.LTT, ASSET.LTT3X, ASSET.GOLD, ASSET.ITT, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ, ASSET.LTT],
  warmupDays: 210,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };
    const bond = trendUp(ctx, ASSET.LTT, 100) ? ASSET.LTT3X : ASSET.GOLD;
    return { [ASSET.NASDAQ3X]: 0.55, [bond]: 0.45 };
  },
};
