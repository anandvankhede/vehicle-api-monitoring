import { api } from './apiClient';
import type { ApiTimeFilterValue } from '../types/dashboard';
import type { ClientDetailsData } from '../types/detailsChart';

export const detailsChartService = {
  /**
   * Fetch per-client API detail trend data for all APIs
   */
  async getClientDetails(
    clientId: string = 'all',
    timeFilter: ApiTimeFilterValue = 'last_7_days',
    _startDate?: string,
    _endDate?: string
  ): Promise<ClientDetailsData> {
    try {
      const result = await api.getClientDetails(clientId, timeFilter, _startDate, _endDate);
      return result as ClientDetailsData;
    } catch {
      return {
        clientId,
        clientName: clientId === 'all' ? 'All Clients' : 'Unknown',
        timeFilter,
        apis: [],
      };
    }
  },
};