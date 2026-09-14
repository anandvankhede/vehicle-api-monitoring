export type RequestStatus = 'Pending' | 'Approved';

export type ApiRequestStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export type ActivityType = 'Company Registration' | 'API Request' | 'Profile Update';

export type ActivityStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Changes Required' | 'Pending Approval';

export type ClientAccountStatus = 'Pending' | 'Under Review' | 'Changes Required' | 'Approved' | 'Inactive';

export type ClientApiStatus = 'Not Assigned' | 'Pending Approval' | 'Active' | 'Suspended' | 'Expired';

export type RequestLimitFrequency = 'Per Minute' | 'Per Hour' | 'Per Day' | 'Per Month' | 'Per Year';

export type Currency = 'INR';

export interface ClientApiAccess {
  id: string;
  client_id: string;
  api_name: string;
  status: ClientApiStatus;
  api_key: string;
  price_per_hit: number;
  success_price_per_hit: number;
  not_found_price_per_hit: number;
  currency: Currency;
  request_limit: number;
  limit_frequency: RequestLimitFrequency;
  current_usage: number;
  expiry_date?: string;
  assigned_at: string;
  assigned_by: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface RegistrationRequest {
  id: string;
  client_id: string;
  company_name: string;
  email: string;
  phone: string;
  requested_apis: string[];
  submitted_date: string;
  status: 'Pending' | 'Approved' | 'Changes Required';
  reason?: string;
}

export interface ApiInfo {
  id?: string;
  name: string;
  description: string;
  category?: string;
  is_active?: boolean;
}

export interface ApiRequest {
  id: string;
  client_id: string;
  api_name: string;
  status: ApiRequestStatus;
  requested_at: string;
  reviewed_at?: string;
  reason?: string;
}

export interface ActivityRecord {
  id: string;
  client_id: string;
  type: ActivityType;
  title: string;
  status: ActivityStatus;
  message: string;
  date: string;
  reason?: string;
  api_name?: string;
  action?: 'Request Again' | 'Edit Company Details';
}

export interface Client {
  id: string;
  username: string;
  company_name: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  selected_apis: string[];
  comments: string;
  request_status: RequestStatus;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
  visible_password?: string;
  api_key?: string;
  request_limit?: number;
  current_usage?: number;
  api_profile_assigned_by?: string;
  api_profile_created_at?: string;
}

export interface ClientApiProfile {
  client_id: string;
  api_key: string;
  username: string;
  status: string;
  used: number;
  lifetimeUsed: number;
  limit_frequency: string;
  assigned_by: string;
  request_limit: number;
  api_list: string;
  redis_synced: boolean;
}

export interface ClientUser {
  id: string;
  client_id: string;
  username: string;
  password_hash: string;
  role: 'CLIENT';
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface ClientRegistrationData {
  company_name: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  username: string;
  password: string;
}

export interface ClientDetailsSubmission {
  company_name: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  selected_apis: string[];
  comments: string;
}

export interface ClientAuditEntry {
  id: string;
  client_id: string;
  action: string;
  details: string;
  admin_username: string;
  timestamp: string;
}

export interface ClientUsageSummary {
  api_name: string;
  total_hits: number;
  remaining_requests: number;
  current_usage: number;
  request_limit: number;
  usage_percent: number;
  total_cost: number;
  currency: Currency;
  price_per_hit: number;
}

export interface ClientBillingItem {
  api_name: string;
  total_hits: number;
  price_per_hit: number;
  total_cost: number;
  currency: Currency;
}

export interface ClientBillingSummary {
  monthly_cost: number;
  currency: Currency;
  items: ClientBillingItem[];
}

export const AVAILABLE_APIS: ApiInfo[] = [
  { name: 'vehicle_specs', description: 'Vehicle specifications and details API' },
  { name: 'vehicle_insurance', description: 'Vehicle insurance information API' },
  { name: 'vehicle_rc', description: 'Vehicle RC (Registration Certificate) verification API' },
  { name: 'vehicle_challan', description: 'Vehicle challan and traffic violations API' },
  { name: 'vehicle_owner', description: 'Vehicle owner details lookup API' },
];
