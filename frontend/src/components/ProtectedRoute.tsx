import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import { getTokenForPortal } from '../utils/authStorage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
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

  // Redirect to login if not authenticated or admin token is missing
  if (!isAuthenticated || !getTokenForPortal('admin')) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0 && !hasRole(...requiredRoles)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div
          className="max-w-md text-center p-8 rounded-xl"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--error-bg)' }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: 'var(--error)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Access Denied
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You do not have the required permissions to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};