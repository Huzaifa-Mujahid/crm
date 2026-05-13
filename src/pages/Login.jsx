import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Loader2, ArrowRight, Eye, EyeOff, 
  Shield, Users, Key, ChevronDown 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'];

const Login = () => {
  const [activeTab, setActiveTab] = useState('admin'); // 'admin' or 'staff'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [staffKey, setStaffKey] = useState('');
  const [staffRole, setStaffRole] = useState('Sales Agent');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { adminLogin, staffLogin } = useAuth();
  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminLogin(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (staffKey.length !== 6) {
      setError('Key must be exactly 6 digits.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await staffLogin(staffKey, staffRole);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid key or role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '55%', height: '55%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Company Logo" style={{ width: 'auto', height: 60, maxWidth: '100%', objectFit: 'contain', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 4 }}>
            Allied Marketing Solutions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Enterprise Client Management System
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 16
        }}>
          <button 
            onClick={() => { setActiveTab('admin'); setError(null); }}
            style={{
              flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: activeTab === 'admin' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: activeTab === 'admin' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Shield size={14} /> Admin
          </button>
          <button 
            onClick={() => { setActiveTab('staff'); setError(null); }}
            style={{
              flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: activeTab === 'staff' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'staff' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: activeTab === 'staff' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Users size={14} /> Staff
          </button>
        </div>

        {/* Form Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="alert alert-error" style={{ marginBottom: 20 }}>
              <span>{error}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'admin' ? (
              <motion.form 
                key="admin-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleAdminLogin} 
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                <div className="form-group">
                  <label className="label">Admin Username</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input input-icon"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Username (e.g. digital)"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Admin Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input input-icon"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', height: 46, marginTop: 6 }}>
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Login as Admin <ArrowRight size={16} /></>}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="staff-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleStaffLogin} 
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                <div className="form-group">
                  <label className="label">Select Your Role</label>
                  <div style={{ position: 'relative' }}>
                    <Users size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                    <select 
                      className="input input-icon" 
                      style={{ appearance: 'none' }}
                      value={staffRole}
                      onChange={e => setStaffRole(e.target.value)}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">6-Digit Staff Key</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      maxLength={6}
                      className="input input-icon"
                      value={staffKey}
                      onChange={e => setStaffKey(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      style={{ letterSpacing: staffKey ? '4px' : 'normal', fontWeight: 700 }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Enter the unique key provided by your Admin.</p>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', height: 46, marginTop: 6 }}>
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Login as Staff <ArrowRight size={16} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
          Allied Marketing Solutions Platform · Secure Access Point
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
