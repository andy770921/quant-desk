import { ASSET, AssetKey } from '../../market-data/assets';
import { DAYS } from '../indicators';
import { StrategyContext, StrategyDefinition, Weights } from '../strategy.types';
import { bestBy } from './_helpers';

/**
 * Strategy 10: All-Weather diversified allocation using inverse-vol risk parity
 * across the sleeves (true Dalio spirit) plus a 200-SMA trend overlay that moves
 * equity risk to a trending Treasury when stocks are below trend.
 */
export const allWeather: StrategyDefinition = {
  id: 'all-weather',
  name: '全天候風險平衡',
  shortName: '全天候',
  category: 'diversified',
  description:
    '以反波動度風險平價配置股票、長/中期公債與黃金，並加上股票 200 日均線濾網，空頭時把股票風險移轉至趨勢公債。',
  longDescription:
    'Ray Dalio 的全天候 (All-Weather) 分散配置，採風險平價版本。把固定權重改為反波動度風險平價——每個資產權重與其波動度成反比，' +
    '使各資產（美國大型股、長期公債、中期公債、黃金）的風險貢獻更均衡，提升 Sharpe；再加上股票腳本的 200 日均線疊加濾網：' +
    '當標普跌破均線時，把原本配給股票的權重移轉到趨勢較強的公債，降低股市主導的回撤。',
  rules: [
    '以反波動度（63 日波動度倒數）替股票、長債、中債、黃金配權重，總和為 1。',
    '股票疊加濾網：標普 500 跌破 200 日均線時，股票權重移轉至趨勢最強公債（中/長期）。',
    '黃金資料不足的早期年份自動排除並重新正規化。',
    '每月再平衡一次。',
  ],
  caveats: [
    '債券權重通常偏高，升息／通膨環境（如 2022）較吃虧。',
    '反波動度權重對波動估計敏感。',
    '黃金資料自 2000 年起；早期以股債為主。',
  ],
  signalFormula: [
    'sleeves = {USLC, LTT, ITT, GOLD}  (排除無資料者)',
    'w[i] = (1 / vol(sleeves[i], 63)) / Σ(1 / vol(.,63))   // 反波動度風險平價',
    '',
    'if level(USLC) <= sma(USLC, 200):    // 股票趨勢疊加',
    '    safe = score13612W(LTT) > score13612W(ITT) ? LTT : ITT',
    '    w[safe] += w[USLC]; w[USLC] = 0',
    'weight = w',
  ].join('\n'),
  tags: ['資產配置', '風險平價', '穩健'],
  rebalance: 'monthly',
  universe: ['美國大型股', '長期公債', '中期公債', '黃金'],
  assets: [ASSET.USLC, ASSET.LTT, ASSET.ITT, ASSET.GOLD],
  coreAssets: [ASSET.USLC, ASSET.LTT, ASSET.ITT],
  warmupDays: 260,
  cadence: 'monthly',
  decide(ctx: StrategyContext): Weights {
    const sleeves: AssetKey[] = [ASSET.USLC, ASSET.LTT, ASSET.ITT, ASSET.GOLD].filter((a) =>
      ctx.has(a),
    );
    const raw = sleeves.map((a) => {
      const v = ctx.vol(a, DAYS.QUARTER);
      return { a, inv: v && v > 0 ? 1 / v : 0 };
    });
    const total = raw.reduce((s, r) => s + r.inv, 0);
    const w: Weights = {};
    if (total === 0) {
      for (const a of sleeves) w[a] = 1 / sleeves.length;
    } else {
      for (const r of raw) if (r.inv > 0) w[r.a] = r.inv / total;
    }
    // Equity trend overlay.
    const price = ctx.level(ASSET.USLC);
    const ma = ctx.sma(ASSET.USLC, 200);
    if (price !== undefined && ma !== undefined && price <= ma && w[ASSET.USLC]) {
      const safe = bestBy([ASSET.LTT, ASSET.ITT], (a) => ctx.score13612W(a), ASSET.ITT);
      w[safe] = (w[safe] ?? 0) + w[ASSET.USLC]!;
      w[ASSET.USLC] = 0;
    }
    return w;
  },
};
