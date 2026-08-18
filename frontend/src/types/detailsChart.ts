import type { ApiTimeFilterValue } from './dashboard';

export interface ClientApiTrendDataPoint {
  time: string;
  total: number;
  success: number;
  failed: number;
  notFound: number;
}

export interface ClientApiDetail {
  apiId: string;
  apiName: string;
  category: string;
  totalHits: number;
  success: number;
  failed: number;
  notFound: number;
  avgResponseTimeMs: number;
  trendData: ClientApiTrendDataPoint[];
}

export interface ClientDetailsData {
  clientId: string;
  clientName: string;
  timeFilter: ApiTimeFilterValue;
  apis: ClientApiDetail[];
}