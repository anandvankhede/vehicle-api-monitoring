import React, { useState, useEffect } from 'react';
import {
  Search, Clock, CheckCircle, XCircle, Eye, X,
  Key, Activity, Building2, Mail, Phone,
  RefreshCw, DollarSign, Gauge, ShieldCheck
} from 'lucide-react';
import clientService from '../services/clientService';
import type { ApiRequest, Currency, RequestLimitFrequency } from '../types/client';

export const ClientManagementApiRequests: React.FC = () => {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending Approval' | 'Approved' | 'Rejected'>('Pending Approval');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Modals
  const [viewingRequest, setViewingRequest] = useState<ApiRequest | null>(null);

  // Assign API Configuration form state
  const [configApiKey, setConfigApiKey] = useState('');
  const [configSuccessPrice, setConfigSuccessPrice] = useState(0.75);
  const [configNotFoundPrice, setConfigNotFoundPrice] = useState(0.75);
  const [configCurrency, setConfigCurrency] = useState<Currency>('INR');
  const [configRequestLimit, setConfigRequestLimit] = useState(10000);
  const [configFrequency, setConfigFrequency] = useState<RequestLimitFrequency>('Per Day');
  const [configStatus, setConfigStatus] = useState<'Active' | 'Suspended'>('Active');

  const currencies: Currency[] = ['INR'];
  const frequencyOptions: RequestLimitFrequency[] = ['Per Minute', 'Per Hour', 'Per Day', 'Per Month', 'Per Year'];

  const loadRequests = async () => {
    setIsLoading(true);
    // Load all data from the backend into the sync cache
    await clientService.loadAllData();
    setRequests(clientService.getAllApiRequests());
    const clientMap: Record<string, string> = {};
    clientService.getAll().forEach((c) => {
      clientMap[c.id] = c.company_name || c.username;
    });
    setClients(clientMap);
    setIsLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Auto-refresh every 15 seconds so new client requests appear automatically
  useEffect(() => {
    const interval = setInterval(loadRequests, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getClientName = (clientId: string) => {
    const client = clientService.getById(clientId);
    return client ? client.company_name : clients[clientId] || 'Unknown';
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
      'Pending Approval': { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: Clock, label: 'Pending' },
      'Approved': { bg: 'var(--success-bg)', color: 'var(--success)', icon: CheckCircle, label: 'Approved' },
      'Rejected': { bg: 'var(--error-bg)', color: 'var(--error)', icon: XCircle, label: 'Rejected' },
    };
    const c = config[status] || config['Pending Approval'];
    const Icon = c.icon;
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.color }}>
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    );
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const clientName = clients[r.client_id] || '';
    return (
      r.api_name.toLowerCase().includes(q) ||
      clientName.toLowerCase().includes(q)
    );
  });

  const openViewModal = (request: ApiRequest) => {
    setViewingRequest(request);
    // Pre-populate config when opening a pending request
    if (request.status === 'Pending Approval') {
      setConfigApiKey(clientService.generateApiKey());
      setConfigSuccessPrice(0.75);
      setConfigNotFoundPrice(0.75);
      setConfigCurrency('INR');
      setConfigRequestLimit(10000);
      setConfigFrequency('Per Day');
      setConfigStatus('Active');
    }
  };

  const handleRegenerateKey = () => {
    setConfigApiKey(clientService.generateApiKey());
  };

  const handleApproveAndAssign = () => {
    if (!viewingRequest) return;

    const config = {
      price_per_hit: configSuccessPrice,
      success_price_per_hit: configSuccessPrice,
      not_found_price_per_hit: configNotFoundPrice,
      currency: configCurrency,
      request_limit: configRequestLimit,
      limit_frequency: configFrequency,
      status: configStatus,
    };

    const success = clientService.approveApiRequest(viewingRequest.id, config);
    if (success) {
      setToast(`API ${viewingRequest.api_name} approved and assigned to ${getClientName(viewingRequest.client_id)}.`);
      setViewingRequest(null);
      loadRequests();
    } else {
      setToast('Failed to approve and assign API. The API may already be assigned to this client.');
    }
  };

  const closeViewModal = () => {
    setViewingRequest(null);
  };

  const StatusFilterButtons: React.FC = () => {
    const filters: Array<'All' | 'Pending Approval' | 'Approved' | 'Rejected'> = ['All', 'Pending Approval', 'Approved', 'Rejected'];
    return (
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 whitespace-nowrap"
            style={{
              backgroundColor: statusFilter === f ? 'var(--primary)' : 'transparent',
              color: statusFilter === f ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            {f === 'Pending Approval' ? 'Pending' : f}
          </button>
        ))}
      </div>
    );
  };

  // ===== ACCESS DETAILS SUB-VIEW (for approved requests) =====
  const AccessDetailsSubView: React.FC<{ clientId: string; apiName: string }> = ({ clientId, apiName }) => {
    const accessRecords = clientService.getClientApiAccess(clientId);
    const access = accessRecords.find((a) => a.api_name === apiName);
    if (!access) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No access record found.</p>;

    const formatCurrency = (amount: number, currency: string) => {
      const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
      return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    };
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Key</span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{access.api_key?.substring(0, 12)}••••</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Success Price</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(access.success_price_per_hit, access.currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Not Found Price</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(access.not_found_price_per_hit, access.currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Request Limit</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{access.request_limit.toLocaleString()} / {access.limit_frequency}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Current Usage</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{access.current_usage.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  // ===== VIEW REQUEST DRAWER (with inline config for pending requests) =====
  const ViewRequestDrawer: React.FC<{
    request: ApiRequest;
    onClose: () => void;
    onApprove: () => void;
  }> = ({ request, onClose, onApprove }) => {
    const client = clientService.getById(request.client_id);
    const companyName = client?.company_name || 'Unknown';
    const email = client?.email || '—';
    const phone = client?.phone || '—';
    const isPending = request.status === 'Pending Approval';

    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={onClose}
        />
        <div
          className="fixed right-0 top-0 h-full w-full max-w-lg overflow-y-auto"
          style={{
            backgroundColor: 'var(--card)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{request.api_name} — Request Details</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>API Request Review</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors hover:scale-105"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-5">
            {/* Status Badge */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Current Status</span>
              <StatusBadge status={request.status} />
            </div>

            {/* Key Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-secondary)' }}>Request Date</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(request.requested_at)}</span>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-secondary)' }}>Last Updated</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {request.reviewed_at ? formatDateTime(request.reviewed_at) : '—'}
                </span>
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Company Information</h3>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Company Name</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{companyName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Phone</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{phone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Requested API */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Requested API</h3>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Name</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{request.api_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Requested Date</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(request.requested_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Remarks (if rejected) */}
            {request.status === 'Rejected' && request.reason && (
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--error)' }}>Rejection Reason</span>
                <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{request.reason}</p>
              </div>
            )}

            {/* Already-approved access info */}
            {request.status === 'Approved' && (
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--success)' }}>Access Granted</span>
                <AccessDetailsSubView clientId={request.client_id} apiName={request.api_name} />
              </div>
            )}

            {/* ===== INLINE CONFIGURATION (for pending requests) ===== */}
            {isPending && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                    <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>API Configuration</h3>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Set pricing, limits, and access details</p>
                  </div>
                </div>

                <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                  {/* API Key with Regenerate */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono break-all" style={{ backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {configApiKey}
                      </code>
                      <button
                        onClick={handleRegenerateKey}
                        className="p-2 rounded-lg transition-all hover:opacity-90"
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                        title="Regenerate Key"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Each API gets its own unique key for this client.</p>
                  </div>

                  {/* Success Request Price + Currency */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Success Request Price</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={configSuccessPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfigSuccessPrice(val);
                            setConfigNotFoundPrice(val);
                          }}
                          className="theme-input w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                        />
                      </div>
                      <select
                        value={configCurrency}
                        onChange={(e) => setConfigCurrency(e.target.value as Currency)}
                        className="theme-input px-2.5 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Data Not Found Price */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Data Not Found Price</label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={configNotFoundPrice}
                        onChange={(e) => setConfigNotFoundPrice(Number(e.target.value))}
                        className="theme-input w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Defaults to Success Price. Edit if needed.</p>
                  </div>

                  {/* Request Limit + Frequency */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative flex-1">
                        <Gauge className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="number"
                          min="1"
                          value={configRequestLimit}
                          onChange={(e) => setConfigRequestLimit(Math.max(1, Number(e.target.value)))}
                          className="theme-input w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                        />
                      </div>
                      <select
                        value={configFrequency}
                        onChange={(e) => setConfigFrequency(e.target.value as RequestLimitFrequency)}
                        className="theme-input px-2.5 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
                    <div className="flex gap-4 mt-2">
                      {(['Active', 'Suspended'] as const).map((s) => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="configStatus"
                            checked={configStatus === s}
                            onChange={() => setConfigStatus(s)}
                            className="w-4 h-4"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 border-t px-5 py-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              {isPending && (
                <button
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Assign
                </button>
              )}
              {request.status === 'Rejected' && (
                <button
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Key className="w-4 h-4" />
                  Re-assign API
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container py-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--success)', color: 'var(--success)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company or API name..."
              className="theme-input w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <StatusFilterButtons />
        </div>
      </div>

      {/* Requests Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-inner)' }}>
            <Activity className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No API requests found</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {statusFilter === 'All'
              ? 'API requests from clients will appear here'
              : `No ${statusFilter === 'Pending Approval' ? 'pending' : statusFilter.toLowerCase()} API requests found`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--card-inner)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Company</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Requested API</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Requested Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {(clients[request.client_id] || '?').charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{clients[request.client_id] || 'Unknown'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {request.api_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(request.requested_at)}</td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openViewModal(request)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Request Drawer */}
      {viewingRequest && (
        <ViewRequestDrawer
          request={viewingRequest}
          onClose={closeViewModal}
          onApprove={handleApproveAndAssign}
        />
      )}
    </div>
  );
};