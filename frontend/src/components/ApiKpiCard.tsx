import React from 'react';
import {
  Car,
  CreditCard,
  ShieldCheck,
  Wrench,
  DollarSign,
  Key,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';
import type { UserApiStats } from '../types/dashboard';

interface ApiKpiCardProps {
  stats: UserApiStats;
  isLoading?: boolean;
}

export const ApiKpiCard: React.FC<ApiKpiCardProps> = ({ stats, isLoading = false }) => {
  // Select API category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vehicle':
        return Car;
      case 'garage':
        return Wrench;
      case 'payment':
        return CreditCard;
      case 'insurance':
        return ShieldCheck;
      case 'valuation':
        return DollarSign;
      case 'auth':
      default:
        return Key;
    }
  };

  const IconComponent = getCategoryIcon(stats.category);

  // Status Badge
  const getStatusBadge = (status: UserApiStats['status']) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' }}>
            <AlertTriangle className="w-2.5 h-2.5" />
            Degraded
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)' }}>
            <XCircle className="w-2.5 h-2.5" />
            Down
          </span>
        );
    }
  };

  // Success rate percentage calculation
  const successRate = stats.totalHits > 0 ? ((stats.success / stats.totalHits) * 100).toFixed(1) : '100';

  if (isLoading) {
    return (
      <div className="rounded-lg p-3 animate-pulse border space-y-2" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center">
          <div className="h-3 rounded w-1/3" style={{ backgroundColor: 'var(--border)' }} />
          <div className="h-3 rounded w-12" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-8 rounded" style={{ backgroundColor: 'var(--border)' }} />
          <div className="h-8 rounded" style={{ backgroundColor: 'var(--border)' }} />
          <div className="h-8 rounded" style={{ backgroundColor: 'var(--border)' }} />
          <div className="h-8 rounded" style={{ backgroundColor: 'var(--border)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-card rounded-lg p-3 border transition-all duration-200 group hover:shadow-lg h-full flex flex-col">
      {/* 1. TOP ROW: API Icon + API Name + Status Badge */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="p-1 rounded-lg border shrink-0" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
            <IconComponent className="w-2.5 h-2.5" />
          </div>
          <h3 className="text-[11px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
            {stats.name}
          </h3>
        </div>
        <div className="shrink-0">{getStatusBadge(stats.status)}</div>
      </div>

      {/* 2. Trend + Response Time (compact row) */}
      <div className="flex items-center justify-between text-[9px] mb-1.5">
        <div className="flex items-center space-x-1 min-w-0">
          {stats.trendDirection === 'up' ? (
            <span className="inline-flex items-center font-semibold" style={{ color: 'var(--success)' }}>
              <TrendingUp className="w-2 h-2 mr-0.5" />
              +{stats.trendPercentage}%
            </span>
          ) : stats.trendDirection === 'down' ? (
            <span className="inline-flex items-center font-semibold" style={{ color: 'var(--error)' }}>
              <TrendingDown className="w-2 h-2 mr-0.5" />
              {stats.trendPercentage}%
            </span>
          ) : (
            <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Stable</span>
          )}
          <span style={{ color: 'var(--text-secondary)' }}>vs prev</span>
        </div>

        <div className="font-semibold flex items-center gap-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }}>
          <Activity className="w-2 h-2" style={{ color: 'var(--primary)' }} />
          {stats.avgResponseTimeMs}ms
        </div>
      </div>

      {/* 3. 2x2 KPI GRID (Total Hits, Success, Not Found, Failed) — ultra compact */}
      <div className="grid grid-cols-2 gap-px rounded-md overflow-hidden mb-1.5" style={{ backgroundColor: 'var(--border)' }}>
        <div style={{ backgroundColor: 'var(--card-inner)' }} className="p-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Total</span>
          <span className="text-[11px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{stats.totalHits.toLocaleString()}</span>
        </div>
        <div style={{ backgroundColor: 'var(--card-inner)' }} className="p-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: 'var(--success)' }}>Success</span>
          <span className="text-[11px] font-extrabold tracking-tight" style={{ color: 'var(--success)' }}>{stats.success.toLocaleString()}</span>
        </div>
        <div style={{ backgroundColor: 'var(--card-inner)' }} className="p-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: 'var(--warning)' }}>Not Found</span>
          <span className="text-[11px] font-extrabold tracking-tight" style={{ color: 'var(--warning)' }}>{stats.notFound.toLocaleString()}</span>
        </div>
        <div style={{ backgroundColor: 'var(--card-inner)' }} className="p-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: 'var(--error)' }}>Failed</span>
          <span className="text-[11px] font-extrabold tracking-tight" style={{ color: 'var(--error)' }}>{stats.failed.toLocaleString()}</span>
        </div>
      </div>

      {/* 4. BOTTOM ROW (Success Rate % & Timestamp) */}
      <div className="flex items-center justify-between text-[9px] mt-auto">
        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{successRate}%</span>
        <span className="flex items-center gap-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          <Clock className="w-2 h-2" />
          2s ago
        </span>
      </div>
    </div>
  );
};