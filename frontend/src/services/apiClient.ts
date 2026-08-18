/**
 * API Client Service
 *
 * This service provides a centralized interface for all API calls.
 * It uses HTTP fetch to communicate with the backend FastAPI server.
 * Auth tokens are stored in localStorage by the auth flow.
 */

import { buildApiUrl } from '../config/api';
import {
  clearAllAuth,
  clearPortalToken,
  getActivePortal,
  getTokenForPortal,
  setPortalToken,
  type PortalType,
} from '../utils/authStorage';
import type {
  Client,
  ClientUser,
  ApiRequest,
  ActivityRecord,
  ClientApiAccess,
  AuditLog,
  RegistrationRequest,
  ClientAuditEntry,
  ApiInfo,
} from '../types/client';

// ============================================================================
// REFRESH TOKEN STATE
// ============================================================================

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let pendingRequests: Array<{ resolve: (token: string) => void; reject: () => void }> = [];

async function performRefresh(portal: PortalType): Promise<string> {
  const token = getToken(portal);
  if (!token) {
    throw new Error('No token available for refresh');
  }

  const response = await fetch(buildApiUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: token }),
  });

  if (!response.ok) {
    throw new Error('Refresh failed');
  }

  const data = await response.json();
  const newToken = data.access_token as string;
  setPortalToken(portal, newToken);
  return newToken;
}

async function waitForRefresh(portal: PortalType): Promise<string> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = performRefresh(portal)
      .catch((err) => {
        // Refresh failed - clear all pending requests
        pendingRequests.forEach(({ reject }) => reject());
        pendingRequests = [];
        throw err;
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
  }

  return refreshPromise!;
}

// ============================================================================
// AUTH TOKEN HELPERS
// ============================================================================

function getToken(portal?: PortalType): string | null {
  const activePortal = portal ?? getActivePortal();
  if (!activePortal) return null;
  return getTokenForPortal(activePortal);
}

function getAuthHeaders(portal?: PortalType): Record<string, string> {
  const token = getToken(portal);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Check whether the current access token has expired.
 * Decodes the JWT `exp` claim (seconds since epoch) and adds a small
 * safety buffer so we proactively treat near-expired tokens as expired.
 */
export function isTokenExpired(portal?: PortalType): boolean {
  const token = getToken(portal);
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp: number | undefined = payload.exp;
    if (!exp) return false; // no exp claim → let the server decide
    const expiresAtMs = exp * 1000 - 30_000; // 30-second buffer
    return Date.now() >= expiresAtMs;
  } catch {
    return true;
  }
}

/**
 * Called when the server returns a 401 (unauthorized / token expired).
 * Clears the token from localStorage and redirects to the appropriate
 * login page based on the stored user type (client vs admin).
 */
export function handleAuthError(portal?: PortalType): void {
  const activePortal = portal ?? getActivePortal();
  localStorage.setItem('session_expired', 'true');
  if (activePortal) {
    clearPortalToken(activePortal);
  }
}

/**
 * Centralized logout function.
 * Clears all authentication state and optionally calls backend logout.
 */
export function logout(clearDataOnly = false): void {
  clearAllAuth();
  if (!clearDataOnly) {
    // Invalidate any cached protected data
  }
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

/** Login/register endpoints return 401 for bad credentials — not expired sessions. */
function isPublicAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint === '/auth/login' ||
    endpoint === '/auth/client-login' ||
    endpoint === '/auth/register'
  );
}

