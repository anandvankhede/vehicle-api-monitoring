import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Activity, ArrowRight } from 'lucide-react';

export const ClientManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isClients = location.pathname === '/client-management/clients';
  const isApiRequests = location.pathname === '/client-management/api-requests';

  const tabs = [
    { name: 'Clients', icon: Users, path: '/client-management/clients', active: isClients, desc: 'Manage all approved clients' },
    { name: 'API Requests', icon: Activity, path: '/client-management/api-requests', active: isApiRequests, desc: 'Review additional API requests' },
  ];

  return (
    <div className="page-container py-6">
      {/* Sub-navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className="rounded-xl p-5 text-left transition-all duration-200 hover:shadow-lg"
              style={{
                backgroundColor: tab.active ? 'var(--primary)' : 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: tab.active ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: tab.active ? '#ffffff' : 'var(--primary)' }} />
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: tab.active ? '#ffffff' : 'var(--text-muted)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: tab.active ? '#ffffff' : 'var(--text-primary)' }}>
                {tab.name}
              </h3>
              <p className="text-xs" style={{ color: tab.active ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                {tab.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};