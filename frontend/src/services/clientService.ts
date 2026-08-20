import { api } from './apiClient';
import { setPortalToken, type PortalType } from '../utils/authStorage';
import type {
  Client,
  ClientRegistrationData,
  ClientDetailsSubmission,
  RequestStatus,
  ApiRequest,
  ActivityRecord,
  ApiInfo,
  ClientApiAccess,
  AuditLog,
  RegistrationRequest,
  RequestLimitFrequency,
  ClientUsageSummary,
  ClientBillingSummary,
  ClientAuditEntry,
  Currency,
} from '../types/client';

// ============================================================================
// SYNC DATA CACHE - holds data loaded from API for synchronous access
// ============================================================================
const syncCache = {
  clients: [] as Client[],
  apiRequests: [] as ApiRequest[],
  apiAccess: [] as ClientApiAccess[],
  auditLogs: [] as AuditLog[],
  registrationRequests: [] as RegistrationRequest[],
  activityRecords: [] as ActivityRecord[],
  loading: false,
};

const clientService = {
  // ============================================================================
  // SYNC FALLBACK METHODS (used by pages that call synchronously)
  // ============================================================================
  getAll(): Client[] {
    return syncCache.clients;
  },
  getAllClientApiAccess(): ClientApiAccess[] {
    return syncCache.apiAccess;
  },
  getAllApiRequests(): ApiRequest[] {
    return syncCache.apiRequests;
  },
  getClientApiRequests(clientId: string): ApiRequest[] {
    return syncCache.apiRequests.filter((r) => r.client_id === clientId);
  },
  getById(id: string): Client | undefined {
    return syncCache.clients.find((c) => c.id === id);
  },
  getClientApiAccess(clientId: string): ClientApiAccess[] {
    return syncCache.apiAccess.filter((a) => a.client_id === clientId);
  },
  getActiveApiCount(clientId: string): number {
    return syncCache.apiAccess.filter((a) => a.client_id === clientId && a.status === 'Active').length;
  },
  getCurrentMonthUsage(clientId: string): number {
    return syncCache.apiAccess
      .filter((a) => a.client_id === clientId)
      .reduce((sum, a) => sum + a.current_usage, 0);
  },
  getClientUsage(clientId: string): ClientUsageSummary[] {
    return this.getClientApiAccess(clientId).map((a) => ({
      api_name: a.api_name,
      total_hits: a.current_usage,
      remaining_requests: Math.max(0, a.request_limit - a.current_usage),
      current_usage: a.current_usage,
      request_limit: a.request_limit,
      usage_percent: a.request_limit > 0 ? Math.round((a.current_usage / a.request_limit) * 100) : 0,
      total_cost: a.current_usage * a.success_price_per_hit,
      currency: a.currency,
      price_per_hit: a.success_price_per_hit,
    }));
  },
  getClientBilling(clientId: string): ClientBillingSummary {
    const access = this.getClientApiAccess(clientId);
    return {
      monthly_cost: access.reduce((sum, a) => sum + (a.current_usage * a.success_price_per_hit), 0),
      currency: access[0]?.currency || 'INR',
      items: access.map((a) => ({
        api_name: a.api_name,
        total_hits: a.current_usage,
        price_per_hit: a.success_price_per_hit,
        total_cost: a.current_usage * a.success_price_per_hit,
        currency: a.currency,
      })),
    };
  },
  getClientAuditHistory(_clientId: string): ClientAuditEntry[] {
    return [];
  },
  getApiAccessById(accessId: string): ClientApiAccess | undefined {
    return syncCache.apiAccess.find((a) => a.id === accessId);
  },
  getAuditLogs(): AuditLog[] {
    return syncCache.auditLogs;
  },
  getRegistrationRequests(): RegistrationRequest[] {
    return syncCache.registrationRequests;
  },
  getClientActivity(_clientId: string): ActivityRecord[] {
    return [];
  },
  getClientApis(_clientId: string): { api: ApiInfo; status: 'Active' | 'Available' | 'Pending' }[] {
    return [];
  },
  async getClientApisAsync(clientId: string, portal: PortalType = 'client'): Promise<{ api: ApiInfo; status: 'Active' | 'Not Assigned' | 'Pending Approval' | 'Suspended' }[]> {
    const result = await api.getClientApis(clientId, portal);
    return result.data;
  },
  async getClientApiRequestsAsync(clientId: string, portal: PortalType = 'client'): Promise<ApiRequest[]> {
    const result = await api.getApiRequests({ client_id: clientId }, portal);
    return result.data;
  },
  isUsernameTaken(_username: string): boolean {
    return false;
  },
  generateApiKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  },

  // ============================================================================
  // ASYNC METHODS (fire-and-forget wrappers for sync methods)
  // ============================================================================

  /** Load all data into the sync cache */
  async loadAllData(): Promise<void> {
    if (syncCache.loading) return;
    syncCache.loading = true;
    try {
      const [clients, apiRequests, apiAccess, auditLogs] = await Promise.all([
        api.getClients('admin').catch(() => ({ data: [] as Client[], total: 0 })),
        api.getApiRequests(undefined, 'admin').catch(() => ({ data: [] as ApiRequest[], total: 0 })),
        api.getApiAccess(undefined, 'admin').catch(() => ({ data: [] as ClientApiAccess[], total: 0 })),
        api.getAuditLogs().catch(() => ({ data: [] as AuditLog[], total: 0 })),
      ]);
      syncCache.clients = clients.data;
      syncCache.apiRequests = apiRequests.data;
      syncCache.apiAccess = apiAccess.data;
      syncCache.auditLogs = auditLogs.data;
    } finally {
      syncCache.loading = false;
    }
  },

  async refreshClientData(_clientId: string): Promise<void> {
    await this.loadAllData();
  },

  async register(data: ClientRegistrationData): Promise<{ success: boolean; error?: string }> {
    try {
      await api.register(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  },

  async submitDetails(clientId: string, data: ClientDetailsSubmission): Promise<{ success: boolean; error?: string }> {
    try {
      await api.updateClient(clientId, data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit details' };
    }
  },

  updateRequestStatus(id: string, status: RequestStatus): boolean {
    api.approveApiRequest(id, { status }).then(
      () => {},
      () => {}
    );
    return true;
  },

  async requestApi(clientId: string, apiName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await api.createApiRequest({ client_id: clientId, api_name: apiName }, 'client');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit API request' };
    }
  },

  approveApiRequest(
    requestId: string,
    config: {
      price_per_hit: number;
      currency: Currency;
      request_limit: number;
      limit_frequency: RequestLimitFrequency;
      expiry_date?: string;
      status: 'Active' | 'Suspended';
    },
    _adminUsername: string = 'admin'
  ): boolean {
    api.approveApiRequest(requestId, config).then(
      () => {},
      () => {}
    );
    return true;
  },

  async authenticate(username: string, password: string): Promise<{ success: boolean; error?: string; client?: Client }> {
    try {
      const result = await api.clientLogin(username, password);
      setPortalToken('client', result.access_token);
      const client = await api.getCurrentClient().catch(() => ({
        id: result.client.client_id,
        username: result.client.username,
        company_name: result.client.company_name,
      } as Client));
      return { success: true, client };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Authentication failed' };
    }
  },

  async updateStatus(id: string, status: 'Active' | 'Inactive'): Promise<boolean> {
    try {
      if (status === 'Active') {
        await api.activateClient(id);
      } else {
        await api.deactivateClient(id);
      }
      return true;
    } catch {
      return false;
    }
  },

  async assignApi(
    clientId: string,
    apiName: string,
    requestLimit: number,
    frequency: RequestLimitFrequency,
    pricePerHit: number,
    currency: Currency,
    assignedBy: string = 'admin',
    successPrice?: number,
    notFoundPrice?: number
  ): Promise<boolean> {
    try {
      await api.assignApi({
        client_id: clientId,
        api_name: apiName,
        request_limit: requestLimit,
        limit_frequency: frequency,
        price_per_hit: successPrice ?? pricePerHit,
        success_price_per_hit: successPrice ?? pricePerHit,
        not_found_price_per_hit: notFoundPrice ?? pricePerHit,
        currency,
        assigned_by: assignedBy,
      });
      await this.loadAllData();
      return true;
    } catch {
      return false;
    }
  },

  async regenerateApiKey(accessId: string, _adminUsername: string = 'admin'): Promise<string | null> {
    try {
      const result = await api.regenerateApiKey(accessId);
      return result.api_key;
    } catch {
      return null;
    }
  },

  updateApiAccess(
    accessId: string,
    updates: Partial<Pick<ClientApiAccess, 'api_key' | 'request_limit' | 'limit_frequency' | 'status' | 'expiry_date' | 'price_per_hit' | 'currency' | 'success_price_per_hit' | 'not_found_price_per_hit'>>,
    _adminUsername: string = 'admin'
  ): boolean {
    api.updateApiAccess(accessId, updates).then(
      () => {
        // Update sync cache so sync reads reflect the change immediately
        const index = syncCache.apiAccess.findIndex((a) => a.id === accessId);
        if (index !== -1) {
          syncCache.apiAccess[index] = { ...syncCache.apiAccess[index], ...updates };
        }
      },
      () => {}
    );
    return true;
  },

  async addRegistrationRequest(clientId: string, companyName: string, email: string, phone: string, requestedApis: string[]): Promise<void> {
    try {
      await api.createRegistrationRequest({
        client_id: clientId,
        company_name: companyName,
        email,
        phone,
        requested_apis: requestedApis,
      });
    } catch {
    }
  },

  async updateRegistrationRequest(requestId: string, status: 'Approved' | 'Changes Required', reason?: string): Promise<boolean> {
    try {
      await api.updateRegistrationRequest(requestId, { status, reason });
      return true;
    } catch {
      return false;
    }
  },

  async addAuditLog(adminUsername: string, action: string, details: string): Promise<void> {
    try {
      await api.createAuditLog({ admin_username: adminUsername, action, details });
    } catch {
    }
  },

  async softDeleteClient(clientId: string): Promise<boolean> {
    try {
      await api.deleteClient(clientId);
      return true;
    } catch {
      return false;
    }
  },

  async resetClientPassword(clientId: string, newPassword: string): Promise<boolean> {
    try {
      await api.resetClientPassword(clientId, newPassword);
      return true;
    } catch {
      return false;
    }
  },

  // Aliases for the async versions (kept for backward compatibility)
  async getClientsAsync(portal?: PortalType): Promise<Client[]> {
    try {
      const result = await api.getClients(portal);
      return result.data;
    } catch {
      return [];
    }
  },
  async getApiRequestsAsync(params?: { skip?: number; limit?: number; status?: string; client_id?: string }): Promise<ApiRequest[]> {
    try {
      const result = await api.getApiRequests(params);
      return result.data;
    } catch {
      return [];
    }
  },
  async getClientByIdAsync(id: string): Promise<Client | undefined> {
    try {
      return await api.getClientById(id);
    } catch {
      return undefined;
    }
  },
  async getClientApiAccessAsync(clientId: string, portal?: PortalType): Promise<ClientApiAccess[]> {
    const result = await api.getClientApiAccess(clientId, portal);
    return result.data;
  },
  async refreshCurrentClient(): Promise<Client | null> {
    try {
      return await api.getCurrentClient();
    } catch {
      return null;
    }
  },
  async getAllClientApiAccessAsync(): Promise<ClientApiAccess[]> {
    try {
      const result = await api.getApiAccess();
      return result.data;
    } catch {
      return [];
    }
  },
};

export default clientService;