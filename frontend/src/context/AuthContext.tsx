import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, isTokenExpired, handleAuthError } from '../services/apiClient';
import {
  clearPortalToken,
  getTokenForPortal,
  setPortalToken,
} from '../utils/authStorage';

export type UserRole = 'admin' | 'viewer' | 'editor';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getTokenForPortal('admin');
    if (token) {
      if (isTokenExpired('admin')) {
        handleAuthError('admin');
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.type !== 'admin') {
          setIsLoading(false);
          return;
        }
        const role = (payload.role || 'admin').toLowerCase();
        setUser({
          id: payload.sub || '',
          username: payload.username || '',
          name: payload.name || payload.username || '',
          role: role as UserRole,
        });
      } catch {
        clearPortalToken('admin');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      clearPortalToken('client');
      const result = await api.login(username, password);
      setPortalToken('admin', result.access_token);
      const role = (result.user.role || 'admin').toLowerCase();
      setUser({
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: role as UserRole,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout().catch(() => {});
    } catch {
      // Ignore logout API errors
    } finally {
      clearPortalToken('admin');
      setUser(null);
    }
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
