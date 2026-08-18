export interface DashboardSummary {
  totalClients: number;
  totalApis: number;
  healthyApisCount?: number;
  degradedApisCount?: number;
}

export interface UserOption {
  id: string;
  name: string;
  code: string;
  type?: 'enterprise' | 'pro' | 'standard';
}

export type TimeFilterValue = 
  | 'today' 
  | 'yesterday' 
  | 'last_7_days' 
  | 'last_month' 
  | 'custom';

export type ApiTimeFilterValue = 
  | 'last_30_min'
  | 'last_1_hour'
  | 'last_2_hours'
  | 'last_3_hours'
  | 'last_4_hours'
  | 'last_5_hours'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_month'
  | 'custom';

export interface UserApiStats {
  id: string;
  name: string; // E.g., "API 1", "API 2", etc.
  category: 'vehicle' | 'payment' | 'insurance' | 'auth' | 'garage' | 'valuation';
  totalHits: number;
  success: number;
  notFound: number;
  failed: number;
  status: 'healthy' | 'degraded' | 'down';
  trendPercentage: number;
  trendDirection: 'up' | 'down' | 'stable';
  avgResponseTimeMs: number;
}

export interface ApiOption {
  id: string;
  name: string;
  category: string;
}

export interface RequestDistributionData {
  name: 'Success' | 'Failed' | 'Not Found';
  value: number;
  color: string;
  percentage: number;
}

export interface RequestTrendDataPoint {
  time: string;
  total: number;
  success: number;
  failed: number;
  notFound: number;
}

export interface ApiMonitoringStats {
  apiId: string;
  apiName: string;
  timeFilter: ApiTimeFilterValue;
  distribution: RequestDistributionData[];
  trendData: RequestTrendDataPoint[];
  totalHits: number;
  successRate: number;
  avgLatencyMs: number;
  uptimePercentage: number;
}

export interface UserFilterState {
  userId: string;
  timeFilter: TimeFilterValue;
  startDate?: string;
  endDate?: string;
}

export interface ApiMonitoringFilterState {
  apiId: string;
  timeFilter: ApiTimeFilterValue;
  startDate?: string;
  endDate?: string;
}
