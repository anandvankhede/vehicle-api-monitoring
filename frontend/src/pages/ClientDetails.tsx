import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Building2, Key, BarChart3, Activity, Settings, Pause, Play, Copy, Eye, EyeOff, RefreshCw, Save, X, CheckCircle,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clientService from '../services/clientService';
import { api } from '../services/apiClient';
import type { Client, ClientApiAccess, Currency, ClientApiStatus, RequestLimitFrequency, ClientAuditEntry, ClientUsageSummary, ApiInfo } from '../types/client';

  const currencies: Currency[] = ['INR'];
const frequencyOptions: RequestLimitFrequency[] = ['Per Minute', 'Per Hour', 'Per Day', 'Per Month', 'Per Year'];

type TabType = 'General' | 'API Management' | 'Usage' | 'Activity' | 'Settings';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const ApiStatusBadge: React.FC<{ status: ClientApiStatus }> = ({ status }) => {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    Active: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'Active' },
    Suspended: { bg: 'var(--error-bg)', color: 'var(--error)', label: 'Inactive' },
    Expired: { bg: 'var(--error-bg)', color: 'var(--error)', label: 'Inactive' },
    'Not Assigned': { bg: 'var(--card-inner)', color: 'var(--text-muted)', label: 'Not Assigned' },
    'Pending Approval': { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Pending' },
  };
  const c = config[status] || config['Not Assigned'];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
};

const OverviewCards: React.FC<{ client: Client; refreshKey?: number }> = ({ client, refreshKey = 0 }) => {
  const [assignedApis, setAssignedApis] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [monthUsage, setMonthUsage] = useState(0);
  const [totalApiHits, setTotalApiHits] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [access, requests] = await Promise.all([
        clientService.getClientApiAccessAsync(client.id, 'admin'),
        clientService.getClientApiRequestsAsync(client.id, 'admin'),
      ]);
      if (cancelled) return;
      setAssignedApis(access.filter((a) => a.status === 'Active').length);
      setPendingRequests(requests.filter((r) => r.status === 'Pending Approval').length);
      setMonthUsage(access.reduce((sum, a) => sum + a.current_usage, 0));
      setTotalApiHits(access.reduce((sum, a) => sum + a.current_usage, 0));
    };
    load();
    return () => { cancelled = true; };
  }, [client.id, refreshKey]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="theme-card p-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Assigned APIs</div>
        <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{assignedApis}</div>
      </div>
      <div className="theme-card p-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending Requests</div>
        <div className="text-xl font-bold mt-1" style={{ color: 'var(--warning)' }}>{pendingRequests}</div>
      </div>
      <div className="theme-card p-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Monthly Usage</div>
        <div className="text-xl font-bold mt-1" style={{ color: 'var(--primary)' }}>{monthUsage.toLocaleString()}</div>
      </div>
      <div className="theme-card p-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total API Hits</div>
        <div className="text-xl font-bold mt-1" style={{ color: 'var(--success)' }}>{totalApiHits.toLocaleString()}</div>
      </div>
    </div>
  );
};

