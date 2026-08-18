import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Download, Calendar, Filter, DollarSign, CheckCircle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useClientAuth } from '../context/ClientAuthContext';
import { api } from '../services/apiClient';
import type { DailyUsageReport, MonthlyConsumptionReport, UsageReportFilters, DateRange } from '../types/reports';
import { SummaryCard } from '../components/SummaryCard';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toBackendDateRange(filters: UsageReportFilters): {
  dateRange: string;
  startDate?: string;
  endDate?: string;
} {
  switch (filters.dateRange) {
    case 'today':
      return { dateRange: 'today' };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().split('T')[0];
      return { dateRange: 'today', startDate: iso, endDate: iso };
    }
    case 'last7days':
      return { dateRange: 'week' };
    case 'last30days':
      return { dateRange: 'month' };
    case 'thisMonth':
      return { dateRange: 'month' };
    case 'lastMonth': {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        dateRange: 'month',
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'custom':
      return {
        dateRange: 'month',
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    default:
      return { dateRange: 'month' };
  }
}

function mapBillingReport(data: {
  month: string;
  year: number;
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  not_found_requests: number;
  total_cost: number;
  total_revenue: number;
  avg_daily_usage: number;
  top_apis: { api_name: string; count: number; percentage: number }[];
  top_failure_apis: { api_name: string; count: number; percentage: number }[];
  peak_usage_date: string;
}): MonthlyConsumptionReport {
  const [yearStr, monthNum] = (data.month || '').split('-');
  const monthIndex = parseInt(monthNum, 10) - 1;
  return {
    month: MONTH_NAMES[monthIndex] || data.month,
    year: data.year || parseInt(yearStr, 10) || new Date().getFullYear(),
    total_requests: data.total_requests,
    success_requests: data.success_requests,
    failed_requests: data.failed_requests,
    not_found_requests: data.not_found_requests,
    total_cost: data.total_cost,
    total_revenue: data.total_revenue,
    avg_daily_usage: data.avg_daily_usage,
    top_apis: data.top_apis,
    top_failure_apis: data.top_failure_apis,
    peak_usage_date: data.peak_usage_date,
  };
}

const emptyMonthly: MonthlyConsumptionReport = {
  month: MONTH_NAMES[new Date().getMonth()],
  year: new Date().getFullYear(),
  total_requests: 0,
  success_requests: 0,
  failed_requests: 0,
  not_found_requests: 0,
  total_cost: 0,
  total_revenue: 0,
  avg_daily_usage: 0,
  top_apis: [],
  top_failure_apis: [],
  peak_usage_date: '—',
};

export const ClientUsageReports: React.FC = () => {
  const { client } = useClientAuth();

  const [filters, setFilters] = useState<UsageReportFilters>({
    dateRange: 'last30days',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [dailyReport, setDailyReport] = useState<DailyUsageReport[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyConsumptionReport>(emptyMonthly);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError('');
    try {
      const { dateRange, startDate, endDate } = toBackendDateRange(filters);
      const [usageResult, billingResult] = await Promise.all([
        api.getClientUsageReport(client.id, dateRange, startDate, endDate, 'client'),
        api.getBillingReport(client.id, undefined, 'client'),
      ]);
      setDailyReport((usageResult as { data: DailyUsageReport[] }).data || []);
      setMonthlyReport(mapBillingReport(billingResult as Parameters<typeof mapBillingReport>[0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
      setDailyReport([]);
      setMonthlyReport(emptyMonthly);
    } finally {
      setIsLoading(false);
    }
  }, [client, filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleDateRangeChange = (range: DateRange) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: range,
      ...(range !== 'custom' ? { startDate: '', endDate: '' } : {}),
    }));
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!client) return;
    try {
      const { startDate, endDate } = toBackendDateRange(filters);
      const result = await api.exportReport(
        {
          format,
          report_type: activeTab === 'daily' ? 'daily' : 'monthly',
          client_id: client.id,
          start_date: startDate,
          end_date: endDate,
        },
        'client',
      ) as { content?: string; filename?: string };

      if (result.content && result.filename) {
        const link = document.createElement('a');
        link.href = `data:text/csv;base64,${result.content}`;
        link.download = result.filename;
        link.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="page-container py-6 space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
          {error}
        </div>
      )}

      <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value as DateRange)}
              className="theme-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="theme-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="theme-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 items-end">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('daily')}
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2"
          style={{
            color: activeTab === 'daily' ? 'var(--primary)' : 'var(--text-secondary)',
            borderColor: activeTab === 'daily' ? 'var(--primary)' : 'transparent',
          }}
        >
          <Calendar className="w-4 h-4" />
          Daily Report
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2"
          style={{
            color: activeTab === 'monthly' ? 'var(--primary)' : 'var(--text-secondary)',
            borderColor: activeTab === 'monthly' ? 'var(--primary)' : 'transparent',
          }}
        >
          <Activity className="w-4 h-4" />
          Monthly Report
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : activeTab === 'daily' ? (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Usage Report</h3>
          {dailyReport.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No usage data for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Date</th>
                    <th className="text-right py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Success</th>
                    <th className="text-right py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Failed</th>
                    <th className="text-right py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Not Found</th>
                    <th className="text-right py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Total</th>
                    <th className="text-right py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.map((day) => (
                    <tr key={day.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{day.date}</td>
                      <td className="text-right py-3 px-4" style={{ color: '#22c55e' }}>{day.success_requests}</td>
                      <td className="text-right py-3 px-4" style={{ color: '#ef4444' }}>{day.failed_requests}</td>
                      <td className="text-right py-3 px-4" style={{ color: '#f59e0b' }}>{day.not_found_requests}</td>
                      <td className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{day.total_requests}</td>
                      <td className="text-right py-3 px-4" style={{ color: 'var(--text-primary)' }}>₹{(day.cost ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Total Requests" value={monthlyReport.total_requests.toLocaleString()} icon={Activity} iconColor="primary" />
            <SummaryCard title="Success Requests" value={monthlyReport.success_requests.toLocaleString()} icon={CheckCircle} iconColor="success" />
            <SummaryCard title="Total Revenue" value={`₹${monthlyReport.total_revenue.toFixed(2)}`} icon={DollarSign} iconColor="success" />
            <SummaryCard title="Total Cost" value={`₹${monthlyReport.total_cost.toFixed(2)}`} icon={DollarSign} iconColor="error" />
          </div>

          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Consumption</h3>
            {monthlyReport.total_requests === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No usage data for this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={[monthlyReport]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="success_requests" fill="#22c55e" name="Success" />
                  <Bar dataKey="failed_requests" fill="#ef4444" name="Failed" />
                  <Bar dataKey="not_found_requests" fill="#f59e0b" name="Not Found" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {monthlyReport.top_apis.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top APIs</h3>
                <div className="space-y-3">
                  {monthlyReport.top_apis.map((apiItem) => (
                    <div key={apiItem.api_name} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{apiItem.api_name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{apiItem.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Peak Usage Date</h3>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{monthlyReport.peak_usage_date}</p>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Average daily usage: {monthlyReport.avg_daily_usage.toLocaleString()} requests
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
