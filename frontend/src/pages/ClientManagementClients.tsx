import React, { useState, useEffect } from 'react';
import {
  Search, Users, ToggleLeft, ToggleRight,
  Eye, EyeOff, Trash2, Building2, Key, Save, ArrowLeft,
  CheckCircle, XCircle, Clock, AlertTriangle, X, Activity, Pencil, UserPlus,
  Mail, Phone, CreditCard, FileText, User, Lock,
} from 'lucide-react';
import {
  GSTIN_FORMAT_EXAMPLE,
  PAN_FORMAT_EXAMPLE,
  validateClientRegistration,
  type ClientRegistrationForm,
} from '../utils/clientRegistrationValidation';
import { Navigate, useLocation } from 'react-router-dom';
import { invalidateCache } from '../services/dashboardCache';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import clientService from '../services/clientService';
import type { ApiInfo } from '../types/client';
import type { Client, ClientApiAccess, ClientApiProfile, Currency, ClientApiStatus } from '../types/client';

type ApiAccessEditDraft = {
  status: ClientApiStatus;
  success_price_per_hit: number;
  not_found_price_per_hit: number;
};

const ProfileStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
    <p className="text-sm font-semibold mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>{value}</p>
  </div>
);

const EMPTY_REGISTER_FORM: ClientRegistrationForm = {
  company_name: '', username: '', password: '', confirm_password: '',
  email: '', phone: '', address: '', gstin: '', pan: '',
};

const CLIENT_LIST_PATHS = new Set(['/client-management', '/client-management/clients']);

