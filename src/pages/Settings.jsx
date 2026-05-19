import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Shield,
  Key,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

/* ── Section wrapper ────────────────────────────────────────── */
const Section = ({ icon: Icon, title, subtitle, children }) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '20px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'var(--accent-glow)',
        border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-light)', flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
    <div style={{ padding: '24px' }}>{children}</div>
  </div>
);

/* ── Alert helper ───────────────────────────────────────────── */
const Alert = ({ type, msg }) => {
  if (!msg) return null;
  const isSuccess = type === 'success';
  return (
    <div className={`alert ${isSuccess ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 0, marginTop: 16 }}>
      {isSuccess ? <Check size={15} /> : <AlertCircle size={15} />}
      <span>{msg}</span>
    </div>
  );
};

/* ── Password Input ─────────────────────────────────────────── */
const PasswordInput = ({ value, onChange, placeholder, ...rest }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingRight: 44 }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
};

/* ── Settings Page ──────────────────────────────────────────── */
const Settings = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  /* ── Change Display Name ─────────────── */
  const [nameForm, setNameForm] = useState({
    newName: user?.user_metadata?.full_name || '',
  });
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState({ type: '', text: '' });

  const handleChangeName = async (e) => {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: nameForm.newName },
      });
      if (error) throw error;
      setNameMsg({ type: 'success', text: 'Display name updated successfully!' });
    } catch (err) {
      setNameMsg({ type: 'error', text: err.message });
    } finally {
      setNameSaving(false);
    }
  };

  /* ── Change Password ─────────────────── */
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (pwForm.newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPwSaving(true);
    try {
      // First, re-authenticate with current password
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwForm.currentPassword,
      });
      if (reAuthErr) throw new Error('Current password is incorrect. Please try again.');

      // Now update the password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pwForm.newPassword,
      });
      if (updateErr) throw updateErr;

      setPwMsg({ type: 'success', text: 'Password changed successfully! Please use your new password on next login.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SettingsIcon size={22} style={{ color: 'var(--accent-light)' }} />
            Settings
          </h1>
          <p className="page-subtitle">Manage your account credentials and application preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>

        {/* ── Appearance ──────────────────────────────────────── */}
        <Section icon={theme === 'dark' ? Moon : Sun} title="Appearance" subtitle="Choose your preferred theme">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderRadius: 12,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: theme === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {theme === 'dark'
                  ? <Moon size={20} style={{ color: '#818cf8' }} />
                  : <Sun size={20} style={{ color: '#fbbf24' }} />}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {theme === 'dark' ? 'Easy on the eyes in low-light environments' : 'Clean look for bright environments'}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={toggleTheme}
              id="theme-toggle-btn"
              aria-label="Toggle theme"
              style={{
                width: 52, height: 28, borderRadius: 99,
                border: 'none', cursor: 'pointer',
                position: 'relative',
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                transition: 'background 0.3s ease',
                flexShrink: 0,
              }}
            >
              <motion.div
                animate={{ x: theme === 'dark' ? 26 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  position: 'absolute', top: 3,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                {theme === 'dark'
                  ? <Moon size={11} style={{ color: '#4f46e5' }} />
                  : <Sun size={11} style={{ color: '#d97706' }} />}
              </motion.div>
            </button>
          </div>

          {/* Theme Preview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            {/* Dark preview */}
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              style={{
                padding: 14, borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
                background: '#07090f',
                transition: 'all 0.2s',
                text: 'left',
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#f43f5e' }} />
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#f59e0b' }} />
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#10b981' }} />
              </div>
              <div style={{ height: 6, borderRadius: 4, background: '#1e2433', marginBottom: 5 }} />
              <div style={{ height: 6, borderRadius: 4, background: '#1e2433', width: '70%', marginBottom: 5 }} />
              <div style={{ height: 6, borderRadius: 4, background: '#6366f1', width: '40%' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#4b5a72', marginTop: 10 }}>Dark</p>
            </button>

            {/* Light preview */}
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              style={{
                padding: 14, borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${theme === 'light' ? '#6366f1' : 'var(--border)'}`,
                background: '#f8faff',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#f43f5e' }} />
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#f59e0b' }} />
                <div style={{ width: 8, height: 8, borderRadius: 99, background: '#10b981' }} />
              </div>
              <div style={{ height: 6, borderRadius: 4, background: '#e2e8f0', marginBottom: 5 }} />
              <div style={{ height: 6, borderRadius: 4, background: '#e2e8f0', width: '70%', marginBottom: 5 }} />
              <div style={{ height: 6, borderRadius: 4, background: '#6366f1', width: '40%' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 10 }}>Light</p>
            </button>
          </div>
        </Section>

        {/* ── Display Name ─────────────────────────────────────── */}
        <Section icon={User} title="Display Name" subtitle="Update how your name appears across the CRM">
          <form onSubmit={handleChangeName}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Current Email (Username)</label>
                <input
                  className="input"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>
              <div>
                <label className="label">Display Name *</label>
                <input
                  className="input"
                  value={nameForm.newName}
                  onChange={e => setNameForm({ newName: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={nameSaving}
              >
                {nameSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {nameSaving ? 'Saving...' : 'Update Name'}
              </button>
            </div>
            <Alert type={nameMsg.type} msg={nameMsg.text} />
          </form>
        </Section>

        {/* ── Change Password ──────────────────────────────────── */}
        <Section icon={Lock} title="Change Password" subtitle="Keep your account secure with a strong password">
          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Current Password *</label>
                <PasswordInput
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                  required
                />
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <div>
                <label className="label">New Password *</label>
                <PasswordInput
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  required
                />
                {/* Strength indicator */}
                {pwForm.newPassword && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(lvl => {
                      const len = pwForm.newPassword.length;
                      const hasUpper = /[A-Z]/.test(pwForm.newPassword);
                      const hasNum = /[0-9]/.test(pwForm.newPassword);
                      const hasSpecial = /[^A-Za-z0-9]/.test(pwForm.newPassword);
                      const strength = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpecial ? 1 : 0);
                      const colors = ['var(--rose)', 'var(--amber)', 'var(--amber)', 'var(--emerald)'];
                      return (
                        <div
                          key={lvl}
                          style={{
                            height: 4, flex: 1, borderRadius: 99,
                            background: lvl <= strength ? colors[strength - 1] : 'var(--border)',
                            transition: 'background 0.3s',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Confirm New Password *</label>
                <PasswordInput
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat your new password"
                  required
                />
                {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                  <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> Passwords do not match
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pwSaving}
              >
                {pwSaving ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />}
                {pwSaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
            <Alert type={pwMsg.type} msg={pwMsg.text} />
          </form>
        </Section>

        {/* ── Security Info ────────────────────────────────────── */}
        <div style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.15)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <Shield size={16} style={{ color: 'var(--accent-light)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Security Reminder
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Use a strong, unique password with uppercase letters, numbers, and special characters.
              Never share your credentials with anyone. Your account has Admin-level access.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
