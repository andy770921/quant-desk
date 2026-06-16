'use client';

import { use, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { BacktestMode, Rating, SignalSource } from '@repo/shared';
import { rateDrawdown, rateReturn, rateSharpe, rateVolatility } from '@repo/shared';
import { useStrategy } from '@/queries/use-strategy';
import { useBacktest } from '@/queries/use-backtest';
import { EquityChart, DrawdownChart } from '@/components/charts';
import { CurrentSignal } from '@/components/current-signal';
import { Loading, ErrorState } from '@/components/states';
import {
  CATEGORY_LABELS,
  REBALANCE_LABELS,
  RISK_LABELS,
  formatNumber,
  formatPct,
  formatUsd,
  pctClass,
} from '@/lib/format';

const MAX_MONTH = '2026-06';

export default function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const strategy = useStrategy(id);

  const inceptionMonth = strategy.data?.dataInception.slice(0, 7) ?? '1990-01';
  const defaultStart = inceptionMonth > '1990-01' ? inceptionMonth : '1990-01';

  const [mode, setMode] = useState<BacktestMode>('dca');
  const [start, setStart] = useState<string>('1990-01');
  const [monthly, setMonthly] = useState(2000);
  const [lump, setLump] = useState(100000);

  // Clamp the requested start to what the strategy supports.
  const effectiveRequestStart = useMemo(
    () => (start < defaultStart ? defaultStart : start),
    [start, defaultStart],
  );

  const backtest = useBacktest({
    strategyId: id,
    mode,
    start: effectiveRequestStart,
    monthlyAmount: monthly,
    lumpSum: lump,
  });

  if (strategy.isPending)
    return (
      <div className="container">
        <Loading />
      </div>
    );
  if (strategy.error)
    return (
      <div className="container">
        <ErrorState error={strategy.error} />
      </div>
    );
  const s = strategy.data!;

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link href="/strategies">策略</Link> / {s.shortName}
      </div>

      {/* Header */}
      <div className="card">
        <div className="scard-top">
          <h1 style={{ fontSize: 28 }}>{s.name}</h1>
          <div className="tag-row">
            <span className="chip cat">{CATEGORY_LABELS[s.category]}</span>
            {s.leverage > 1 && <span className="chip lev">{s.leverage}x 槓桿</span>}
            <span className="chip">
              <span className={`risk-dot risk-${s.riskLevel}`} />
              {RISK_LABELS[s.riskLevel]}
            </span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {s.longDescription}
        </p>
        <div className="tag-row" style={{ marginTop: 14 }}>
          <span className="chip">{REBALANCE_LABELS[s.rebalance]}調整</span>
          {s.universe.map((u) => (
            <span key={u} className="chip">
              {u}
            </span>
          ))}
          <span className="chip">資料自 {s.dataInception}</span>
        </div>
      </div>

      {/* Live current signal */}
      <CurrentSignal strategyId={id} />

      {/* Controls */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="controls">
          <div className="field">
            <label>投入方式</label>
            <div className="toggle">
              <button className={mode === 'dca' ? 'active' : ''} onClick={() => setMode('dca')}>
                每月定期定額
              </button>
              <button
                className={mode === 'lumpsum' ? 'active' : ''}
                onClick={() => setMode('lumpsum')}
              >
                一次性投入
              </button>
            </div>
          </div>

          <div className="field">
            <label>起始月份</label>
            <input
              type="month"
              value={start}
              min={inceptionMonth}
              max={MAX_MONTH}
              onChange={(e) => setStart(e.target.value || '1990-01')}
            />
          </div>

          {mode === 'dca' ? (
            <div className="field">
              <label>每月投入 (USD)</label>
              <input
                type="number"
                value={monthly}
                min={100}
                step={100}
                onChange={(e) => setMonthly(Math.max(100, Number(e.target.value) || 0))}
              />
            </div>
          ) : (
            <div className="field">
              <label>一次投入 (USD)</label>
              <input
                type="number"
                value={lump}
                min={1000}
                step={1000}
                onChange={(e) => setLump(Math.max(1000, Number(e.target.value) || 0))}
              />
            </div>
          )}

          <div className="field">
            <label>快速選擇</label>
            <div className="pill-list">
              <button className="btn sm ghost" onClick={() => setStart('1990-01')}>
                1990 至今
              </button>
              <button className="btn sm ghost" onClick={() => setStart('2010-01')}>
                2010 至今
              </button>
              <button className="btn sm ghost" onClick={() => setStart('2026-01')}>
                2026 前瞻
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {backtest.isPending && <Loading label="回測計算中…" />}
      {backtest.error && <ErrorState error={backtest.error} />}
      {backtest.data && (
        <Results data={backtest.data} caveats={s.caveats} signalSource={s.signalSource} />
      )}
    </div>
  );
}

