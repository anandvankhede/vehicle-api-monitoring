import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, CreditCard, FileText, Mail, Phone, User, CheckCircle, XCircle, Calendar, Shield, Activity } from 'lucide-react';
import { useClientAuth } from '../context/ClientAuthContext';
import clientService from '../services/clientService';

export const ClientProfile: React.FC = () => {
  const { client, isAuthenticated, isLoading: authLoading, refreshClient } = useClientAuth();
  const navigate = useNavigate();
  const [activeApiNames, setActiveApiNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/client/login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!client?.id) return;

    let cancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const refreshed = await refreshClient();
        if (cancelled) return;

        const clientId = refreshed?.id ?? client.id;
        const access = await clientService.getClientApiAccessAsync(refreshed.id, 'client');
        if (cancelled) return;

        setActiveApiNames(access.filter((a) => a.status === 'Active').map((a) => a.api_name));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [client?.id, refreshClient]);

  if (authLoading || !client || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
    <div className="flex items-start gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: 'var(--text-primary)' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );

  const displayApis = activeApiNames.length > 0 ? activeApiNames : (client.selected_apis || []);

  return (
    <div className="page-container py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
              >
                {client.company_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {client.company_name}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: client.status === 'Active' ? 'var(--success-bg)' : 'var(--error-bg)',
                      color: client.status === 'Active' ? 'var(--success)' : 'var(--error)',
                    }}
                  >
                    {client.status === 'Active' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {client.status}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}
                  >
                    <Shield className="w-3 h-3" />
                    Client
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-0">
              <InfoRow icon={Building2} label="Company Name" value={client.company_name} />
              <InfoRow icon={MapPin} label="Address" value={client.address} />
              <InfoRow icon={CreditCard} label="GSTIN" value={client.gstin} />
              <InfoRow icon={FileText} label="PAN" value={client.pan} />
              <InfoRow icon={Mail} label="Email" value={client.email} />
              <InfoRow icon={Phone} label="Phone" value={client.phone} />
              <InfoRow icon={User} label="Username" value={client.username} />
              <InfoRow icon={Calendar} label="Registration Date" value={formatDate(client.created_at)} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              Active APIs
            </h3>

            {displayApis.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No active APIs yet. Request access from the Services page.
              </p>
            ) : (
              <div className="space-y-2">
                {displayApis.map((api) => (
                  <div
                    key={api}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{api}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Account Status</span>
                <span
                  className="font-semibold"
                  style={{ color: client.status === 'Active' ? 'var(--success)' : 'var(--error)' }}
                >
                  {client.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span style={{ color: 'var(--text-muted)' }}>APIs Access</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                  {displayApis.length} API{displayApis.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
