'use client';

import { useState } from 'react';
import { useStrategies } from '@/queries/use-strategies';
import { StrategyCard } from '@/components/strategy-card';
import { Loading, ErrorState } from '@/components/states';
import { CATEGORY_LABELS } from '@/lib/format';

const CATEGORIES = [
  'all',
  'trend-following',
  'momentum',
  'mean-reversion',
  'volatility',
  'diversified',
];

export default function StrategiesPage() {
  const { data, isPending, error } = useStrategies();
  const [filter, setFilter] = useState('all');

  const filtered = data?.filter((s) => filter === 'all' || s.category === filter) ?? [];

  return (
    <div className="container">
      <div className="section-head" style={{ marginTop: 36 }}>
        <div>
          <h2>量化策略總覽</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            10 種規則化策略，皆可回測至最早可得資料。點擊任一策略檢視完整回測與績效比較。
          </p>
        </div>
      </div>

      <div className="pill-list" style={{ marginBottom: 22 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`btn sm ${filter === c ? 'primary' : 'ghost'}`}
            onClick={() => setFilter(c)}
          >
            {c === 'all' ? '全部' : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {isPending && <Loading />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="grid cols-3">
          {filtered.map((s) => {
            const idx = data.findIndex((d) => d.id === s.id) + 1;
            return <StrategyCard key={s.id} strategy={s} index={idx} />;
          })}
        </div>
      )}
    </div>
  );
}
