import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Loader2, ArrowRight, Eye, EyeOff, 
  Shield, Users, Key, ChevronDown, AlertTriangle, Clock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'];

// ─── Rate Limiting Constants ─────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;            // Max failed attempts before lockout
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

// ─── Lockout Hook ─────────────────────────────────────────────────────────────
// Manages per-tab attempt counters and lockout timers in memory.
// NOT stored in localStorage to avoid persistence across sessions.
const useLockout = () => {
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!lockoutUntil) return;

    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setAttempts(0);
        setCountdown(0);
        clearInterval(timerRef.current);
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;

  const recordFailure = () => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
    }
    return newAttempts;
  };

  const resetAttempts = () => {
    setAttempts(0);
    setLockoutUntil(null);
    setCountdown(0);
    clearInterval(timerRef.current);
  };

  const remaining = MAX_ATTEMPTS - attempts;

  return { isLockedOut, countdown, attempts, remaining, recordFailure, resetAttempts };
};

// ─── Lockout Banner Component ─────────────────────────────────────────────────
const LockoutBanner = ({ countdown }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 10, marginBottom: 16,
      background: 'rgba(244,63,94,0.08)',
      border: '1px solid rgba(244,63,94,0.25)',
      color: 'var(--rose)',
    }}
  >
    <Clock size={15} style={{ flexShrink: 0 }} />
    <span style={{ fontSize: 13, fontWeight: 600 }}>
      Too many failed attempts. Try again in{' '}
      <strong>{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</strong>
    </span>
  </motion.div>
);

// ─── Attempt Warning Component ────────────────────────────────────────────────
const AttemptsWarning = ({ remaining }) => {
  if (remaining >= MAX_ATTEMPTS) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8, marginBottom: 12,
        background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.2)',
        color: 'var(--amber)',
        fontSize: 12, fontWeight: 500,
      }}
    >
      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
      {remaining === 1
        ? 'Last attempt before 5-minute lockout.'
        : `${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`}
    </motion.div>
  );
};

// ─── Main Login Component ─────────────────────────────────────────────────────
const Login = () => {
  const [activeTab, setActiveTab] = useState('admin'); // 'admin' or 'staff'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffKey, setStaffKey] = useState('');
  const [staffRole, setStaffRole] = useState('Sales Agent');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const adminLockout = useLockout();
  const staffLockout = useLockout();

  const { adminLogin, staffLogin } = useAuth();
  const navigate = useNavigate();

  // Reset error when switching tabs
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setError(null);
  };

  // ─── Admin Login Handler ────────────────────────────────────────────────────
  const handleAdminLogin = async (e) => {
    e.preventDefault();

    if (adminLockout.isLockedOut) {
      setError(`Account temporarily locked. Please wait ${adminLockout.countdown} seconds.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminLogin(username, password);
      adminLockout.resetAttempts();
      navigate('/');
    } catch (err) {
      const newCount = adminLockout.recordFailure();
      if (newCount >= MAX_ATTEMPTS) {
        setError('Too many failed attempts. Account locked for 5 minutes.');
      } else {
        setError(err.message || 'Invalid admin credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Staff Login Handler ─────────────────────────────────────────────────────
  const handleStaffLogin = async (e) => {
    e.preventDefault();

    if (staffLockout.isLockedOut) {
      setError(`Account temporarily locked. Please wait ${staffLockout.countdown} seconds.`);
      return;
    }

    if (!staffUsername || !staffKey) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await staffLogin(staffUsername, staffKey, staffRole);
      staffLockout.resetAttempts();
      navigate('/');
    } catch (err) {
      const newCount = staffLockout.recordFailure();
      if (newCount >= MAX_ATTEMPTS) {
        setError('Too many failed attempts. Account locked for 5 minutes.');
      } else {
        setError(err.message || 'Invalid username, password or role.');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentLockout = activeTab === 'admin' ? adminLockout : staffLockout;

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
            onClick={() => handleTabSwitch('admin')}
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
            onClick={() => handleTabSwitch('staff')}
            style={{
              flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: activeTab === 'staff' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'staff' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: activeTab === 'staff' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Users size={14} /> User
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
          {/* Lockout banner */}
          {currentLockout.isLockedOut && (
            <LockoutBanner countdown={currentLockout.countdown} />
          )}

          {/* Error message */}
          {error && !currentLockout.isLockedOut && (
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
                {/* Attempt warning */}
                {!adminLockout.isLockedOut && adminLockout.attempts > 0 && (
                  <AttemptsWarning remaining={adminLockout.remaining} />
                )}

                <div className="form-group">
                  <label className="label">Admin Username</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      id="admin-username"
                      className="input input-icon"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Admin username"
                      required
                      disabled={adminLockout.isLockedOut}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Admin Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      id="admin-password"
                      className="input input-icon"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={adminLockout.isLockedOut}
                      autoComplete="current-password"
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

                <button
                  type="submit"
                  id="admin-login-btn"
                  disabled={loading || adminLockout.isLockedOut}
                  className="btn btn-primary"
                  style={{ width: '100%', height: 46, marginTop: 6, opacity: adminLockout.isLockedOut ? 0.5 : 1 }}
                >
                  {adminLockout.isLockedOut
                    ? <><Clock size={16} /> Locked ({Math.floor(adminLockout.countdown / 60)}:{String(adminLockout.countdown % 60).padStart(2, '0')})</>
                    : loading
                    ? <Loader2 className="animate-spin" size={18} />
                    : <>Login as Admin <ArrowRight size={16} /></>
                  }
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
                {/* Attempt warning */}
                {!staffLockout.isLockedOut && staffLockout.attempts > 0 && (
                  <AttemptsWarning remaining={staffLockout.remaining} />
                )}

                <div className="form-group">
                  <label className="label">Select Your Role</label>
                  <div style={{ position: 'relative' }}>
                    <Users size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                    <select 
                      id="staff-role"
                      className="input input-icon" 
                      style={{ appearance: 'none' }}
                      value={staffRole}
                      onChange={e => setStaffRole(e.target.value)}
                      disabled={staffLockout.isLockedOut}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Username</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      id="staff-username"
                      className="input input-icon"
                      value={staffUsername}
                      onChange={e => setStaffUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="Your username"
                      required
                      disabled={staffLockout.isLockedOut}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Password (6-Digit Key)</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      id="staff-key"
                      maxLength={6}
                      className="input input-icon"
                      value={staffKey}
                      onChange={e => setStaffKey(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      required
                      disabled={staffLockout.isLockedOut}
                      autoComplete="current-password"
                      style={{ letterSpacing: staffKey ? '4px' : 'normal', fontWeight: 700 }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Enter the secure key provided by your Admin.</p>
                </div>

                <button
                  type="submit"
                  id="staff-login-btn"
                  disabled={loading || staffLockout.isLockedOut}
                  className="btn btn-primary"
                  style={{ width: '100%', height: 46, marginTop: 6, opacity: staffLockout.isLockedOut ? 0.5 : 1 }}
                >
                  {staffLockout.isLockedOut
                    ? <><Clock size={16} /> Locked ({Math.floor(staffLockout.countdown / 60)}:{String(staffLockout.countdown % 60).padStart(2, '0')})</>
                    : loading
                    ? <Loader2 className="animate-spin" size={18} />
                    : <>Login as User <ArrowRight size={16} /></>
                  }
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
