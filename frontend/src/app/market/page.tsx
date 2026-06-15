'use client';

import { useState } from 'react';
import { useMarketOverview } from '@/queries/use-market-overview';
import { useMarketSeries } from '@/queries/use-market-series';
import { PriceChart } from '@/components/charts';
import { Sparkline } from '@/components/sparkline';
import { Loading, ErrorState } from '@/components/states';
import { formatPct, pctClass } from '@/lib/format';

const SELECTABLE = ['GSPC', 'NDX', 'IXIC', 'RUT', 'GLD', 'TNX'];

export default function MarketPage() {
  const overview = useMarketOverview();
  const [symbol, setSymbol] = useState('NDX');
  const series = useMarketSeries(symbol);
  const isYield = symbol === 'TNX';

  return (
    <div className="container">
      <div className="section-head" style={{ marginTop: 36 }}>
        <div>
          <h2>美股市場行情</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            主要指數、黃金與 10 年期公債殖利率快照（資料來源 Yahoo Finance，每日更新）。
          </p>
        </div>
        {overview.data && <span className="faint">截至 {overview.data.asOf}</span>}
      </div>

      {overview.isPending && <Loading />}
      {overview.error && <ErrorState error={overview.error} />}
      {overview.data && (
        <div className="grid cols-3">
          {overview.data.quotes.map((q) => (
            <div className="card quote" key={q.symbol}>
              <div className="name">{q.name}</div>
              <div className="price">
                {q.isYield ? `${q.last.toFixed(2)}%` : q.last.toLocaleString('en-US')}
              </div>
              <div className="row">
                <span className={pctClass(q.changePct1d)}>今日 {formatPct(q.changePct1d)}</span>
                <span className={pctClass(q.changePctYtd)}>今年 {formatPct(q.changePctYtd)}</span>
                <span className={pctClass(q.changePct1y)}>一年 {formatPct(q.changePct1y)}</span>
              </div>
              <Sparkline data={q.sparkline} color="auto" />
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 26 }}>
        <div className="section-head" style={{ margin: '0 0 14px' }}>
          <h2 style={{ fontSize: 18 }}>歷史走勢</h2>
          <div className="pill-list">
            {SELECTABLE.map((sym) => (
              <button
                key={sym}
                className={`btn sm ${symbol === sym ? 'primary' : 'ghost'}`}
                onClick={() => setSymbol(sym)}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
        {series.isPending && <Loading />}
        {series.error && <ErrorState error={series.error} />}
        {series.data && (
          <>
            <p className="faint" style={{ marginTop: 0 }}>
              {series.data.name} · {series.data.firstDate} → {series.data.lastDate}
            </p>
            <PriceChart data={series.data.points} isYield={isYield} />
          </>
        )}
      </div>
    </div>
  );
}
