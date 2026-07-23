import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Clock, MapPin, Video, CheckCircle2, X, Loader2, Edit3, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const EMPTY = { id: null, client_id: '', title: '', description: '', scheduled_at: '', duration_minutes: 30, location: '', is_completed: false };

const MeetingModal = ({ form, setForm, clients, saving, err, onSave, onClose }) => (
  <div className="modal-overlay">
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box">
      <div className="modal-header">
        <span className="modal-title">{form.id ? 'Edit Meeting' : 'Schedule Meeting'}</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="modal-body">
        {err && <div className="alert alert-error"><span>⚠</span><span>{err}</span></div>}
        <form id="meet-form" onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Meeting Title *</label>
            <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Project Kickoff" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Client *</label>
              <select className="input" required value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="input" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Date & Time *</label>
              <input className="input" type="datetime-local" required value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Zoom, Office, etc." />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Agenda or context…" />
          </div>
          {form.id && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_completed} onChange={e => setForm(f => ({ ...f, is_completed: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mark as completed</span>
            </label>
          )}
        </form>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="meet-form" type="submit" disabled={saving}>
          {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : form.id ? 'Save Changes' : 'Schedule'}
        </button>
      </div>
    </motion.div>
  </div>
);

const Meetings = () => {
  const { user, isAdmin, isManager } = useAuth();
  const isStaff = !isAdmin && !isManager;
  const [meetings, setMeetings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchData();

    // Handle Quick Action
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      openAdd();
      // Clear the param from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let meetQuery = supabase.from('meetings').select('*').order('scheduled_at', { ascending: true });
      let clientsQuery = supabase.from('clients').select('id, full_name, company');
      if (isStaff) {
        meetQuery = meetQuery.eq('created_by', user.id);
        clientsQuery = clientsQuery.eq('assigned_to', user.id);
      }
      const [{ data: mData }, { data: cData }] = await Promise.all([meetQuery, clientsQuery]);
      const map = (cData || []).reduce((a, c) => ({ ...a, [c.id]: c.company || c.full_name }), {});
      setMeetings((mData || []).map(m => ({ ...m, client_name: map[m.client_id] || 'Unknown' })));
      setClients(cData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY); setFormErr(null); setShowModal(true); };
  const openEdit = (m) => { setForm({ ...m, scheduled_at: m.scheduled_at?.slice(0, 16) || '' }); setFormErr(null); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.title || !form.scheduled_at) { setFormErr('Title, client, and date/time are required.'); return; }
    setSaving(true); setFormErr(null);
    try {
      const payload = { client_id: form.client_id, title: form.title, description: form.description, scheduled_at: form.scheduled_at, duration_minutes: form.duration_minutes, location: form.location, is_completed: form.is_completed };
      if (form.id) { const { error } = await supabase.from('meetings').update(payload).eq('id', form.id); if (error) throw error; }
      else { const { error } = await supabase.from('meetings').insert([payload]); if (error) throw error; }
      setShowModal(false); fetchData();
    } catch (e) { setFormErr(e.message); } finally { setSaving(false); }
  };

  const toggleComplete = async (m) => {
    try { await supabase.from('meetings').update({ is_completed: !m.is_completed }).eq('id', m.id); fetchData(); }
    catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    try { await supabase.from('meetings').delete().eq('id', id); fetchData(); }
    catch (e) { console.error(e); }
  };

  const now = new Date();
  const displayed = meetings.filter(m => {
    const past = new Date(m.scheduled_at) < now || m.is_completed;
    return activeTab === 'Upcoming' ? !past : past;
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle">Schedule and track client appointments</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} />Schedule Meeting</button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {['Upcoming', 'Past'].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t}
            <span style={{ fontSize: 11, background: activeTab === t ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)', color: activeTab === t ? 'var(--accent-light)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid var(--border)' }}>
              {meetings.filter(m => { const past = new Date(m.scheduled_at) < now || m.is_completed; return t === 'Upcoming' ? !past : past; }).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /><p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading meetings…</p></div>
      ) : displayed.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Calendar size={22} /></div>
            <p className="empty-title">No {activeTab.toLowerCase()} meetings</p>
            <p className="empty-desc">{activeTab === 'Upcoming' ? 'Schedule a meeting with a client to see it here.' : 'Completed or past meetings will appear here.'}</p>
            {activeTab === 'Upcoming' && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}><Plus size={14} />Schedule Meeting</button>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {displayed.map((m, i) => {
            const isOverdue = new Date(m.scheduled_at) < now && !m.is_completed;
            const dt = new Date(m.scheduled_at);
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card"
                style={{ padding: 20, borderColor: isOverdue ? 'rgba(244,63,94,0.25)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: m.is_completed ? 'rgba(100,116,139,0.1)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.is_completed ? '#64748b' : 'var(--accent-light)', flexShrink: 0 }}>
                      <Video size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: m.is_completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: m.is_completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>{m.client_name}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleComplete(m)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.is_completed ? 'var(--emerald)' : 'var(--bg-elevated)', color: m.is_completed ? '#fff' : 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }} title="Toggle complete">
                    <CheckCircle2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: m.description ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</p>
                      <p style={{ fontSize: 12.5, color: isOverdue ? 'var(--rose)' : 'var(--text-secondary)', fontWeight: 600 }}>
                        {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{m.location || '—'}</p>
                    </div>
                  </div>
                </div>

                {m.description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>{m.description}</p>}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {isOverdue
                    ? <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--rose)' }}>⚠ Overdue</span>
                    : <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.duration_minutes} min</span>
                  }
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(m)} title="Edit"><Edit3 size={14} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(m.id)} title="Delete" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--rose)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && <MeetingModal form={form} setForm={setForm} clients={clients} saving={saving} err={formErr} onSave={handleSave} onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Meetings;
