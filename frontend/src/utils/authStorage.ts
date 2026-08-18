export type PortalType = 'admin' | 'client';

const ADMIN_TOKEN_KEY = 'admin_access_token';
const CLIENT_TOKEN_KEY = 'client_access_token';
const USER_TYPE_KEY = 'user_type';
const LEGACY_TOKEN_KEY = 'access_token';

function decodeTokenType(token: string): PortalType | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.type === 'client') return 'client';
    if (payload.type === 'admin') return 'admin';
    return null;
  } catch {
    return null;
  }
}

/** Migrate legacy single-token storage to portal-specific keys. */
function migrateLegacyToken(): void {
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacy) return;

  const portal = decodeTokenType(legacy) ?? (localStorage.getItem(USER_TYPE_KEY) as PortalType | null);
  if (portal === 'client') {
    localStorage.setItem(CLIENT_TOKEN_KEY, legacy);
    localStorage.setItem(USER_TYPE_KEY, 'client');
  } else if (portal === 'admin') {
    localStorage.setItem(ADMIN_TOKEN_KEY, legacy);
    localStorage.setItem(USER_TYPE_KEY, 'admin');
  }
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getPortalToken(portal: PortalType): string | null {
  migrateLegacyToken();
  return localStorage.getItem(portal === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY);
}

export function setPortalToken(portal: PortalType, token: string): void {
  localStorage.setItem(portal === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY, token);
  localStorage.setItem(USER_TYPE_KEY, portal);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearPortalToken(portal: PortalType): void {
  localStorage.removeItem(portal === 'admin' ? ADMIN_TOKEN_KEY : CLIENT_TOKEN_KEY);
  const activeType = localStorage.getItem(USER_TYPE_KEY);
  if (activeType === portal) {
    localStorage.removeItem(USER_TYPE_KEY);
  }
}

export function clearAllAuth(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(CLIENT_TOKEN_KEY);
  localStorage.removeItem(USER_TYPE_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getActivePortal(): PortalType | null {
  migrateLegacyToken();
  const userType = localStorage.getItem(USER_TYPE_KEY);
  if (userType === 'admin' || userType === 'client') {
    return userType;
  }
  if (getPortalToken('admin')) return 'admin';
  if (getPortalToken('client')) return 'client';
  return null;
}

export function getActiveToken(): string | null {
  const portal = getActivePortal();
  if (!portal) return null;
  return getPortalToken(portal);
}

export function getTokenForPortal(portal: PortalType): string | null {
  return getPortalToken(portal);
}
