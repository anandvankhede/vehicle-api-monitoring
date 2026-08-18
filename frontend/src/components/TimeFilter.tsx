import React from 'react';

export interface TimeOption {
  value: string;
  label: string;
}

interface TimeFilterProps {
  options: TimeOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (startDate: string, endDate: string) => void;
  label?: string;
  isLoading?: boolean;
  className?: string;
}

export const TimeFilter: React.FC<TimeFilterProps> = ({
  options,
  selectedValue,
  onChange,
  startDate = '',
  endDate = '',
  onDateChange,
  isLoading = false,
  className = '',
}) => {
  const isCustom = selectedValue === 'custom';

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--input-border)',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative min-w-[140px]">
        <select
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
          style={selectStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--input-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>

      {/* Inline Custom Date Pickers */}
      {isCustom && (
        <div className="flex items-center gap-1.5 animate-fadeIn">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onDateChange && onDateChange(e.target.value, endDate)}
            className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--input-border)',
            }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onDateChange && onDateChange(startDate, e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--input-border)',
            }}
          />
        </div>
      )}
    </div>
  );
};