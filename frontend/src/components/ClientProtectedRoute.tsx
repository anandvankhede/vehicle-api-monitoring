import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useClientAuth } from '../context/ClientAuthContext';

interface ClientProtectedRouteProps {
  children: React.ReactNode;
}

export const ClientProtectedRoute: React.FC<ClientProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useClientAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--border)',
              borderTopColor: 'var(--primary)',
            }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/client/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
