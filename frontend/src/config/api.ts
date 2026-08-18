// API Endpoint Configuration
// Organized by feature for better maintainability
import { ENV } from './env';

export const API = {
  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // Client management endpoints
  CLIENT: {
    LIST: '/clients',
    DETAILS: (id: string) => `/clients/${id}`,
    CREATE: '/clients',
    UPDATE: (id: string) => `/clients/${id}`,
    DELETE: (id: string) => `/clients/${id}`,
    ACTIVATE: (id: string) => `/clients/${id}/activate`,
    DEACTIVATE: (id: string) => `/clients/${id}/deactivate`,
  },

  // Client user endpoints
  CLIENT_USER: {
    LIST: '/client-users',
    DETAILS: (id: string) => `/client-users/${id}`,
    CREATE: '/client-users',
    UPDATE: (id: string) => `/client-users/${id}`,
    DELETE: (id: string) => `/client-users/${id}`,
    RESET_PASSWORD: (id: string) => `/client-users/${id}/reset-password`,
  },

  // API request endpoints
  API_REQUEST: {
    LIST: '/api-requests',
    DETAILS: (id: string) => `/api-requests/${id}`,
    CREATE: '/api-requests',
    UPDATE: (id: string) => `/api-requests/${id}`,
    DELETE: (id: string) => `/api-requests/${id}`,
    APPROVE: (id: string) => `/api-requests/${id}/approve`,
    REJECT: (id: string) => `/api-requests/${id}/reject`,
  },

  // API access/subscription endpoints
  API_ACCESS: {
    LIST: '/api-access',
    DETAILS: (id: string) => `/api-access/${id}`,
    CREATE: '/api-access',
    UPDATE: (id: string) => `/api-access/${id}`,
    DELETE: (id: string) => `/api-access/${id}`,
    REGENERATE_KEY: (id: string) => `/api-access/${id}/regenerate-key`,
    CLIENT_ACCESS: (clientId: string) => `/api-access/client/${clientId}`,
  },

  // Dashboard endpoints
  DASHBOARD: {
    STATS: '/dashboard/stats',
    ANALYTICS: '/dashboard/analytics',
    RECENT_ACTIVITY: '/dashboard/recent-activity',
    API_USAGE: '/dashboard/api-usage',
  },

  // Report endpoints
  REPORTS: {
    CLIENT_USAGE: '/reports/client-usage',
    BILLING: '/reports/billing',
    API_STATS: '/reports/api-stats',
    EXPORT: '/reports/export',
  },

  // Settings endpoints
  SETTINGS: {
    PROFILE: '/settings/profile',
    PASSWORD: '/settings/password',
    NOTIFICATIONS: '/settings/notifications',
  },
} as const;

// Helper function to build full URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = ENV.API_BASE_URL;
  return `${baseUrl}${endpoint}`;
};

