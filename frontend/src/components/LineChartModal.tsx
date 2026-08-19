import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Server, Loader2 } from 'lucide-react';
import { TimeFilter } from './TimeFilter';
import type { TimeOption } from './TimeFilter';
import { TrendLineChart, TREND_CHART_QUICK_RANGES, computeTrendSummary } from './TrendLineChart';
import { dashboardService } from '../services/dashboardService';
import { usePolling } from '../hooks/usePolling';
import { ENV } from '../config/env';
import type { RequestTrendDataPoint, ApiTimeFilterValue, ApiOption, ApiMonitoringStats } from '../types/dashboard';

const MAIN_API_TIME_OPTIONS: TimeOption[] = [
  { value: 'last_30_min', label: 'Last 30 Mins' },
  { value: 'last_1_hour', label: 'Last 1 Hour' },
  { value: 'last_2_hours', label: 'Last 2 Hours' },
  { value: 'last_3_hours', label: 'Last 3 Hours' },
  { value: 'last_4_hours', label: 'Last 4 Hours' },
  { value: 'last_5_hours', label: 'Last 5 Hours' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];


interface LineChartModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: RequestTrendDataPoint[];
  initialStats?: Pick<ApiMonitoringStats, 'totalHits' | 'successRate'> | null;
  apis: ApiOption[];
  selectedApiId: string;
  onApiChange: (apiId: string) => void;
  selectedTimeFilter: ApiTimeFilterValue;
  onTimeFilterChange: (filter: ApiTimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
}

export const LineChartModal: React.FC<LineChartModalProps> = ({
  open,
  onClose,
  initialData = [],
  initialStats = null,
  apis,
  selectedApiId,
  onApiChange,
  selectedTimeFilter,
  onTimeFilterChange,
  startDate = '',
  endDate = '',
  onDateChange,
}) => {
  const [trendData, setTrendData] = useState<RequestTrendDataPoint[]>(initialData);
  const [summary, setSummary] = useState({ totalHits: initialStats?.totalHits ?? 0, successRate: initialStats?.successRate ?? 0 });
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(0);

  const fetchModalData = useCallback(async (silent = true) => {
    if (!selectedApiId) return;
    if (selectedTimeFilter === 'custom' && (!startDate || !endDate)) return;

    const requestId = ++requestRef.current;
    if (!silent) setIsLoading(true);

    try {
      const stats = await dashboardService.getApiMonitoringStats(
        selectedApiId,
        selectedTimeFilter,
        startDate,
        endDate
      );
      if (requestId !== requestRef.current) return;
      setTrendData(stats.trendData);
      setSummary({ totalHits: stats.totalHits, successRate: stats.successRate });
    } catch {
      if (!silent && requestId === requestRef.current) {
        setTrendData([]);
      }
    } finally {
      if (!silent && requestId === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedApiId, selectedTimeFilter, startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    setTrendData(initialData);
    if (initialStats) {
      setSummary({ totalHits: initialStats.totalHits, successRate: initialStats.successRate });
    }
    fetchModalData(false);
  }, [open, selectedApiId, selectedTimeFilter, startDate, endDate]);

  usePolling(() => fetchModalData(true), ENV.DASHBOARD_POLL_MS, open);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const chartKey = `${selectedApiId}-${selectedTimeFilter}-${trendData.length}`;
  const trendSummary = computeTrendSummary(trendData);
  const displayTotal = summary.totalHits || trendSummary.totalHits;
  const displayRate = summary.successRate || trendSummary.successRate;
  const isEmpty = !isLoading && trendData.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-7xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', height: '90vh' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--primary-light)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Request Trend — Live View
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                This graph refreshes every 5 seconds
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b space-y-3 shrink-0" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            {TREND_CHART_QUICK_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => onTimeFilterChange(range.value as ApiTimeFilterValue)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: selectedTimeFilter === range.value ? 'var(--primary)' : 'var(--card-inner)',
                  color: selectedTimeFilter === range.value ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${selectedTimeFilter === range.value ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[160px]">
              <select
                value={selectedApiId}
                onChange={(e) => onApiChange(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg px-3 py-1.5 pr-8"
                style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}
              >
                {apis.map((api) => (
                  <option key={api.id} value={api.id}>{api.name}</option>
                ))}
              </select>
              <Server className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--primary)' }} />
            </div>
            <TimeFilter
              options={MAIN_API_TIME_OPTIONS}
              selectedValue={selectedTimeFilter}
              onChange={(val) => onTimeFilterChange(val as ApiTimeFilterValue)}
              startDate={startDate}
              endDate={endDate}
              onDateChange={onDateChange}
            />
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />}
          </div>

          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Success Rate: <span style={{ color: 'var(--success)' }}>{displayRate.toFixed(2)}%</span>
            <span style={{ color: 'var(--text-muted)' }}> | </span>
            Total Hits: <span>{displayTotal.toLocaleString()}</span>
          </p>
        </div>

        <div className="flex-1 p-5 relative min-h-[320px]">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-muted)' }}>
              <TrendingUp className="w-10 h-10" />
              <p className="text-sm">No trend data for this period</p>
            </div>
          ) : (
            <TrendLineChart data={trendData} chartKey={chartKey} showAxisLabels />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
