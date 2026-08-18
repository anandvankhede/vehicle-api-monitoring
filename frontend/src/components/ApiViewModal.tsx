import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Code2, Link2, FileJson, BookOpen, Copy, Download } from 'lucide-react';

export interface ApiInfoItem {
  id: string;
  name: string;
  description: string;
  category?: string;
  endpoint: string;
  method: string;
  headers: { key: string; value: string }[];
  request_schema?: Record<string, unknown>;
  response_schema?: Record<string, unknown>;
  is_active: boolean;
  pricing_success?: number;
  pricing_not_found?: number;
  currency?: string;
  documentation?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApiViewModalProps {
  open: boolean;
  onClose: () => void;
  api: ApiInfoItem;
}

const methodColors: Record<string, { bg: string; color: string }> = {
  GET: { bg: 'var(--success-bg)', color: 'var(--success)' },
  POST: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  PUT: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  DELETE: { bg: 'var(--error-bg)', color: 'var(--error)' },
  PATCH: { bg: 'var(--info-bg)', color: 'var(--info)' },
};

const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const value = amount ?? 0;
  const cur = currency || 'INR';
  return `${symbols[cur] || cur} ${value.toFixed(2)}`;
};

const formatDate = (iso: string | undefined) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const JSONDisplay: React.FC<{ label: string; data: unknown; icon?: React.ReactNode }> = ({
  label,
  data,
  icon,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.replace(/\s/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Download JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded transition-colors"
            style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <pre className="text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all" style={{ color: 'var(--text-secondary)' }}>
        {data ? JSON.stringify(data, null, 2) : 'No schema defined'}
      </pre>
    </div>
  );
};

export const ApiViewModal: React.FC<ApiViewModalProps> = ({ open, onClose, api }) => {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const methodStyle = methodColors[api.method] || methodColors.GET;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 modal-overlay"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden modal-content"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--primary-light)' }}>
              <Code2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                {api.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                  style={{ backgroundColor: methodStyle.bg, color: methodStyle.color }}
                >
                  {api.method}
                </span>
                <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                  {api.endpoint}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all duration-200 hover:scale-105 hover:rotate-90"
            style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Description
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {api.description || 'No description provided.'}
            </p>
          </div>

          {/* Basic Info + Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Basic Information
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>API Name</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{api.name}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Method</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                    style={{ backgroundColor: methodStyle.bg, color: methodStyle.color }}
                  >
                    {api.method}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Endpoint</span>
                  <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{api.endpoint}</code>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</span>
                  {api.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Pricing
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Success Price</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                    {formatCurrency(api.pricing_success, api.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not Found Price</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>
                    {formatCurrency(api.pricing_not_found, api.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Currency</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{api.currency || 'INR'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Request Headers */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Request Headers
            </h3>
            {api.headers && api.headers.length > 0 ? (
              <div className="space-y-1.5">
                {api.headers.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <code className="px-2 py-1 rounded font-mono" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--primary)' }}>
                      {h.key}
                    </code>
                    <span style={{ color: 'var(--text-muted)' }}>:</span>
                    <code className="px-2 py-1 rounded font-mono break-all" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                      {h.value}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No headers defined.</p>
            )}
          </div>

          {/* Schemas */}
          <div className="space-y-4">
            <JSONDisplay
              label="Request Schema"
              data={api.request_schema}
              icon={<FileJson className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
            />
            <JSONDisplay
              label="Response Schema"
              data={api.response_schema}
              icon={<FileJson className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />}
            />
          </div>

          {/* Documentation */}
          {api.documentation && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Documentation
              </h3>
              <a
                href={api.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium break-all"
                style={{ color: 'var(--primary)' }}
              >
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                {api.documentation}
              </a>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>ID:</span>
                <code className="font-mono" style={{ color: 'var(--text-secondary)' }}>{api.id}</code>
              </div>
              <div className="flex items-center gap-1">
                <Link2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(api.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Link2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Updated:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(api.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ApiViewModal;
