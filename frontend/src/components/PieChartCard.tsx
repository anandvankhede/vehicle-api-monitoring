import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RequestDistributionData } from '../types/dashboard';
import { PieChart as PieChartIcon, Info } from 'lucide-react';

interface PieChartCardProps {
  data: RequestDistributionData[];
  totalHits?: number;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload as RequestDistributionData;
    return (
      <div className="p-2.5 rounded-lg shadow-xl text-xs space-y-0.5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center space-x-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
          <span>{item.name}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Count: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value.toLocaleString()}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Share: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const DistributionLegend: React.FC<{ data: RequestDistributionData[] }> = ({ data }) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
    {data.map((entry) => (
      <div key={entry.name} className="flex items-center gap-1.5 text-[11px] min-w-0">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
        <span className="font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
        <span className="font-bold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
          {entry.value.toLocaleString()} ({entry.percentage}%)
        </span>
      </div>
    ))}
  </div>
);

export const PieChartCard: React.FC<PieChartCardProps> = ({
  data,
  totalHits = 0,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="enterprise-card rounded-xl p-3 sm:p-4 border h-full min-h-[320px] flex flex-col animate-pulse" style={{ borderColor: 'var(--border)' }}>
        <div className="h-5 rounded w-1/3 mb-3" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="h-8 rounded w-full mt-3" style={{ backgroundColor: 'var(--border)' }} />
      </div>
    );
  }

  const isEmpty = !data || data.every((item) => item.value === 0);

  return (
    <div className="enterprise-card rounded-xl p-3 sm:p-4 border shadow-md flex flex-col h-full min-h-[320px]" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between pb-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--success-bg)', borderColor: 'color-mix(in srgb, var(--success) 20%, transparent)', color: 'var(--success)' }}>
            <PieChartIcon className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            Request Distribution
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-semibold block" style={{ color: 'var(--text-muted)' }}>Total</span>
          <span className="text-xs font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
            {totalHits.toLocaleString()}
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] space-y-1 px-2" style={{ color: 'var(--text-muted)' }}>
          <Info className="w-5 h-5 sm:w-6 sm:h-6" />
          <p className="text-[11px] sm:text-xs font-medium text-center">No request distribution data</p>
        </div>
      ) : (
        <>
          <div className="w-full h-[210px] sm:h-[220px] mt-2 shrink-0 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  key={data.map((item) => `${item.name}-${item.value}`).join('|')}
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="72%"
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--pie-stroke)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <DistributionLegend data={data} />
        </>
      )}
    </div>
  );
};
