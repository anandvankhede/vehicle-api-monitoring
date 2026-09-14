import { api } from './apiClient';
import {
  cacheKey,
  DASHBOARD_CACHE_TTL,
  getOrFetch,
  getStaleWhileRevalidate,
  setCached,
} from './dashboardCache';
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

const toApiOption = (a: { id: string; name: string; category?: string }): ApiOption => ({
  id: a.id,
  name: a.name,
  category: a.category ?? 'vehicle',
});

const normalizeApiList = (raw: unknown): ApiOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { id: string; name: string; category?: string } =>
      Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item))
    .map(toApiOption);
};

const ALL_USERS_OPTION: UserOption = {
  id: 'all',
  name: 'All Users',
  code: 'ALL_CLIENTS',
  type: 'enterprise',
};

export const dashboardService = {
  /** Bootstrap: stats + users + APIs in one request (cached in browser). */
  async getBootstrap(): Promise<{
    summary: DashboardSummary;
    users: UserOption[];
    apis: ApiOption[];
  }> {
    return getOrFetch('bootstrap', DASHBOARD_CACHE_TTL.bootstrap, async () => {
      const raw = await api.getDashboardAnalytics() as {
        summary?: DashboardSummary;
        userOptions?: UserOption[];
        apiOptions?: ApiOption[];
      };

      const summary = raw.summary ?? {
        totalClients: 0,
        totalApis: 0,
        healthyApisCount: 0,
        degradedApisCount: 0,
      };

      const users = [ALL_USERS_OPTION, ...(raw.userOptions ?? [])];
      const apis = normalizeApiList(raw.apiOptions ?? []);

      setCached('users', users, DASHBOARD_CACHE_TTL.users);
      setCached(cacheKey({ apis: 1, clientId: 'all' }), apis, DASHBOARD_CACHE_TTL.apis);

      return { summary, users, apis };
    });
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    const bootstrap = await this.getBootstrap();
    return bootstrap.summary;
  },

  async getUsers(): Promise<UserOption[]> {
    return getOrFetch('users', DASHBOARD_CACHE_TTL.users, async () => {
      try {
        const result = await api.getDashboardUsers();
        return result as UserOption[];
      } catch {
        const bootstrap = await this.getBootstrap().catch(() => null);
        if (bootstrap?.users.length) return bootstrap.users;
        return [ALL_USERS_OPTION];
      }
    });
  },

  async getUserApiStats(
    userId: string = 'all',
    timeFilter: TimeFilterValue = 'last_7_days',
    startDate?: string,
    endDate?: string,
    silent = false,
  ): Promise<UserApiStats[]> {
    const key = cacheKey({
      userApiStats: 1,
      userId,
      timeFilter,
      startDate,
      endDate,
    });
    const fetcher = async () => {
      const result = await api.getUserApiStats(userId, timeFilter, startDate, endDate);
      return result as UserApiStats[];
    };
    if (silent) {
      return getStaleWhileRevalidate(key, DASHBOARD_CACHE_TTL.analytics, fetcher);
    }
    try {
      return await getOrFetch(key, DASHBOARD_CACHE_TTL.analytics, fetcher);
    } catch {
      return [];
    }
  },

  async getAvailableApis(clientId: string = 'all'): Promise<ApiOption[]> {
    const key = cacheKey({ apis: 1, clientId });
    return getOrFetch(key, DASHBOARD_CACHE_TTL.apis, async () => {
      try {
        const dashboardApis = await api.getDashboardApis(clientId);
        return normalizeApiList(dashboardApis);
      } catch (err) {
        console.warn('Failed to load scoped dashboard APIs:', err);
        if (clientId === 'all') {
          const bootstrap = await this.getBootstrap().catch(() => null);
          if (bootstrap?.apis.length) return bootstrap.apis;
        }
        return [];
      }
    });
  },

  async getApiMonitoringStats(
    apiId: string = '',
    timeFilter: ApiTimeFilterValue = 'last_7_days',
    startDate?: string,
    endDate?: string,
    clientId: string = 'all',
    silent = false,
    onUpdate?: (stats: ApiMonitoringStats) => void,
  ): Promise<ApiMonitoringStats> {
    const key = cacheKey({
      apiUsage: 1,
      apiId,
      clientId,
      timeFilter,
      startDate,
      endDate,
    });
    const fetcher = async () => {
      const result = await api.getDashboardApiUsage(
        apiId,
        timeFilter,
        startDate,
        endDate,
        clientId,
      );
      return normalizeApiMonitoringStats(
        result as Record<string, unknown>,
        apiId,
        timeFilter,
      );
    };
    if (silent) {
      return getStaleWhileRevalidate(key, DASHBOARD_CACHE_TTL.analytics, fetcher, onUpdate);
    }
    return getOrFetch(key, DASHBOARD_CACHE_TTL.analytics, fetcher);
  },
};
