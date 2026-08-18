export interface ClientActivityRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  apiId: string;
  apiName: string;
  apiCategory: string;
  totalHits: number;
  success: number;
  failed: number;
  notFound: number;
  avgResponseTimeMs: number;
  successRate: number;
  timestamp: string;
  date: string;
}

export interface ClientAnalyticsSummary {
  totalClients: number;
  totalApis: number;
  totalHits: number;
  overallSuccessRate: number;
  avgResponseTimeMs: number;
}

export interface ClientAnalyticsFilter {
  clientId: string;
  apiId: string;
  timeFilter: string;
  startDate: string;
  endDate: string;
  searchQuery: string;
  statusFilter: 'all' | 'success' | 'failed' | 'notFound';
  sortBy: 'totalHits' | 'successRate' | 'avgResponseTimeMs' | 'clientName' | 'apiName';
  sortOrder: 'asc' | 'desc';
}

export interface ClientAnalyticsData {
  records: ClientActivityRecord[];
  summary: ClientAnalyticsSummary;
  totalRecords: number;
  filteredRecords: number;
}