import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isTokenExpired, handleAuthError } from '../services/apiClient';
import {
  clearPortalToken,
  getTokenForPortal,
  setPortalToken,
} from '../utils/authStorage';
import type { Client } from '../types/client';

interface ClientAuthContextType {
  client: Client | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshClient: () => Promise<Client | null>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

function buildClientFromLoginResponse(result: {
  client: { id: string; client_id: string; username: string; company_name: string };
}): Client {
  return {
    id: result.client.client_id,
    username: result.client.username,
    company_name: result.client.company_name,
    email: '',
    phone: '',
    address: '',
    gstin: '',
    pan: '',
    selected_apis: [],
    comments: '',
    status: 'Active',
    request_status: 'Approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const ClientAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getTokenForPortal('client');
    if (token) {
      if (isTokenExpired('client')) {
        handleAuthError();
        setIsLoading(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.type !== 'client') {
          setIsLoading(false);
          return;
        }
        if (payload.client_id) {
          api.getCurrentClient()
            .then((c) => {
              setClient(c as Client);
            })
            .catch(() => {
              setClient({
                id: payload.client_id,
                username: payload.username || '',
                company_name: payload.company_name || 'Client',
                email: '',
                phone: '',
                address: '',
                gstin: '',
                pan: '',
                selected_apis: [],
                comments: '',
                status: 'Active',
                request_status: 'Approved',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            })
            .finally(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      } catch {
        clearPortalToken('client');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      clearPortalToken('admin');
      const result = await api.clientLogin(username, password);
      setPortalToken('client', result.access_token);

      try {
        const c = await api.getCurrentClient();
        setClient(c as Client);
      } catch {
        setClient(buildClientFromLoginResponse(result));
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, []);

  const refreshClient = useCallback(async (): Promise<Client | null> => {
    try {
      const c = await api.getCurrentClient();
      setClient(c as Client);
      return c as Client;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout().catch(() => {});
    } catch {
      // Ignore logout API errors
    } finally {
      clearPortalToken('client');
      setClient(null);
    }
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        isAuthenticated: !!client,
        isLoading,
        login,
        logout,
        refreshClient,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = (): ClientAuthContextType => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
};
