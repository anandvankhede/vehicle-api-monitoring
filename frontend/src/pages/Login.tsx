import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, LogIn, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show session expired message if redirected from token expiry
  const [sessionExpired, setSessionExpired] = useState(false);

  // Redirect authenticated admins to dashboard
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Check for session expiry message
  React.useEffect(() => {
    const expired = localStorage.getItem('session_expired');
    if (expired) {
      setSessionExpired(true);
      localStorage.removeItem('session_expired');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl mb-4" style={{ backgroundColor: 'var(--primary-light)' }}>
            <Activity className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            API Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Admin sign in
          </p>
        </div>

        {/* Session Expired Message */}
        {sessionExpired && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              border: '1px solid var(--warning)',
            }}
          >
            Your session has expired. Please log in again.
          </div>
        )}

        {/* Login Card */}
        <div
          className="rounded-xl p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--error-bg)',
                  color: 'var(--error)',
                  border: '1px solid var(--error)',
                }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="theme-input w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="theme-input w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none pr-10"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Admin Access */}
          <div
            className="mt-6 p-4 rounded-lg text-xs space-y-2"
            style={{
              backgroundColor: 'var(--card-inner)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Access</span>
            </div>
            <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
              <p><span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Admin:</span> admin / admin123</p>
            </div>
          </div>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
          Client user?{' '}
          <a href="/client/login" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
            Sign in to Client Portal
          </a>
        </p>
      </div>
    </div>
  );
};