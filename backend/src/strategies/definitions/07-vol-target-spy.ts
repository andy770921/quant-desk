import { ASSET } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestDefensive, equalWeight, topStocksByMomentum, trendUp } from './_helpers';

/**
 * Strategy 7: Multifactor — Momentum × Low-Volatility, UNLEVERAGED. Among the
 * top-40 momentum names it keeps the 15 with the LOWEST realized volatility,
 * combining the momentum and low-volatility anomalies. This calmer book targets
 * a higher Sharpe and gentler drawdown than raw momentum. Trend-gated to bonds.
 */
export const volTargetSpy: StrategyDefinition = {
  id: 'stock-multifactor-lowvol',
  name: '多因子低波選股',
  shortName: '多因子低波',
  category: 'volatility',
  description:
    '先選出 12-1 動能最強的 40 檔，再從中挑波動最低的 15 檔等權持有（動能 × 低波動雙因子）；大盤跌破 200 日均線則轉入公債/黃金/現金。追求較高 Sharpe、較低回撤。',
  longDescription:
    '結合兩個最穩健的選股因子：動能 (momentum) 與低波動 (low-volatility anomaly)。' +
    '每月底先用 12-1 動能選出最強的 40 檔，再從中保留近半年實現波動最低的 15 檔等權持有——' +
    '低波動因子長期提供更高的風險調整後報酬，搭配動能可同時抓「強勢」與「穩定」。' +
    '一樣以大盤 200 日均線為總開關，跌破時全數轉入中期/長期公債、黃金、現金中趨勢最強者。' +
    '相較純動能，本策略波動與回撤更低、Sharpe 更高。全程不使用槓桿。',
  rules: [
    '每月底以 12-1 動能選出最強的 40 檔個股。',
    '再從這 40 檔中挑近半年實現波動最低的 15 檔，等權持有。',
    '大盤跌破 200 日均線：全數轉入公債/黃金/現金中近半年趨勢最強者。',
    '每月再平衡一次，全程不使用槓桿。',
  ],
  caveats: [
    '股票池為目前 S&P 500 成分股，存在存活者偏誤，歷史績效偏樂觀。',
    '低波動股在急漲的強多頭中可能跑輸高 beta 名單。',
    '僅有價量資料，無基本面品質因子。',
  ],
  tags: ['多因子', '低波動', '動能', '選股', '不使用槓桿'],
  rebalance: 'monthly',
  universe: ['S&P 500 個股（約 500 檔）', '中/長期公債', '黃金', '現金'],
  assets: [ASSET.NASDAQ, ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH],
  coreAssets: [ASSET.USLC],
  warmupDays: DAYS.YEAR + 10,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };
    const ranked = topStocksByMomentum(ctx, 40)
      .map((s) => ({ s, v: ctx.vol(s, DAYS.HALF_YEAR) }))
      .filter((x): x is { s: typeof x.s; v: number } => x.v !== undefined)
      .sort((a, b) => a.v - b.v);
    const top = ranked.slice(0, 15).map((x) => x.s);
    return top.length < 8 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);
  },
};