function Results({
  data,
  caveats,
  signalSource,
}: {
  data: NonNullable<ReturnType<typeof useBacktest>['data']>;
  caveats: string[];
  signalSource: SignalSource;
}) {
  const m = data.metrics;
  return (
    <>
      {/* Hero metrics */}
      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card stat">
          <span className="label">最終價值</span>
          <span className="value lg">{formatUsd(m.finalValue, { compact: true })}</span>
          <span className="faint">投入 {formatUsd(m.totalContributed, { compact: true })}</span>
        </div>
        <div className="card stat">
          <span className="label">總報酬</span>
          <span className={`value lg ${pctClass(m.totalReturnPct)}`}>
            {formatPct(m.totalReturnPct)}
          </span>
          <span className="faint">獲利 {formatUsd(m.totalProfit, { compact: true })}</span>
        </div>
        <div className="card stat">
          <span className="label">年化報酬 ({data.mode === 'dca' ? 'XIRR' : 'CAGR'})</span>
          <span className={`value lg ${pctClass(m.annualizedReturnPct)}`}>
            {formatPct(m.annualizedReturnPct)}
          </span>
          <RateBadge rating={rateReturn(m.annualizedReturnPct)} suffix={`· ${m.years} 年`} />
        </div>
        <div className="card stat">
          <span className="label">夏普值 (Sharpe)</span>
          <span className={`value lg ${m.sharpe >= 1 ? 'pos' : m.sharpe < 0 ? 'neg' : 'flat'}`}>
            {m.sharpe.toFixed(2)}
          </span>
          <RateBadge rating={rateSharpe(m.sharpe)} suffix="風險調整後報酬" />
        </div>
        <div className="card stat">
          <span className="label">最大回撤</span>
          <span className="value lg neg">{m.maxDrawdownPct.toFixed(1)}%</span>
          <RateBadge rating={rateDrawdown(m.maxDrawdownPct)} suffix={`· 交易 ${m.tradeCount} 次`} />
        </div>
        <div className="card stat">
          <span className="label">年化波動度</span>
          <span className="value lg flat">{m.annualVolPct.toFixed(1)}%</span>
          <RateBadge
            rating={rateVolatility(m.annualVolPct)}
            suffix={`· 最高槓桿 ${m.peakLeverage}x`}
          />
        </div>
      </div>

      {/* Equity chart */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-head" style={{ margin: '0 0 14px' }}>
          <h2 style={{ fontSize: 18 }}>資金成長曲線</h2>
          <span className="faint">
            {data.effectiveStart} → {data.end}
          </span>
        </div>
        <EquityChart data={data.equityCurve} />
      </div>

      {/* Comparison + side panel */}
      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>績效比較</h2>
          <table className="alloc">
            <tbody>
              <ComparisonRow name="本策略" highlight metrics={m} />
              {data.benchmarks.map((b) => (
                <ComparisonRow key={b.key} name={b.name} metrics={b.metrics} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>回撤走勢</h2>
          <DrawdownChart data={data.drawdownCurve} />
        </div>
      </div>

      {/* Current holdings (shares + dollars) */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-head" style={{ margin: '0 0 12px' }}>
          <h2 style={{ fontSize: 18 }}>目前持倉</h2>
          <span className="faint">
            總值 {formatUsd(data.totalValueNow)} · 累積{m.totalProfit >= 0 ? '獲利' : '虧損'}{' '}
            <span className={pctClass(m.totalProfit)}>{formatUsd(m.totalProfit)}</span>
          </span>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>標的</th>
              <th>股數</th>
              <th>每股淨值</th>
              <th>市值</th>
              <th>佔比</th>
            </tr>
          </thead>
          <tbody>
            {data.holdingsNow.map((h) => (
              <tr key={h.asset}>
                <td>{h.asset}</td>
                <td>{formatNumber(h.shares, 4)}</td>
                <td>{formatUsd(h.price, { decimals: 2 })}</td>
                <td>{formatUsd(h.value)}</td>
                <td>{h.weightPct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="cash-row">
              <td>未投入現金</td>
              <td>—</td>
              <td>—</td>
              <td>{formatUsd(data.cashNow, { decimals: 2 })}</td>
              <td>
                {data.totalValueNow > 0
                  ? ((data.cashNow / data.totalValueNow) * 100).toFixed(1)
                  : '0.0'}
                %
              </td>
            </tr>
          </tbody>
        </table>
        <p className="faint" style={{ marginBottom: 0 }}>
          已投入本金合計 {formatUsd(m.totalContributed)}（
          {data.mode === 'dca' ? '每月定期定額' : '一次性投入'}）。
        </p>
      </div>

      {/* Detailed trade ledger */}
      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>近期交易明細</h2>
        {data.recentTrades.length === 0 ? (
          <p className="faint">此區間內無交易。</p>
        ) : (
          <div className="tradelog">
            {data.recentTrades.map((t, i) => (
              <div className="tradelog-row" key={i}>
                <div className="tl-head">
                  <span className="date">{t.date}</span>
                  <span className="kind">{t.kind}</span>
                  <span className="faint">
                    當時總值 {formatUsd(t.totalValue)} · 交易後現金 {formatUsd(t.cashAfter)}
                  </span>
                </div>
                <div className="tl-legs">
                  {t.sells.map((l, j) => (
                    <div className="leg sell" key={`s${j}`}>
                      賣出 {l.asset}：{formatNumber(l.shares, 4)} 股，得{' '}
                      {formatUsd(l.amount, { decimals: 2 })}
                    </div>
                  ))}
                  {t.buys.map((l, j) => (
                    <div className="leg buy" key={`b${j}`}>
                      買入 {l.asset}：{formatNumber(l.shares, 4)} 股，花{' '}
                      {formatUsd(l.amount, { decimals: 2 })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes + caveats */}
      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>注意事項</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {caveats.map((c, i) => (
            <div className="note" key={`c${i}`}>
              {c}
            </div>
          ))}
          {data.notes.map((n, i) => (
            <div className="note" key={`n${i}`}>
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* Buy/sell signal formula — generated from the real decide() source */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="fml-head">
          <h2 style={{ fontSize: 18, margin: 0 }}>買賣訊號邏輯 / 公式</h2>
          <span className="fml-badge" title="此程式碼直接抽取自後端，回測與即時訊號皆執行同一段">
            ✓ 由 decide() 原始碼自動生成
          </span>
        </div>
        <p className="faint" style={{ marginTop: 8, marginBottom: 14 }}>
          下方即為後端<strong>實際執行</strong>
          的決策函式原始碼（非手寫說明）。每個交易日（或每月）呼叫{' '}
          <code className="fml-inline">decide(ctx)</code>{' '}
          計算目標持倉權重，因此畫面公式永遠與回測、即時訊號一致，不會走鐘。
        </p>

        <div className="fml-window">
          <div className="fml-filebar">
            <span className="fml-dot" />
            <span className="fml-dot" />
            <span className="fml-dot" />
            <span className="fml-filename">decide(ctx) → 目標權重</span>
          </div>
          <CodeBlock code={signalSource.decide} />
        </div>

        {signalSource.refs.length > 0 && (
          <details className="fml-refs">
            <summary>
              引用的輔助函式與指標公式（{signalSource.refs.length}）— 點此展開背後的數學
            </summary>
            <div className="fml-refgrid">
              {signalSource.refs.map((r) => (
                <div className="fml-ref" key={r.name}>
                  <div className="fml-reflabel">{r.name}()</div>
                  <CodeBlock code={r.source} />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}

/** Token classes for the lightweight TS highlighter below. */
const TS_TOKEN =
  /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(const|let|var|return|if|else|for|of|in|new|function|undefined|null|true|false|typeof|interface|type|export|import|from)\b|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;

/** Minimal, dependency-free TS syntax highlighting → React nodes (input is escaped by React). */
function highlightTs(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TS_TOKEN.lastIndex = 0;
  while ((m = TS_TOKEN.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'cm' : m[2] ? 'st' : m[3] ? 'kw' : m[4] ? 'nu' : m[5] ? 'fn' : 'id';
    out.push(
      <span className={`tok-${cls}`} key={key++}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="code-block fml-code">
      <code>{highlightTs(code)}</code>
    </pre>
  );
}

function RateBadge({ rating, suffix }: { rating: Rating; suffix?: string }) {
  return (
    <span className="faint">
      <span className={`rate ${rating.tone}`}>{rating.label}</span>
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

function ComparisonRow({
  name,
  metrics,
  highlight,
}: {
  name: string;
  metrics: {
    finalValue: number;
    totalReturnPct: number;
    annualizedReturnPct: number;
    maxDrawdownPct: number;
    sharpe: number;
  };
  highlight?: boolean;
}) {
  return (
    <tr style={highlight ? { fontWeight: 700 } : undefined}>
      <td>
        {highlight && <span style={{ color: 'var(--accent)' }}>● </span>}
        {name}
      </td>
      <td>{formatUsd(metrics.finalValue, { compact: true })}</td>
      <td className={pctClass(metrics.annualizedReturnPct)}>
        {formatPct(metrics.annualizedReturnPct)}
        <span className="faint" style={{ fontWeight: 400 }}>
          {' '}
          年化
        </span>
      </td>
      <td>
        <span className="faint" style={{ fontWeight: 400 }}>
          Sharpe{' '}
        </span>
        {metrics.sharpe.toFixed(2)}
      </td>
      <td className="neg">-{metrics.maxDrawdownPct.toFixed(0)}%</td>
    </tr>
  );
}
