import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FilterBar } from '../components/FilterBar';
import { ApiKpiCard } from '../components/ApiKpiCard';
import { ApiMonitoringSection } from '../components/ApiMonitoringSection';
import { dashboardService } from '../services/dashboardService';
import { usePolling } from '../hooks/usePolling';
import { ENV } from '../config/env';
import type {
  DashboardSummary,
  UserOption,
  UserApiStats,
  ApiOption,
  ApiMonitoringStats,
  TimeFilterValue,
  ApiTimeFilterValue,
} from '../types/dashboard';
import { Grid, AlertCircle, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  // Summary Stats State (Section 1)
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [, setIsSummaryLoading] = useState<boolean>(true);

  // User Filter & Grid State (Section 2 & 3)
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [userTimeFilter, setUserTimeFilter] = useState<TimeFilterValue>('last_7_days');
  const [userStartDate, setUserStartDate] = useState<string>('');
  const [userEndDate, setUserEndDate] = useState<string>('');
  const [userApiStats, setUserApiStats] = useState<UserApiStats[]>([]);
  const [isUserStatsLoading, setIsUserStatsLoading] = useState<boolean>(true);

  // Main API Monitoring State (Section 4 & 5)
  const [availableApis, setAvailableApis] = useState<ApiOption[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [apisLoadError, setApisLoadError] = useState<string | null>(null);
  const [apiTimeFilter, setApiTimeFilter] = useState<ApiTimeFilterValue>('last_7_days');
  const [apiStartDate, setApiStartDate] = useState<string>('');
  const [apiEndDate, setApiEndDate] = useState<string>('');
  const [monitoringStats, setMonitoringStats] = useState<ApiMonitoringStats | null>(null);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState<boolean>(true);
  const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
  const monitoringRequestRef = useRef(0);
  const skipApisReloadRef = useRef(true);
  const hasMonitoringDataRef = useRef(false);
  const [isMonitoringRefreshing, setIsMonitoringRefreshing] = useState(false);

  // Global Error State
  const [error, setError] = useState<string | null>(null);

  const resetMonitoringForFilterChange = useCallback(() => {
    monitoringRequestRef.current += 1;
  }, []);

  const handleApiChange = useCallback((apiId: string) => {
    resetMonitoringForFilterChange();
    setSelectedApiId(apiId);
  }, [resetMonitoringForFilterChange]);

  const handleApiTimeFilterChange = useCallback((timeFilter: ApiTimeFilterValue) => {
    resetMonitoringForFilterChange();
    setApiTimeFilter(timeFilter);
    if (timeFilter !== 'custom') {
      setApiStartDate('');
      setApiEndDate('');
    }
  }, [resetMonitoringForFilterChange]);

  const handleApiDateChange = useCallback((start: string, end: string) => {
    resetMonitoringForFilterChange();
    setApiStartDate(start);
    setApiEndDate(end);
  }, [resetMonitoringForFilterChange]);

  const loadAvailableApis = useCallback(async (clientId: string = selectedUserId) => {
    try {
      setApisLoadError(null);
      const apisRes = await dashboardService.getAvailableApis(clientId);
      setAvailableApis(apisRes);
      if (apisRes.length > 0) {
        setSelectedApiId(apisRes[0].id);
      } else {
        setSelectedApiId('');
        setApisLoadError(
          clientId === 'all'
            ? 'No response_db APIs found. Ensure result_* collections exist on the response database.'
            : 'No APIs are assigned to this client. Configure API access in Client Management.'
        );
      }
      return apisRes;
    } catch (err) {
      console.error('Failed to load available APIs:', err);
      setApisLoadError('Could not load API list. Check backend connection and login session.');
      return [];
    }
  }, [selectedUserId]);

  // 1. Initial load: single bootstrap request (stats + users + APIs) — cached
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setIsSummaryLoading(true);
        const bootstrap = await dashboardService.getBootstrap();
        if (!isMounted) return;
        setSummary(bootstrap.summary);
        setUsers(bootstrap.users);
        if (bootstrap.apis.length > 0) {
          setAvailableApis(bootstrap.apis);
          setSelectedApiId(bootstrap.apis[0].id);
          setApisLoadError(null);
        } else {
          setApisLoadError(
            'No response_db APIs found. Ensure result_* collections exist on the response database.'
          );
        }
      } catch {
        if (isMounted) setError('Failed to load initial system metadata.');
      } finally {
        if (isMounted) setIsSummaryLoading(false);
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Reload monitoring API dropdown when the user filter changes (bootstrap already loaded APIs for "all")
  useEffect(() => {
    if (skipApisReloadRef.current) {
      skipApisReloadRef.current = false;
      return;
    }
    loadAvailableApis(selectedUserId);
  }, [selectedUserId, loadAvailableApis]);

  // 2. Fetch User API Stats whenever User Filter or Time Filter changes (Section 3)
  const loadUserApiStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsUserStatsLoading(true);
      const stats = await dashboardService.getUserApiStats(
        selectedUserId,
        userTimeFilter,
        userStartDate,
        userEndDate,
        silent,
      );
      setUserApiStats(stats);
    } catch (err) {
      console.error('Failed to fetch user API statistics:', err);
    } finally {
      if (!silent) setIsUserStatsLoading(false);
    }
  }, [selectedUserId, userTimeFilter, userStartDate, userEndDate]);

  // 3. Fetch API Monitoring stats when API selection or time filter changes
  const loadMonitoringStats = useCallback(async (silent = false) => {
    if (!selectedApiId) {
      setMonitoringStats(null);
      setIsMonitoringLoading(false);
      return;
    }
    if (apiTimeFilter === 'custom' && (!apiStartDate || !apiEndDate)) {
      setIsMonitoringLoading(false);
      return;
    }

    const requestId = ++monitoringRequestRef.current;
    if (!silent) {
      if (!hasMonitoringDataRef.current) {
        setIsMonitoringLoading(true);
      } else {
        setIsMonitoringRefreshing(true);
      }
    }

    try {
      const stats = await dashboardService.getApiMonitoringStats(
        selectedApiId,
        apiTimeFilter,
        apiStartDate,
        apiEndDate,
        selectedUserId,
        silent,
        silent ? (fresh) => {
          if (requestId === monitoringRequestRef.current) {
            hasMonitoringDataRef.current = true;
            setMonitoringStats(fresh);
          }
        } : undefined,
      );
      if (requestId !== monitoringRequestRef.current) {
        return;
      }
      hasMonitoringDataRef.current = true;
      setMonitoringStats(stats);
    } catch (err) {
      console.error('Failed to fetch API monitoring statistics:', err);
      if (!silent && requestId === monitoringRequestRef.current) {
        setMonitoringStats(null);
      }
    } finally {
      if (requestId === monitoringRequestRef.current) {
        if (!silent) {
          setIsMonitoringLoading(false);
          setIsMonitoringRefreshing(false);
        }
      }
    }
  }, [selectedApiId, apiTimeFilter, apiStartDate, apiEndDate, selectedUserId]);

  useEffect(() => {
    loadUserApiStats(false);
  }, [loadUserApiStats]);

  useEffect(() => {
    if (isTrendModalOpen) return;
    loadMonitoringStats(false);
  }, [loadMonitoringStats, isTrendModalOpen]);

  const dashboardPollingEnabled =
    !isTrendModalOpen &&
    Boolean(selectedApiId) &&
    !(apiTimeFilter === 'custom' && (!apiStartDate || !apiEndDate));

  usePolling(() => loadUserApiStats(true), ENV.DASHBOARD_POLL_MS, !isTrendModalOpen);
  usePolling(() => loadMonitoringStats(true), ENV.DASHBOARD_POLL_MS, dashboardPollingEnabled);

  // Reset Filters Handler
  const handleResetUserFilters = () => {
    setSelectedUserId('all');
    setUserTimeFilter('last_7_days');
    setUserStartDate('');
    setUserEndDate('');
  };

  const selectedUserLabel =
    users.find((u) => u.id === selectedUserId)?.name || 'All Users';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="page-container py-4 sm:py-5 lg:py-6 space-y-5 sm:space-y-6">
        {/* Error Alert if any */}
        {error && (
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--error)' }} />
                <span style={{ color: 'var(--error)' }} className="text-xs">{error}</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: SINGLE HORIZONTAL FILTER BAR */}
        <FilterBar
          users={users}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
          selectedTimeFilter={userTimeFilter}
          onTimeFilterChange={setUserTimeFilter}
          startDate={userStartDate}
          endDate={userEndDate}
          onDateChange={(start, end) => {
            setUserStartDate(start);
            setUserEndDate(end);
          }}
          onResetFilters={handleResetUserFilters}
          isLoading={isUserStatsLoading}
        />

        {/* SECTION 3: USER API KPI GRID */}
        <section>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <Grid className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  User API Performance
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Showing API statistics for: <span className="font-semibold" style={{ color: 'var(--primary)' }}>{selectedUserLabel}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => loadUserApiStats(false)}
              disabled={isUserStatsLoading}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Refresh User API Grid"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUserStatsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Responsive Grid */}
          {isUserStatsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <ApiKpiCard
                  key={idx}
                  stats={{} as UserApiStats}
                  isLoading={true}
                />
              ))}
            </div>
          ) : userApiStats.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl p-6 text-center space-y-2 theme-card">
              <AlertCircle className="w-7 h-7 mx-auto" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                {summary?.responseDbAvailable === false
                  ? 'Response Database Not Connected'
                  : 'No API Telemetry Found'}
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {summary?.responseDbAvailable === false
                  ? 'API performance stats come from the response database. Configure RESPONSE_MONGO_URL on the server to enable this section.'
                  : `No API request statistics recorded for ${selectedUserLabel} in the selected time range.`}
              </p>
            </div>
          ) : (
            /* Cards Grid - responsive with 2xl:grid-cols-5 for large screens */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {userApiStats.map((stats) => (
                <ApiKpiCard key={stats.id} stats={stats} />
              ))}
            </div>
          )}
        </section>

                {/* SECTION 4 & SECTION 5: MAIN API MONITORING & CHART AREA */}
        <ApiMonitoringSection
          apis={availableApis}
          selectedApiId={selectedApiId}
          onApiChange={handleApiChange}
          selectedTimeFilter={apiTimeFilter}
          onTimeFilterChange={handleApiTimeFilterChange}
          startDate={apiStartDate}
          endDate={apiEndDate}
          onDateChange={handleApiDateChange}
          monitoringStats={monitoringStats}
          isLoading={isMonitoringLoading}
          isRefreshing={isMonitoringRefreshing || (isMonitoringLoading && monitoringStats?.timeFilter === apiTimeFilter && monitoringStats?.apiId === selectedApiId)}
          onTrendModalOpenChange={setIsTrendModalOpen}
          onRefresh={() => loadMonitoringStats(false)}
          responseDbAvailable={summary?.responseDbAvailable}
          apisLoadError={apisLoadError}
          onReloadApis={() => loadAvailableApis(selectedUserId)}
          clientId={selectedUserId}
        />
      </div>
    </div>
  );
};