import React from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardHeader } from './DashboardHeader';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}>
      <DashboardHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
};
