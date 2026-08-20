import { api } from './apiClient';
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
  ): Promise<ClientDetailsData> {
    const result = await api.getClientDetails(
      clientId,
      timeFilter,
      startDate,
      endDate,
      apiId,
    );
    return result as ClientDetailsData;
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
