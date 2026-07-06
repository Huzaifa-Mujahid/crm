import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  MessageSquare,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronRight,
  CheckSquare,
  History,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

/* ── Navigation items ─────────────────────────────────────────── */
const NAV = [
  {
    group: 'Workspace',
    items: [
      { label: 'Dashboard',  path: '/',             icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'] },
      { label: 'Clients',    path: '/clients',       icon: Users,           roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'] },
      { label: 'Projects',   path: '/projects',      icon: Briefcase,       roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'] },
      { label: 'Tasks',      path: '/tasks',         icon: CheckSquare,     roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'] },
      { label: 'Users',      path: '/staff',         icon: Users,           roles: ['Admin'] },
    ],
  },
  {
    group: 'Activity',
    items: [
      { label: 'Meetings',     path: '/meetings',     icon: Calendar,        roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'] },
      { label: 'Interactions', path: '/interactions', icon: MessageSquare,   roles: ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'] },
      { label: 'Payments',     path: '/payments',     icon: CreditCard,      roles: ['Admin', 'Manager'] },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Reports',      path: '/reports',      icon: BarChart3,       roles: ['Admin', 'Manager'] },
      { label: 'Activity Log', path: '/activity-log', icon: History,         roles: ['Admin', 'Manager'] },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Settings', path: '/settings', icon: Settings, roles: ['Admin'] },
    ],
  },
];

/* ── Avatar color by email initial ───────────────────────────── */
const AVATAR_COLORS = ['avatar-indigo', 'avatar-emerald', 'avatar-rose', 'avatar-amber', 'avatar-blue'];
const avatarColor = (email) => AVATAR_COLORS[(email?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

/* ── Theme Toggle Button ─────────────────────────────────────── */
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      id="theme-toggle-sidebar"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
        border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(245,158,11,0.3)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        flexShrink: 0,
        width: 32,
        height: 32,
      }}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -20, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {isDark
          ? <Sun size={14} style={{ color: '#fbbf24' }} />
          : <Moon size={14} style={{ color: '#818cf8' }} />}
      </motion.div>
    </button>
  );
};

/* ── Sidebar Component ─────────────────────────────────────────── */
const Sidebar = ({ open, onClose }) => {
  const { user, role, userFullName, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canAddClient = ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'].includes(role);

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); } catch (e) { console.error(e); }
  };

  const fullName = userFullName || user?.user_metadata?.full_name;
  const initial = fullName?.trim()?.[0]?.toUpperCase() || user?.email?.trim()?.[0]?.toUpperCase() || 'U';
  const colorClass = avatarColor(user?.email);
  const displayEmail = user?.email || '';
  const displayName = fullName || displayEmail;
  const displayRole = role || 'Employee';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          zIndex: 40,
          transform: open ? 'translateX(0)' : undefined,
          transition: 'transform 0.25s ease',
        }}
        className={`
          fixed inset-y-0 left-0 md:relative md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img src="/logo.png?v=4" alt="Allied Marketing Solutions Logo" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {NAV.map(({ group, items }) => {
            const filteredItems = items.filter(i => !i.roles || i.roles.includes(displayRole));
            if (filteredItems.length === 0) return null;

            return (
              <div key={group}>
                <p className="nav-group-label">{group}</p>
                {filteredItems.map(({ label, path, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === '/'}
                    onClick={onClose}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={15} className="nav-icon" style={{ flexShrink: 0 }} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}

          {/* Quick Actions for Staff */}
          {!isAdmin && (
            <div style={{ marginTop: 24, padding: '0 10px' }}>
              <p className="nav-group-label" style={{ marginBottom: 12 }}>Quick Actions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canAddClient && (
                  <NavLink to="/clients?new=true" className="quick-action-btn">
                    <Users size={14} />
                    <span>+ Add Client</span>
                  </NavLink>
                )}
                <NavLink to="/tasks?new=true" className="quick-action-btn">
                  <CheckSquare size={14} />
                  <span>+ New Task</span>
                </NavLink>
                <NavLink to="/meetings?new=true" className="quick-action-btn">
                  <Calendar size={14} />
                  <span>+ Schedule Meeting</span>
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 10px',
            borderRadius: 10,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
          }}>
            <div className={`avatar avatar-sm ${colorClass}`} style={{ flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 130,
              }}>
                {displayName}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{displayRole}</p>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fb7185'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

/* ── Main Layout ───────────────────────────────────────────────── */
const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar (mobile) */}
        <header style={{
          height: 52,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--bg-surface)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
        }}
          className="md:hidden"
        >
          <button
            onClick={() => setSidebarOpen(s => !s)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--text-primary), #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Allied Marketing Solutions</span>
          </div>
          {/* Theme toggle in mobile header */}
          <button
            onClick={toggleTheme}
            style={{
              background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 8, cursor: 'pointer',
              padding: '6px', display: 'flex', alignItems: 'center',
              width: 32, height: 32, justifyContent: 'center',
            }}
          >
            {isDark
              ? <Sun size={14} style={{ color: '#fbbf24' }} />
              : <Moon size={14} style={{ color: '#818cf8' }} />}
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-7" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1360, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
