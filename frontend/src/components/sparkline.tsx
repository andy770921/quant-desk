'use client';

/** Tiny inline SVG sparkline (no dependency) for market quote cards. */
export function Sparkline({
  data,
  width = 220,
  height = 44,
  color = 'var(--accent)',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map(
      (v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`,
    )
    .join(' ');
  const up = data[data.length - 1] >= data[0];
  const stroke = color === 'auto' ? (up ? 'var(--pos)' : 'var(--neg)') : color;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
