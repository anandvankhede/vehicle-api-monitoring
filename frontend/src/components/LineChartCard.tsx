import React, { useState, useCallback } from 'react';
import { TrendingUp, Info, Maximize2, Loader2 } from 'lucide-react';
import { LineChartModal } from './LineChartModal';
import { TrendLineChart, computeTrendSummary } from './TrendLineChart';
import type { RequestTrendDataPoint, ApiTimeFilterValue, ApiOption } from '../types/dashboard';

interface LineChartCardProps {
  data: RequestTrendDataPoint[];
  chartKey?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  totalHits?: number;
  successRate?: number;
  apis: ApiOption[];
  selectedApiId: string;
  onApiChange: (apiId: string) => void;
  selectedTimeFilter?: ApiTimeFilterValue;
  onTimeFilterChange?: (filter: ApiTimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onModalOpenChange?: (open: boolean) => void;
  clientId?: string;
}

export const LineChartCard: React.FC<LineChartCardProps> = ({
  data,
  chartKey = 'default',
  isLoading = false,
  isRefreshing = false,
  totalHits = 0,
  successRate = 0,
  apis,
  selectedApiId,
  onApiChange,
  selectedTimeFilter = 'last_7_days',
  onTimeFilterChange,
  startDate = '',
  endDate = '',
  onDateChange,
  onModalOpenChange,
  clientId = 'all',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showCardSkeleton = isLoading && !isModalOpen;
  const isEmpty = !data || data.length === 0;
  const summary = computeTrendSummary(data);
  const displayTotal = totalHits || summary.totalHits;
  const displayRate = successRate || summary.successRate;

  const setModalOpen = useCallback((open: boolean) => {
    setIsModalOpen(open);
    onModalOpenChange?.(open);
  }, [onModalOpenChange]);

  const modal = (
    <LineChartModal
      open={isModalOpen}
      onClose={() => setModalOpen(false)}
      initialData={data}
      initialStats={{ totalHits: displayTotal, successRate: displayRate }}
      apis={apis}
      selectedApiId={selectedApiId}
      onApiChange={onApiChange}
      selectedTimeFilter={selectedTimeFilter}
      onTimeFilterChange={onTimeFilterChange || (() => {})}
      startDate={startDate}
      endDate={endDate}
      onDateChange={onDateChange}
      clientId={clientId}
    />
  );

  if (showCardSkeleton) {
    return (
      <>
        <div className="enterprise-card rounded-xl p-3 sm:p-4 border h-full min-h-[280px] flex flex-col animate-pulse" style={{ borderColor: 'var(--border)' }}>
          <div className="h-5 rounded w-1/3 mb-3" style={{ backgroundColor: 'var(--border)' }} />
          <div className="flex-1 rounded-lg mx-2" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <div className="enterprise-card rounded-xl p-3 sm:p-4 border shadow-md flex flex-col h-full min-h-[280px] relative" style={{ borderColor: 'var(--border)' }}>
        {isRefreshing && (
          <div className="absolute top-2 right-2 z-10 p-1 rounded-full" style={{ backgroundColor: 'var(--card)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        <div className="flex items-center justify-between pb-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Request Trend
              </h3>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Success: {displayRate.toFixed(1)}% · Hits: {displayTotal.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Maximize2 className="w-3 h-3" />
            View
          </button>
        </div>

        <div className="flex-1 min-h-[180px] relative my-2">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
              <Info className="w-5 h-5 mb-1" />
              <p className="text-[11px] font-medium">No trend telemetry available</p>
            </div>
          ) : (
            <TrendLineChart data={data} chartKey={chartKey} compact showAxisLabels={false} />
          )}
        </div>
      </div>

      {modal}
    </>
  );
};
