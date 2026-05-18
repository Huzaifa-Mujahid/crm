import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, MessageSquare, Mail, Phone, Users, FileText, Clock, AlertCircle, X, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const TYPES = ['Call', 'Email', 'Meeting', 'Note'];

const InteractionModal = ({ form, setForm, clients, saving, err, onSave, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box">
      <div className="modal-header">
        <span className="modal-title">Log Interaction</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="modal-body">
        {err && <div className="alert alert-error"><span>⚠</span><span>{err}</span></div>}
        <form id="int-form" onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Client *</label>
            <select className="input" required value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 8 }}>Interaction Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {TYPES.map(t => (
                <button type="button" key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{
                    padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                    background: form.type === t ? 'var(--accent)' : 'var(--bg-elevated)',
                    borderColor: form.type === t ? 'var(--accent-dark)' : 'var(--border)',
                    color: form.type === t ? '#fff' : 'var(--text-muted)'
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Notes *</label>
            <textarea className="input" required rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Summary of discussion…" />
          </div>
          <div>
            <label className="label">Follow-up Date</label>
            <input className="input" type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="int-form" type="submit" disabled={saving}>
          {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : 'Log Interaction'}
        </button>
      </div>
    </motion.div>
  </div>
);

const Interactions = () => {
  const { user, isAdmin, isManager } = useAuth();
  const isStaff = !isAdmin && !isManager;
  const location = useLocation();
  const [interactions, setInteractions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [form, setForm] = useState({ client_id: '', type: 'Call', notes: '', follow_up_date: '' });

  useEffect(() => { 
    fetchData(); 
    if (location.state?.preselectClientId) {
      setForm(f => ({ ...f, client_id: location.state.preselectClientId }));
      setShowModal(true);
    }
  }, [location.state]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let intQuery = supabase.from('interactions').select('*, clients(full_name)').order('interaction_date', { ascending: false });
      let clientsQuery = supabase.from('clients').select('id, full_name');
      if (isStaff) {
        intQuery = intQuery.eq('created_by', user.id);
        clientsQuery = clientsQuery.eq('assigned_to', user.id);
      }
      const [{ data: iData }, { data: cData }] = await Promise.all([intQuery, clientsQuery]);
      setInteractions(iData || []);
      setClients(cData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.notes) { setFormErr('Client and notes are required.'); return; }
    setSaving(true); setFormErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('interactions').insert([{ 
        client_id: form.client_id, 
        type: form.type, 
        notes: form.notes, 
        follow_up_date: form.follow_up_date || null,
        created_by: user?.id
      }]);
      if (error) throw error;
      setShowModal(false); fetchData();
    } catch (e) { setFormErr(e.message); } finally { setSaving(false); }
  };

  const filtered = interactions.filter(i => {
    const isOverdue = i.follow_up_date && new Date(i.follow_up_date) < new Date();
    return (!typeFilter || i.type === typeFilter) && (!showOverdue || isOverdue);
  });

  const getIcon = (type) => {
    switch (type) {
      case 'Call': return <Phone size={16} />;
      case 'Email': return <Mail size={16} />;
      case 'Meeting': return <Users size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getBadge = (type) => {
    switch (type) {
      case 'Call': return 'badge-blue';
      case 'Email': return 'badge-indigo';
      case 'Meeting': return 'badge-emerald';
      default: return 'badge-slate';
    }
  };

  const openAdd = () => { setForm({ client_id: '', type: 'Call', notes: '', follow_up_date: '' }); setFormErr(null); setShowModal(true); };

  return (
    <div className="animate-in" style={{ paddingBottom: 40, maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interactions</h1>
          <p className="page-subtitle">Timeline of client communications</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} />Log Interaction</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <select className="input" style={{ paddingRight: 34, minWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <Filter size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer' }}>
          <input type="checkbox" checked={showOverdue} onChange={e => setShowOverdue(e.target.checked)} style={{ width: 14, height: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Overdue Follow-ups</span>
        </label>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /><p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading timeline…</p></div>
      ) : (!interactions || filtered.length === 0) ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><MessageSquare size={22} /></div>
            <p className="empty-title">No interactions found</p>
            <p className="empty-desc">Log your first communication to build the client timeline.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}><Plus size={14} />Log Interaction</button>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Timeline Line */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 44, width: 2, background: 'var(--border)' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((item, idx) => {
              const isOverdue = item.follow_up_date && new Date(item.follow_up_date) < new Date();
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  style={{ display: 'flex', gap: 16, position: 'relative' }}>
                  
                  {/* Timeline Dot/Icon */}
                  <div style={{ position: 'relative', zIndex: 2, width: 42, height: 42, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {getIcon(item.type)}
                  </div>
                  
                  {/* Content Card */}
                  <div className="card" style={{ flex: 1, padding: 18, borderColor: isOverdue ? 'rgba(244,63,94,0.3)' : undefined, background: isOverdue ? 'rgba(244,63,94,0.02)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`badge ${getBadge(item.type)}`}>{item.type}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.clients?.full_name || 'Unknown Client'}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12} />
                        {item.interaction_date ? new Date(item.interaction_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: item.follow_up_date ? 16 : 0, whiteSpace: 'pre-wrap' }}>
                      {item.notes}
                    </p>
                    
                    {item.follow_up_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Follow-up:</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: isOverdue ? 'var(--rose)' : 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {isOverdue && <AlertCircle size={14} />}
                          {new Date(item.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && <InteractionModal form={form} setForm={setForm} clients={clients} saving={saving} err={formErr} onSave={handleSave} onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Interactions;
