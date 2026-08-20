import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserFilter } from '../components/UserFilter';
import { TimeFilter } from '../components/TimeFilter';
import { ApiDetailGraphCard } from '../components/ApiDetailGraphCard';
import { detailsChartService } from '../services/detailsChartService';
import type { ClientDetailsData } from '../types/detailsChart';
import type { UserOption, ApiTimeFilterValue } from '../types/dashboard';
import { dashboardService } from '../services/dashboardService';
import { usePolling } from '../hooks/usePolling';
import { ENV } from '../config/env';
import { AlertCircle, RefreshCw } from 'lucide-react';

const DETAIL_TIME_OPTIONS = [
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

export const DetailsChart: React.FC = () => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<ApiTimeFilterValue>('last_7_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailsData, setDetailsData] = useState<ClientDetailsData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseDbAvailable, setResponseDbAvailable] = useState<boolean | undefined>(undefined);
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    dashboardService.getUsers().then(setUsers).catch(() => {});
    dashboardService.getDashboardSummary()
      .then((summary) => setResponseDbAvailable(summary.responseDbAvailable))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (timeFilter === 'custom' && (!startDate || !endDate)) {
      setIsInitialLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    if (!silent) {
      if (!hasDataRef.current) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
    }

    try {
      setError(null);
      const data = await detailsChartService.getClientDetails(
        selectedUserId,
        timeFilter,
        startDate,
        endDate
      );
      if (requestId !== requestRef.current) return;
      hasDataRef.current = true;
      setDetailsData(data);
    } catch {
      if (requestId === requestRef.current) {
        setError('Failed to load chart data.');
      }
    } finally {
      if (requestId === requestRef.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedUserId, timeFilter, startDate, endDate]);

  useEffect(() => {
    if (isDetailModalOpen) return;
    loadData(false);
  }, [loadData, isDetailModalOpen]);

  usePolling(
    () => loadData(true),
    ENV.DASHBOARD_POLL_MS,
    !isDetailModalOpen && !(timeFilter === 'custom' && (!startDate || !endDate))
  );

  const handleReset = () => {
    setSelectedUserId('all');
    setTimeFilter('last_7_days');
    setStartDate('');
    setEndDate('');
  };

  const selectedUserLabel =
    users.find((u) => u.id === selectedUserId)?.name || 'All Users';

  const dataMatchesFilter =
    detailsData != null && detailsData.timeFilter === timeFilter;

  const activeDetails = dataMatchesFilter ? detailsData : null;
  const showGridLoading =
    isInitialLoading || isRefreshing || (detailsData != null && !dataMatchesFilter);

  return (
    <div className="page-container py-4 sm:py-5 lg:py-6 space-y-5">
      {error && (
        <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--error)' }} className="text-xs">{error}</span>
            <button onClick={() => loadData(false)} className="px-2.5 py-1 rounded-md text-[11px] font-semibold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}>Retry</button>
          </div>
        </div>
      )}

      <div className="rounded-xl px-4 py-3 shadow-sm border" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3 w-full">
          <UserFilter users={users} selectedUserId={selectedUserId} onChange={setSelectedUserId} isLoading={isInitialLoading} />
          <TimeFilter options={DETAIL_TIME_OPTIONS} selectedValue={timeFilter} onChange={(val) => setTimeFilter(val as ApiTimeFilterValue)} startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} isLoading={isInitialLoading} label="Time Range" />
          <button onClick={handleReset} className="p-2 rounded-lg border transition-colors flex items-center gap-1 text-xs font-medium" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
          <button onClick={() => loadData(false)} disabled={isInitialLoading} className="p-2 rounded-lg transition-colors ml-auto" style={{ color: 'var(--text-muted)' }} title="Refresh">
            <RefreshCw className={`w-3 h-3 ${isInitialLoading || isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeDetails && dataMatchesFilter && (
        <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {activeDetails.clientName}
          </span>
          <span style={{ color: 'var(--text-muted)' }}> — </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {activeDetails.apis.length} APIs · Filter: {timeFilter.replace(/_/g, ' ')} · Auto-refresh 5s
          </span>
        </div>
      )}

      {showGridLoading && !activeDetails ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 animate-pulse border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="h-4 rounded w-1/2 mb-3" style={{ backgroundColor: 'var(--border)' }} />
              <div className="h-20 rounded mb-2" style={{ backgroundColor: 'var(--border)' }} />
              <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--border)' }} />
            </div>
          ))}
        </div>
      ) : activeDetails && activeDetails.apis.length > 0 ? (
        <div className="relative">
          {showGridLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-5">
            {activeDetails.apis.map((api) => (
            <ApiDetailGraphCard
              key={api.apiId}
              detail={api}
              clientId={selectedUserId}
              clientName={activeDetails.clientName}
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              startDate={startDate}
              endDate={endDate}
              onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              onModalOpenChange={setIsDetailModalOpen}
            />
          ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-8 text-center space-y-2 theme-card">
          <AlertCircle className="w-8 h-8 mx-auto" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {responseDbAvailable === false
              ? 'Response Database Not Connected'
              : 'No Data Available'}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {responseDbAvailable === false
              ? 'Detailed charts read from the response database. Configure RESPONSE_MONGO_URL on the server and restart the backend.'
              : `No trend data for ${selectedUserLabel} in this time range.`}
          </p>
        </div>
      )}
    </div>
  );
};
