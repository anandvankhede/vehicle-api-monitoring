import React from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { UserFilter } from './UserFilter';
import { TimeFilter } from './TimeFilter';
import type { TimeOption } from './TimeFilter';
import type { UserOption, TimeFilterValue } from '../types/dashboard';

interface FilterBarProps {
  users: UserOption[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  selectedTimeFilter: TimeFilterValue;
  onTimeFilterChange: (timeFilter: TimeFilterValue) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onResetFilters?: () => void;
  isLoading?: boolean;
}

const USER_TIME_OPTIONS: TimeOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  users,
  selectedUserId,
  onUserChange,
  selectedTimeFilter,
  onTimeFilterChange,
  startDate,
  endDate,
  onDateChange,
  onResetFilters,
  isLoading = false,
}) => {
  return (
    <section
      className="rounded-xl px-4 py-3 shadow-sm border"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        {/* Left Label */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="p-1.5 rounded-lg border" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            User Filters
          </span>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <UserFilter
            users={users}
            selectedUserId={selectedUserId}
            onChange={onUserChange}
            isLoading={isLoading}
          />

          <TimeFilter
            options={USER_TIME_OPTIONS}
            selectedValue={selectedTimeFilter}
            onChange={(val) => onTimeFilterChange(val as TimeFilterValue)}
            startDate={startDate}
            endDate={endDate}
            onDateChange={onDateChange}
            isLoading={isLoading}
            label="User Time Range"
          />

          {onResetFilters && (
            <button
              onClick={onResetFilters}
              title="Reset Filters"
              className="px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium"
              style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Reset
            </button>
          )}
        </div>
      </div>
    </section>
  );
};