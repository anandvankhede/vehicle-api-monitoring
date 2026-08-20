import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Code2, Trash2, Edit, Search, Eye,
  CheckCircle, XCircle
} from 'lucide-react';
import { api } from '../services/apiClient';
import { ApiViewModal, type ApiInfoItem } from '../components/ApiViewModal';

export const ApiManagement: React.FC = () => {
  const navigate = useNavigate();
  const [apis, setApis] = useState<ApiInfoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [viewApi, setViewApi] = useState<ApiInfoItem | null>(null);

  const loadApis = async () => {
    setIsLoading(true);
    try {
      const result = await api.getApiInfo();
      setApis((result.data as ApiInfoItem[]) || []);
    } catch {
      setApis([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApis();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.deleteApiInfo(id);
      setToast(`${name} deleted successfully.`);
      loadApis();
    } catch {
      setToast('Failed to delete API.');
    }
  };

  const filteredApis = apis.filter((api) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      api.name.toLowerCase().includes(q) ||
      api.description.toLowerCase().includes(q) ||
      api.endpoint.toLowerCase().includes(q)
    );
  });

  const getMethodColor = (method: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      GET: { bg: 'var(--success-bg)', color: 'var(--success)' },
      POST: { bg: 'var(--primary-light)', color: 'var(--primary)' },
      PUT: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
      DELETE: { bg: 'var(--error-bg)', color: 'var(--error)' },
      PATCH: { bg: 'var(--info-bg)', color: 'var(--info)' },
    };
    return colors[method] || colors.GET;
  };

  return (
    <div className="page-container py-6">
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}

      {/* Header Actions */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search APIs by name, description, or endpoint..."
              className="theme-input w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={() => navigate('/api-management/create')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="w-4 h-4" />
            Create API
          </button>
        </div>
      </div>

      {/* API Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="theme-card p-4">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total APIs</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{apis.length}</div>
        </div>
        <div className="theme-card p-4">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Active APIs</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--success)' }}>{apis.filter((a) => a.is_active).length}</div>
        </div>
        <div className="theme-card p-4">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Inactive APIs</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--warning)' }}>{apis.filter((a) => !a.is_active).length}</div>
        </div>
      </div>

      {/* API List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      ) : filteredApis.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-inner)' }}>
            <Code2 className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No APIs found</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? 'Try a different search' : 'Create your first API to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate('/api-management/create')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create API
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApis.map((apiItem) => {
            const methodStyle = getMethodColor(apiItem.method);
            return (
              <div
                key={apiItem.id}
                className="rounded-xl p-4 transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                      style={{ backgroundColor: methodStyle.bg, color: methodStyle.color }}
                    >
                      {apiItem.method}
                    </span>
                    <code className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {apiItem.endpoint}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    {apiItem.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                        <CheckCircle className="w-2.5 h-2.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>
                        <XCircle className="w-2.5 h-2.5" />
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{apiItem.name}</h3>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{apiItem.description}</p>
                {apiItem.response_collection && (
                  <p className="text-[10px] mb-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                    Collection: {apiItem.response_collection}
                    {apiItem.response_db_status === 'live' ? ' · linked' : ' · pending'}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => setViewApi(apiItem)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}
                    title="View API details"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/api-management/edit/${apiItem.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(apiItem.id, apiItem.name)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View API Modal */}
      {viewApi && (
        <ApiViewModal
          open={!!viewApi}
          onClose={() => setViewApi(null)}
          api={viewApi}
        />
      )}
    </div>
  );
};

export default ApiManagement;
