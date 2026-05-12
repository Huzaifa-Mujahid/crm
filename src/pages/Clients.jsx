import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Download, Loader2, ArrowUpRight, Building2, X, CreditCard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const STATUS_BADGE = {
  Active:     'badge-emerald',
  Onboarding: 'badge-blue',
  'At Risk':  'badge-amber',
  Churned:    'badge-rose',
};

const AVATAR_BG = ['rgba(99,102,241,0.15)', 'rgba(16,185,129,0.15)', 'rgba(245,158,11,0.15)', 'rgba(59,130,246,0.15)', 'rgba(244,63,94,0.15)'];
const AVATAR_FG = ['#818cf8', '#34d399', '#fbbf24', '#60a5fa', '#fb7185'];
const av = (name) => { const i = (name?.charCodeAt(0) || 0) % 5; return [AVATAR_BG[i], AVATAR_FG[i]]; };

/* ── Add Client Modal ─────────────────────────────────────────── */
const AddClientModal = ({ onClose, onSaved }) => {
  const { user, isAdmin, isManager, role } = useAuth();
  const isCS = role === 'Customer Success Manager';
  const canHandlePayment = isAdmin || isManager || isCS;

  const [form, setForm] = useState({ 
    full_name: '', 
    email: '', 
    phone: '', 
    company: '', 
    status: 'Active', 
    assigned_to: '',
    payment_method: '',
    card_number: '',
    card_expiry: '',
    card_cvv: ''
  });
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isAdmin || isManager) {
      fetchStaff();
    } else {
      up('assigned_to', user.id);
    }
  }, []);

  const fetchStaff = async () => {
    const { data } = await supabase.from('user_roles').select('user_id, full_name, role');
    setStaffList(data || []);
    // Default to current user
    if (data?.length > 0) {
      up('assigned_to', user.id);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email) { setErr('Name and email are required.'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('clients').insert([{ 
        ...form, 
        health_score: 80,
        assigned_to: form.assigned_to || user.id
      }]);
      if (error) throw error;
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box">
        <div className="modal-header">
          <span className="modal-title">Add New Client</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {err && <div className="alert alert-error"><span>⚠</span><span>{err}</span></div>}
          <form id="add-client-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="label">Full Name *</label><input className="input" value={form.full_name} onChange={e => up('full_name', e.target.value)} placeholder="John Smith" required /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => up('email', e.target.value)} placeholder="john@company.com" required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="+1 (555) 000-0000" /></div>
              <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => up('company', e.target.value)} placeholder="Acme Inc." /></div>
            </div>
            
            {(isAdmin || isManager) && (
              <div>
                <label className="label">Assign to Staff Member</label>
                <select className="input" value={form.assigned_to} onChange={e => up('assigned_to', e.target.value)}>
                  {staffList.map(s => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => up('status', e.target.value)}>
                {['Active', 'Onboarding', 'At Risk', 'Churned'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {canHandlePayment && (
              <div style={{ padding: 16, background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 12, marginTop: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 12 }}>Payment Information</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Method</label>
                    <select className="input" value={form.payment_method} onChange={e => up('payment_method', e.target.value)}>
                      <option value="">Select Method...</option>
                      <option value="Merchant Client">Merchant Client</option>
                      <option value="Visa">Visa Card</option>
                      <option value="MasterCard">MasterCard</option>
                      <option value="AMEX">American Express</option>
                      <option value="Discover">Discover</option>
                      <option value="PayPal">PayPal</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Card Number</label>
                    <input 
                      className="input" 
                      type="text"
                      placeholder="XXXX XXXX XXXX XXXX"
                      value={form.card_number}
                      onChange={e => up('card_number', e.target.value.replace(/\D/g, '').slice(0, 16))}
                    />
                  </div>
                  <div>
                    <label className="label">Expiry (MM/YY)</label>
                    <input 
                      className="input" 
                      placeholder="12/28"
                      value={form.card_expiry}
                      onChange={e => up('card_expiry', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">CVV</label>
                    <input 
                      className="input" 
                      type="password"
                      placeholder="***"
                      value={form.card_cvv}
                      onChange={e => up('card_cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="add-client-form" type="submit" disabled={saving}>
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</> : 'Add Client'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Clients Page ─────────────────────────────────────────────── */
const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchClients();

    // Handle Quick Action
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setShowModal(true);
      // Clear the param from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setClients(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client{clients.length !== 1 ? 's' : ''} in your database</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} />Add Client</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select className="input" style={{ paddingRight: 34, minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['Active', 'Onboarding', 'At Risk', 'Churned'].map(s => <option key={s}>{s}</option>)}
          </select>
          <Filter size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading clients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Search size={22} /></div>
            <p className="empty-title">No clients found</p>
            <p className="empty-desc">{search || statusFilter ? 'Try adjusting your search or filter.' : 'Add your first client to get started.'}</p>
            {!search && !statusFilter && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={14} />Add Client</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Health Score</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((client, idx) => {
                    const [abg, afg] = av(client.full_name);
                    const score = client.health_score || 80;
                    const scoreColor = score >= 70 ? 'var(--emerald)' : score >= 40 ? 'var(--amber)' : 'var(--rose)';
                    return (
                      <motion.tr key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                        onClick={() => navigate(`/clients/${client.id}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="avatar" style={{ background: abg, color: afg, width: 36, height: 36, fontSize: 13, borderRadius: 10 }}>{client.full_name?.[0] || 'U'}</div>
                            <div>
                              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{client.full_name}</p>
                              <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{client.company || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {client.payment_method ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CreditCard size={12} style={{ color: 'var(--accent-light)' }} /> {client.payment_method}
                              </p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                                {isAdmin ? client.card_number : `**** **** **** ${client.card_number?.slice(-4)}`}
                              </p>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[client.status] || 'badge-slate'}`}>
                            <span className="badge-dot" />
                            {client.status || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-fill" style={{ width: `${score}%`, background: scoreColor }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor }}>{score}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); navigate(`/clients/${client.id}`); }}>
                            <ArrowUpRight size={15} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && <AddClientModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchClients(); }} />}
      </AnimatePresence>
    </div>
  );
};

export default Clients;
