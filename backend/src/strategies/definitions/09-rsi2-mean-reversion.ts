import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equalWeight, topStocksByMomentum, trendUp } from './_helpers';

/**
 * Strategy 9: Momentum-Leader Pullback (mean reversion), UNLEVERAGED. Within the
 * 100 strongest 12-1 momentum names it buys the 30 with the WEAKEST last-month
 * return — i.e. the short-term pullbacks among long-term winners. Combines the
 * momentum and short-term-reversal effects. Trend-gated to bonds in bear markets.
 */
export const rsi2MeanReversion: StrategyDefinition = {
  id: 'momentum-pullback',
  name: '強勢股逢低布局',
  shortName: '強勢股逢低',
  category: 'mean-reversion',
  description:
    '在 12-1 動能最強的 100 檔「長線贏家」中，買進近一個月跌最多的 30 檔（短線拉回），等權持有；大盤跌破 200 日均線則轉入公債/黃金/現金。長線動能 × 短線反轉。',
  longDescription:
    '結合「長線動能」與「短線反轉」兩個效應：先用 12-1 動能鎖定 100 檔長期強勢的領導股，' +
    '再從中買進「最近一個月跌最多」的 30 檔——也就是在長線贏家裡挑短線拉回、相對超賣者，等權持有，賺取均值回歸的反彈。' +
    '只在大盤站上 200 日均線時操作；跌破時全數轉入中期/長期公債、黃金、現金中趨勢最強者。' +
    '這種「買強勢股的回檔」比單純追高更能改善進場價位。全程不使用槓桿。',
  rules: [
    '大盤站上 200 日均線時：先用 12-1 動能選出最強的 100 檔。',
    '再從中買進最近一個月（21 日）報酬最低的 30 檔，等權持有。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，歷史績效偏樂觀。',
    '「逢低」也可能買到趨勢真正轉壞、而非單純拉回的個股。',
    '月頻再平衡，無法捕捉日內或數日的反轉。',
  ],
  tags: ['均值回歸', '動能', '選股', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['S&P 500 個股（約 500 檔）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const dipped = topStocksByMomentum(ctx, 100)
      .map((s) => ({ s, r: ctx.ret(s, DAYS.MONTH) }))
      .filter((x): x is { s: typeof x.s; r: number } => x.r !== undefined)
      .sort((a, b) => a.r - b.r)
      .slice(0, 30)
      .map((x) => x.s);
    return dipped.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(dipped);
  },
};
