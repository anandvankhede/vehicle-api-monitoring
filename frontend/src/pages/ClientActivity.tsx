import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Clock, Search, X, Eye, ArrowRight,
  Activity as ActivityIcon, FileText, Hourglass, CheckCheck, Key, Gauge, Copy,
} from 'lucide-react';
import { useClientAuth } from '../context/ClientAuthContext';
import clientService from '../services/clientService';
import { SummaryCard } from '../components/SummaryCard';
import type { ApiRequest, ApiRequestStatus, ClientApiAccess } from '../types/client';

type FilterType = 'All' | 'Pending Approval' | 'Approved';

export const ClientActivity: React.FC = () => {
  const { client, isAuthenticated } = useClientAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [accessRecords, setAccessRecords] = useState<ClientApiAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/client/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    if (!client) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const [requestsData, accessData] = await Promise.all([
        clientService.getClientApiRequestsAsync(client.id),
        clientService.getClientApiAccessAsync(client.id),
      ]);
      setRequests(
        requestsData.filter(
          (r) => r.status === 'Pending Approval' || r.status === 'Approved'
        )
      );
      setAccessRecords(accessData);
    } catch {
      setLoadError('Failed to load activity data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Summary counts derived from requests
  const summary = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'Pending Approval').length;
    const approved = requests.filter((r) => r.status === 'Approved').length;
    return { total, pending, approved };
  }, [requests]);

  // Filtered list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filter !== 'All' && r.status !== filter) return false;
      if (searchQuery.trim() && !r.api_name.toLowerCase().includes(searchQuery.toLowerCase().trim())) return false;
      return true;
    });
  }, [requests, filter, searchQuery]);

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const StatusBadge = ({ status }: { status: ApiRequestStatus }) => {
    const config: Partial<Record<ApiRequestStatus, { bg: string; color: string; icon: React.ElementType; label: string }>> = {
      'Pending Approval': { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: Clock, label: 'Pending Approval' },
      'Approved': { bg: 'var(--success-bg)', color: 'var(--success)', icon: CheckCircle, label: 'Approved' },
    };
    const c = config[status];
    if (!c) return null;
    const Icon = c.icon;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.color }}>
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    );
  };

  const filterButtons: FilterType[] = ['All', 'Pending Approval', 'Approved'];

  // Helper: get access record for an approved API
  const getAccessForApi = (apiName: string): ClientApiAccess | undefined => {
    return accessRecords.find((a) => a.api_name === apiName);
  };

  // Helper: short status message
  const getStatusMessage = (req: ApiRequest): string => {
    if (req.status === 'Pending Approval') return 'Request submitted, waiting for administrator approval.';
    if (req.status === 'Approved') return 'API access approved and now active on your account.';
    return '';
  };

  return (
    <div className="page-container py-6">
      {loadError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
          {loadError}
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          title="Total Requests"
          value={summary.total}
          icon={FileText}
          iconColor="primary"
          iconBg="primary-light"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Pending"
          value={summary.pending}
          icon={Hourglass}
          iconColor="warning"
          iconBg="warning-bg"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Approved"
          value={summary.approved}
          icon={CheckCheck}
          iconColor="success"
          iconBg="success-bg"
          isLoading={isLoading}
        />
      </div>

      {/* Filters & Search */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by API name..."
              className="theme-input w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
            {filterButtons.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 whitespace-nowrap"
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

      {/* API Request List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-inner)' }}>
            <ActivityIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No API requests found</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery || filter !== 'All' ? 'Try a different search or filter.' : 'Request access to APIs from the Services page.'}
          </p>
          {!searchQuery && filter === 'All' && (
            <button
              onClick={() => navigate('/client/services')}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              Browse Services
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl p-4 transition-all duration-200 hover:shadow-lg"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: API info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{request.api_name}</h3>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{getStatusMessage(request)}</p>
                  <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Requested: {formatDate(request.requested_at)}
                    </span>
                    {request.reviewed_at && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Updated: {formatDate(request.reviewed_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: View Details button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Drawer */}
      {selectedRequest && (
        <DetailsDrawer
          request={selectedRequest}
          access={getAccessForApi(selectedRequest.api_name)}
          onClose={() => setSelectedRequest(null)}
          onGoToServices={() => navigate('/client/services')}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          StatusBadge={StatusBadge}
        />
      )}
    </div>
  );
};

/* ============================================================
   Details Drawer Component
   ============================================================ */
interface DetailsDrawerProps {
  request: ApiRequest;
  access?: ClientApiAccess;
  onClose: () => void;
  onGoToServices: () => void;
  formatDate: (d: string) => string;
  formatDateTime: (d: string) => string;
  StatusBadge: React.FC<{ status: ApiRequestStatus }>;
}

const DetailsDrawer: React.FC<DetailsDrawerProps> = ({
  request, access, onClose, onGoToServices, formatDate, formatDateTime, StatusBadge,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyApiKey = async () => {
    if (!access?.api_key) return;
    try {
      await navigator.clipboard.writeText(access.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  // Timeline steps — only Pending Approval and Approved exist now
  const steps = [
    { label: 'Request Submitted', date: request.requested_at, done: true },
    { label: 'Under Review', date: null, done: request.status !== 'Pending Approval' },
    {
      label: request.status === 'Approved' ? 'Approved' : 'Pending Decision',
      date: request.reviewed_at || null,
      done: request.status === 'Approved',
    },
  ];

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="drawer-overlay absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="drawer-panel fixed right-0 top-0 h-full w-full max-w-md overflow-y-auto"
        style={{
          backgroundColor: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{request.api_name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Request Details</p>
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
          {/* Current Status */}
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

          {/* Admin Remarks */}
          {request.reason && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--info-bg)', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--info)' }}>Admin Remarks</span>
              <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{request.reason}</p>
            </div>
          )}

          {/* Status Timeline */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-3" style={{ color: 'var(--text-secondary)' }}>Status Timeline</span>
            <div className="space-y-0">
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                const isApproved = step.done && request.status === 'Approved';
                const dotColor = step.done
                  ? (isApproved ? 'var(--success)' : 'var(--primary)')
                  : 'var(--border-subtle)';
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor, border: '2px solid var(--card)' }} />
                      {!isLast && <div className="w-px flex-1 min-h-[24px]" style={{ backgroundColor: 'var(--border)' }} />}
                    </div>
                    <div className={`pb-3 ${isLast ? 'pb-0' : ''}`}>
                      <p className="text-xs font-semibold" style={{ color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.label}</p>
                      {step.date && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDateTime(step.date)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approved: API Key & Limit */}
          {request.status === 'Approved' && (
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--success)' }}>Access Granted</span>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</span>
                </div>
                {access?.api_key ? (
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copied!' : 'Copy Key'}
                  </button>
                ) : (
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Not assigned</span>
                )}
              </div>

              {access?.api_key && (
                <code className="block text-[10px] p-2 rounded break-all" style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
                  {access.api_key}
                </code>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit</span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {access ? `${access.request_limit.toLocaleString()} / ${access.limit_frequency}` : '—'}
                </span>
              </div>

              <button
                onClick={onGoToServices}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Go to Services
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};