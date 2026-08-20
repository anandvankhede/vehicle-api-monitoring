// Environment configuration
function parsePollMs(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 5000 ? parsed : fallback;
}

const parsedDashboardPollMs = Number(import.meta.env.VITE_DASHBOARD_POLL_MS);

export const ENV = {
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  /** Background page auto-refresh (Dashboard, Detailed Chart). Slower in prod to reduce response_db load. */
  DASHBOARD_POLL_MS:
    Number.isFinite(parsedDashboardPollMs) && parsedDashboardPollMs >= 5000
      ? parsedDashboardPollMs
      : import.meta.env.PROD
        ? 30_000
        : 15_000,
  /** Graph popup live refresh while modal is open. */
  GRAPH_MODAL_POLL_MS: parsePollMs(import.meta.env.VITE_GRAPH_MODAL_POLL_MS, 5_000),
  /** Client Activity and admin API Requests list refresh. */
  ACTIVITY_POLL_MS: parsePollMs(import.meta.env.VITE_ACTIVITY_POLL_MS, 15_000),
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