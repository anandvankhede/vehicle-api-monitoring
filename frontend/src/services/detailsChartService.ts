import { api } from './apiClient';
import { cacheKey, DASHBOARD_CACHE_TTL, getOrFetch, getStaleWhileRevalidate } from './dashboardCache';
import type { ApiTimeFilterValue } from '../types/dashboard';
import type { ClientApiDetail, ClientDetailsData } from '../types/detailsChart';

export const detailsChartService = {
  /**
   * Fetch per-client API detail trend data for all APIs (or one API when apiId is set).
   */
  async getClientDetails(
    clientId: string = 'all',
    timeFilter: ApiTimeFilterValue = 'last_7_days',
    startDate?: string,
    endDate?: string,
    apiId?: string,
    silent = false,
    onUpdate?: (data: ClientDetailsData) => void,
  ): Promise<ClientDetailsData> {
    const key = cacheKey({
      clientDetails: 1,
      clientId,
      timeFilter,
      startDate,
      endDate,
      apiId,
    });
    const fetcher = async () => {
      const result = await api.getClientDetails(
        clientId,
        timeFilter,
        startDate,
        endDate,
        apiId,
      );
      return result as ClientDetailsData;
    };
    if (silent) {
      return getStaleWhileRevalidate(key, DASHBOARD_CACHE_TTL.analytics, fetcher, onUpdate);
    }
    return getOrFetch(key, DASHBOARD_CACHE_TTL.analytics, fetcher);
  },

  /**
   * Fetch a single API trend series — used by graph modals to avoid loading all APIs.
   */
  async getApiTrend(
    apiId: string,
    clientId: string = 'all',
    timeFilter: ApiTimeFilterValue = 'last_7_days',
    startDate?: string,
    endDate?: string,
  ): Promise<ClientApiDetail> {
    const result = await api.getApiTrend(apiId, clientId, timeFilter, startDate, endDate);
    return result as ClientApiDetail;
  },
};
