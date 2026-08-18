// Environment configuration
export const ENV = {
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
} as const;

// LocalStorage keys (centralized)
export const STORAGE_KEYS = {
  CLIENTS: 'vehical_clients',
  CLIENT_USERS: 'vehical_client_users',
  API_REQUESTS: 'vehical_api_requests',
  ACTIVITY: 'vehical_client_activity',
  CLIENT_API_ACCESS: 'vehical_client_api_access',
  AUDIT_LOGS: 'vehical_audit_logs',
  REGISTRATION_REQUESTS: 'vehical_registration_requests',
  CLIENT_AUDIT: 'vehical_client_audit',
  AUTH_USER: 'auth_user',
  CLIENT_SESSION: 'vehical_client_session',
} as const;