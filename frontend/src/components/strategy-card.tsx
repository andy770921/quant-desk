'use client';

import Link from 'next/link';
import type { StrategySummary } from '@repo/shared';
import { CATEGORY_LABELS, REBALANCE_LABELS, RISK_LABELS } from '@/lib/format';

export function StrategyCard({ strategy, index }: { strategy: StrategySummary; index?: number }) {
  return (
    <Link href={`/strategies/${strategy.id}`}>
      <article className="card scard">
        <div className="scard-top">
          <h3>
            {index !== undefined ? `${index}. ` : ''}
            {strategy.name}
          </h3>
          {strategy.leverage > 1 && <span className="chip lev">{strategy.leverage}x 槓桿</span>}
        </div>
        <p className="desc">{strategy.description}</p>
        <div className="tag-row">
          <span className="chip cat">
            {CATEGORY_LABELS[strategy.category] ?? strategy.category}
          </span>
          {strategy.universe.slice(0, 3).map((u) => (
            <span key={u} className="chip">
              {u}
            </span>
          ))}
        </div>
        <div className="scard-foot">
          <span>
            <span className={`risk-dot risk-${strategy.riskLevel}`} />
            {RISK_LABELS[strategy.riskLevel]}
          </span>
          <span>
            {REBALANCE_LABELS[strategy.rebalance]}調整 · 資料自 {strategy.dataInception.slice(0, 4)}
          </span>
        </div>
      </article>
    </Link>
  );
}
