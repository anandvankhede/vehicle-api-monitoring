import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { RequestDistributionData } from '../types/dashboard';
import { PieChart as PieChartIcon, Info } from 'lucide-react';

interface PieChartCardProps {
  data: RequestDistributionData[];
  totalHits?: number;
  isLoading?: boolean;
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RequestDistributionData;
    return (
      <div className="p-2.5 rounded-lg shadow-xl text-xs space-y-0.5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center space-x-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: data.color }}
          />
          <span>{data.name}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Count: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{data.value.toLocaleString()}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Share: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Legend Component
const CustomLegend = ({ payload }: any) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center space-x-1.5 text-[11px]">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{entry.value}</span>
          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>({entry.payload.percentage}%)</span>
        </div>
      ))}
    </div>
  );
};

export const PieChartCard: React.FC<PieChartCardProps> = ({
  data,
  totalHits = 0,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="enterprise-card rounded-xl p-3 sm:p-4 border h-full min-h-[280px] flex flex-col animate-pulse" style={{ borderColor: 'var(--border)' }}>
        <div className="h-5 rounded w-1/3 mb-3" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="h-5 rounded w-full mt-3" style={{ backgroundColor: 'var(--border)' }} />
      </div>
    );
  }

  const isEmpty = !data || data.every((item) => item.value === 0);

  return (
    <div className="enterprise-card rounded-xl p-3 sm:p-4 border shadow-md flex flex-col h-full min-h-[280px]" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--success-bg)', borderColor: 'color-mix(in srgb, var(--success) 20%, transparent)', color: 'var(--success)' }}>
            <PieChartIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Request Distribution
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-semibold block" style={{ color: 'var(--text-muted)' }}>
            Total
          </span>
          <span className="text-xs font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
            {totalHits.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 min-h-[180px] relative my-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full space-y-1 px-2" style={{ color: 'var(--text-muted)' }}>
            <Info className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[11px] sm:text-xs font-medium text-center">No request distribution data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                key={data.map((item) => `${item.name}-${item.value}`).join('|')}
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--pie-stroke)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};