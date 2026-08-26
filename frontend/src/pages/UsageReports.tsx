import React, { useState, useMemo } from 'react';
import { Activity, Calendar, Filter, DollarSign, CheckCircle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { ExportFormatButtons } from '../components/ExportFormatButtons';
import { exportTableData, type ExportFormat } from '../utils/exportHelpers';
import type { UsageReportFilters, DateRange, RequestStatus } from '../types/reports';
import { SummaryCard } from '../components/SummaryCard';

export const UsageReports: React.FC = () => {
  const { user } = useAuth();

  const [filters, setFilters] = useState<UsageReportFilters>({
    dateRange: 'last30days',
    status: 'all',
    startDate: '',
    endDate: '',
  });

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  // Generate reports
  const dailyReport = useMemo(() => reportService.getDailyReport(filters, user?.id), [filters, user]);
  const monthlyReport = useMemo(() => reportService.getMonthlyReport(filters, user?.id), [filters, user]);

  const handleDateRangeChange = (range: DateRange) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
    if (range !== 'custom') {
      setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
    }
  };

  const handleStatusChange = (status: RequestStatus) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handleExport = (format: ExportFormat) => {
    const filename = `usage-report-${activeTab}-${new Date().toISOString().split('T')[0]}`;
    if (activeTab === 'daily') {
      exportTableData(
        format,
        ['Date', 'Success', 'Failed', 'Not Found', 'Total', 'Cost'],
        dailyReport.map((day) => [
          day.date,
          day.success_requests,
          day.failed_requests,
          day.not_found_requests,
          day.total_requests,
          (day.cost ?? 0).toFixed(2),
        ]),
        filename,
      );
      return;
    }

    exportTableData(
      format,
      ['Month', 'Year', 'Total Requests', 'Success', 'Failed', 'Not Found', 'Revenue', 'Cost', 'Avg Daily Usage', 'Peak Usage Date'],
      [[
        monthlyReport.month,
        monthlyReport.year,
        monthlyReport.total_requests,
        monthlyReport.success_requests,
        monthlyReport.failed_requests,
        monthlyReport.not_found_requests,
        monthlyReport.total_revenue.toFixed(2),
        monthlyReport.total_cost.toFixed(2),
        monthlyReport.avg_daily_usage,
        monthlyReport.peak_usage_date,
      ]],
      filename,
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Filters */}
      <div
        className="rounded-xl p-4 sm:p-6"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value as DateRange)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
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

          {/* Custom Date Range */}
          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </>
          )}

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Status
            </label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="not_found">Data Not Found</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 items-end">
            <ExportFormatButtons onExport={handleExport} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('daily')}
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap"
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
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'monthly' ? 'var(--primary)' : 'var(--text-secondary)',
            borderColor: activeTab === 'monthly' ? 'var(--primary)' : 'transparent',
          }}
        >
          <Activity className="w-4 h-4" />
          Monthly Report
        </button>
      </div>

      {/* Daily Report Tab */}
      {activeTab === 'daily' && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Daily Usage Report
          </h3>
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
                    <td className="text-right py-3 px-4" style={{ color: 'var(--text-primary)' }}>₹{day.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Report Tab */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Requests"
              value={monthlyReport.total_requests.toLocaleString()}
              icon={Activity}
              iconColor="primary"
            />
            <SummaryCard
              title="Success Requests"
              value={monthlyReport.success_requests.toLocaleString()}
              icon={CheckCircle}
              iconColor="success"
            />
            <SummaryCard
              title="Total Revenue"
              value={`₹${monthlyReport.total_revenue.toFixed(2)}`}
              icon={DollarSign}
              iconColor="success"
            />
            <SummaryCard
              title="Total Cost"
              value={`₹${monthlyReport.total_cost.toFixed(2)}`}
              icon={DollarSign}
              iconColor="error"
            />
          </div>

          {/* Monthly Consumption Chart */}
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Monthly Consumption
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={[monthlyReport]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="success_requests" fill="#22c55e" name="Success" />
                <Bar dataKey="failed_requests" fill="#ef4444" name="Failed" />
                <Bar dataKey="not_found_requests" fill="#f59e0b" name="Not Found" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top APIs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Top APIs
              </h3>
              <div className="space-y-3">
                {monthlyReport.top_apis.map((api, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{api.api_name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${api.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs w-12 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {api.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Peak Usage Date
              </h3>
              <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {monthlyReport.peak_usage_date}
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Average daily usage: {monthlyReport.avg_daily_usage.toLocaleString()} requests
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};