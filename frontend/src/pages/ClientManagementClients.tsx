import React, { useState, useEffect } from 'react';
import {
  Search, Users, ToggleLeft, ToggleRight,
  Eye, Trash2, Building2, Key, Save, ArrowLeft,
  CheckCircle, XCircle, Clock, AlertTriangle, X, Activity
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import clientService from '../services/clientService';
import type { ApiInfo } from '../types/client';
import type { Client, ClientApiAccess, RequestLimitFrequency, Currency } from '../types/client';

export const ClientManagementClients: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientApis, setClientApis] = useState<ClientApiAccess[]>([]);
  const [isLoadingApis, setIsLoadingApis] = useState(false);
  const [toast, setToast] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Client | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [editingApiKey, setEditingApiKey] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [assignApiName, setAssignApiName] = useState('');
  const [assignSuccessPrice, setAssignSuccessPrice] = useState(0.5);
  const [assignNotFoundPrice, setAssignNotFoundPrice] = useState(0.5);
  const [assignCurrency, setAssignCurrency] = useState<Currency>('INR');
  const [assignLimit, setAssignLimit] = useState(10000);
  const [assignFrequency, setAssignFrequency] = useState<RequestLimitFrequency>('Per Month');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [availableApis, setAvailableApis] = useState<ApiInfo[]>([]);
  const [togglingClientId, setTogglingClientId] = useState<string | null>(null);

  const currencies: Currency[] = ['INR'];

  const loadApis = async () => {
    try {
      const result = await api.getApiInfo();
      setAvailableApis((result.data as ApiInfo[]).filter((item) => item.is_active !== false));
    } catch (error) {
      console.error('Failed to load APIs:', error);
      setAvailableApis([]);
    }
  };

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const result = await clientService.getClientsAsync('admin');
      setClients(result);
    } catch (error) {
      console.error('Failed to load clients:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadClientApis = async (clientId: string) => {
    setIsLoadingApis(true);
    try {
      const result = await clientService.getClientApiAccessAsync(clientId, 'admin');
      setClientApis(result);
    } catch (error) {
      console.error('Failed to load client APIs:', error);
      setClientApis([]);
    } finally {
      setIsLoadingApis(false);
    }
  };

  const openClientDetails = async (client: Client) => {
    setSelectedClient(client);
    await Promise.all([loadClientApis(client.id), loadApis()]);
  };

  const handleToggleStatus = async (client: Client) => {
    if (togglingClientId === client.id) return; // Prevent double-click
    
    const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    setTogglingClientId(client.id);
    
    try {
      await clientService.updateStatus(client.id, newStatus);
      await loadClients();
      setToast(`Client ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully.`);
    } catch (error) {
      setToast('Failed to update client status.');
    } finally {
      setTogglingClientId(null);
    }
  };

  const handleSoftDelete = async (client: Client) => {
    await clientService.softDeleteClient(client.id);
    setShowDeleteConfirm(null);
    await loadClients();
    setToast('Client deleted successfully.');
  };

  const handleAssignApi = async () => {
    if (!selectedClient) return;
    const success = await clientService.assignApi(selectedClient.id, assignApiName, assignLimit, assignFrequency, assignSuccessPrice, assignCurrency, 'admin', assignSuccessPrice, assignNotFoundPrice);
    if (success) {
      setToast(`API ${assignApiName} assigned successfully.`);
      setShowAssignDialog(false);
      await Promise.all([
        loadClientApis(selectedClient.id),
        loadClients(),
        loadApis(),
      ]);
    } else {
      setToast('Failed to assign API. It may already be assigned.');
    }
  };

  const handleChangePassword = async () => {
    if (!selectedClient || !newPassword.trim()) return;
    if (newPassword.length < 8) {
      setToast('Password must be at least 8 characters');
      return;
    }
    const success = await clientService.resetClientPassword(selectedClient.id, newPassword);
    if (success) {
      setToast('Password changed successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
    } else {
      setToast('Failed to change password');
    }
  };

  const handleSaveApiKey = async () => {
    if (!editingClientId || !editingApiKey.trim()) return;
    const access = clientApis.find(a => a.client_id === editingClientId);
    if (access) {
      try {
        await api.updateApiAccess(access.id, { api_key: editingApiKey.trim() });
        if (selectedClient) await loadClientApis(selectedClient.id);
        setEditingClientId(null);
        setEditingApiKey('');
        setToast('API key updated successfully.');
      } catch {
        setToast('Failed to update API key.');
      }
    }
  };

  const handleUpdateApiAccess = (access: ClientApiAccess, updates: Partial<Pick<ClientApiAccess, 'request_limit' | 'limit_frequency' | 'status'>>) => {
    clientService.updateApiAccess(access.id, updates);
    if (selectedClient) loadClientApis(selectedClient.id);
    setToast('API configuration saved.');
  };

  const filteredClients = clients.filter((client) => {
    if (statusFilter !== 'All' && client.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      client.company_name.toLowerCase().includes(q) ||
      client.email.toLowerCase().includes(q) ||
      client.phone.includes(q)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'Active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  const ApiStatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
      'Active': { bg: 'var(--success-bg)', color: 'var(--success)', icon: CheckCircle, label: 'Active' },
      'Not Assigned': { bg: 'var(--card-inner)', color: 'var(--text-muted)', icon: XCircle, label: 'Not Assigned' },
      'Pending Approval': { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: Clock, label: 'Pending Approval' },
      'Suspended': { bg: 'var(--error-bg)', color: 'var(--error)', icon: AlertTriangle, label: 'Suspended' },
      'Expired': { bg: 'var(--error-bg)', color: 'var(--error)', icon: XCircle, label: 'Expired' },
    };
    const c = config[status] || config['Not Assigned'];
    const Icon = c.icon;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: c.bg, color: c.color }}>
        <Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  const unassignedApis = availableApis.filter(
    (api) => !clientApis.some((a) => a.api_name === api.name)
  );

  return (
    <div className="page-container py-6">
      {toast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--success)', color: 'var(--success)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {!selectedClient ? (
        <>
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by company name, email, or phone..."
                  className="theme-input w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                {(['All', 'Active', 'Inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                    style={{
                      backgroundColor: statusFilter === f ? 'var(--primary)' : 'transparent',
                      color: statusFilter === f ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-inner)' }}>
                <Users className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No clients found</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Try a different search or filter</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--card-inner)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Company Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Email</th>
                      <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Created Date</th>
                      <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                              {(client.company_name || client.username).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{client.company_name || '—'}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{client.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{client.email || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{client.phone || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(client.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openClientDetails(client)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--primary)' }} title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleToggleStatus(client)} 
                              disabled={togglingClientId === client.id}
                              className="p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                              style={{ color: client.status === 'Active' ? 'var(--success)' : 'var(--text-muted)' }} 
                              title={client.status === 'Active' ? 'Deactivate' : 'Activate'}
                            >
                              {togglingClientId === client.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : client.status === 'Active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setShowDeleteConfirm(client)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--error)' }} title="Delete">
                              <Trash2 className="w-4 h-4" />
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
        </>
      ) : (
        <div>
          <button
            onClick={() => { setSelectedClient(null); setClientApis([]); }}
            className="flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </button>
          <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {(selectedClient.company_name || selectedClient.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{selectedClient.company_name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{selectedClient.username}</p>
                </div>
              </div>
              <StatusBadge status={selectedClient.status} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Building2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                General Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Company Name</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedClient.company_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Address</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedClient.address || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>GSTIN</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedClient.gstin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>PAN</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedClient.pan || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Email</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedClient.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Phone</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedClient.phone || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Username</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{selectedClient.username}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Password</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>••••••••</p>
                      <button
                        onClick={() => setShowPasswordDialog(true)}
                        className="text-xs font-medium px-2 py-1 rounded"
                        style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Created Date</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(selectedClient.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Last Updated</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(selectedClient.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  API Management
                </h3>
                {unassignedApis.length > 0 && (
                  <button
                    onClick={() => { setAssignApiName(unassignedApis[0].name); setShowAssignDialog(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
                  >
                    <Key className="w-3.5 h-3.5" />
                    Assign API
                  </button>
                )}
              </div>

              {isLoadingApis ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
                </div>
              ) : availableApis.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No APIs available. Create APIs in API Management first.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableApis.map((api) => {
                    const access = clientApis.find((a) => a.api_name === api.name);
                    if (!access) {
                      return (
                        <div key={api.name} className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{api.name}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{api.description}</p>
                            </div>
                            <ApiStatusBadge status="Not Assigned" />
                          </div>
                          <button
                            onClick={() => { setAssignApiName(api.name); setShowAssignDialog(true); }}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            <Key className="w-3.5 h-3.5" />
                            Assign API
                          </button>
                        </div>
                      );
                    }

                    const usagePercent = access.request_limit > 0 ? Math.min(100, Math.round((access.current_usage / access.request_limit) * 100)) : 0;

                    return (
                      <div key={api.name} className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{api.name}</p>
                          <ApiStatusBadge status={access.status} />
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: 'var(--text-muted)' }}>API Key</span>
                              <button
                                onClick={() => {
                                  if (editingClientId === selectedClient.id) {
                                    setEditingClientId(null);
                                    setEditingApiKey('');
                                  } else {
                                    setEditingClientId(selectedClient.id);
                                    setEditingApiKey(access.api_key || '');
                                  }
                                }}
                                className="text-xs font-medium"
                                style={{ color: 'var(--primary)' }}
                              >
                                {editingClientId === selectedClient.id ? 'Cancel' : 'Edit'}
                              </button>
                            </div>
                            {editingClientId === selectedClient.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingApiKey}
                                  onChange={(e) => setEditingApiKey(e.target.value)}
                                  className="theme-input flex-1 px-2 py-1.5 rounded text-xs focus:outline-none"
                                  placeholder="Enter API key"
                                />
                                <button
                                  onClick={handleSaveApiKey}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: 'var(--primary)' }}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <code className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {showKey[access.id] ? access.api_key : '••••••••••••••••••••••••'}
                                </code>
                                <button onClick={() => setShowKey((prev) => ({ ...prev, [access.id]: !prev[access.id] }))} className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                                  {showKey[access.id] ? 'Hide' : 'Show'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--text-muted)' }}>Request Limit</span>
                          <input
                            type="number"
                            value={access.request_limit}
                            onChange={(e) => handleUpdateApiAccess(access, { request_limit: Number(e.target.value) })}
                            className="theme-input px-2 py-1 rounded text-xs focus:outline-none w-20 text-right"
                            min={1}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--text-muted)' }}>Frequency</span>
                          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{access.limit_frequency}</span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span style={{ color: 'var(--text-muted)' }}>Usage</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{access.current_usage.toLocaleString()} / {access.request_limit.toLocaleString()} ({usagePercent}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--card-inner)' }}>
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${usagePercent}%`,
                                backgroundColor: usagePercent > 80 ? 'var(--error)' : usagePercent > 50 ? 'var(--warning)' : 'var(--success)',
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateApiAccess(access, { status: access.status === 'Active' ? 'Suspended' : 'Active' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: access.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)', color: access.status === 'Active' ? 'var(--error)' : 'var(--success)' }}
                          >
                            {access.status === 'Active' ? 'Disable API' : 'Enable API'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Delete Client?</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{showDeleteConfirm.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteConfirm(null)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will deactivate the client account. The client will no longer be able to log in.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={() => handleSoftDelete(showDeleteConfirm)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--error)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowAssignDialog(false)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Key className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Assign API</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedClient?.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowAssignDialog(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>API</label>
                <select
                  value={assignApiName}
                  onChange={(e) => setAssignApiName(e.target.value)}
                  className="theme-input w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mt-1"
                >
                  {unassignedApis.map((api) => (
                    <option key={api.name} value={api.name}>{api.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Success Request Price</label>
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
                    className="theme-input flex-1 px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  />
                  <select
                    value={assignCurrency}
                    onChange={(e) => setAssignCurrency(e.target.value as Currency)}
                    className="theme-input px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Data Not Found Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={assignNotFoundPrice}
                  onChange={(e) => setAssignNotFoundPrice(Number(e.target.value))}
                  className="theme-input w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mt-1"
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Defaults to Success Price. Edit if needed.</p>
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Request Limit</label>
                <input
                  type="number"
                  value={assignLimit}
                  onChange={(e) => setAssignLimit(Number(e.target.value))}
                  min={1}
                  className="theme-input w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Duration</label>
                <select
                  value={assignFrequency}
                  onChange={(e) => setAssignFrequency(e.target.value as RequestLimitFrequency)}
                  className="theme-input w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mt-1"
                >
                  {(['Per Minute', 'Per Hour', 'Per Day', 'Per Month', 'Per Year'] as const).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Active
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignDialog(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleAssignApi} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                Assign API
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowPasswordDialog(false)} />
          <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Key className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedClient?.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowPasswordDialog(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="theme-input w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mt-1"
                  placeholder="Enter new password (min 8 characters)"
                  minLength={8}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Password must be at least 8 characters long</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowPasswordDialog(false); setNewPassword(''); }} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleChangePassword} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};