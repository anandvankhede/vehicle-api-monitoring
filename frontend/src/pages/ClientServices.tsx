import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Clock, Circle, Search, ExternalLink, Send,
  CheckCheck, X, Building2, Ban,
} from 'lucide-react';
import { useClientAuth } from '../context/ClientAuthContext';
import clientService from '../services/clientService';
import { api } from '../services/apiClient';
import ApiViewModal from '../components/ApiViewModal';
import type { ApiInfoItem } from '../components/ApiViewModal';
import type { ApiInfo, ClientApiAccess } from '../types/client';

type FilterType = 'All' | 'Active' | 'Available' | 'Pending' | 'Suspended';

interface ApiCardData {
  api: ApiInfo;
  status: 'Active' | 'Available' | 'Pending' | 'Suspended';
}

export const ClientServices: React.FC = () => {
  const { client, isAuthenticated } = useClientAuth();
  const navigate = useNavigate();

  const [apis, setApis] = useState<ApiCardData[]>([]);
  const [accessRecords, setAccessRecords] = useState<ClientApiAccess[]>([]);
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [requestApi, setRequestApi] = useState<ApiInfo | null>(null);
  const [viewingApi, setViewingApi] = useState<ApiInfoItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningApi, setIsOpeningApi] = useState(false);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/client/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loadApis = async () => {
    if (!client) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const [data, accessData] = await Promise.all([
        clientService.getClientApisAsync(client.id),
        clientService.getClientApiAccessAsync(client.id),
      ]);
      setAccessRecords(accessData);
      const mapped: ApiCardData[] = data.map((item) => ({
        api: item.api,
        status:
          item.status === 'Not Assigned' ? 'Available' :
          item.status === 'Pending Approval' ? 'Pending' :
          item.status === 'Suspended' ? 'Suspended' :
          item.status === 'Active' ? 'Active' : 'Available',
      }));
      setApis(mapped);
    } catch {
      setLoadError('Failed to load APIs. Please try again.');
      setApis([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  const handleRequestAccess = async () => {
    if (!requestApi) return;
    setIsSubmitting(true);
    try {
      const result = await clientService.requestApi(client.id, requestApi.name);
      if (result.success) {
        setToast('Your API request has been submitted successfully.');
        setRequestApi(null);
        loadApis();
      } else {
        setToast(result.error || 'Failed to submit request');
      }
    } catch {
      setToast('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApi = async (apiItem: ApiInfo) => {
    setIsOpeningApi(true);
    try {
      const access = accessRecords.find((a) => a.api_name === apiItem.name && a.status === 'Active');
      let detail: ApiInfoItem;
      if (apiItem.id) {
        detail = await api.getApiInfoById(apiItem.id) as ApiInfoItem;
      } else {
        const catalog = await api.getApiInfo() as { data: ApiInfoItem[] };
        const match = catalog.data.find((a) => a.name === apiItem.name);
        if (!match) throw new Error('API not found');
        detail = match;
      }
      const apiKey = access?.api_key || '{api_key}';
      setViewingApi({
        ...detail,
        headers: (detail.headers || []).map((h) => ({
          ...h,
          value: h.value.replace('{api_key}', apiKey),
        })),
      });
      if (!access) {
        setToast('API access not found. Request access first.');
      }
    } catch {
      setToast('Could not load API details.');
    } finally {
      setIsOpeningApi(false);
    }
  };

  const filteredApis = apis.filter((item) => {
    if (filter !== 'All' && item.status !== filter) return false;
    if (searchQuery.trim() && !item.api.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const StatusBadge = ({ status }: { status: ApiCardData['status'] }) => {
    if (status === 'Active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
          <CheckCircle className="w-3.5 h-3.5" />
          Active
        </span>
      );
    }
    if (status === 'Pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
          <Clock className="w-3.5 h-3.5" />
          Pending Approval
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>
          <Ban className="w-3.5 h-3.5" />
          Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-muted)' }}>
        <Circle className="w-3.5 h-3.5" />
        Available
      </span>
    );
  };

  const filterButtons: FilterType[] = ['All', 'Active', 'Available', 'Pending', 'Suspended'];

  return (
    <div className="page-container py-6">
      {loadError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
          {loadError}
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--success)', color: 'var(--success)' }}>
          <CheckCheck className="w-4 h-4 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search APIs..."
              className="theme-input w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
            {filterButtons.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                style={{
                  backgroundColor: filter === f ? 'var(--primary)' : 'transparent',
                  color: filter === f ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : filteredApis.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-inner)' }}>
            <Building2 className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No APIs found</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApis.map(({ api, status }) => (
            <div
              key={api.name}
              className="rounded-xl p-5 transition-all duration-200 hover:shadow-lg"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Building2 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <StatusBadge status={status} />
              </div>

              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{api.name}</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{api.description}</p>

              {status === 'Active' && (
                <button
                  onClick={() => handleOpenApi(api)}
                  disabled={isOpeningApi}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isOpeningApi ? 'Loading...' : 'Open API'}
                </button>
              )}

              {status === 'Available' && (
                <button
                  onClick={() => setRequestApi(api)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90"
                  style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  Request Access
                </button>
              )}

              {status === 'Pending' && (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-muted)' }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Request Submitted
                </button>
              )}

              {status === 'Suspended' && (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Access Suspended
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* API View Modal */}
      {viewingApi && (
        <ApiViewModal
          open={!!viewingApi}
          onClose={() => setViewingApi(null)}
          api={viewingApi}
        />
      )}

      {/* Confirmation Dialog */}
      {requestApi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setRequestApi(null)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Building2 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Request API Access</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{requestApi.name}</p>
                </div>
              </div>
              <button onClick={() => setRequestApi(null)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to request access to the {requestApi.name}?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRequestApi(null)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestAccess}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};