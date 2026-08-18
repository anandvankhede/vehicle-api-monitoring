import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import type { RequestTrendDataPoint } from '../types/dashboard';

export const TREND_CHART_QUICK_RANGES = [
  { value: 'last_30_min', label: 'Last 30 Min' },
  { value: 'last_1_hour', label: 'Last 1 Hour' },
  { value: 'last_2_hours', label: 'Last 2 Hours' },
  { value: 'last_4_hours', label: 'Last 4 Hours' },
] as const;

interface TrendLineChartProps {
  data: RequestTrendDataPoint[];
  chartKey: string;
  height?: number | string;
  compact?: boolean;
  showAxisLabels?: boolean;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="p-2.5 rounded-lg shadow-xl text-xs space-y-1 min-w-[160px]"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="font-semibold pb-1 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
        {label}
      </div>
      {payload.map((item: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  chartKey,
  height = '100%',
  compact = false,
  showAxisLabels = true,
}) => {
  const fontSize = compact ? 9 : 11;
  const dotR = compact ? 2 : 3.5;
  const strokeW = compact ? 2 : 2.5;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          key={chartKey}
          data={data}
          margin={{ top: 12, right: 16, left: 4, bottom: showAxisLabels ? 8 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" opacity={0.35} />
          <XAxis
            dataKey="time"
            stroke="var(--chart-text)"
            fontSize={fontSize}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)', opacity: 0.4 }}
            minTickGap={8}
            interval="preserveStartEnd"
            angle={data.length > 10 ? -40 : 0}
            textAnchor={data.length > 10 ? 'end' : 'middle'}
            height={data.length > 10 ? 52 : 32}
          >
            {showAxisLabels && (
              <Label value="Time (HH:MM)" offset={-2} position="insideBottom" style={{ fill: 'var(--chart-text)', fontSize: fontSize - 1 }} />
            )}
          </XAxis>
          <YAxis
            stroke="var(--chart-text)"
            fontSize={fontSize}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)', opacity: 0.4 }}
            allowDecimals={false}
            width={compact ? 28 : 36}
          >
            {showAxisLabels && (
              <Label value="Count" angle={-90} position="insideLeft" style={{ fill: 'var(--chart-text)', fontSize: fontSize - 1, textAnchor: 'middle' }} />
            )}
          </YAxis>
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '6px', fontSize: `${fontSize}px`, color: 'var(--chart-text)' }} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#2563eb"
            strokeWidth={strokeW + 0.5}
            dot={{ r: dotR, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: dotR + 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="success"
            name="Success"
            stroke="#16a34a"
            strokeWidth={strokeW}
            dot={{ r: dotR, fill: '#16a34a', strokeWidth: 0 }}
            activeDot={{ r: dotR + 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="#dc2626"
            strokeWidth={strokeW}
            dot={{ r: dotR, fill: '#dc2626', strokeWidth: 0 }}
            activeDot={{ r: dotR + 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="notFound"
            name="Not Found"
            stroke="#d97706"
            strokeWidth={strokeW}
            dot={{ r: dotR, fill: '#d97706', strokeWidth: 0 }}
            activeDot={{ r: dotR + 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export function computeTrendSummary(data: RequestTrendDataPoint[]) {
  const totalHits = data.reduce((sum, p) => sum + p.total, 0);
  const successHits = data.reduce((sum, p) => sum + p.success, 0);
  const successRate = totalHits > 0 ? (successHits / totalHits) * 100 : 0;
  return { totalHits, successRate };
}
