import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: 'primary' | 'success' | 'warning' | 'error' | 'muted';
  iconBg?: 'primary-light' | 'success-bg' | 'warning-bg' | 'error-bg' | 'muted';
  isLoading?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'primary',
  iconBg = 'primary-light',
  isLoading = false,
}) => {
  const getIconBgStyle = (): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      'primary-light': { backgroundColor: 'var(--primary-light)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' },
      'success-bg': { backgroundColor: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' },
      'warning-bg': { backgroundColor: 'var(--warning-bg)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' },
      'error-bg': { backgroundColor: 'var(--error-bg)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)' },
      'muted': { backgroundColor: 'var(--card-inner)', border: '1px solid var(--border)' },
    };
    return map[iconBg] || map['primary-light'];
  };

  const getIconColor = (): string => {
    const map: Record<string, string> = {
      'primary': 'var(--primary)',
      'success': 'var(--success)',
      'warning': 'var(--warning)',
      'error': 'var(--error)',
      'muted': 'var(--text-secondary)',
    };
    return map[iconColor] || 'var(--primary)';
  };

  return (
    <div className="theme-card rounded-xl px-3.5 py-3 flex items-center justify-between w-full h-full min-h-[64px]">
      <div className="space-y-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider block truncate" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </span>
        {isLoading ? (
          <div className="h-5 w-10 rounded my-0.5 animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
        ) : (
          <span className="text-xl font-extrabold tracking-tight leading-none block" style={{ color: 'var(--text-primary)' }}>
            {value}
          </span>
        )}
      </div>

      <div className="p-2 rounded-lg border flex items-center justify-center shrink-0" style={{ ...getIconBgStyle(), color: getIconColor() }}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
};