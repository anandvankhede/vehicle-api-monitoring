import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Activity, Building2, Shield, LogIn } from 'lucide-react';
import { getActivePortal } from '../utils/authStorage';

export const PortalHome: React.FC = () => {
  const activePortal = getActivePortal();

  if (activePortal === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  if (activePortal === 'client') {
    return <Navigate to="/client/services" replace />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center p-3 rounded-2xl mb-4"
            style={{ backgroundColor: 'var(--primary-light)' }}
          >
            <Activity className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            API Analytics Platform
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Choose your portal to continue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/admin/login"
            className="rounded-xl p-6 transition-all hover:scale-[1.01]"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary-light)' }}
              >
                <Shield className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Admin Portal</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage clients, APIs & monitoring</p>
              </div>
            </div>
            <div
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <LogIn className="w-4 h-4" />
              Admin Sign In
            </div>
          </Link>

          <Link
            to="/client/login"
            className="rounded-xl p-6 transition-all hover:scale-[1.01]"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--info-bg)' }}
              >
                <Building2 className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Client Portal</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>View services, usage & requests</p>
              </div>
            </div>
            <div
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--info)' }}
            >
              <LogIn className="w-4 h-4" />
              Client Sign In
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
