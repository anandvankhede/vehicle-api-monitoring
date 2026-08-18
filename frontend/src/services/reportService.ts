/**
 * Report Service
 * Generates usage reports from localStorage data
 */

import clientService from './clientService';
import type {
  DailyUsageReport,
  MonthlyConsumptionReport,
  UsageSummary,
  ReportTableRow,
  Invoice,
  ApiUsageItem,
  UsageReportFilters,
} from '../types/reports';
import { generateInvoiceNumber } from '../types/reports';

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

const getDateRange = (range: string): { start: Date; end: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    case 'last7days':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { start: last7, end: now };
    case 'last30days':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { start: last30, end: now };
    case 'thisMonth':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: now };
    case 'lastMonth':
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: lastMonthStart, end: lastMonthEnd };
    default:
      return { start: today, end: now };
  }
};

// ============================================================================
// REPORT SERVICE
// ============================================================================

export const reportService = {
  /**
   * Get usage summary for a date range
   */
  getUsageSummary(_filters: UsageReportFilters, clientId?: string): UsageSummary {
    const accessRecords = clientService.getAllClientApiAccess();
    const filtered = clientId
      ? accessRecords.filter(a => a.client_id === clientId)
      : accessRecords;

    const totalHits = filtered.reduce((sum, a) => sum + a.current_usage, 0);
    const successRequests = Math.floor(totalHits * 0.8); // Simulated
    const failedRequests = Math.floor(totalHits * 0.1);
    const notFoundRequests = totalHits - successRequests - failedRequests;

    const totalRevenue = filtered.reduce((sum, a) => sum + (a.current_usage * a.success_price_per_hit), 0);
    const totalCost = totalRevenue * 0.7; // Simulated cost (70% of revenue)

    return {
      total_hits: totalHits,
      successful_requests: successRequests,
      failed_requests: failedRequests,
      not_found_requests: notFoundRequests,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      avg_response_time: 150, // Simulated average response time in ms
      success_rate: totalHits > 0 ? (successRequests / totalHits) * 100 : 0,
    };
  },

  /**
   * Get daily usage report
   */
  getDailyReport(filters: UsageReportFilters, clientId?: string): DailyUsageReport[] {
    const reports: DailyUsageReport[] = [];
    const { start, end } = getDateRange(filters.dateRange);

    const accessRecords = clientService.getAllClientApiAccess();
    const filtered = clientId
      ? accessRecords.filter(a => a.client_id === clientId)
      : accessRecords;

    const totalUsage = filtered.reduce((sum, a) => sum + a.current_usage, 0);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const dailyUsage = Math.floor(totalUsage / days);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayUsage = Math.floor(dailyUsage * (0.8 + Math.random() * 0.4));
      const success = Math.floor(dayUsage * 0.8);
      const failed = Math.floor(dayUsage * 0.1);
      const notFound = dayUsage - success - failed;

      reports.push({
        date: dateStr,
        success_requests: success,
        failed_requests: failed,
        not_found_requests: notFound,
        total_requests: dayUsage,
        revenue: dayUsage * 0.5,
        cost: dayUsage * 0.35,
        avg_response_time: 120 + Math.random() * 80,
      });
    }

    return reports;
  },

  /**
   * Get monthly consumption report
   */
  getMonthlyReport(_filters: UsageReportFilters, clientId?: string): MonthlyConsumptionReport {
    const accessRecords = clientService.getAllClientApiAccess();
    const filtered = clientId
      ? accessRecords.filter(a => a.client_id === clientId)
      : accessRecords;

    const totalUsage = filtered.reduce((sum, a) => sum + a.current_usage, 0);
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();

    const successRequests = Math.floor(totalUsage * 0.8);
    const failedRequests = Math.floor(totalUsage * 0.1);
    const notFoundRequests = totalUsage - successRequests - failedRequests;

    const totalRevenue = filtered.reduce((sum, a) => sum + (a.current_usage * a.success_price_per_hit), 0);
    const totalCost = totalRevenue * 0.7;

    const apiStats = filtered.map(a => ({
      api_name: a.api_name,
      count: a.current_usage,
      percentage: totalUsage > 0 ? (a.current_usage / totalUsage) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    return {
      month,
      year,
      total_requests: totalUsage,
      success_requests: successRequests,
      failed_requests: failedRequests,
      not_found_requests: notFoundRequests,
      total_cost: totalCost,
      total_revenue: totalRevenue,
      avg_daily_usage: Math.floor(totalUsage / 30),
      top_apis: apiStats.slice(0, 5),
      top_failure_apis: apiStats.filter(a => a.count > 0).slice(0, 5),
      peak_usage_date: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  },

  /**
   * Get detailed report table data
   */
  getReportTable(_filters: UsageReportFilters, clientId?: string): ReportTableRow[] {
    const rows: ReportTableRow[] = [];
    const accessRecords = clientService.getAllClientApiAccess();
    const clients = clientService.getAll();
    const filtered = clientId
      ? accessRecords.filter(a => a.client_id === clientId)
      : accessRecords;

    filtered.forEach(access => {
      const client = clients.find(c => c.id === access.client_id);
      const success = Math.floor(access.current_usage * 0.8);
      const failed = Math.floor(access.current_usage * 0.1);
      const notFound = access.current_usage - success - failed;

      rows.push({
        id: access.id,
        date: access.assigned_at,
        client_name: client?.company_name || 'Unknown',
        api_name: access.api_name,
        endpoint: `/api/${access.api_name.toLowerCase().replace(/\s/g, '-')}`,
        success,
        failed,
        not_found: notFound,
        total_requests: access.current_usage,
        success_cost: success * access.success_price_per_hit,
        not_found_cost: notFound * access.not_found_price_per_hit,
        total_cost: (success * access.success_price_per_hit) + (notFound * access.not_found_price_per_hit),
        avg_response_time: 120 + Math.random() * 80,
        invoice_status: access.expiry_date ? 'generated' : 'pending',
        invoice_month: new Date().toLocaleString('default', { month: 'long' }),
        invoice_year: new Date().getFullYear(),
      });
    });

    return rows;
  },

  /**
   * Generate invoice for a client
   */
  generateInvoice(clientId: string, billingPeriodStart: string, billingPeriodEnd: string): Invoice {
    const clients = clientService.getAll();
    const client = clients.find(c => c.id === clientId);
    const accessRecords = clientService.getClientApiAccess(clientId);

    const apiWiseUsage: ApiUsageItem[] = accessRecords.map(access => {
      const success = Math.floor(access.current_usage * 0.8);
      const notFound = access.current_usage - success;
      const successCost = success * access.success_price_per_hit;
      const notFoundCost = notFound * access.not_found_price_per_hit;

      return {
        api_name: access.api_name,
        success_requests: success,
        not_found_requests: notFound,
        success_cost: successCost,
        not_found_cost: notFoundCost,
        total_cost: successCost + notFoundCost,
      };
    });

    const subtotal = apiWiseUsage.reduce((sum, item) => sum + item.total_cost, 0);
    const gstPercentage = 18; // 18% GST
    const gstAmount = (subtotal * gstPercentage) / 100;
    const grandTotal = subtotal + gstAmount;

    return {
      id: generateInvoiceNumber(),
      invoice_number: generateInvoiceNumber(),
      client_id: clientId,
      client_name: client?.company_name || 'Unknown',
      company_name: client?.company_name || 'Unknown',
      invoice_date: new Date().toISOString().split('T')[0],
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      api_wise_usage: apiWiseUsage,
      subtotal,
      gst_percentage: gstPercentage,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      currency: 'INR',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Get all invoices for a client
   */
  getClientInvoices(clientId: string): Invoice[] {
    // In a real app, this would fetch from backend
    // For now, generate current month invoice
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    return [this.generateInvoice(clientId, monthStart, monthEnd)];
  },
};

// Export for convenience
export { getDateRange };