async function httpGet<T>(endpoint: string, portal?: PortalType): Promise<T> {
  const activePortal = portal ?? getActivePortal() ?? 'admin';
  const response = await fetch(buildApiUrl(endpoint), {
    method: 'GET',
    headers: getAuthHeaders(activePortal),
  });

  if (response.status === 401) {
    try {
      const newToken = await waitForRefresh(activePortal);
      const retryResponse = await fetch(buildApiUrl(endpoint), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
      // Retry failed - throw error from retry response
      const error = await retryResponse.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${retryResponse.status}`);
    } catch {
      handleAuthError(activePortal);
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function httpPost<T, B = unknown>(endpoint: string, body?: B, portal?: PortalType): Promise<T> {
  const activePortal = portal ?? getActivePortal() ?? 'admin';
  const response = await fetch(buildApiUrl(endpoint), {
    method: 'POST',
    headers: getAuthHeaders(activePortal),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && activePortal && !isPublicAuthEndpoint(endpoint)) {
    try {
      const newToken = await waitForRefresh(activePortal);
      const retryResponse = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
      // Retry failed - throw error from retry response
      const error = await retryResponse.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${retryResponse.status}`);
    } catch {
      handleAuthError(activePortal);
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function httpPut<T, B = unknown>(endpoint: string, body?: B, portal?: PortalType): Promise<T> {
  const activePortal = portal ?? getActivePortal() ?? 'admin';
  const response = await fetch(buildApiUrl(endpoint), {
    method: 'PUT',
    headers: getAuthHeaders(activePortal),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    try {
      const newToken = await waitForRefresh(activePortal);
      const retryResponse = await fetch(buildApiUrl(endpoint), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
      // Retry failed - throw error from retry response
      const error = await retryResponse.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${retryResponse.status}`);
    } catch {
      handleAuthError(activePortal);
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function httpDelete<T>(endpoint: string, portal?: PortalType): Promise<T> {
  const activePortal = portal ?? getActivePortal() ?? 'admin';
  const response = await fetch(buildApiUrl(endpoint), {
    method: 'DELETE',
    headers: getAuthHeaders(activePortal),
  });

  if (response.status === 401) {
    try {
      const newToken = await waitForRefresh(activePortal);
      const retryResponse = await fetch(buildApiUrl(endpoint), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
      // Retry failed - throw error from retry response
      const error = await retryResponse.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${retryResponse.status}`);
    } catch {
      handleAuthError(activePortal);
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================================
// HTTP-BASED API IMPLEMENTATION
// ============================================================================

export const api = {
  // Clients
  getClients: (portal?: PortalType): Promise<{ data: Client[]; total: number }> => httpGet('/clients', portal),
  getClientById: (id: string): Promise<Client> => httpGet(`/clients/${id}`),
  getCurrentClient: (): Promise<Client> => httpGet('/clients/me', 'client'),
  createClient: (body: unknown): Promise<Client> => httpPost('/clients', body),
  updateClient: (id: string, body: unknown): Promise<Client> => httpPut(`/clients/${id}`, body),
  deleteClient: (id: string): Promise<{ success: boolean }> => httpDelete(`/clients/${id}`),
  activateClient: (id: string): Promise<Client> => httpPost(`/clients/${id}/activate`),
  deactivateClient: (id: string): Promise<Client> => httpPost(`/clients/${id}/deactivate`),
  resetClientPassword: (id: string, newPassword: string): Promise<{ success: boolean }> =>
    httpPost(`/clients/${id}/reset-password`, { new_password: newPassword }),

  // Client Users
  getClientUsers: (): Promise<{ data: ClientUser[]; total: number }> => httpGet('/client-users'),
  getClientUserById: (id: string): Promise<ClientUser> => httpGet(`/client-users/${id}`),
  createClientUser: (body: unknown): Promise<ClientUser> => httpPost('/client-users', body),
  updateClientUser: (id: string, body: unknown): Promise<ClientUser> => httpPut(`/client-users/${id}`, body),
  deleteClientUser: (id: string): Promise<{ success: boolean }> => httpDelete(`/client-users/${id}`),
  resetClientUserPassword: (id: string, newPassword: string): Promise<{ success: boolean }> =>
    httpPost(`/client-users/${id}/reset-password`, { new_password: newPassword }),

  // API Requests
  getApiRequests: (params?: { skip?: number; limit?: number; status?: string; client_id?: string }, portal?: PortalType): Promise<{ data: ApiRequest[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.client_id) searchParams.set('client_id', params.client_id);
    return httpGet(`/api-requests?${searchParams.toString()}`, portal);
  },
  getApiRequestById: (id: string): Promise<ApiRequest> => httpGet(`/api-requests/${id}`),
  createApiRequest: (body: unknown, portal?: PortalType): Promise<ApiRequest> => httpPost('/api-requests', body, portal),
  updateApiRequest: (id: string, body: unknown): Promise<ApiRequest> => httpPut(`/api-requests/${id}`, body),
  deleteApiRequest: (id: string): Promise<{ success: boolean }> => httpDelete(`/api-requests/${id}`),
  approveApiRequest: (id: string, body: unknown): Promise<ApiRequest> => httpPost(`/api-requests/${id}/approve`, body),
  rejectApiRequest: (id: string, body: unknown): Promise<ApiRequest> => httpPost(`/api-requests/${id}/reject`, body),

  // API Access
  getApiAccess: (params?: { skip?: number; limit?: number }, portal?: PortalType): Promise<{ data: ClientApiAccess[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    return httpGet(`/api-access?${searchParams.toString()}`, portal);
  },
  getApiAccessById: (id: string): Promise<ClientApiAccess> => httpGet(`/api-access/${id}`),
  assignApi: (body: unknown): Promise<ClientApiAccess> => httpPost('/api-access', body),
  updateApiAccess: (id: string, body: unknown): Promise<ClientApiAccess> => httpPut(`/api-access/${id}`, body),
  deleteApiAccess: (id: string): Promise<{ success: boolean }> => httpDelete(`/api-access/${id}`),
  regenerateApiKey: (id: string): Promise<{ success: boolean; api_key: string }> => httpPost(`/api-access/${id}/regenerate-key`),
  getClientApiAccess: (clientId: string, portal?: PortalType): Promise<{ data: ClientApiAccess[] }> =>
    httpGet(`/api-access/client/${clientId}`, portal),

  // API Info (Catalog)
  getApiInfo: (): Promise<{ data: unknown[]; total: number }> => httpGet('/api-info'),
  getApiInfoById: (id: string): Promise<unknown> => httpGet(`/api-info/${id}`),
  createApiInfo: (body: unknown): Promise<{ success: boolean; message?: string }> => httpPost('/api-info', body, 'admin'),
  updateApiInfo: (id: string, body: unknown): Promise<{ success: boolean; message?: string }> => httpPut(`/api-info/${id}`, body, 'admin'),
  updateApiInfoDirect: async (id: string, body: unknown): Promise<{ success: boolean; message?: string }> => {
    const token = getToken('admin');
    const response = await fetch(buildApiUrl(`/api-info/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
  deleteApiInfo: (id: string): Promise<{ success: boolean; message?: string }> => httpDelete(`/api-info/${id}`, 'admin'),

  // Activity
  getActivityRecords: (): Promise<{ data: ActivityRecord[]; total: number }> => httpGet('/activity'),
  getClientActivity: (clientId: string, portal?: PortalType): Promise<{ data: ActivityRecord[] }> =>
    httpGet(`/clients/${clientId}/activity`, portal),

  // Client APIs (catalog with subscription status)
  getClientApis: (clientId: string, portal?: PortalType): Promise<{ data: { api: ApiInfo; status: 'Active' | 'Not Assigned' | 'Pending Approval' | 'Suspended' }[] }> =>
    httpGet(`/clients/${clientId}/apis`, portal),

  // Audit Logs
  getAuditLogs: (): Promise<{ data: AuditLog[]; total: number }> => httpGet('/audit-logs'),
  createAuditLog: (body: unknown): Promise<{ success: boolean }> => httpPost('/audit-logs', body),
  getClientAudit: (clientId: string): Promise<{ data: ClientAuditEntry[] }> => httpGet(`/clients/${clientId}/audit`),

  // Registration Requests
  getRegistrationRequests: (): Promise<{ data: RegistrationRequest[]; total: number }> => httpGet('/registration-requests'),
  getRegistrationRequestById: (id: string): Promise<RegistrationRequest> => httpGet(`/registration-requests/${id}`),
  createRegistrationRequest: (body: unknown): Promise<{ success: boolean }> => httpPost('/registration-requests', body),
  updateRegistrationRequest: (id: string, body: unknown): Promise<RegistrationRequest> => httpPut(`/registration-requests/${id}`, body),

  // Auth
  login: (username: string, password: string): Promise<{ access_token: string; user: { id: string; username: string; name: string; role: string } }> =>
    httpPost('/auth/login', { username, password }, 'admin'),
  clientLogin: (username: string, password: string): Promise<{ access_token: string; client: { id: string; client_id: string; username: string; company_name: string } }> =>
    httpPost('/auth/client-login', { username, password }, 'client'),
  register: (body: unknown): Promise<{ success: boolean }> => httpPost('/auth/register', body),
  logout: (): Promise<{ success: boolean }> => httpPost('/auth/logout'),
  refreshToken: (): Promise<{ access_token: string }> => httpPost('/auth/refresh'),

  // Dashboard
  getDashboardStats: () => httpGet('/dashboard/stats'),
  getDashboardAnalytics: () => httpGet('/dashboard/analytics'),
  getDashboardUsers: () => httpGet('/dashboard/users'),
  getDashboardApis: () => httpGet('/dashboard/apis'),
  getUserApiStats: (clientId: string = 'all', timeFilter: string = 'last_7_days', startDate?: string, endDate?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('client_id', clientId);
    searchParams.set('time_filter', timeFilter);
    if (startDate) searchParams.set('start_date', startDate);
    if (endDate) searchParams.set('end_date', endDate);
    return httpGet(`/dashboard/user-api-stats?${searchParams.toString()}`);
  },
  getDashboardApiUsage: (apiId: string, timeFilter: string = 'last_7_days', startDate?: string, endDate?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('api_id', apiId);
    searchParams.set('time_filter', timeFilter);
    if (startDate) searchParams.set('start_date', startDate);
    if (endDate) searchParams.set('end_date', endDate);
    const query = searchParams.toString();
    return httpGet(`/dashboard/api-usage?${query}&_t=${Date.now()}`);
  },
  getDashboardRecentActivity: () => httpGet('/dashboard/recent-activity'),
  getClientAnalytics: (params: {
    clientId?: string;
    apiId?: string;
    timeFilter?: string;
    statusFilter?: string;
    searchQuery?: string;
    sortBy?: string;
    sortOrder?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.clientId) searchParams.set('client_id', params.clientId);
    if (params.apiId) searchParams.set('api_id', params.apiId);
    if (params.timeFilter) searchParams.set('time_filter', params.timeFilter);
    if (params.statusFilter) searchParams.set('status_filter', params.statusFilter);
    if (params.searchQuery) searchParams.set('search_query', params.searchQuery);
    if (params.sortBy) searchParams.set('sort_by', params.sortBy);
    if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);
    if (params.startDate) searchParams.set('start_date', params.startDate);
    if (params.endDate) searchParams.set('end_date', params.endDate);
    return httpGet(`/dashboard/client-analytics?${searchParams.toString()}`);
  },
  exportClientAnalyticsDetail: (params: {
    clientId: string;
    apiId?: string;
    apiName?: string;
    timeFilter?: string;
    statusFilter?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('client_id', params.clientId);
    if (params.apiId) searchParams.set('api_id', params.apiId);
    if (params.apiName) searchParams.set('api_name', params.apiName);
    if (params.timeFilter) searchParams.set('time_filter', params.timeFilter);
    if (params.statusFilter && params.statusFilter !== 'all') {
      searchParams.set('status_filter', params.statusFilter);
    }
    if (params.startDate) searchParams.set('start_date', params.startDate);
    if (params.endDate) searchParams.set('end_date', params.endDate);
    return httpGet(`/dashboard/client-analytics/export?${searchParams.toString()}`);
  },
  getClientDetails: (clientId: string = 'all', timeFilter: string = 'last_7_days', startDate?: string, endDate?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('client_id', clientId);
    searchParams.set('time_filter', timeFilter);
    if (startDate) searchParams.set('start_date', startDate);
    if (endDate) searchParams.set('end_date', endDate);
    return httpGet(`/dashboard/client-details?${searchParams.toString()}`);
  },

  // Reports
  getClientUsageReport: (
    clientId?: string,
    dateRange: string = 'month',
    startDate?: string,
    endDate?: string,
    portal?: PortalType,
  ) => {
    const searchParams = new URLSearchParams();
    if (clientId) searchParams.set('client_id', clientId);
    searchParams.set('date_range', dateRange);
    if (startDate) searchParams.set('start_date', startDate);
    if (endDate) searchParams.set('end_date', endDate);
    return httpGet(`/reports/client-usage?${searchParams.toString()}`, portal);
  },
  getBillingReport: (clientId?: string, month?: string, portal?: PortalType) => {
    const searchParams = new URLSearchParams();
    if (clientId) searchParams.set('client_id', clientId);
    if (month) searchParams.set('month', month);
    return httpGet(`/reports/billing?${searchParams.toString()}`, portal);
  },
  getApiStats: (apiName?: string, timeFilter: string = '7d') => {
    const searchParams = new URLSearchParams();
    if (apiName) searchParams.set('api_name', apiName);
    searchParams.set('time_filter', timeFilter);
    return httpGet(`/reports/api-stats?${searchParams.toString()}`);
  },
  getReportTable: (params?: {
    status?: string;
    apiName?: string;
    clientName?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.apiName) searchParams.set('api_name', params.apiName);
    if (params?.clientName) searchParams.set('client_name', params.clientName);
    if (params?.dateRange) searchParams.set('date_range', params.dateRange);
    if (params?.startDate) searchParams.set('start_date', params.startDate);
    if (params?.endDate) searchParams.set('end_date', params.endDate);
    return httpGet(`/reports/table?${searchParams.toString()}`);
  },
  exportReport: (body: {
    format: string;
    report_type: string;
    date_range?: string;
    start_date?: string;
    end_date?: string;
    client_id?: string;
    api_name?: string;
    client_name?: string;
    status?: string;
  }, portal?: PortalType) => httpPost('/reports/export', body, portal),
  generateInvoice: (clientId: string, month: string, gstPercentage: number = 18) =>
    httpPost('/reports/invoices', { client_id: clientId, month, gst_percentage: gstPercentage }),
  getInvoices: (clientId?: string, status?: string, limit: number = 50) => {
    const searchParams = new URLSearchParams();
    if (clientId) searchParams.set('client_id', clientId);
    if (status) searchParams.set('status', status);
    searchParams.set('limit', String(limit));
    return httpGet(`/reports/invoices?${searchParams.toString()}`);
  },

  // Settings
  getProfile: () => httpGet('/settings/profile'),
  updateProfile: (body: unknown) => httpPut('/settings/profile', body),
  updatePassword: (body: { current_password: string; new_password: string }) => httpPut('/settings/password', body),
  getNotifications: () => httpGet('/settings/notifications'),
  updateNotifications: (body: unknown) => httpPut('/settings/notifications', body),
};

export { ENV, STORAGE_KEYS } from '../config/env';
export { buildApiUrl } from '../config/api';