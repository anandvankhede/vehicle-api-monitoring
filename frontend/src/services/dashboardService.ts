import { api } from './apiClient';
import type {
  DashboardSummary,
  UserOption,
  UserApiStats,
  ApiOption,
  ApiMonitoringStats,
  RequestDistributionData,
  RequestTrendDataPoint,
  TimeFilterValue,
  ApiTimeFilterValue,
} from '../types/dashboard';

function normalizeApiMonitoringStats(
  raw: Record<string, unknown>,
  apiId: string,
  timeFilter: ApiTimeFilterValue
): ApiMonitoringStats {
  const trendRaw = (raw.trendData ?? raw.trend_data ?? []) as Array<Record<string, unknown>>;
  const distributionRaw = (raw.distribution ?? []) as Array<Record<string, unknown>>;

  const trendData: RequestTrendDataPoint[] = trendRaw.map((point) => ({
    time: String(point.time ?? ''),
    total: Number(point.total ?? 0),
    success: Number(point.success ?? 0),
    failed: Number(point.failed ?? 0),
    notFound: Number(point.notFound ?? point.not_found ?? 0),
  }));

  const distribution: RequestDistributionData[] = distributionRaw.map((item) => ({
    name: item.name as RequestDistributionData['name'],
    value: Number(item.value ?? 0),
    color: String(item.color ?? '#94A3B8'),
    percentage: Number(item.percentage ?? 0),
  }));

  return {
    apiId: String(raw.apiId ?? raw.api_id ?? apiId),
    apiName: String(raw.apiName ?? raw.api_name ?? 'Unknown'),
    timeFilter: (raw.timeFilter ?? raw.time_filter ?? timeFilter) as ApiTimeFilterValue,
    distribution,
    trendData,
    totalHits: Number(raw.totalHits ?? raw.total_hits ?? 0),
    successRate: Number(raw.successRate ?? raw.success_rate ?? 0),
    avgLatencyMs: Number(raw.avgLatencyMs ?? raw.avg_latency_ms ?? 0),
    uptimePercentage: Number(raw.uptimePercentage ?? raw.uptime_percentage ?? 0),
  };
}

export const dashboardService = {
  /**
   * Fetch top header summary stats (Total Clients, Total APIs)
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const stats = await api.getDashboardStats() as DashboardSummary;
      return {
        totalClients: stats.totalClients ?? 0,
        totalApis: stats.totalApis ?? 0,
        healthyApisCount: stats.healthyApisCount ?? 0,
        degradedApisCount: stats.degradedApisCount ?? 0,
        responseDbAvailable: stats.responseDbAvailable,
      };
    } catch {
      try {
        const [clients, apis] = await Promise.all([
          api.getClients().catch(() => ({ data: [], total: 0 })),
          api.getApiInfo().catch(() => ({ data: [], total: 0 })),
        ]);
        return {
          totalClients: clients.total,
          totalApis: apis.total,
          healthyApisCount: apis.total,
          degradedApisCount: 0,
        };
      } catch {
        return { totalClients: 0, totalApis: 0, healthyApisCount: 0, degradedApisCount: 0 };
      }
    }
  },

  /**
   * Fetch list of users for the global filter (sourced from user_mapping).
   * The backend already prepends the "All Users" option and returns
   * {id, name, code, type} records.
   */
  async getUsers(): Promise<UserOption[]> {
    try {
      const result = await api.getDashboardUsers();
      return result as UserOption[];
    } catch {
      return [{ id: 'all', name: 'All Users', code: 'ALL_CLIENTS', type: 'enterprise' }];
    }
  },

  /**
   * Fetch user API KPI grid statistics based on selected User and Time Filter
   */
  async getUserApiStats(
    userId: string = 'all',
    timeFilter: TimeFilterValue = 'last_7_days',
    _startDate?: string,
    _endDate?: string
  ): Promise<UserApiStats[]> {
    try {
      const result = await api.getUserApiStats(userId, timeFilter, _startDate, _endDate);
      return result as UserApiStats[];
    } catch {
      return [];
    }
  },

  /**
   * Fetch APIs for Main API Monitoring — scoped by user filter.
   * All users: every PAN API. Specific client: that client's assigned APIs.
   */
  async getAvailableApis(clientId: string = 'all'): Promise<ApiOption[]> {
    const toOption = (a: { id: string; name: string; category?: string }): ApiOption => ({
      id: a.id,
      name: a.name,
      category: a.category ?? 'vehicle',
    });

    const normalizeList = (raw: unknown): ApiOption[] => {
      if (Array.isArray(raw)) {
        return raw
          .filter((item): item is { id: string; name: string; category?: string } =>
            Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item))
          .map(toOption);
      }
      return [];
    };

    try {
      const dashboardApis = await api.getDashboardApis(clientId);
      return normalizeList(dashboardApis);
    } catch (err) {
      console.warn('Failed to load scoped dashboard APIs:', err);
      return [];
    }
  },

  /**
   * Fetch detailed global monitoring statistics for a specific API and timeframe
   */
  async getApiMonitoringStats(
    apiId: string = '',
    timeFilter: ApiTimeFilterValue = 'last_7_days',
    startDate?: string,
    endDate?: string,
    clientId: string = 'all',
  ): Promise<ApiMonitoringStats> {
    const result = await api.getDashboardApiUsage(apiId, timeFilter, startDate, endDate, clientId);
    return normalizeApiMonitoringStats(
      result as Record<string, unknown>,
      apiId,
      timeFilter
    );
  },
};