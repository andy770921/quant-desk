'use client';

import Link from 'next/link';
import { useStrategies } from '@/queries/use-strategies';
import { useMarketOverview } from '@/queries/use-market-overview';
import { StrategyCard } from '@/components/strategy-card';
import { Sparkline } from '@/components/sparkline';
import { Loading, ErrorState } from '@/components/states';
import { formatPct, pctClass } from '@/lib/format';

export default function Home() {
  const strategies = useStrategies();
  const market = useMarketOverview();

  return (
    <div className="container">
      <section className="hero">
        <h1>
          用 <span className="grad">量化策略</span> 投資美股，
          <br />
          先回測再進場。
        </h1>
        <p>
          抓取免費美股歷史資料，回測 10 種規則化交易策略。獨家比較兩種投入方式：
          <strong> 每月定期定額 </strong> 與 <strong> 一次性投入 </strong>， 並對照每月／一次買入
          QQQ 與 VOO 的績效。
        </p>
        <div className="hero-actions">
          <Link href="/strategies" className="btn primary">
            瀏覽全部策略 →
          </Link>
          <Link href="/market" className="btn ghost">
            查看市場行情
          </Link>
        </div>
      </section>

      {/* Market strip */}
      {market.data && (
        <div className="grid cols-3">
          {market.data.quotes.map((q) => (
            <div className="card quote" key={q.symbol}>
              <div className="name">{q.name}</div>
              <div className="price">
                {q.isYield ? `${q.last.toFixed(2)}%` : q.last.toLocaleString('en-US')}
              </div>
              <div className="row">
                <span className={pctClass(q.changePctYtd)}>今年 {formatPct(q.changePctYtd)}</span>
                <span className={pctClass(q.changePct1y)}>一年 {formatPct(q.changePct1y)}</span>
              </div>
              <Sparkline data={q.sparkline} color="auto" />
            </div>
          ))}
        </div>
      )}

      {/* Strategies */}
      <div className="section-head">
        <h2>策略總覽</h2>
        <Link href="/strategies">全部 {strategies.data?.length ?? ''} 種 →</Link>
      </div>
      {strategies.isPending && <Loading />}
      {strategies.error && <ErrorState error={strategies.error} />}
      {strategies.data && (
        <div className="grid cols-3">
          {strategies.data.slice(0, 6).map((s, i) => (
            <StrategyCard key={s.id} strategy={s} index={i + 1} />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="section-head">
        <h2>兩種回測基準</h2>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>💵 每月定期定額</h3>
          <p className="muted">
            自選起始月份，每月固定投入一筆金額（預設 $2,000）。年化報酬以
            <strong> 資金加權報酬率 (XIRR) </strong>計算，忠實反映分批投入的時間價值。
          </p>
          <p className="faint">比較對象：每月買入 QQQ、每月買入 VOO。</p>
        </div>
        <div className="card">
          <h3>🏦 一次性投入</h3>
          <p className="muted">
            起始時一次投入一筆資金（預設 $100,000），之後不再加碼，全靠策略交易累積。年化報酬以
            <strong> 複合年均成長率 (CAGR) </strong>計算。
          </p>
          <p className="faint">比較對象：一次買入 QQQ、一次買入 VOO。</p>
        </div>
      </div>
    </div>
  );
}
