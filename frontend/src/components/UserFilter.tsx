import React from 'react';
import type { UserOption } from '../types/dashboard';

interface UserFilterProps {
  users: UserOption[];
  selectedUserId: string;
  onChange: (userId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const UserFilter: React.FC<UserFilterProps> = ({
  users,
  selectedUserId,
  onChange,
  isLoading = false,
  className = '',
}) => {
  return (
    <div className={`relative min-w-[160px] ${className}`}>
      <select
        value={selectedUserId}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="w-full appearance-none text-xs font-semibold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 transition-all cursor-pointer disabled:opacity-50"
        style={{
          backgroundColor: 'var(--input-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--input-border)',
          outlineColor: 'var(--primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)';
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--input-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id} style={{ backgroundColor: 'var(--card)', color: 'var(--text-primary)' }}>
            {user.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
};