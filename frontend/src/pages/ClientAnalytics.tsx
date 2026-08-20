import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Server,
  Activity,
  BarChart3,
  Search,
  Download,
  RefreshCw,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowUpDown,
} from 'lucide-react';
import { TimeFilter } from '../components/TimeFilter';
import { clientAnalyticsService } from '../services/clientAnalyticsService';
import { dashboardService } from '../services/dashboardService';
import { usePolling } from '../hooks/usePolling';
import { ENV } from '../config/env';
import type { UserOption } from '../types/dashboard';
import type { ClientActivityRecord, ClientAnalyticsData } from '../types/clientAnalytics';

const TIME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_30_min', label: 'Last 30 Mins' },
  { value: 'last_1_hour', label: 'Last 1 Hour' },
  { value: 'last_2_hours', label: 'Last 2 Hours' },
  { value: 'last_3_hours', label: 'Last 3 Hours' },
  { value: 'last_4_hours', label: 'Last 4 Hours' },
  { value: 'last_5_hours', label: 'Last 5 Hours' },
  { value: 'custom', label: 'Custom Range' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status', icon: Filter },
  { value: 'success', label: 'Success', icon: CheckCircle },
  { value: 'failed', label: 'Failed', icon: XCircle },
  { value: 'notFound', label: 'Not Found', icon: HelpCircle },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type SortField = 'totalHits' | 'successRate' | 'avgResponseTimeMs' | 'clientName' | 'apiName';

export const ClientAnalytics: React.FC = () => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [apis, setApis] = useState<{ id: string; name: string; category: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [selectedApiId, setSelectedApiId] = useState('all');
  const [timeFilter, setTimeFilter] = useState('last_7_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalHits');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<ClientAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    dashboardService.getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    clientAnalyticsService.getAvailableApis(selectedClientId).then(setApis).catch(() => {});
    setSelectedApiId('all');
  }, [selectedClientId]);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const result = await clientAnalyticsService.getClientAnalyticsData(
        selectedClientId,
        selectedApiId,
        timeFilter,
        statusFilter,
        debouncedSearch,
        sortBy,
        sortOrder,
        startDate,
        endDate
      );
      setData(result);
      setPage(1);
    } catch (err) {
      setError('Failed to load client analytics data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClientId, selectedApiId, timeFilter, statusFilter, debouncedSearch, sortBy, sortOrder, startDate, endDate]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  usePolling(
    () => loadData(true),
    ENV.DASHBOARD_POLL_MS,
    !(timeFilter === 'custom' && (!startDate || !endDate))
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleReset = () => {
    setSelectedClientId('all');
    setSelectedApiId('all');
    setTimeFilter('last_7_days');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setSortBy('totalHits');
    setSortOrder('desc');
    setPage(1);
  };

  const exportToCSV = () => {
    if (!data) return;
    setExporting(true);
    try {
      const headers = [
        'Client Name', 'Client Code', 'API Name',
        'Total Hits', 'Success', 'Failed', 'Not Found',
        'Success Rate (%)', 'Avg Response Time (ms)',
      ];
      const rows = data.records.map((r) => [
        r.clientName, r.clientCode, r.apiName,
        r.totalHits, r.success, r.failed, r.notFound,
        r.successRate, r.avgResponseTimeMs,
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `client-analytics-summary-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const exportRowReport = async (record: ClientActivityRecord) => {
    if (!record.clientId) return;
    setExportingRowId(record.id);
    try {
      const result = await clientAnalyticsService.exportDetailReport({
        clientId: record.clientId,
        apiId: record.apiId,
        apiName: record.apiName,
        timeFilter,
        statusFilter,
        startDate,
        endDate,
      });
      const link = document.createElement('a');
      link.href = `data:text/csv;base64,${result.content}`;
      link.download = result.filename;
      link.click();
      if (result.truncated) {
        alert(`Export limited to ${result.rowCount?.toLocaleString()} rows. Narrow the time filter for a complete export.`);
      }
    } catch {
      setError('Failed to export detail report. Please try again.');
    } finally {
      setExportingRowId(null);
    }
  };

  const paginatedRecords = data ? data.records.slice((page - 1) * pageSize, page * pageSize) : [];
  const totalPages = data ? Math.ceil(data.records.length / pageSize) : 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 shrink-0" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 shrink-0" /> : <ChevronDown className="w-3 h-3 ml-1 shrink-0" />;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="page-container py-4 sm:py-5 lg:py-6 space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl flex items-center justify-between"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <span className="text-xs" style={{ color: 'var(--error)' }}>{error}</span>
            <button
              onClick={() => loadData(false)}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary Cards */}
        {data && !isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Active Clients', value: data.summary.totalClients, icon: Users, color: '#6366F1' },
              { label: 'APIs Tracked', value: data.summary.totalApis, icon: Server, color: '#8B5CF6' },
              { label: 'Total Hits', value: data.summary.totalHits.toLocaleString(), icon: Activity, color: '#3B82F6' },
              { label: 'Success Rate', value: `${data.summary.overallSuccessRate}%`, icon: TrendingUp, color: '#10B981' },
              { label: 'Avg Response', value: `${data.summary.avgResponseTimeMs}ms`, icon: Clock, color: '#F59E0B' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3.5 shadow-sm border transition-all hover:shadow-md"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </span>
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                    <item.icon className="w-3 h-3" />
                  </div>
                </div>
                <p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filters Bar - responsive wrapping */}
        <div className="rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Client Filter */}
              <div className="relative min-w-[160px] flex-1 sm:flex-none">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={isLoading}
                  className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--input-border)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="all" style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                    All Clients
                  </option>
                  {users.filter((u) => u.id !== 'all').map((user) => (
                    <option key={user.id} value={user.id} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              {/* API Filter */}
              <div className="relative min-w-[140px] flex-1 sm:flex-none">
                <select
                  value={selectedApiId}
                  onChange={(e) => setSelectedApiId(e.target.value)}
                  disabled={isLoading}
                  className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--input-border)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="all" style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                    All APIs
                  </option>
                  {apis.map((api) => (
                    <option key={api.id} value={api.id} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                      {api.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              {/* Time Filter */}
              <div className="flex-1 sm:flex-none">
                <TimeFilter
                  options={TIME_OPTIONS}
                  selectedValue={timeFilter}
                  onChange={(val) => setTimeFilter(val)}
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                  isLoading={isLoading}
                  label="Time Range"
                />
              </div>

              {/* Status Filter */}
              <div className="relative min-w-[120px] flex-1 sm:flex-none">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  disabled={isLoading}
                  className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--input-border)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search client, API..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 transition-all"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--input-border)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleReset}
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Reset
                </button>
                <button
                  onClick={() => loadData(false)}
                  disabled={isLoading}
                  className="p-2 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                  title="Refresh"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={!data || data.records.length === 0 || exporting}
                  className="px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    borderColor: 'var(--primary)',
                    opacity: !data || data.records.length === 0 || exporting ? 0.6 : 1,
                  }}
                  title="Export CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? 'Exporting...' : 'Export Summary'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-xl shadow-sm border overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          {/* Table Header Info */}
          <div className="px-4 py-3 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                Client Activity Log
              </span>
              {data && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {data.records.length} records
                </span>
              )}
            </div>
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-[10px] rounded-md px-2 py-1.5 focus:outline-none"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--input-border)',
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
              ))}
            </div>
          ) : !data || data.records.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No Records Found</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Try adjusting your filters or search query to see results.
              </p>
            </div>
          ) : (
            <>
              {/* Responsive Table with horizontal scroll */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--card-inner)' }}>
                      <th className="px-3 py-3 text-left font-bold cursor-pointer select-none hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }} onClick={() => handleSort('clientName')}>
                        <div className="flex items-center">
                          Client
                          <SortIcon field="clientName" />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left font-bold cursor-pointer select-none hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }} onClick={() => handleSort('apiName')}>
                        <div className="flex items-center">
                          API
                          <SortIcon field="apiName" />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-right font-bold cursor-pointer select-none hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }} onClick={() => handleSort('totalHits')}>
                        <div className="flex items-center justify-end">
                          Hits
                          <SortIcon field="totalHits" />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        Success
                      </th>
                      <th className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        Failed
                      </th>
                      <th className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        Not Found
                      </th>
                      <th className="px-3 py-3 text-right font-bold cursor-pointer select-none hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }} onClick={() => handleSort('successRate')}>
                        <div className="flex items-center justify-end">
                          Success Rate
                          <SortIcon field="successRate" />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-right font-bold cursor-pointer select-none hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }} onClick={() => handleSort('avgResponseTimeMs')}>
                        <div className="flex items-center justify-end">
                          Avg Resp
                          <SortIcon field="avgResponseTimeMs" />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        Export Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record, idx) => (
                      <tr
                        key={record.id}
                        className="transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'var(--card-inner)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                              {record.clientName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                                {record.clientName}
                              </p>
                              <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {record.clientCode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {record.apiName}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {record.totalHits.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" style={{ color: '#10B981' }}>
                          {record.success.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" style={{ color: '#EF4444' }}>
                          {record.failed.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" style={{ color: '#F59E0B' }}>
                          {record.notFound.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${record.successRate}%`,
                                  backgroundColor: record.successRate >= 95 ? '#10B981'
                                    : record.successRate >= 85 ? '#F59E0B' : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="font-semibold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                              {record.successRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {record.avgResponseTimeMs}ms
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => exportRowReport(record)}
                            disabled={exportingRowId === record.id || !record.clientId}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-50"
                            style={{
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                            }}
                            title="Download transaction report for current filters"
                          >
                            <Download className={`w-3 h-3 ${exportingRowId === record.id ? 'animate-pulse' : ''}`} />
                            {exportingRowId === record.id ? 'Exporting...' : 'Export'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card-inner)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.records.length)} of {data.records.length} entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-md transition-colors disabled:opacity-30"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className="min-w-[28px] h-7 rounded-md text-[11px] font-semibold transition-all"
                        style={{
                          backgroundColor: page === pageNum ? 'var(--primary)' : 'transparent',
                          color: page === pageNum ? '#ffffff' : 'var(--text-secondary)',
                          border: page === pageNum ? 'none' : '1px solid var(--border)',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-md transition-colors disabled:opacity-30"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};