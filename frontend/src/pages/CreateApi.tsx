import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, X, CheckCircle, AlertCircle, Plus, Trash2,
  Code2, Link2, FileJson,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/apiClient';

interface ApiHeaderField {
  key: string;
  value: string;
}

interface ApiFormData {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  headers: ApiHeaderField[];
  request_schema: string;
  response_schema: string;
  is_active: boolean;
}

const initialForm: ApiFormData = {
  name: '',
  description: '',
  endpoint: '',
  method: 'GET',
  headers: [{ key: 'Authorization', value: 'Bearer {api_key}' }],
  request_schema: '{\n  "type": "object",\n  "properties": {}\n}',
  response_schema: '{\n  "type": "object",\n  "properties": {}\n}',
  is_active: true,
};

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export const CreateApi: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<ApiFormData>(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof ApiFormData>(key: K, value: ApiFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const updateHeader = (index: number, key: keyof ApiHeaderField, value: string) => {
    if (!form) return;
    const newHeaders = [...form.headers];
    newHeaders[index] = { ...newHeaders[index], [key]: value };
    updateField('headers', newHeaders);
  };

  const addHeader = () => {
    if (!form) return;
    updateField('headers', [...form.headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    if (!form) return;
    const newHeaders = form.headers.filter((_, i) => i !== index);
    updateField('headers', newHeaders);
  };

  const validate = (): string => {
    if (!form) return 'Form not loaded';
    const name = form.name || '';
    const description = form.description || '';
    const endpoint = form.endpoint || '';
    if (!name.trim()) return 'API Name is required';
    if (!description.trim()) return 'Description is required';
    if (!endpoint.trim()) return 'Endpoint path is required';
    if (!endpoint.startsWith('/')) return 'Endpoint must start with /';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!form) return;

    setIsSubmitting(true);
    try {
      const requestSchema = form.request_schema ? JSON.parse(form.request_schema) : null;
      const responseSchema = form.response_schema ? JSON.parse(form.response_schema) : null;

      await api.createApiInfo({
        name: form.name.trim(),
        description: form.description.trim(),
        endpoint: form.endpoint.trim(),
        method: form.method,
        headers: form.headers.filter((h) => h.key.trim()),
        request_schema: requestSchema,
        response_schema: responseSchema,
        is_active: form.is_active,
      });

      setSuccess('API created successfully!');
      setForm(initialForm);
      setTimeout(() => navigate('/api-management'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = 'theme-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none';
  const labelStyle = { color: 'var(--text-secondary)' } as React.CSSProperties;
  const sectionStyle = { backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' } as React.CSSProperties;

  return (
    <div className="page-container py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/api-management')}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to APIs
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ===== 1. Basic Information ===== */}
        <div className="rounded-xl p-5 mb-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
              <Code2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Basic Information</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Name and description of your API</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-medium" style={labelStyle}>API Name <span style={{ color: 'var(--error)' }}>*</span></label>
              <input
                type="text"
                value={form?.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Vehicle Lookup"
                className={`${inputStyle} mt-1`}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="text-xs font-medium" style={labelStyle}>Description <span style={{ color: 'var(--error)' }}>*</span></label>
              <textarea
                value={form?.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe what this API does..."
                rows={2}
                className={`${inputStyle} mt-1 resize-none`}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ===== 2. Endpoint Configuration ===== */}
        <div className="rounded-xl p-5 mb-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
              <Link2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Endpoint Configuration</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Define the endpoint path, HTTP method, and headers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="text-xs font-medium" style={labelStyle}>Method</label>
              <select
                value={form?.method || 'GET'}
                onChange={(e) => updateField('method', e.target.value)}
                className={`${inputStyle} mt-1 font-mono`}
                disabled={isSubmitting}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-medium" style={labelStyle}>Endpoint Path <span style={{ color: 'var(--error)' }}>*</span></label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>/</span>
                  <input
                    type="text"
                    value={form?.endpoint || ''}
                    onChange={(e) => updateField('endpoint', e.target.value.startsWith('/') ? e.target.value : `/${e.target.value}`)}
                    placeholder="v1/vehicles/{vin}"
                    className={`${inputStyle} pl-6 font-mono`}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Headers */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={labelStyle}>Request Headers</label>
              <button
                type="button"
                onClick={addHeader}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
              >
                <Plus className="w-3 h-3" />
                Add Header
              </button>
            </div>

            <div className="space-y-2">
              {form?.headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    placeholder="Header name (e.g., Authorization)"
                    className={`${inputStyle} flex-1 font-mono`}
                    disabled={isSubmitting}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>:</span>
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    placeholder="Value (e.g., Bearer {api_key})"
                    className={`${inputStyle} flex-1 font-mono`}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(index)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--error)' }}
                    disabled={form.headers.length === 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 3. Schema Configuration ===== */}
        <div className="rounded-xl p-5 mb-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
              <FileJson className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Schema Configuration</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Define request and response schemas (JSON)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium" style={labelStyle}>Request Schema</label>
              <textarea
                value={form?.request_schema || ''}
                onChange={(e) => updateField('request_schema', e.target.value)}
                rows={8}
                spellCheck={false}
                className={`${inputStyle} mt-1 font-mono text-xs resize-none`}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="text-xs font-medium" style={labelStyle}>Response Schema</label>
              <textarea
                value={form?.response_schema || ''}
                onChange={(e) => updateField('response_schema', e.target.value)}
                rows={8}
                spellCheck={false}
                className={`${inputStyle} mt-1 font-mono text-xs resize-none`}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ===== 4. Status ===== */}
        <div className="rounded-xl p-5 mb-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-light)' }}>
              <CheckCircle className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>API Status</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Activate or deactivate this API</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_active"
                checked={form?.is_active || false}
                onChange={() => updateField('is_active', true)}
                className="w-4 h-4"
                style={{ accentColor: 'var(--success)' }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_active"
                checked={!form?.is_active}
                onChange={() => updateField('is_active', false)}
                className="w-4 h-4"
                style={{ accentColor: 'var(--error)' }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--error)' }}>Inactive</span>
            </label>
          </div>
        </div>

        {/* ===== Actions ===== */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/api-management')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)' }}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? 'Creating API...' : 'Create API'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateApi;