'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DrawdownPoint, EquityPoint, PricePoint } from '@repo/shared';
import { formatUsd } from '@/lib/format';

const GRID = '#1c2740';
const AXIS = '#5f6e8a';

const SERIES = [
  { key: 'strategy', name: '本策略', color: '#2dd4bf', width: 2.4 },
  { key: 'qqq', name: 'QQQ (那斯達克)', color: '#a78bfa', width: 1.6 },
  { key: 'voo', name: 'VOO (標普500)', color: '#60a5fa', width: 1.6 },
  { key: 'contributed', name: '累積投入', color: '#5f6e8a', width: 1.4, dashed: true },
] as const;

function yearTick(date: string): string {
  return date.slice(0, 4);
}

function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#121826',
        border: '1px solid #243049',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
      }}
    >
      <div style={{ color: '#93a0b8', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div
          key={p.dataKey}
          style={{ color: p.color, display: 'flex', gap: 12, justifyContent: 'space-between' }}
        >
          <span>{SERIES.find((s) => s.key === p.dataKey)?.name ?? p.dataKey}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatUsd(p.value, { compact: true })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EquityChart({ data }: { data: EquityPoint[] }) {
  const values = data.flatMap((d) => [d.strategy, d.qqq, d.voo].filter((v) => v > 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const useLog = max / Math.max(min, 1) > 30;

  return (
    <>
      <div className="legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i
              style={{
                background: s.color,
                ...('dashed' in s && s.dashed ? { opacity: 0.7 } : {}),
              }}
            />
            {s.name}
          </span>
        ))}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={yearTick}
              minTickGap={48}
              tick={{ fill: AXIS, fontSize: 12 }}
              stroke={GRID}
            />
            <YAxis
              scale={useLog ? 'log' : 'auto'}
              domain={useLog ? ['auto', 'auto'] : [0, 'auto']}
              tickFormatter={(v) => formatUsd(v, { compact: true })}
              tick={{ fill: AXIS, fontSize: 12 }}
              stroke={GRID}
              width={62}
            />
            <Tooltip content={<EquityTooltip />} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={'dashed' in s && s.dashed ? '4 4' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function PriceChart({ data, isYield }: { data: PricePoint[]; isYield?: boolean }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={yearTick}
            minTickGap={48}
            tick={{ fill: AXIS, fontSize: 12 }}
            stroke={GRID}
          />
          <YAxis
            scale={isYield ? 'auto' : 'log'}
            domain={['auto', 'auto']}
            tickFormatter={(v) => (isYield ? `${v}%` : Number(v).toLocaleString('en-US'))}
            tick={{ fill: AXIS, fontSize: 12 }}
            stroke={GRID}
            width={62}
          />
          <Tooltip
            formatter={(v: number) => [
              isYield ? `${v.toFixed(2)}%` : v.toLocaleString('en-US'),
              '收盤',
            ]}
            contentStyle={{ background: '#121826', border: '1px solid #243049', borderRadius: 10 }}
            labelStyle={{ color: '#93a0b8' }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#2dd4bf"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  return (
    <div className="chart-wrap short">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={yearTick}
            minTickGap={48}
            tick={{ fill: AXIS, fontSize: 12 }}
            stroke={GRID}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: AXIS, fontSize: 12 }}
            stroke={GRID}
            width={48}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}%`, '回撤']}
            contentStyle={{ background: '#121826', border: '1px solid #243049', borderRadius: 10 }}
            labelStyle={{ color: '#93a0b8' }}
          />
          <Area
            type="monotone"
            dataKey="strategy"
            stroke="#f87171"
            strokeWidth={1.5}
            fill="url(#ddFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
