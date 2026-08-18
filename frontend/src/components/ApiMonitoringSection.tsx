import React from 'react';
import { Activity, Server, Clock, CheckCircle2, RefreshCw, TrendingUp } from 'lucide-react';
import { TimeFilter } from './TimeFilter';
import type { TimeOption } from './TimeFilter';
import { PieChartCard } from './PieChartCard';
import { LineChartCard } from './LineChartCard';
import { SummaryCard } from './SummaryCard';
import type {
  ApiOption,
  ApiMonitoringStats,
  ApiTimeFilterValue,
} from '../types/dashboard';

interface ApiMonitoringSectionProps {
  apis: ApiOption[];
  selectedApiId: string;
  onApiChange: (apiId: string) => void;
  selectedTimeFilter: ApiTimeFilterValue;
  onTimeFilterChange: (timeFilter: ApiTimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  monitoringStats: ApiMonitoringStats | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onTrendModalOpenChange?: (open: boolean) => void;
}

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

export const ApiMonitoringSection: React.FC<ApiMonitoringSectionProps> = ({
  apis,
  selectedApiId,
  onApiChange,
  selectedTimeFilter,
  onTimeFilterChange,
  startDate,
  endDate,
  onDateChange,
  monitoringStats,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onTrendModalOpenChange,
}) => {
  const statsMatchSelection =
    monitoringStats != null &&
    monitoringStats.apiId === selectedApiId &&
    monitoringStats.timeFilter === selectedTimeFilter;

  const activeStats = statsMatchSelection ? monitoringStats : null;
  const showChartsLoading = isLoading && !activeStats;
  const chartTrendData = activeStats?.trendData ?? [];

  const chartKey = `${selectedApiId}-${selectedTimeFilter}-${startDate ?? ''}-${endDate ?? ''}-${activeStats?.trendData.length ?? 0}`;

  return (
    <section className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      {/* SECTION 4: MAIN API MONITORING HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Left Side: Title & Subtitle */}
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              Main API Monitoring
            </h2>
          </div>
          <p className="text-xs pl-7" style={{ color: 'var(--text-secondary)' }}>
            Monitor overall API health and request traffic.
          </p>
        </div>

        {/* Right Side Controls: API Dropdown & Time Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* API Select Dropdown */}
          <div className="relative min-w-[150px]">
            <select
              value={selectedApiId}
              onChange={(e) => onApiChange(e.target.value)}
              disabled={isLoading}
              className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
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
              {apis.map((api) => (
                <option key={api.id} value={api.id} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                  {api.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              <Server className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            </div>
          </div>

                    {/* Time Filter */}
          <TimeFilter
            options={MAIN_API_TIME_OPTIONS}
            selectedValue={selectedTimeFilter}
            onChange={(val) => onTimeFilterChange(val as ApiTimeFilterValue)}
            startDate={startDate}
            endDate={endDate}
            onDateChange={onDateChange}
            isLoading={isLoading}
          />

          {/* Refresh Actions */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Refresh monitoring data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 5: CHART AREA (Fully Responsive Layout) */}
      {selectedApiId ? (
        <div className="space-y-4">
          {/* KPI Summary Row (driven by the real /dashboard/api-usage response) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              title="Total Requests"
              value={(activeStats?.totalHits ?? 0).toLocaleString()}
              subtitle="Across selected range"
              icon={Activity}
              iconColor="primary"
              isLoading={showChartsLoading}
            />
            <SummaryCard
              title="Success Rate"
              value={`${(activeStats?.successRate ?? 0).toFixed(1)}%`}
              icon={CheckCircle2}
              iconColor="success"
              iconBg="success-bg"
              isLoading={showChartsLoading}
            />
            <SummaryCard
              title="Avg Latency"
              value={`${(activeStats?.avgLatencyMs ?? 0).toFixed(0)} ms`}
              icon={Clock}
              iconColor="primary"
              isLoading={showChartsLoading}
            />
            <SummaryCard
              title="Uptime"
              value={`${(activeStats?.uptimePercentage ?? 0).toFixed(1)}%`}
              icon={TrendingUp}
              iconColor={(activeStats?.uptimePercentage ?? 0) >= 99 ? 'success' : 'warning'}
              iconBg={(activeStats?.uptimePercentage ?? 0) >= 99 ? 'success-bg' : 'muted'}
              isLoading={showChartsLoading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            {/* Left Column: Pie Chart (4 Cols on LG) */}
            <div className="lg:col-span-4">
              <PieChartCard
                key={`pie-${chartKey}`}
                data={activeStats ? activeStats.distribution : []}
                totalHits={activeStats ? activeStats.totalHits : 0}
                isLoading={showChartsLoading}
              />
            </div>

            {/* Right Column: Line Chart (8 Cols on LG) */}
            <div className="lg:col-span-8">
              <LineChartCard
                key={`line-${chartKey}`}
                chartKey={chartKey}
                data={chartTrendData}
                totalHits={activeStats?.totalHits}
                successRate={activeStats?.successRate}
                isLoading={showChartsLoading}
                isRefreshing={isRefreshing}
                apis={apis}
                selectedApiId={selectedApiId}
                onApiChange={onApiChange}
                selectedTimeFilter={selectedTimeFilter}
                onTimeFilterChange={onTimeFilterChange}
                startDate={startDate}
                endDate={endDate}
                onDateChange={onDateChange}
                onModalOpenChange={onTrendModalOpenChange}
              />
            </div>
          </div>
        </div>
      ) : (
        /* No API selected yet — instruct the user */
        <div className="rounded-xl p-6 text-center space-y-2 theme-card">
          <Server className="w-7 h-7 mx-auto" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No API Selected</h3>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Choose an API from the dropdown above to view its request telemetry and health.
          </p>
        </div>
      )}
    </section>
  );
};