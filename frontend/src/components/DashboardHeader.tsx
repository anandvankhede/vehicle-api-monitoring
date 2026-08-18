import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Sun, Moon, Users, LayoutDashboard, BarChart2, Table2, Menu, X, LogOut, ChevronDown, Shield, KeyRound, DollarSign, Code2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface DashboardHeaderProps {
  pageTitle?: string;
  pageSubtitle?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  pageTitle,
  pageSubtitle,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const isDashboard = location.pathname === '/dashboard';
  const isDetailsChart = location.pathname === '/details-chart';
  const isClientAnalytics = location.pathname === '/client-analytics';
  const isClientManagement = location.pathname === '/client-management' || location.pathname.startsWith('/client-management/');
  const isClientManagementClients = location.pathname === '/client-management/clients';
  const isClientManagementApiRequests = location.pathname === '/client-management/api-requests';
  const isCostManagement = location.pathname === '/api-subscription-management';
  const isApiManagement = location.pathname === '/api-management' || location.pathname.startsWith('/api-management/');
  const isCreateApi = location.pathname === '/api-management/create';
  // Dynamic page title based on current route
  const getPageTitle = () => {
    if (isCreateApi) return 'Create API';
    if (isApiManagement) return 'API Management';
    if (isClientManagementClients) return 'Clients';
    if (isClientManagementApiRequests) return 'API Requests';
    if (isCostManagement) return 'API Subscriptions';
    if (isClientManagement) return 'Client Management';
    if (isClientAnalytics) return 'Client Analytics';
    if (isDetailsChart) return 'Detailed Chart';
    return 'Dashboard';
  };

  const getPageSubtitle = () => {
    if (isCreateApi) return 'Design and create a new API in the catalog';
    if (isApiManagement) return 'Manage the API catalog, create and configure APIs';
    if (isClientManagementClients) return 'Manage all approved clients';
    if (isClientManagementApiRequests) return 'Review additional API requests';
    if (isCostManagement) return 'Manage assigned APIs, pricing, API keys and request limits for every client.';
    if (isClientManagement) return 'Manage clients and API requests';
    if (isClientAnalytics) return 'API Analytics & Monitoring';
    if (isDetailsChart) return 'Detailed API Analytics & Monitoring';
    return 'API Analytics & Monitoring';
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', active: isDashboard },
    { name: 'Detailed Chart', icon: BarChart2, path: '/details-chart', active: isDetailsChart },
    { name: 'Client Analytics', icon: Table2, path: '/client-analytics', active: isClientAnalytics },
    { name: 'Client Management', icon: Users, path: '/client-management', active: isClientManagement },
    { name: 'API Management', icon: Code2, path: '/api-management', active: isApiManagement },
    { name: 'API Subscriptions', icon: DollarSign, path: '/api-subscription-management', active: isCostManagement },
  ];

  const clientManagementSubNav = [
    { name: 'Clients', icon: Users, path: '/client-management/clients', active: isClientManagementClients },
    { name: 'API Requests', icon: KeyRound, path: '/client-management/api-requests', active: isClientManagementApiRequests },
  ];

  const NavLink = ({ item, isMobile = false }: { item: typeof navItems[0]; isMobile?: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={() => navigate(item.path)}
        className={`flex items-center gap-2 font-medium transition-all duration-200 rounded-lg ${
          isMobile
            ? 'w-full px-3 py-2.5 text-sm'
            : 'px-3 py-1.5 text-xs'
        }`}
        style={{
          backgroundColor: item.active ? 'var(--primary)' : 'transparent',
          color: item.active ? '#ffffff' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!item.active) {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!item.active) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        <Icon className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        <span>{item.name}</span>
      </button>
    );
  };

  // User menu dropdown component
  const UserMenu = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const roleColors: Record<string, { bg: string; text: string }> = {
      admin: { bg: 'var(--primary-light)', text: 'var(--primary)' },
      viewer: { bg: 'var(--info-bg)', text: 'var(--info)' },
      editor: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
    };

    const roleColor = roleColors[user.role] || roleColors.viewer;

    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 p-1.5 rounded-lg transition-all hover:scale-105 shadow-sm"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
          title={`Logged in as ${user.name}`}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate" style={{ color: 'var(--text-primary)' }}>
            {user.name}
          </span>
          <ChevronDown className="w-3 h-3 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className="absolute right-0 top-full mt-1.5 w-56 rounded-lg shadow-lg border py-1 z-50"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            {/* User Info */}
            <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {user.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    @{user.username}
                  </p>
                </div>
              </div>
              <div
                className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium capitalize"
                style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
              >
                <Shield className="w-3 h-3" />
                {user.role}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
                navigate('/admin/login', { replace: true });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                e.currentTarget.style.color = 'var(--error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sticky Navbar */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: isScrolled
            ? 'color-mix(in srgb, var(--surface) 85%, transparent)'
            : 'var(--surface)',
          backdropFilter: isScrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: isScrolled ? 'blur(12px)' : 'none',
          transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease',
        }}
      >
        <div className="navbar-container">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Logo & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}>
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-sm font-extrabold tracking-tight hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                API Analytics Enterprise
              </span>
              <span className="text-sm font-extrabold tracking-tight sm:hidden" style={{ color: 'var(--text-primary)' }}>
                API Monitor
              </span>
            </div>

            {/* Desktop Nav - hidden on mobile */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-lg border" style={{ backgroundColor: 'var(--card-inner)', borderColor: 'var(--border)' }}>
              {navItems.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </nav>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* User Avatar Dropdown */}
              <UserMenu />

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-all hover:scale-105 shadow-sm"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
                ) : (
                  <Moon className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                )}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                className="md:hidden p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--card-inner)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                aria-label="Toggle navigation menu"
              >
                {isMobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {isMobileNavOpen && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setIsMobileNavOpen(false)} />
          <div className="mobile-nav-panel" style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Navigation</span>
              <button
                onClick={() => setIsMobileNavOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.name} item={item} isMobile />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Page Title Area */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="page-container">
          <div className="py-3 sm:py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {pageTitle || getPageTitle()}
                </h1>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {pageSubtitle || getPageSubtitle()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Management Sub-navigation */}
      {isClientManagement && (
        <div className="border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="page-container">
            <div className="flex gap-1 py-2 overflow-x-auto">
              {clientManagementSubNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200"
                    style={{
                      backgroundColor: item.active ? 'var(--primary)' : 'transparent',
                      color: item.active ? '#ffffff' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!item.active) {
                        e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!item.active) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};