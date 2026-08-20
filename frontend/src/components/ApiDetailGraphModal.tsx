import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Clock, Loader2, RefreshCw } from 'lucide-react';
import { TimeFilter } from './TimeFilter';
import type { TimeOption } from './TimeFilter';
import { TrendLineChart, TREND_CHART_QUICK_RANGES } from './TrendLineChart';
import { detailsChartService } from '../services/detailsChartService';
import { usePolling } from '../hooks/usePolling';
import { ENV } from '../config/env';
import type { ClientApiDetail } from '../types/detailsChart';
import type { ApiTimeFilterValue } from '../types/dashboard';

const TIME_OPTIONS: TimeOption[] = [
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


interface ApiDetailGraphModalProps {
  open: boolean;
  onClose: () => void;
  detail: ClientApiDetail;
  clientId: string;
  clientName: string;
  timeFilter: ApiTimeFilterValue;
  onTimeFilterChange: (filter: ApiTimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
}

export const ApiDetailGraphModal: React.FC<ApiDetailGraphModalProps> = ({
  open,
  onClose,
  detail,
  clientId,
  clientName,
  timeFilter,
  onTimeFilterChange,
  startDate = '',
  endDate = '',
  onDateChange,
}) => {
  const [liveDetail, setLiveDetail] = useState<ClientApiDetail>(detail);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);
  const apiIdRef = useRef(detail.apiId);

  const [modalTimeFilter, setModalTimeFilter] = useState(timeFilter);
  const [modalStartDate, setModalStartDate] = useState(startDate);
  const [modalEndDate, setModalEndDate] = useState(endDate);

  useEffect(() => {
    if (!open) return;
    apiIdRef.current = detail.apiId;
    setModalTimeFilter(timeFilter);
    setModalStartDate(startDate);
    setModalEndDate(endDate);
    setLiveDetail(detail);
    hasDataRef.current = (detail.trendData?.length ?? 0) > 0;
    setIsLoading(false);
    setIsRefreshing(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- seed only when modal opens

  const fetchModalData = useCallback(async (options: { blocking?: boolean } = {}) => {
    const { blocking = false } = options;
    if (modalTimeFilter === 'custom' && (!modalStartDate || !modalEndDate)) return;

    const requestId = ++requestRef.current;
    if (blocking || !hasDataRef.current) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const apiDetail = await detailsChartService.getApiTrend(
        apiIdRef.current,
        clientId,
        modalTimeFilter,
        modalStartDate,
        modalEndDate,
      );
      if (requestId !== requestRef.current) return;
      setLiveDetail(apiDetail);
      hasDataRef.current = (apiDetail.trendData?.length ?? 0) > 0;
    } catch {
      if (requestId === requestRef.current && blocking && !hasDataRef.current) {
        setLiveDetail((prev) => ({ ...prev, trendData: [] }));
      }
    } finally {
      if (requestId === requestRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [clientId, modalTimeFilter, modalStartDate, modalEndDate]);

  useEffect(() => {
    if (!open) return;
    if (modalTimeFilter === 'custom' && (!modalStartDate || !modalEndDate)) return;

    const delay = modalTimeFilter === 'custom' ? 400 : 0;
    const timer = window.setTimeout(() => {
      fetchModalData({ blocking: !hasDataRef.current });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, modalTimeFilter, modalStartDate, modalEndDate, fetchModalData]);

  usePolling(
    () => fetchModalData(),
    ENV.GRAPH_MODAL_POLL_MS,
    open && !(modalTimeFilter === 'custom' && (!modalStartDate || !modalEndDate))
  );

  const handleClose = useCallback(() => {
    onTimeFilterChange(modalTimeFilter);
    onDateChange?.(modalStartDate, modalEndDate);
    onClose();
  }, [modalTimeFilter, modalStartDate, modalEndDate, onTimeFilterChange, onDateChange, onClose]);

  const handleModalTimeFilterChange = (filter: ApiTimeFilterValue) => {
    setModalTimeFilter(filter);
    if (filter !== 'custom') {
      setModalStartDate('');
      setModalEndDate('');
    }
  };

  const handleModalDateChange = (start: string, end: string) => {
    setModalStartDate(start);
    setModalEndDate(end);
  };

  const refreshLabelSec = ENV.GRAPH_MODAL_POLL_MS / 1000;

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  }, [handleClose]);

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

  const chartKey = `${liveDetail.apiId}-${modalTimeFilter}-${liveDetail.trendData?.length ?? 0}`;
  const hasTrendData = (liveDetail.trendData?.length ?? 0) > 0;
  const showBlockingLoader = isLoading && !hasTrendData;
  const isEmpty = !showBlockingLoader && !isRefreshing && !hasTrendData;
  const successRate = liveDetail.totalHits > 0
    ? ((liveDetail.success / liveDetail.totalHits) * 100).toFixed(2)
    : '0.00';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-7xl flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', height: '90vh' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{liveDetail.apiName}</h2>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{clientName} · Live refresh every {refreshLabelSec}s</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchModalData({ blocking: true })}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Refresh graph"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            {TREND_CHART_QUICK_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => handleModalTimeFilterChange(range.value as ApiTimeFilterValue)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{
                  backgroundColor: modalTimeFilter === range.value ? 'var(--primary)' : 'var(--card-inner)',
                  color: modalTimeFilter === range.value ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${modalTimeFilter === range.value ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {range.label}
              </button>
            ))}
          </div>
          <TimeFilter
            options={TIME_OPTIONS}
            selectedValue={modalTimeFilter}
            onChange={(val) => handleModalTimeFilterChange(val as ApiTimeFilterValue)}
            startDate={modalStartDate}
            endDate={modalEndDate}
            onDateChange={handleModalDateChange}
          />
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Success Rate: <span style={{ color: 'var(--success)' }}>{successRate}%</span>
            <span style={{ color: 'var(--text-muted)' }}> | </span>
            Total Hits: {liveDetail.totalHits.toLocaleString()}
            <span className="ml-3 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3 h-3" /> Avg {liveDetail.avgResponseTimeMs}ms
            </span>
            {isRefreshing && <Loader2 className="w-4 h-4 inline ml-2 animate-spin" style={{ color: 'var(--primary)' }} />}
          </p>
        </div>

        <div className="flex-1 p-5 relative min-h-[300px]">
          {showBlockingLoader && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {isRefreshing && hasTrendData && (
            <div className="absolute top-2 right-2 z-10 p-1.5 rounded-full" style={{ backgroundColor: 'var(--card)' }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
              <TrendingUp className="w-10 h-10 mb-2" />
              <p className="text-sm">No trend data for this period</p>
            </div>
          ) : (
            <TrendLineChart data={liveDetail.trendData} chartKey={chartKey} showAxisLabels />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
