import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogIn, Eye, EyeOff, AlertCircle, CheckCircle, Building2,
  User, Lock, CreditCard, FileText, Mail, Phone, Save
} from 'lucide-react';
import { useClientAuth } from '../context/ClientAuthContext';
import clientService from '../services/clientService';
import { validateClientRegistration } from '../utils/clientRegistrationValidation';

type AuthMode = 'login' | 'register';

export const ClientAuth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useClientAuth();

  const [mode, setMode] = useState<AuthMode>(location.pathname.includes('/register') ? 'register' : 'login');

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show session expired message if redirected from token expiry
  const [sessionExpired, setSessionExpired] = useState(false);

  // Redirect authenticated users to client services
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/client/services', { replace: true });
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

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(loginUsername.trim(), loginPassword);
      if (result.success) {
        navigate('/client/services', { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const fieldErrors = validateClientRegistration({
      company_name: companyName,
      address,
      gstin,
      pan,
      email,
      phone,
      username,
      password,
      confirm_password: confirmPassword,
    }, { requireConfirmPassword: true });
    const errorMessages = Object.values(fieldErrors);
    if (errorMessages.length > 0) {
      setError(errorMessages.join(' · '));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await clientService.register({
        company_name: companyName.trim(),
        address: address.trim(),
        gstin: gstin.toUpperCase().trim(),
        pan: pan.toUpperCase().trim(),
        email: email.trim(),
        phone: phone.trim(),
        username: username.trim(),
        password,
      });

      if (result.success) {
        setSuccess('Registration successful! You can now sign in.');
        // Clear register form
        setCompanyName('');
        setAddress('');
        setGstin('');
        setPan('');
        setEmail('');
        setPhone('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        // Switch to login mode
        setMode('login');
        setLoginUsername(username.trim());
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "theme-input w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none";
  const labelClass = "text-sm font-medium";
  const labelStyle = { color: 'var(--text-secondary)' } as React.CSSProperties;
  const requiredStyle = { color: 'var(--error)' } as React.CSSProperties;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
      <div className={`w-full ${mode === 'register' ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl mb-4" style={{ backgroundColor: 'var(--primary-light)' }}>
            <Building2 className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Client Portal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <div className={`rounded-xl ${mode === 'register' ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="client-username" className={labelClass} style={labelStyle}>Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    id="client-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    autoComplete="username"
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="client-password" className={labelClass} style={labelStyle}>Password</label>
                <div className="relative">
                  <input
                    id="client-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="theme-input w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none pr-10"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              {/* Company Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <Building2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Company Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={labelStyle}>Company Name <span style={requiredStyle}>*</span></label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                      className={`${inputClass} mt-0.5`}
                      autoComplete="organization"
                    />
                  </div>

                  <div>
                    <label className={labelClass} style={labelStyle}>Phone <span style={requiredStyle}>*</span></label>
                    <div className="relative mt-0.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        maxLength={10}
                        className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass} style={labelStyle}>Address <span style={requiredStyle}>*</span></label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter company address"
                    rows={1}
                    className={`${inputClass} mt-0.5 resize-none`}
                    autoComplete="street-address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={labelStyle}>GSTIN <span style={requiredStyle}>*</span></label>
                    <div className="relative mt-0.5">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>PAN <span style={requiredStyle}>*</span></label>
                    <div className="relative mt-0.5">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={pan}
                        onChange={(e) => setPan(e.target.value.toUpperCase())}
                        placeholder="AAAAA0000A"
                        maxLength={10}
                        className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass} style={labelStyle}>Email <span style={requiredStyle}>*</span></label>
                  <div className="relative mt-0.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="company@example.com"
                      className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                      autoComplete="email"
                    />
                  </div>
                </div>
              </div>

              {/* User Credentials */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>User Credentials</span>
                </div>

                <div>
                  <label className={labelClass} style={labelStyle}>Username <span style={requiredStyle}>*</span></label>
                  <div className="relative mt-0.5">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username (min 3 chars)"
                      className="theme-input w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={labelStyle}>Password <span style={requiredStyle}>*</span></label>
                    <div className="relative mt-0.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="theme-input w-full pl-9 pr-10 py-2.5 rounded-lg text-sm focus:outline-none"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass} style={labelStyle}>Confirm Password <span style={requiredStyle}>*</span></label>
                    <div className="relative mt-0.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="theme-input w-full pl-9 pr-10 py-2.5 rounded-lg text-sm focus:outline-none"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Register Here
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
            <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
              Admin user?{' '}
              <a href="/admin/login" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
                Sign in to Admin Portal
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};