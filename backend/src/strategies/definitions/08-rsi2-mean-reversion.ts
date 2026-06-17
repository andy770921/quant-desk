import { ASSET } from '../../market-data/assets';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, leveragedEquity, trendUp } from './_helpers';

/**
 * Strategy 8 (S7) — Short-Term Mean Reversion (RSI-2). Source: Connors & Alvarez,
 * "Short Term Trading Strategies That Work" (2008). Buy oversold pullbacks inside
 * an uptrend; de-risk when overbought. Daily. Bias-free (index only).
 *
 * Only acts above the 200-day MA. RSI-2 ≤ 10 (deeply oversold) → vol-targeted
 * leveraged Nasdaq (cap 1.5x); RSI-2 ≥ 70 (overbought) → step down to 1x S&P;
 * otherwise hold the 1x index. The ≤3-trades/month cap deliberately tames its
 * turnover. Its recent strength leans on the "every dip recovers" 2010s regime —
 * treat its post-2010 numbers with the most caution of the nine.
 */
export const rsi2MeanReversion: StrategyDefinition = {
  id: 's7-rsi2-mean-reversion',
  name: '短線均值回歸 (RSI-2)',
  shortName: 'RSI-2回歸',
  category: 'mean-reversion',
  description:
    '只在那斯達克站上 200 日均線（多頭）時操作：2 日 RSI ≤ 10（深度超賣回檔）→ 以波動目標槓桿做多那斯達克（上限 1.5 倍）；RSI ≥ 70（超買）→ 降風險轉 1x 標普；其餘時間持有 1x 那斯達克。跌破 200 日均線則全數轉入趨勢最強的避險資產。',
  longDescription:
    'Connors–Alvarez「Short Term Trading Strategies That Work」(2008) 的 RSI-2 逆勢買回檔：在多頭趨勢中，短線的超賣往往很快反彈，因此「買在多頭裡的回檔」具有正期望值。' +
    '每日先確認那斯達克是否站上 200 日均線——這是大前提，跌破就全數轉入中期/長期公債、黃金、現金中近半年趨勢最強者，絕不在空頭裡接刀。' +
    '多頭中計算 2 日 RSI：≤ 10（深度超賣）代表短線回檔到位，以波動目標槓桿做多那斯達克（30% ÷ 近 3 個月波動，上限 1.5 倍，1x＋2x ETF）；≥ 70（超買）代表短線過熱，降風險轉持 1x 標普 500；介於之間則持有 1x 那斯達克。' +
    '原始 RSI-2 換手極高，平台的「每月最多 3 次交易」上限刻意馴服其週轉率。純指數，無存活者偏誤。',
  rules: [
    '那斯達克 < 200 日均線 → 全數轉入趨勢最強的公債/黃金/現金（不操作）。',
    '多頭中 2 日 RSI ≤ 10（超賣）→ 波動目標槓桿做多那斯達克（上限 1.5 倍）。',
    '2 日 RSI ≥ 70（超買）→ 降風險轉 1x 標普；其餘 → 持有 1x 那斯達克。',
    '每月最多交易 3 次（刻意壓低週轉），最多持有 10 檔。',
  ],
  caveats: [
    '九個策略中最依賴 2010–2021「逢低必反彈」行情，2000/2008 表現較差。',
    '短線訊號每月 3 次交易上限會錯過部分回檔買點。',
    '槓桿型 ETF 每日重設，盤整時有波動耗損。',
  ],
  tags: ['均值回歸', 'RSI', '短線', '逆勢'],
  rebalance: 'daily',
  universe: ['那斯達克100 (1x/2x)', '標普500', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.USLC, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.NASDAQ],
  warmupDays: 262,
  cadence: 'daily',
  decide(ctx: StrategyContext): Weights {
    // Only buy dips in an uptrend; risk-off below the 200-day MA.
    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };
    const r = ctx.rsi(ASSET.NASDAQ, 2);
    // Oversold → vol-targeted leveraged long (cap 1.5x).
    if (r !== undefined && r <= 10) {
      return leveragedEquity(ctx, ASSET.NASDAQ, ASSET.NASDAQ2X, undefined, 1, 0.3, 1.5);
    }
    // Overbought → de-risk to 1x S&P.
    if (r !== undefined && r >= 70) return { [ASSET.USLC]: 1 };
    // Default: hold the 1x index in an uptrend.
    return { [ASSET.NASDAQ]: 1 };
  },
};
