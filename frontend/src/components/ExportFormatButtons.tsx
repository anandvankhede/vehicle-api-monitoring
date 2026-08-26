import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

export type ExportFormat = 'csv' | 'excel';

interface ExportFormatButtonsProps {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

export const ExportFormatButtons: React.FC<ExportFormatButtonsProps> = ({
  onExport,
  disabled = false,
  loading = false,
  compact = false,
  className = '',
}) => {
  const baseClass = compact
    ? 'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:opacity-90 disabled:opacity-50'
    : 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';

  const style = {
    backgroundColor: 'var(--card-inner)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onExport('csv')}
        disabled={disabled || loading}
        className={baseClass}
        style={style}
        title="Export CSV"
      >
        <Download className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Exporting...' : 'CSV'}
      </button>
      <button
        type="button"
        onClick={() => onExport('excel')}
        disabled={disabled || loading}
        className={baseClass}
        style={style}
        title="Export Excel"
      >
        <FileSpreadsheet className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Exporting...' : 'Excel'}
      </button>
    </div>
  );
};
