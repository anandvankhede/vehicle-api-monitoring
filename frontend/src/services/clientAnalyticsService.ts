import { api } from './apiClient';
import { cacheKey, DASHBOARD_CACHE_TTL, getOrFetch, getStaleWhileRevalidate } from './dashboardCache';
import { dashboardService } from './dashboardService';
import type {
  ClientAnalyticsData,
} from '../types/clientAnalytics';

export const clientAnalyticsService = {
  async getClientAnalyticsData(
    clientId: string = 'all',
    apiId: string = 'all',
    timeFilter: string = 'last_7_days',
    statusFilter: string = 'all',
    searchQuery: string = '',
    sortBy: string = 'totalHits',
    sortOrder: string = 'desc',
    _startDate?: string,
    _endDate?: string,
    silent = false,
    onUpdate?: (data: ClientAnalyticsData) => void,
  ): Promise<ClientAnalyticsData> {
    const key = cacheKey({
      clientAnalytics: 1,
      clientId,
      apiId,
      timeFilter,
      statusFilter,
      searchQuery,
      sortBy,
      sortOrder,
      startDate: _startDate,
      endDate: _endDate,
    });
    const fetcher = async () => {
      const result = await api.getClientAnalytics({
        clientId: clientId !== 'all' ? clientId : undefined,
        apiId: apiId !== 'all' ? apiId : undefined,
        timeFilter,
        statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
        searchQuery: searchQuery || undefined,
        sortBy,
        sortOrder,
        startDate: _startDate,
        endDate: _endDate,
      });
      return result as ClientAnalyticsData;
    };
    try {
      if (silent) {
        return getStaleWhileRevalidate(key, DASHBOARD_CACHE_TTL.analytics, fetcher, onUpdate);
      }
      return await getOrFetch(key, DASHBOARD_CACHE_TTL.analytics, fetcher);
    } catch {
      return {
        records: [],
        summary: { totalClients: 0, totalApis: 0, totalHits: 0, overallSuccessRate: 0, avgResponseTimeMs: 0 },
        totalRecords: 0,
        filteredRecords: 0,
      };
    }
  },

  async getAvailableApis(clientId: string = 'all'): Promise<{ id: string; name: string; category: string }[]> {
    const apis = await dashboardService.getAvailableApis(clientId);
    return apis.map((a) => ({ id: a.id, name: a.name, category: a.category }));
  },

  async exportDetailReport(params: {
    clientId: string;
    apiId: string;
    apiName: string;
    timeFilter: string;
    statusFilter: string;
    startDate?: string;
    endDate?: string;
    format?: 'csv' | 'excel';
  }): Promise<{ content: string; filename: string; contentType?: string; rowCount?: number; truncated?: boolean }> {
    const result = await api.exportClientAnalyticsDetail({
      clientId: params.clientId,
      apiId: params.apiId,
      apiName: params.apiName,
      timeFilter: params.timeFilter,
      statusFilter: params.statusFilter,
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format ?? 'csv',
    }) as { content?: string; filename?: string; contentType?: string; rowCount?: number; truncated?: boolean };
    if (!result.content || !result.filename) {
      throw new Error('Export failed — empty response from server');
    }
    return {
      content: result.content,
      filename: result.filename,
      contentType: result.contentType,
      rowCount: result.rowCount,
      truncated: result.truncated,
    };
  },
};