export const ClientManagementClients: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

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
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ApiAccessEditDraft | null>(null);
  const [assignApiName, setAssignApiName] = useState('');
  const [assignSuccessPrice, setAssignSuccessPrice] = useState(0.5);
  const [assignNotFoundPrice, setAssignNotFoundPrice] = useState(0.5);
  const [assignCurrency, setAssignCurrency] = useState<Currency>('INR');
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [availableApis, setAvailableApis] = useState<ApiInfo[]>([]);
  const [togglingClientId, setTogglingClientId] = useState<string | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerForm, setRegisterForm] = useState<ClientRegistrationForm>(EMPTY_REGISTER_FORM);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [registerGeneralError, setRegisterGeneralError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [profileRequestLimit, setProfileRequestLimit] = useState(10000);
  const [editProfileLimit, setEditProfileLimit] = useState(10000);
  const [editApiKey, setEditApiKey] = useState('');
  const [apiProfile, setApiProfile] = useState<ClientApiProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isUpdatingProfileLimit, setIsUpdatingProfileLimit] = useState(false);
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [isUpdatingProfileStatus, setIsUpdatingProfileStatus] = useState(false);

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

  const loadClients = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setIsLoading(true);
    try {
      const result = await clientService.getClientsAsync('admin');
      setClients(result);
      return result;
    } catch (error) {
      console.error('Failed to load clients:', error);
      return null;
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!CLIENT_LIST_PATHS.has(location.pathname)) return;
    loadClients();
  }, [location.pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && CLIENT_LIST_PATHS.has(location.pathname)) {
        loadClients({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [location.pathname]);

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

  const refreshSelectedClient = async (clientId: string) => {
    const updated = await clientService.getClientByIdAsync(clientId);
    if (updated) {
      setSelectedClient(updated);
    }
    await loadClientProfile(clientId);
  };

  const loadClientProfile = async (clientId: string) => {
    setIsLoadingProfile(true);
    try {
      const profile = await clientService.getClientApiProfile(clientId);
      setApiProfile(profile);
      if (profile) {
        setEditApiKey(profile.api_key);
        setEditProfileLimit(profile.request_limit);
      } else {
        setEditApiKey('');
        setEditProfileLimit(10000);
      }
    } catch {
      setApiProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const openClientDetails = async (client: Client) => {
    cancelEditingAccess();
    setShowApiKey(false);
    setApiProfile(null);
    const fresh = await clientService.getClientByIdAsync(client.id);
    const active = fresh || client;
    setSelectedClient(active);
    setEditProfileLimit(active.request_limit ?? 10000);
    await Promise.all([
      loadClientApis(client.id),
      loadApis(),
      active.api_key ? loadClientProfile(client.id) : Promise.resolve(),
    ]);
  };

  const openRegisterDialog = () => {
    setRegisterForm(EMPTY_REGISTER_FORM);
    setRegisterErrors({});
    setRegisterGeneralError('');
    setShowRegisterPassword(false);
    setShowRegisterConfirmPassword(false);
    setShowRegisterDialog(true);
  };

  const closeRegisterDialog = () => {
    setShowRegisterDialog(false);
    setRegisterErrors({});
    setRegisterGeneralError('');
    setShowRegisterPassword(false);
    setShowRegisterConfirmPassword(false);
  };

  const updateRegisterField = (field: keyof ClientRegistrationForm, value: string) => {
    setRegisterForm((f) => ({ ...f, [field]: value }));
    if (registerErrors[field] || registerGeneralError) {
      setRegisterErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setRegisterGeneralError('');
    }
  };

  const handleRegisterClient = async () => {
    const fieldErrors = validateClientRegistration(registerForm, { requireConfirmPassword: true });
    if (Object.keys(fieldErrors).length > 0) {
      setRegisterErrors(fieldErrors);
      setRegisterGeneralError('Please fix the highlighted fields below.');
      return;
    }

    const { company_name, username, password, email, phone, address, gstin, pan } = registerForm;
    setIsRegistering(true);
    setRegisterErrors({});
    setRegisterGeneralError('');
    try {
      const created = await clientService.createClientAdmin({
        company_name: company_name.trim(),
        username: username.trim().toLowerCase(),
        password,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
      });
      setClients((prev) => [
        created,
        ...prev.filter((c) => c.id !== created.id),
      ]);
      setSelectedClient(null);
      invalidateCache('bootstrap');
      invalidateCache('users');
      setToast('Client registered successfully.');
      closeRegisterDialog();
      setRegisterForm(EMPTY_REGISTER_FORM);
      await Promise.all([
        loadClients({ silent: true }),
        clientService.loadAllData(),
      ]);
    } catch (err) {
      setRegisterGeneralError(err instanceof Error ? err.message : 'Failed to register client.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCreateApiProfile = async () => {
    if (!selectedClient || profileRequestLimit < 1) return;
    setIsCreatingProfile(true);
    try {
      await clientService.createClientApiProfile(selectedClient.id, profileRequestLimit);
      await refreshSelectedClient(selectedClient.id);
      await loadClients();
      setToast('API key created and saved to Redis.');
    } catch {
      setToast('Failed to create API profile.');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleUpdateApiProfileLimit = async () => {
    if (!selectedClient || editProfileLimit < 1) return;
    setIsUpdatingProfileLimit(true);
    try {
      const profile = await clientService.updateClientApiProfile(selectedClient.id, {
        request_limit: editProfileLimit,
      });
      setApiProfile(profile);
      setEditProfileLimit(profile.request_limit);
      await refreshSelectedClient(selectedClient.id);
      setToast('Request limit updated in MongoDB and Redis.');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to update request limit.');
    } finally {
      setIsUpdatingProfileLimit(false);
    }
  };

  const profileStatus = apiProfile?.status?.toLowerCase() ?? '';
  const isProfileActive = profileStatus === 'active';

  const handleToggleProfileStatus = async () => {
    if (!selectedClient) return;
    const newStatus = isProfileActive ? 'inactive' : 'active';
    setIsUpdatingProfileStatus(true);
    try {
      const profile = await clientService.updateClientApiProfile(selectedClient.id, {
        status: newStatus,
      });
      setApiProfile(profile);
      await refreshSelectedClient(selectedClient.id);
      setToast(`API profile ${newStatus === 'active' ? 'activated' : 'deactivated'} in Redis.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to update profile status.');
    } finally {
      setIsUpdatingProfileStatus(false);
    }
  };

  const handleUpdateApiKey = async () => {
    if (!selectedClient || !editApiKey.trim()) return;
    if (editApiKey.trim().length < 16) {
      setToast('API key must be at least 16 characters.');
      return;
    }
    setIsUpdatingApiKey(true);
    try {
      const profile = await clientService.updateClientApiProfile(selectedClient.id, {
        api_key: editApiKey.trim(),
      });
      setApiProfile(profile);
      setEditApiKey(profile.api_key);
      await refreshSelectedClient(selectedClient.id);
      await loadClientApis(selectedClient.id);
      setToast('API key updated in MongoDB and Redis.');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to update API key.');
    } finally {
      setIsUpdatingApiKey(false);
    }
  };

  const handleToggleStatus = async (client: Client) => {
    if (togglingClientId === client.id) return; // Prevent double-click
    
    const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    setTogglingClientId(client.id);
    
    try {
      await clientService.updateStatus(client.id, newStatus);
      await loadClients();
      setToast(`Client ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully.`);
    } catch {
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

  const openAssignDialog = async (apiName: string) => {
    if (!selectedClient?.api_key) return;
    if (selectedClient) {
      await loadClientApis(selectedClient.id);
    }
    setAssignApiName(apiName);
    setShowAssignDialog(true);
  };

  const handleAssignApi = async () => {
    if (!selectedClient || !assignApiName) return;
    if (clientApis.some((a) => a.api_name === assignApiName)) {
      setToast(`API ${assignApiName} is already assigned to this client.`);
      setShowAssignDialog(false);
      return;
    }
    const result = await clientService.assignApi(
      selectedClient.id,
      assignApiName,
      assignSuccessPrice,
      assignCurrency,
      'admin',
      assignSuccessPrice,
      assignNotFoundPrice,
    );
    if (result.success) {
      setToast(
        result.alreadyAssigned
          ? `API ${assignApiName} is already assigned — list updated.`
          : `API ${assignApiName} assigned successfully.`,
      );
      setShowAssignDialog(false);
      await Promise.all([
        loadClientApis(selectedClient.id),
        loadClients(),
        loadApis(),
      ]);
    } else {
      setToast(result.error ?? 'Failed to assign API.');
      await loadClientApis(selectedClient.id);
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
      const updated = await clientService.getClientByIdAsync(selectedClient.id);
      if (updated) setSelectedClient(updated);
      setToast('Password changed successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
      setShowNewPassword(false);
    } else {
      setToast('Failed to change password');
    }
  };

  const startEditingAccess = (access: ClientApiAccess) => {
    setEditingAccessId(access.id);
    setEditDraft({
      status: access.status,
      success_price_per_hit: access.success_price_per_hit,
      not_found_price_per_hit: access.not_found_price_per_hit,
    });
  };

  const cancelEditingAccess = () => {
    setEditingAccessId(null);
    setEditDraft(null);
  };

  const handleSaveAccessEdit = async () => {
    if (!editingAccessId || !editDraft) return;
    try {
      const updates = {
        success_price_per_hit: editDraft.success_price_per_hit,
        not_found_price_per_hit: editDraft.not_found_price_per_hit,
        price_per_hit: editDraft.success_price_per_hit,
        status: editDraft.status,
      };
      await api.updateApiAccess(editingAccessId, updates);
      setClientApis((prev) =>
        prev.map((a) => (a.id === editingAccessId ? { ...a, ...updates } : a))
      );
      cancelEditingAccess();
      setToast('API configuration saved.');
    } catch {
      setToast('Failed to save API configuration.');
    }
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

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

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
              <button
                type="button"
                onClick={openRegisterDialog}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <UserPlus className="w-4 h-4" />
                Register Client
              </button>
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
            onClick={() => {
              cancelEditingAccess();
              setSelectedClient(null);
              setClientApis([]);
              loadClients({ silent: true });
            }}
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
                      <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                        {selectedClient.visible_password
                          ? (showClientPassword ? selectedClient.visible_password : '••••••••')
                          : 'Not available — use Change to set'}
                      </p>
                      {selectedClient.visible_password && (
                        <button
                          type="button"
                          onClick={() => setShowClientPassword((v) => !v)}
                          className="p-1 rounded"
                          style={{ color: 'var(--primary)' }}
                          title={showClientPassword ? 'Hide password' : 'Show password'}
                        >
                          {showClientPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
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

            <div className="rounded-xl p-5 h-full" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Key className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                API Access Profile
                {apiProfile?.redis_synced && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                    Redis synced
                  </span>
                )}
              </h3>

              {!selectedClient.api_key ? (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Create a universal API key and daily request limit. Profile is stored in Redis with an empty API list until APIs are assigned.
                  </p>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Daily Request Limit (Per Day)</label>
                    <input
                      type="number"
                      min={1}
                      value={profileRequestLimit}
                      onChange={(e) => setProfileRequestLimit(Number(e.target.value))}
                      className="theme-input w-full px-3 py-2 rounded-lg text-sm mt-1 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateApiProfile}
                    disabled={isCreatingProfile}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--primary)', opacity: isCreatingProfile ? 0.7 : 1 }}
                  >
                    <Key className="w-4 h-4" />
                    {isCreatingProfile ? 'Creating...' : 'Create API Key'}
                  </button>
                </div>
              ) : isLoadingProfile ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <ProfileStat label="client_id" value={apiProfile?.client_id || selectedClient.id} />
                    <ProfileStat label="username" value={apiProfile?.username || selectedClient.username} />
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>status</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span
                          className="text-sm font-semibold capitalize"
                          style={{
                            color: profileStatus === 'inactive'
                              ? 'var(--error)'
                              : profileStatus === 'active'
                                ? 'var(--success)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {profileStatus || '—'}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleProfileStatus}
                          disabled={isUpdatingProfileStatus}
                          className="px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap disabled:opacity-50"
                          style={{
                            backgroundColor: isProfileActive ? 'var(--error-bg)' : 'var(--success-bg)',
                            color: isProfileActive ? 'var(--error)' : 'var(--success)',
                          }}
                        >
                          {isUpdatingProfileStatus
                            ? 'Updating...'
                            : isProfileActive
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      </div>
                    </div>
                    <ProfileStat label="used" value={(apiProfile?.used ?? 0).toLocaleString()} />
                    <ProfileStat label="lifetimeUsed" value={(apiProfile?.lifetimeUsed ?? 0).toLocaleString()} />
                    <ProfileStat label="limit_frequency" value={apiProfile?.limit_frequency || 'Per Day'} />
                    <ProfileStat label="assigned_by" value={apiProfile?.assigned_by || 'admin'} />
                    <ProfileStat label="request_limit" value={(apiProfile?.request_limit ?? editProfileLimit).toLocaleString()} />
                    <ProfileStat
                      label="api_list (Redis)"
                      value={apiProfile?.api_list || '—'}
                    />
                  </div>

                  <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={editApiKey}
                            onChange={(e) => setEditApiKey(e.target.value)}
                            className="theme-input w-full px-3 py-2.5 pr-10 rounded-lg text-xs font-mono focus:outline-none"
                            placeholder="Enter API key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleUpdateApiKey}
                          disabled={isUpdatingApiKey || editApiKey.trim() === apiProfile?.api_key}
                          className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          {isUpdatingApiKey ? 'Updating...' : 'Update Key'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Request Limit (Per Day)</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="number"
                          min={1}
                          value={editProfileLimit}
                          onChange={(e) => setEditProfileLimit(Number(e.target.value))}
                          className="theme-input flex-1 px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateApiProfileLimit}
                          disabled={isUpdatingProfileLimit || editProfileLimit === apiProfile?.request_limit}
                          className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          {isUpdatingProfileLimit ? 'Updating...' : 'Update Limit'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl p-5 lg:col-span-2" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  API Management
                </h3>
                {unassignedApis.length > 0 && selectedClient.api_key && (
                  <button
                    onClick={() => openAssignDialog(unassignedApis[0].name)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
                  >
                    <Key className="w-3.5 h-3.5" />
                    Assign API
                  </button>
                )}
              </div>
              {!selectedClient.api_key && (
                <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  Create an API Access Profile above before assigning APIs.
                </p>
              )}

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
                            onClick={() => openAssignDialog(api.name)}
                            disabled={!selectedClient.api_key}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            <Key className="w-3.5 h-3.5" />
                            Assign API
                          </button>
                        </div>
                      );
                    }

                    const isEditing = editingAccessId === access.id;

                    return (
                      <div key={api.name} className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{api.name}</p>
                          <div className="flex items-center gap-2">
                            <ApiStatusBadge status={isEditing && editDraft ? editDraft.status : access.status} />
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => startEditingAccess(access)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing && editDraft ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Success Price</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={editDraft.success_price_per_hit}
                                  onChange={(e) => setEditDraft({ ...editDraft, success_price_per_hit: Number(e.target.value) })}
                                  className="theme-input w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Not Found Price</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={editDraft.not_found_price_per_hit}
                                  onChange={(e) => setEditDraft({ ...editDraft, not_found_price_per_hit: Number(e.target.value) })}
                                  className="theme-input w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>API Status</label>
                              <button
                                type="button"
                                onClick={() => setEditDraft({
                                  ...editDraft,
                                  status: editDraft.status === 'Active' ? 'Suspended' : 'Active',
                                })}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                                style={{
                                  backgroundColor: editDraft.status === 'Active' ? 'var(--error-bg)' : 'var(--success-bg)',
                                  color: editDraft.status === 'Active' ? 'var(--error)' : 'var(--success)',
                                }}
                              >
                                {editDraft.status === 'Active' ? 'Disable API' : 'Enable API'}
                              </button>
                            </div>

                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              API key and request limits are managed in the API Access Profile above.
                            </p>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={cancelEditingAccess}
                                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold"
                                style={{ backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveAccessEdit}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                <Save className="w-3.5 h-3.5" />
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5 text-xs">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <div>
                                <span className="block font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Success Price</span>
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {access.success_price_per_hit} {access.currency}
                                </span>
                              </div>
                              <div>
                                <span className="block font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Not Found Price</span>
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {access.not_found_price_per_hit} {access.currency}
                                </span>
                              </div>
                            </div>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              Uses the universal API key from API Access Profile.
                            </p>
                          </div>
                        )}
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

      {showRegisterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeRegisterDialog} />
          <div className="relative w-full max-w-lg rounded-xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <UserPlus className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Register Client</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Create a new client account (admin)</p>
                </div>
              </div>
              <button onClick={closeRegisterDialog} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {registerGeneralError && (
              <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{registerGeneralError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Company Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <Building2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Company Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Company Name <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      value={registerForm.company_name}
                      onChange={(e) => updateRegisterField('company_name', e.target.value)}
                      placeholder="Enter company name"
                      className="theme-input w-full px-3 py-2 rounded-lg text-sm mt-1 focus:outline-none"
                      style={registerErrors.company_name ? { borderColor: 'var(--error)' } : undefined}
                    />
                    {registerErrors.company_name && <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.company_name}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Phone <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="tel"
                        value={registerForm.phone}
                        onChange={(e) => updateRegisterField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        maxLength={10}
                        className="theme-input w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={registerErrors.phone ? { borderColor: 'var(--error)' } : undefined}
                      />
                    </div>
                    {registerErrors.phone
                      ? <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.phone}</p>
                      : <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>10-digit Indian mobile (starts with 6–9)</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Address <span style={{ color: 'var(--error)' }}>*</span></label>
                  <textarea
                    value={registerForm.address}
                    onChange={(e) => updateRegisterField('address', e.target.value)}
                    placeholder="Enter company address"
                    rows={2}
                    className="theme-input w-full px-3 py-2 rounded-lg text-sm mt-1 focus:outline-none resize-none"
                    style={registerErrors.address ? { borderColor: 'var(--error)' } : undefined}
                  />
                  {registerErrors.address && <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.address}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>GSTIN <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div className="relative mt-1">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        value={registerForm.gstin}
                        onChange={(e) => updateRegisterField('gstin', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
                        placeholder={GSTIN_FORMAT_EXAMPLE}
                        maxLength={15}
                        className="theme-input w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={registerErrors.gstin ? { borderColor: 'var(--error)' } : undefined}
                      />
                    </div>
                    {registerErrors.gstin
                      ? <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.gstin}</p>
                      : <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Format: 2-digit state + PAN + entity + Z + checksum</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>PAN <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div className="relative mt-1">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        value={registerForm.pan}
                        onChange={(e) => updateRegisterField('pan', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10))}
                        placeholder={PAN_FORMAT_EXAMPLE}
                        maxLength={10}
                        className="theme-input w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={registerErrors.pan ? { borderColor: 'var(--error)' } : undefined}
                      />
                    </div>
                    {registerErrors.pan
                      ? <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.pan}</p>
                      : <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Format: 5 letters + 4 digits + 1 letter</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Email <span style={{ color: 'var(--error)' }}>*</span></label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => updateRegisterField('email', e.target.value)}
                      placeholder="company@example.com"
                      className="theme-input w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={registerErrors.email ? { borderColor: 'var(--error)' } : undefined}
                    />
                  </div>
                  {registerErrors.email && <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.email}</p>}
                </div>
              </div>

              {/* User Credentials */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>User Credentials</span>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Username <span style={{ color: 'var(--error)' }}>*</span></label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      value={registerForm.username}
                      onChange={(e) => updateRegisterField('username', e.target.value)}
                      placeholder="Choose a username (min 3 chars)"
                      className="theme-input w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={registerErrors.username ? { borderColor: 'var(--error)' } : undefined}
                    />
                  </div>
                  {registerErrors.username
                    ? <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.username}</p>
                    : <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Letters, numbers, . _ - only</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Password <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(e) => updateRegisterField('password', e.target.value)}
                        placeholder="Min 8 characters"
                        className="theme-input w-full pl-9 pr-10 py-2 rounded-lg text-sm focus:outline-none"
                        style={registerErrors.password ? { borderColor: 'var(--error)' } : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                        tabIndex={-1}
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {registerErrors.password && <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.password}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Confirm Password <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        value={registerForm.confirm_password ?? ''}
                        onChange={(e) => updateRegisterField('confirm_password', e.target.value)}
                        placeholder="Re-enter password"
                        className="theme-input w-full pl-9 pr-10 py-2 rounded-lg text-sm focus:outline-none"
                        style={registerErrors.confirm_password ? { borderColor: 'var(--error)' } : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                        tabIndex={-1}
                      >
                        {showRegisterConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {registerErrors.confirm_password && <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>{registerErrors.confirm_password}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeRegisterDialog} disabled={isRegistering} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={handleRegisterClient}
                disabled={isRegistering}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)', opacity: isRegistering ? 0.7 : 1 }}
              >
                {isRegistering ? 'Registering...' : 'Register'}
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

              <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-muted)' }}>
                Uses the client&apos;s universal API key and daily request limit from API Access Profile
                ({(apiProfile?.request_limit ?? editProfileLimit).toLocaleString()} / day).
              </p>

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
                <div className="relative mt-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="theme-input w-full px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none"
                    placeholder="Enter new password (min 8 characters)"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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