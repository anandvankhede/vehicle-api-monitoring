import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Save, X, CheckCircle, AlertCircle,
  Copy, Eye, EyeOff, Pause, Play, Trash2,
  BarChart3, Building2, Key,
} from 'lucide-react';
import { api } from '../services/apiClient';
import type { ClientApiAccess, Client, Currency, ClientApiStatus, ApiRequest } from '../types/client';

interface ApiAccessWithClient extends ClientApiAccess {
  client?: Client;
}

export const ApiSubscriptionManagement: React.FC = () => {
  const [apiAccessList, setApiAccessList] = useState<ApiAccessWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [apiRequests, setApiRequests] = useState<number>(0);
  const [searchClient, setSearchClient] = useState('');
  const [searchApi, setSearchApi] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerAccess, setDrawerAccess] = useState<ApiAccessWithClient | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ApiAccessWithClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [clientsRes, accessRes, requestsRes] = await Promise.all([
        api.getClients(),
        api.getApiAccess(),
        api.getApiRequests(),
      ]);
      const allClients: Client[] = clientsRes.data;
      setClients(allClients);

      const allRequests = requestsRes.data;
      setApiRequests(allRequests.filter((r: ApiRequest) => r.status === 'Pending Approval').length);

      const allAccess: ApiAccessWithClient[] = [];
      accessRes.data.forEach((access: ClientApiAccess) => {
        const client = allClients.find((c: Client) => c.id === access.client_id);
        allAccess.push({ ...access, client: client });
      });
      setApiAccessList(allAccess);
    } catch (err) {
      console.error('Failed to load subscription data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrawerOpen = (access: ApiAccessWithClient) => {
    setDrawerAccess({ ...access });
    setShowKey(false);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setShowDrawer(false);
    setDrawerAccess(null);
    setShowKey(false);
  };

  const handleSave = async () => {
    if (!drawerAccess) return;

    const updates: Partial<ClientApiAccess> = {
      success_price_per_hit: drawerAccess.success_price_per_hit,
      not_found_price_per_hit: drawerAccess.not_found_price_per_hit,
      currency: drawerAccess.currency,
      status: drawerAccess.status,
    };

    try {
      await api.updateApiAccess(drawerAccess.id, updates);
      setToast({ message: 'Subscription updated successfully', type: 'success' });
      setShowDrawer(false);
      setDrawerAccess(null);
      await loadData();
    } catch {
      setToast({ message: 'Failed to update subscription', type: 'error' });
    }
  };

  const handleDeleteSubscription = async () => {
    if (!showDeleteConfirm) return;

    try {
      await api.deleteApiAccess(showDeleteConfirm.id);
      setToast({ message: 'API subscription deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      await loadData();
    } catch {
      setToast({ message: 'Failed to delete subscription', type: 'error' });
    }
  };

  const handleCopyKey = () => {
    if (!drawerAccess?.api_key) return;
    navigator.clipboard.writeText(drawerAccess.api_key);
    setToast({ message: 'API key copied to clipboard', type: 'success' });
  };

  const handleSuspendToggle = () => {
    if (!drawerAccess) return;
    const newStatus: ClientApiStatus = drawerAccess.status === 'Active' ? 'Suspended' : 'Active';
    setDrawerAccess({ ...drawerAccess, status: newStatus });
  };

  const filteredData = apiAccessList.filter((item) => {
    const matchesClient = searchClient.trim() === '' ||
      item.client?.company_name.toLowerCase().includes(searchClient.toLowerCase()) ||
      item.client?.email.toLowerCase().includes(searchClient.toLowerCase());
    const matchesApi = searchApi.trim() === '' ||
      item.api_name.toLowerCase().includes(searchApi.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesClient && matchesApi && matchesStatus;
  });

  const totalClients = clients.filter((c) => c.status === 'Active').length;
  const totalAssignedApis = apiAccessList.filter((a) => a.status !== 'Not Assigned').length;
  const totalHits = apiAccessList.reduce((sum, a) => sum + a.current_usage, 0);

  const formatCurrency = (amount: number, currency: Currency) => {
    const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
      Active: { bg: 'var(--success-bg)', color: 'var(--success)', icon: CheckCircle, label: 'Active' },
      Suspended: { bg: 'var(--error-bg)', color: 'var(--error)', icon: Pause, label: 'Inactive' },
      Expired: { bg: 'var(--error-bg)', color: 'var(--error)', icon: AlertCircle, label: 'Inactive' },
      'Not Assigned': { bg: 'var(--card-inner)', color: 'var(--text-muted)', icon: AlertCircle, label: 'Not Assigned' },
      'Pending Approval': { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: AlertCircle, label: 'Pending' },
    };
    const c = config[status] || config['Not Assigned'];
    const Icon = c.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: c.bg, color: c.color }}
      >
        <Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  return (
    <div className="page-container py-6">
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--success)' }} /> : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--error)' }} />}
          <span style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="theme-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Clients</div>
          </div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{totalClients}</div>
        </div>
        <div className="theme-card p-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Assigned APIs</div>
          </div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{totalAssignedApis}</div>
        </div>
        <div className="theme-card p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending API Requests</div>
          </div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--warning)' }}>{apiRequests}</div>
        </div>
        <div className="theme-card p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total API Hits</div>
          </div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--primary)' }}>{totalHits.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="theme-card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="relative">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Search Client</label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Company or email..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                className="theme-input w-full pl-8 pr-2 py-1.5 rounded text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="relative">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Search API</label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="API name..."
                value={searchApi}
                onChange={(e) => setSearchApi(e.target.value)}
                className="theme-input w-full pl-8 pr-2 py-1.5 rounded text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="theme-select w-full px-2 py-1.5 rounded text-sm mt-1 focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Inactive</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              onClick={() => {
                setSearchClient('');
                setSearchApi('');
                setStatusFilter('All');
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Filter className="w-3 h-3" />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="theme-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--card-inner)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>API</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Price Per Hit</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Request Limit</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Current Usage</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Expiry</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--border)' }}>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Loading subscriptions...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No API subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {(item.client?.company_name || item.client?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.client?.company_name || '—'}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.client?.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.api_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(item.success_price_per_hit, item.currency)}
                      <span style={{ color: 'var(--text-muted)' }}> / </span>
                      {formatCurrency(item.not_found_price_per_hit, item.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.request_limit.toLocaleString()} {item.limit_frequency.replace('Per ', '/')}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.current_usage.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.expiry_date ? formatDate(item.expiry_date) : '—'}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                     <td className="px-4 py-2.5">
                       <div className="flex items-center justify-end gap-2">
                         <button
                           onClick={() => handleDrawerOpen(item)}
                           className="px-2.5 py-1 rounded text-xs font-semibold"
                           style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                         >
                           Manage
                         </button>
                         <button
                           onClick={() => setShowDeleteConfirm(item)}
                           className="p-1.5 rounded text-xs"
                           style={{ color: 'var(--error)' }}
                           title="Delete Subscription"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                     </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--error-bg)' }}>
                  <Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Delete API Subscription?</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {showDeleteConfirm.client?.company_name} — {showDeleteConfirm.api_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDeleteConfirm(null)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will permanently remove this API subscription. The client will lose access to this API immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleDeleteSubscription} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--error)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Drawer */}
      {showDrawer && drawerAccess && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 drawer-overlay"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={handleDrawerClose}
          />
          <div
            className="fixed right-0 top-0 h-full w-full max-w-lg overflow-y-auto drawer-panel"
            style={{
              backgroundColor: 'var(--card)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
            }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Manage API Subscription</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {drawerAccess.client?.company_name} — {drawerAccess.api_name}
                </p>
              </div>
              <button onClick={handleDrawerClose} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Client & API Info */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Client Name</span>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{drawerAccess.client?.company_name || 'Unknown'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Name</span>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{drawerAccess.api_name}</p>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <select
                  value={drawerAccess.status}
                  onChange={(e) => setDrawerAccess({ ...drawerAccess, status: e.target.value as ClientApiStatus })}
                  className="theme-select w-full px-3 py-1.5 rounded text-sm mt-1 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Inactive</option>
                </select>
              </div>

              {/* API Key (read-only — profile-level) */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key (Profile)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code
                    className="flex-1 px-3 py-1.5 rounded text-xs font-mono break-all"
                    style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    {showKey ? drawerAccess.api_key : '••••••••••••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-xs font-medium"
                    style={{ color: 'var(--primary)' }}
                    title={showKey ? 'Hide' : 'Show'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Same key for all APIs. Manage in Client Management → API Access Profile.
                </p>
              </div>

              {/* Success Request Price */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Success Request Price</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={drawerAccess.success_price_per_hit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrawerAccess({ ...drawerAccess, success_price_per_hit: val, price_per_hit: val });
                    }}
                    className="theme-input flex-1 px-3 py-1.5 rounded text-sm focus:outline-none"
                  />
                  <span className="theme-select px-3 py-1.5 rounded text-sm focus:outline-none bg-gray-100 text-gray-600 font-medium">
                    INR
                  </span>
                </div>
              </div>

              {/* Not Found Price Per Hit */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Data Not Found Price</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={drawerAccess.not_found_price_per_hit}
                    onChange={(e) => setDrawerAccess({ ...drawerAccess, not_found_price_per_hit: Number(e.target.value) })}
                    className="theme-input flex-1 px-3 py-1.5 rounded text-sm focus:outline-none"
                  />
                  <span className="theme-select px-3 py-1.5 rounded text-sm focus:outline-none bg-gray-100 text-gray-600 font-medium">
                    INR
                  </span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Defaults to Success Price. Edit if needed.</p>
              </div>

              {/* Request Limit (read-only — profile-level) */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit (Profile)</label>
                <input
                  type="text"
                  value={`${drawerAccess.request_limit.toLocaleString()} / day`}
                  disabled
                  className="theme-input w-full px-3 py-1.5 rounded text-sm mt-1 focus:outline-none opacity-60"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Expiry Date</label>
                <input
                  type="date"
                  value={drawerAccess.expiry_date ? drawerAccess.expiry_date.split('T')[0] : ''}
                  onChange={(e) => setDrawerAccess({ ...drawerAccess, expiry_date: e.target.value || undefined })}
                  className="theme-input w-full px-3 py-1.5 rounded text-sm mt-1 focus:outline-none"
                />
              </div>

              {/* Current Usage */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Current Usage</label>
                <input
                  type="text"
                  value={`${drawerAccess.current_usage.toLocaleString()} / ${drawerAccess.request_limit.toLocaleString()} ${drawerAccess.limit_frequency.replace('Per ', '/')}`}
                  disabled
                  className="theme-input w-full px-3 py-1.5 rounded text-sm mt-1 focus:outline-none opacity-60"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 border-t px-5 py-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div className="flex gap-3">
                <button
                  onClick={handleDrawerClose}
                  className="flex-1 px-4 py-2 rounded text-sm font-semibold"
                  style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspendToggle}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-semibold"
                  style={{
                    backgroundColor: drawerAccess.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)',
                    color: drawerAccess.status === 'Active' ? 'var(--error)' : 'var(--success)',
                  }}
                >
                  {drawerAccess.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {drawerAccess.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiSubscriptionManagement;
