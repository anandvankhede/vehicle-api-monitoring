import React, { useState } from 'react';
import { Maximize2, TrendingUp, Clock } from 'lucide-react';
import { ApiDetailGraphModal } from './ApiDetailGraphModal';
import { TrendLineChart } from './TrendLineChart';
import type { ClientApiDetail } from '../types/detailsChart';
import type { ApiTimeFilterValue } from '../types/dashboard';

interface ApiDetailGraphCardProps {
  detail: ClientApiDetail;
  clientId: string;
  clientName: string;
  timeFilter: ApiTimeFilterValue;
  onTimeFilterChange: (filter: ApiTimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onModalOpenChange?: (open: boolean) => void;
}

export const ApiDetailGraphCard: React.FC<ApiDetailGraphCardProps> = ({
  detail,
  clientId,
  clientName,
  timeFilter,
  onTimeFilterChange,
  startDate,
  endDate,
  onDateChange,
  onModalOpenChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isEmpty = !detail.trendData || detail.trendData.length === 0;
  const chartKey = `${detail.apiId}-${timeFilter}-${detail.trendData?.length ?? 0}`;

  const openModal = () => {
    setIsModalOpen(true);
    onModalOpenChange?.(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    onModalOpenChange?.(false);
  };

  return (
    <>
      <div className="enterprise-card rounded-xl p-3 border transition-all duration-200 group hover:shadow-lg flex flex-col h-full" style={{ borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2 border-b pb-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center space-x-2 min-w-0">
            <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
              <TrendingUp className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
                {detail.apiName}
              </h3>
              <span className="text-[9px] font-medium capitalize" style={{ color: 'var(--text-muted)' }}>
                {detail.category}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[9px] font-semibold shrink-0"
            style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="View Expanded"
          >
            <Maximize2 className="w-2.5 h-2.5" />
            View
          </button>
        </div>

        {/* Mini Line Chart */}
        <div className="flex-1 min-h-[140px]" style={{ width: '100%' }}>
          {isEmpty ? (
            <div className="flex items-center justify-center h-full text-[10px]" style={{ color: 'var(--text-muted)' }}>
              No data
            </div>
          ) : (
            <TrendLineChart data={detail.trendData} chartKey={chartKey} compact showAxisLabels={false} />
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-[9px] mt-1 pt-1.5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {detail.totalHits.toLocaleString()} hits
            </span>
            <span className="font-medium" style={{ color: 'var(--success)' }}>
              {detail.success.toLocaleString()} ok
            </span>
            <span className="font-medium" style={{ color: 'var(--error)' }}>
              {detail.failed.toLocaleString()} fail
            </span>
            <span className="font-medium" style={{ color: 'var(--warning)' }}>
              {detail.notFound.toLocaleString()} nf
            </span>
          </div>
          <span className="flex items-center gap-0.5 font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-2 h-2" />
            {detail.avgResponseTimeMs}ms
          </span>
        </div>
      </div>

      {/* Expanded Modal */}
      <ApiDetailGraphModal
        open={isModalOpen}
        onClose={closeModal}
        detail={detail}
        clientId={clientId}
        clientName={clientName}
        timeFilter={timeFilter}
        onTimeFilterChange={onTimeFilterChange}
        startDate={startDate}
        endDate={endDate}
        onDateChange={onDateChange}
      />
    </>
  );
};