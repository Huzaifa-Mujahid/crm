import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import Meetings from './pages/Meetings';
import Payments from './pages/Payments';
import Interactions from './pages/Interactions';
import Reports from './pages/Reports';
import ClientDetail from './pages/ClientDetail';
import Staff from './pages/Staff';
import Tasks from './pages/Tasks';
import ActivityLog from './pages/ActivityLog';

/* ── Loading Screen ─────────────────────────────────────────── */
const LoadingScreen = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090f', color: 'white' }}>
    <div style={{ textAlign: 'center' }}>
      <Loader2 className="animate-spin" style={{ margin: '0 auto 16px', color: '#6366f1' }} size={32} />
      <p style={{ fontSize: 14, color: '#4b5a72' }}>Initializing Allied Marketing Solutions...</p>
    </div>
  </div>
);

/* ── Protected Route — requires login ───────────────────────── */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  return <MainLayout>{children}</MainLayout>;
};

/* ── Role Protected Route — requires specific roles ─────────── */
const RoleRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>You don't have permission to view this page.</p>
        </div>
      </MainLayout>
    );
  }
  return <MainLayout>{children}</MainLayout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* /register is DISABLED — admins manage staff via Staff page */}
          <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
          <Route path="/interactions" element={<ProtectedRoute><Interactions /></ProtectedRoute>} />

          {/* Admin + Manager only */}
          <Route path="/payments" element={<RoleRoute allowedRoles={['Admin', 'Manager']}><Payments /></RoleRoute>} />
          <Route path="/reports" element={<RoleRoute allowedRoles={['Admin', 'Manager']}><Reports /></RoleRoute>} />
          <Route path="/activity-log" element={<RoleRoute allowedRoles={['Admin', 'Manager']}><ActivityLog /></RoleRoute>} />

          {/* Admin only */}
          <Route path="/staff" element={<RoleRoute allowedRoles={['Admin']}><Staff /></RoleRoute>} />

          <Route path="*" element={<ProtectedRoute>
            <div style={{ padding: 40, textAlign: 'center' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Page Not Found</h1>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>This page does not exist.</p>
            </div>
          </ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