const GeneralTab: React.FC<{ client: Client }> = ({ client }) => {
  return (
    <div className="theme-card p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Company Name</span>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{client.company_name || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Username</span>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>@{client.username}</p>
        </div>
        <div className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Address</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{client.address || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>GSTIN</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{client.gstin || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>PAN</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{client.pan || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{client.email || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Phone</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{client.phone || '—'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{client.status}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Created Date</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(client.created_at)}</p>
        </div>
      </div>
    </div>
  );
};

const ApiManagementTab: React.FC<{ client: Client; setToast: (t: string) => void; onDataChange?: () => void }> = ({ client, setToast, onDataChange }) => {
  const [accessRecords, setAccessRecords] = useState<ClientApiAccess[]>([]);
  const [availableApis, setAvailableApis] = useState<ApiInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showManageDrawer, setShowManageDrawer] = useState(false);
  const [managedAccess, setManagedAccess] = useState<ClientApiAccess | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [assignApiName, setAssignApiName] = useState('');
  const [assignSuccessPrice, setAssignSuccessPrice] = useState(0.5);
  const [assignNotFoundPrice, setAssignNotFoundPrice] = useState(0.5);
  const [assignApiCurrency, setAssignApiCurrency] = useState<Currency>('INR');
  const [assignLimit, setAssignLimit] = useState(10000);
  const [assignFrequency, setAssignFrequency] = useState<RequestLimitFrequency>('Per Month');

  const loadAccess = async () => {
    setIsLoading(true);
    try {
      const [access, apiCatalog, requests] = await Promise.all([
        clientService.getClientApiAccessAsync(client.id, 'admin'),
        api.getApiInfo(),
        clientService.getClientApiRequestsAsync(client.id, 'admin'),
      ]);
      setAccessRecords(access);
      setAvailableApis((apiCatalog.data as ApiInfo[]).filter((item) => item.is_active !== false));
      setPendingApiNames(new Set(
        requests.filter((r) => r.status === 'Pending Approval').map((r) => r.api_name)
      ));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const unassignedApis = availableApis.filter(
    (apiItem) => !accessRecords.some((a) => a.api_name === apiItem.name)
  );

  const [pendingApiNames, setPendingApiNames] = useState<Set<string>>(new Set());

  const handleAssign = async () => {
    const success = await clientService.assignApi(
      client.id,
      assignApiName,
      assignLimit,
      assignFrequency,
      assignSuccessPrice,
      assignApiCurrency,
      'admin',
      assignSuccessPrice,
      assignNotFoundPrice
    );
    if (success) {
      setToast(`API ${assignApiName} assigned successfully.`);
      setShowAssignDialog(false);
      await loadAccess();
      onDataChange?.();
    } else {
      setToast('Failed to assign API. It may already be assigned.');
    }
  };

  const handleManageOpen = (access: ClientApiAccess) => {
    setManagedAccess({ ...access });
    setShowKey(false);
    setShowManageDrawer(true);
  };

  const handleDrawerClose = () => {
    setShowManageDrawer(false);
    setManagedAccess(null);
    setShowKey(false);
  };

  const handleDrawerSave = async () => {
    if (!managedAccess) return;
    clientService.updateApiAccess(managedAccess.id, {
      price_per_hit: managedAccess.success_price_per_hit,
      success_price_per_hit: managedAccess.success_price_per_hit,
      not_found_price_per_hit: managedAccess.not_found_price_per_hit,
      currency: managedAccess.currency,
      request_limit: managedAccess.request_limit,
      limit_frequency: managedAccess.limit_frequency,
      status: managedAccess.status,
      expiry_date: managedAccess.expiry_date,
    });
    setShowManageDrawer(false);
    setManagedAccess(null);
    await loadAccess();
    setToast('Subscription updated successfully.');
  };

  const handleRegenerateKey = async () => {
    if (!managedAccess) return;
    const newKey = await clientService.regenerateApiKey(managedAccess.id);
    if (newKey !== null) {
      setManagedAccess({ ...managedAccess, api_key: newKey });
      setShowKey(true);
      setToast('API key regenerated.');
    }
  };

  const handleCopyKey = () => {
    if (!managedAccess?.api_key) return;
    navigator.clipboard.writeText(managedAccess.api_key);
    setToast('API key copied to clipboard.');
  };

  const handleSuspendToggle = () => {
    if (!managedAccess) return;
    setManagedAccess({
      ...managedAccess,
      status: managedAccess.status === 'Active' ? 'Suspended' : 'Active',
    });
  };

  const handleTableSuspendToggle = async (access: ClientApiAccess) => {
    const newStatus = access.status === 'Active' ? 'Suspended' : 'Active';
    clientService.updateApiAccess(access.id, { status: newStatus });
    await loadAccess();
    setToast(`${access.api_name} ${newStatus === 'Active' ? 'enabled' : 'suspended'} successfully.`);
  };

  return (
    <div className="theme-card overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : (
        <>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Assigned APIs</h3>
        <div className="flex gap-2">
          {pendingApiNames.size > 0 && (
            <span className="text-xs" style={{ color: 'var(--warning)' }}>
              {pendingApiNames.size} pending approval
            </span>
          )}
          {unassignedApis.length > 0 && (
            <button
              onClick={() => setShowAssignDialog(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold"
              style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
            >
              <Key className="w-3 h-3" />
              Assign API
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--card-inner)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>API Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Request Limit</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Current Usage</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Expiry</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: 'var(--border)' }}>
            {accessRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No APIs assigned to this client yet.
                </td>
              </tr>
            ) : (
              accessRecords.map((access) => (
                <tr key={access.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{access.api_name}</td>
                  <td className="px-4 py-2.5"><ApiStatusBadge status={access.status} /></td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {access.request_limit.toLocaleString()} {access.limit_frequency.replace('Per ', '/')}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{access.current_usage.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{access.expiry_date ? formatDate(access.expiry_date) : 'Never'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleManageOpen(access)}
                        className="px-2.5 py-1 rounded text-xs font-semibold"
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                      >
                        Manage
                      </button>
                      {access.status === 'Active' ? (
                        <button
                          onClick={() => handleTableSuspendToggle(access)}
                          className="px-2.5 py-1 rounded text-xs font-semibold"
                          style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTableSuspendToggle(access)}
                          className="px-2.5 py-1 rounded text-xs font-semibold"
                          style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign API Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowAssignDialog(false)} />
          <div
            className="relative w-full max-w-lg rounded-xl p-6 modal-content"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px var(--border), 0 0 40px var(--modal-glow)' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Key className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Assign API</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{client.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowAssignDialog(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API</label>
                <select
                  value={assignApiName}
                  onChange={(e) => setAssignApiName(e.target.value)}
                  className="theme-select w-full px-3 py-2.5 rounded text-sm mt-1 focus:outline-none"
                >
                  <option value="">Select API</option>
                  {unassignedApis.map((api) => (
                    <option key={api.name} value={api.name}>{api.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Success Request Price</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={assignSuccessPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAssignSuccessPrice(val);
                      setAssignNotFoundPrice(val);
                    }}
                    className="theme-input flex-1 px-3 py-2.5 rounded text-sm focus:outline-none"
                  />
                  <select
                    value={assignApiCurrency}
                    onChange={(e) => setAssignApiCurrency(e.target.value as Currency)}
                    className="theme-select px-3 py-2.5 rounded text-sm focus:outline-none"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Data Not Found Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={assignNotFoundPrice}
                  onChange={(e) => setAssignNotFoundPrice(Number(e.target.value))}
                  className="theme-input w-full px-3 py-2.5 rounded text-sm mt-1 focus:outline-none"
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Defaults to Success Price. Edit if needed.</p>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    value={assignLimit}
                    onChange={(e) => setAssignLimit(Number(e.target.value))}
                    className="theme-input flex-1 px-3 py-2.5 rounded text-sm focus:outline-none"
                  />
                  <select
                    value={assignFrequency}
                    onChange={(e) => setAssignFrequency(e.target.value as RequestLimitFrequency)}
                    className="theme-select px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  >
                    {frequencyOptions.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignDialog(false)} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleAssign} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Assign API</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Drawer */}
      {showManageDrawer && managedAccess && (
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
                  {client.company_name} — {managedAccess.api_name}
                </p>
              </div>
              <button onClick={handleDrawerClose} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* API Name + Status */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Name</span>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{managedAccess.api_name}</p>
                </div>
                <ApiStatusBadge status={managedAccess.status} />
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                <div className="flex items-center gap-2 mt-1">
                  <code
                    className="flex-1 px-3 py-1.5 rounded text-xs font-mono break-all"
                    style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    {showKey ? managedAccess.api_key : '••••••••••••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}
                    title={showKey ? 'Hide' : 'Show'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card-inner)' }}
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRegenerateKey}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-bg)' }}
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Request Limit */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    value={managedAccess.request_limit}
                    onChange={(e) => setManagedAccess({ ...managedAccess, request_limit: Number(e.target.value) })}
                    className="theme-input flex-1 px-3 py-1.5 rounded text-sm focus:outline-none"
                  />
                  <select
                    value={managedAccess.limit_frequency}
                    onChange={(e) => setManagedAccess({ ...managedAccess, limit_frequency: e.target.value as RequestLimitFrequency })}
                    className="theme-select px-2 py-1.5 rounded text-sm focus:outline-none"
                  >
                    {frequencyOptions.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Current Usage */}
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Current Usage</label>
                <input
                  type="text"
                  value={`${managedAccess.current_usage.toLocaleString()} / ${managedAccess.request_limit.toLocaleString()} ${managedAccess.limit_frequency.replace('Per ', '/')}`}
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
                    backgroundColor: managedAccess.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)',
                    color: managedAccess.status === 'Active' ? 'var(--error)' : 'var(--success)',
                  }}
                >
                  {managedAccess.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {managedAccess.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={handleDrawerSave}
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
        </>
      )}
    </div>
  );
};

const UsageTab: React.FC<{ client: Client }> = ({ client }) => {
  const [usage, setUsage] = useState<ClientUsageSummary[]>([]);

  useEffect(() => {
    setUsage(clientService.getClientUsage(client.id));
  }, [client.id]);

  if (usage.length === 0) {
    return (
      <div className="theme-card p-8 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No usage data</h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Assign APIs to this client to see usage</p>
      </div>
    );
  }

  return (
    <div className="theme-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--card-inner)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>API</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Hits Used</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Remaining</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Usage %</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: 'var(--border)' }}>
            {usage.map((u) => (
              <tr key={u.api_name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{u.api_name}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{u.total_hits.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{u.remaining_requests.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.usage_percent}%</span>
                    <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: 'var(--card-inner)' }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${u.usage_percent}%`,
                          backgroundColor: u.usage_percent > 80 ? 'var(--error)' : u.usage_percent > 50 ? 'var(--warning)' : 'var(--success)',
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ActivityTab: React.FC<{ client: Client }> = ({ client }) => {
  const [audit, setAudit] = useState<ClientAuditEntry[]>([]);

  useEffect(() => {
    setAudit(clientService.getClientAuditHistory(client.id));
  }, [client.id]);

  if (audit.length === 0) {
    return (
      <div className="theme-card p-8 text-center">
        <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No activity history</h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Administrative actions will appear here</p>
      </div>
    );
  }

  return (
    <div className="theme-card overflow-hidden">
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {audit.map((entry) => (
          <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)' }}>
              <Activity className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.action}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{entry.details}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {formatDateTime(entry.timestamp)} · by {entry.admin_username}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsTab: React.FC<{ client: Client; setToast: (t: string) => void; navigate: (path: string) => void }> = ({ client, setToast, navigate }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleToggleStatus = () => {
    const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    clientService.updateStatus(client.id, newStatus);
    setToast(`Client ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully.`);
    setTimeout(() => window.location.reload(), 500);
  };

  const handleSoftDelete = () => {
    clientService.softDeleteClient(client.id);
    setShowDeleteConfirm(false);
    setToast('Client deleted successfully.');
    setTimeout(() => navigate('/client-management/clients'), 500);
  };

  const handleResetPassword = () => {
    if (!newPassword.trim()) return;
    clientService.resetClientPassword(client.id, newPassword);
    setShowResetPassword(false);
    setNewPassword('');
    setToast('Password reset successfully.');
  };

  return (
    <div className="space-y-4">
      {/* Account Status */}
      <div className="theme-card p-5 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Account Status</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {client.status === 'Active' ? 'Client account is currently active' : 'Client account is currently deactivated'}
          </p>
        </div>
        <button
          onClick={handleToggleStatus}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold"
          style={{
            backgroundColor: client.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)',
            color: client.status === 'Active' ? 'var(--error)' : 'var(--success)',
          }}
        >
          {client.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {client.status === 'Active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {/* Reset Password */}
      <div className="theme-card p-5 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Reset Password</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Set a new password for this client</p>
        </div>
        <button
          onClick={() => setShowResetPassword(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold"
          style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
        >
          <Key className="w-3.5 h-3.5" />
          Reset Password
        </button>
      </div>

      {/* Delete Client */}
      <div className="theme-card p-5 flex items-center justify-between" style={{ border: '1px solid var(--error)' }}>
        <div>
          <h4 className="text-sm font-bold" style={{ color: 'var(--error)' }}>Delete Client</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Soft delete — deactivates the account permanently</p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--error)' }}
        >
          <X className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--error-bg)' }}>
                  <X className="w-5 h-5" style={{ color: 'var(--error)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Delete Client?</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{client.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will deactivate the client account. The client will no longer be able to log in.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleSoftDelete} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--error)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {showResetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowResetPassword(false)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                <Key className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Reset Password</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{client.company_name}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password..."
                className="theme-input w-full px-3 py-2.5 rounded text-sm mt-1 focus:outline-none"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowResetPassword(false)} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleResetPassword} className="flex-1 px-4 py-2.5 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'General';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const c = await clientService.getClientByIdAsync(clientId);
        if (!c) {
          navigate('/client-management/clients');
          return;
        }
        setClient(c);
        await clientService.loadAllData();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [clientId, navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const tabs: { name: TabType; icon: React.ElementType }[] = [
    { name: 'General', icon: Building2 },
    { name: 'API Management', icon: Key },
    { name: 'Usage', icon: BarChart3 },
    { name: 'Activity', icon: Activity },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <div className="page-container py-6">
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg"
          style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)' }}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate('/client-management/clients')}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>
      </div>

      {/* Client Header */}
      <div className="theme-card px-5 py-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              {(client.company_name || client.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{client.company_name}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {client.id}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: client.status === 'Active' ? 'var(--success-bg)' : 'var(--error-bg)', color: client.status === 'Active' ? 'var(--success)' : 'var(--error)' }}>{client.status === 'Active' ? 'Active' : 'Inactive'}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>Email:</span>
            <span>{client.email || '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
            <span>{client.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>Created:</span>
            <span>{formatDate(client.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>Last Login:</span>
            <span style={{ color: 'var(--text-muted)' }}>Never logged in</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="mt-3 flex gap-2">
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold"
            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
          >
            Edit Client
          </button>
          <button
            onClick={() => {
              const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
              clientService.updateStatus(client.id, newStatus);
              setTimeout(() => window.location.reload(), 500);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold"
            style={{
              backgroundColor: client.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)',
              color: client.status === 'Active' ? 'var(--error)' : 'var(--success)',
            }}
          >
            {client.status === 'Active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {client.status === 'Active' ? 'Suspend Client' : 'Activate Client'}
          </button>
          <button
            onClick={() => {
              const newPassword = prompt('Enter new password for this client:');
              if (newPassword && newPassword.trim()) {
                clientService.resetClientPassword(client.id, newPassword.trim());
                setToast('Password reset successfully.');
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold"
            style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Key className="w-3 h-3" />
            Reset Password
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <OverviewCards client={client} refreshKey={dataRefreshKey} />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg overflow-x-auto mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.name}
              onClick={() => { setActiveTab(tab.name); setSearchParams({ tab: tab.name }); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: activeTab === tab.name ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.name ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'General' && <GeneralTab client={client} />}
      {activeTab === 'API Management' && (
        <ApiManagementTab
          client={client}
          setToast={setToast}
          onDataChange={() => setDataRefreshKey((key) => key + 1)}
        />
      )}
      {activeTab === 'Usage' && <UsageTab client={client} />}
      {activeTab === 'Activity' && <ActivityTab client={client} />}
      {activeTab === 'Settings' && <SettingsTab client={client} setToast={setToast} navigate={navigate} />}
    </div>
  );
};

export default ClientDetails;
