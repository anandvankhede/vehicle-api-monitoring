// Usage Reporting Types

export type DateRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
export type RequestStatus = 'success' | 'failed' | 'not_found' | 'all';

export interface UsageReportFilters {
  dateRange: DateRange;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  apiName?: string;
  status?: RequestStatus;
}

export interface DailyUsageReport {
  date: string;
  success_requests: number;
  failed_requests: number;
  not_found_requests: number;
  total_requests: number;
  revenue: number;
  cost: number;
  avg_response_time: number;
}

export interface MonthlyConsumptionReport {
  month: string;
  year: number;
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  not_found_requests: number;
  total_cost: number;
  total_revenue: number;
  avg_daily_usage: number;
  top_apis: ApiUsageStat[];
  top_failure_apis: ApiUsageStat[];
  peak_usage_date: string;
}

export interface ApiUsageStat {
  api_name: string;
  count: number;
  percentage: number;
}

export interface UsageSummary {
  total_hits: number;
  successful_requests: number;
  failed_requests: number;
  not_found_requests: number;
  total_revenue: number;
  total_cost: number;
  avg_response_time: number;
  success_rate: number;
}

export interface ReportTableRow {
  id: string;
  date: string;
  client_name: string;
  api_name: string;
  endpoint: string;
  success: number;
  failed: number;
  not_found: number;
  total_requests: number;
  success_cost: number;
  not_found_cost: number;
  total_cost: number;
  avg_response_time: number;
  invoice_status: 'pending' | 'generated' | 'paid';
  invoice_month?: string;
  invoice_year?: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  company_name: string;
  invoice_date: string;
  billing_period_start: string;
  billing_period_end: string;
  api_wise_usage: ApiUsageItem[];
  subtotal: number;
  gst_percentage: number;
  gst_amount: number;
  grand_total: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue';
  created_at: string;
}

export interface ApiUsageItem {
  api_name: string;
  success_requests: number;
  not_found_requests: number;
  success_cost: number;
  not_found_cost: number;
  total_cost: number;
}

export interface ReportExportOptions {
  format: 'excel' | 'csv' | 'pdf';
  reportType: 'usage' | 'daily' | 'monthly' | 'invoice';
  dateRange: DateRange;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  apiName?: string;
  status?: RequestStatus;
}

// Helper function to generate invoice number
export const generateInvoiceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
};