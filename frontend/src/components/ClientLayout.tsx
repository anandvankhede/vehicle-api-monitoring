import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Activity, LogOut, ChevronDown, Shield, Menu, X, Building2, LayoutGrid, UserCircle, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useClientAuth } from '../context/ClientAuthContext';

export const ClientLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { client, logout } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    navigate('/client/login', { replace: true });
  };

  const isServices = location.pathname === '/client/services';
  const isActivity = location.pathname === '/client/dashboard' || location.pathname === '/client/activity';
  const isProfile = location.pathname === '/client/profile';
  const isUsageReports = location.pathname === '/client/usage-reports';

  const navItems = [
    { name: 'Services', icon: LayoutGrid, path: '/client/services', active: isServices },
    { name: 'Activity', icon: Activity, path: '/client/activity', active: isActivity },
    { name: 'Usage Reports', icon: TrendingUp, path: '/client/usage-reports', active: isUsageReports },
    { name: 'Profile', icon: UserCircle, path: '/client/profile', active: isProfile },
  ];

  // Dynamic page title based on current route
  const getPageTitle = () => {
    if (isServices) return 'Services';
    if (isActivity) return 'Activity';
    if (isUsageReports) return 'Usage Reports';
    if (isProfile) return 'Profile';
    return 'Client Portal';
  };

  const getPageSubtitle = () => {
    if (isServices) return 'Manage your subscribed APIs and request access to additional services.';
    if (isActivity) return 'Track your API requests and approval status.';
    if (isUsageReports) return 'View your API usage statistics and billing information.';
    if (isProfile) return 'Your registered account details';
    return 'Client Portal';
  };

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}>
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
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Client Portal
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-lg border" style={{ backgroundColor: 'var(--card-inner)', borderColor: 'var(--border)' }}>
              {navItems.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </nav>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* User Menu */}
              {client && (
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-1.5 p-1.5 rounded-lg transition-all hover:scale-105 shadow-sm"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                    title={`Logged in as ${client.company_name}`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                    >
                      {client.company_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {client.company_name}
                    </span>
                    <ChevronDown className="w-3 h-3 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-56 rounded-lg shadow-lg border py-1 z-50"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                      }}
                    >
                      <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                          >
                            {client.company_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                              {client.company_name}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              @{client.username}
                            </p>
                          </div>
                        </div>
                        <div
                          className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}
                        >
                          <Shield className="w-3 h-3" />
                          Client
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
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
              )}

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
            <div className="space-y-0.5">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {getPageTitle()}
              </h1>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {getPageSubtitle()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};