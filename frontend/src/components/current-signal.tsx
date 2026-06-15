'use client';

import { useCurrentSignal } from '@/queries/use-current-signal';

const STANCE_LABEL: Record<string, string> = {
  invested: '進場',
  cash: '場外（現金）',
  mixed: '分散持有',
};

export function CurrentSignal({ strategyId }: { strategyId: string }) {
  const { data } = useCurrentSignal(strategyId);
  if (!data) return null;
  return (
    <div className="card signal-card">
      <div className="signal-main">
        <div className="label">
          目前訊號 · 依最新資料即時計算
          <span className={`signal-pill ${data.stance}`}>{STANCE_LABEL[data.stance]}</span>
        </div>
        <div className="signal-summary">{data.summary}</div>
      </div>
      <div className="faint signal-asof">資料截至 {data.asOf}</div>
    </div>
  );
}
