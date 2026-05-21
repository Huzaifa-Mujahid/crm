import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, LayoutGrid, Table as TableIcon, X, Loader2, Calendar, DollarSign, ChevronRight, Briefcase } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const STATUS_STYLES = {
  Pending:     'badge-amber',
  'In Progress':'badge-indigo',
  Completed:   'badge-emerald',
  Cancelled:   'badge-rose',
};
const STATUS_COLORS = { Pending: '#f59e0b', 'In Progress': '#6366f1', Completed: '#10b981', Cancelled: '#f43f5e' };
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

const SERVICE_OPTIONS = [
  'GMB + WEBSITE DEVELOPMENT',
  'SOCIAL MEDIA',
  'LANDING PAGE - MARKETING',
  'WEBSITE REDESIGN & DEVELOPMENT',
  'GMB + LANDING PAGE MARKETING',
  'GMB + SOCIAL MEDIA (PAID)',
  'GMB+WEBSITE DEVELOPMENT',
  'GOOGLE BUSINESS PROFILE ( SEO )',
  'GMB CREATION ONE TIME',
  'GOOGLE ADS',
];

const EMPTY_FORM = { id: null, client_id: '', title: '', services: '', description: '', budget: '', status: 'Pending', start_date: '', end_date: '' };

/* ── Project Modal ─────────────────────────────────────────────── */
const ProjectModal = ({ formData, setFormData, clients, saving, formError, onSave, onDelete, onClose, isEdit }) => {
  const { user, isAdmin, isManager } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [customService, setCustomService] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (formData.services && !SERVICE_OPTIONS.includes(formData.services)) {
      setCustomService(true);
    }
  }, [formData.services]);

  const fetchStaff = async () => {
    // Read from staff_keys so ALL active staff (including Employees) appear in dropdowns
    const { data } = await supabase
      .from('staff_keys')
      .select('user_id, full_name, role')
      .eq('is_active', true);
    setStaffList(data || []);
  };

  return (
    <div className="modal-overlay">
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box">
      <div className="modal-header">
        <span className="modal-title">{isEdit ? 'Edit Project' : 'New Project'}</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="modal-body">
        {formError && <div className="alert alert-error"><span>⚠</span><span>{formError}</span></div>}
        <form id="proj-form" onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label className="label">Client *</label>
              <select className="input" required value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Select a client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Project Title *</label>
              <input className="input" required value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Website Redesign" />
            </div>
            <div>
              <label className="label">Services Included</label>
              {!customService && (SERVICE_OPTIONS.includes(formData.services) || !formData.services) ? (
                <select className="input" value={formData.services || ''} onChange={e => {
                  const val = e.target.value;
                  if (val === 'Custom') {
                    setCustomService(true);
                    setFormData(f => ({ ...f, services: '' }));
                  } else {
                    setFormData(f => ({ ...f, services: val }));
                  }
                }}>
                  <option value="">Select Service...</option>
                  {SERVICE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Custom">✨ Write Custom Service...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" style={{ flex: 1 }} value={formData.services || ''} onChange={e => setFormData(f => ({ ...f, services: e.target.value.toUpperCase() }))} placeholder="Write custom service..." />
                  <button className="btn btn-secondary btn-sm" style={{ padding: '0 10px', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    type="button"
                    onClick={() => { setCustomService(false); setFormData(f => ({ ...f, services: '' })); }}>
                    ✕ Dropdown
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Brief project description…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Sales Agent Name</label>
              <select className="input" value={formData.sales_agent || ''} onChange={e => setFormData(f => ({ ...f, sales_agent: e.target.value }))}>
                <option value="">Select Agent...</option>
                {staffList.filter(s => s.role === 'Sales Agent').map(s => (
                  <option key={s.user_id} value={s.full_name}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Closer Name</label>
              <select className="input" value={formData.closer || ''} onChange={e => setFormData(f => ({ ...f, closer: e.target.value }))}>
                <option value="">Select Closer...</option>
                {staffList.filter(s => s.role === 'Sales Closer').map(s => (
                  <option key={s.user_id} value={s.full_name}>{s.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Budget ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={formData.budget} onChange={e => setFormData(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Assigned Staff</label>
              <select className="input" value={formData.assigned_to || ''} onChange={e => setFormData(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Select Staff...</option>
                {staffList.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
            </div>
            <div>
              <label className="label">Deadline</label>
              <input className="input" type="date" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
        {isEdit && <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete Project</button>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="proj-form" type="submit" disabled={saving}>
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);
};

/* ── Projects Page ─────────────────────────────────────────────── */
const Projects = () => {
  const { user, isAdmin, isManager } = useAuth();
  const isStaff = !isAdmin && !isManager;
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => { 
    fetchData(); 
    if (location.state?.preselectClientId) {
      setFormData(f => ({ ...f, client_id: location.state.preselectClientId }));
      setIsEdit(false);
      setShowModal(true);
    }
  }, [location.state]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let projQuery = supabase.from('projects').select('*').order('created_at', { ascending: false });
      let clientsQuery = supabase.from('clients').select('id, full_name');
      // Staff only see their assigned projects and clients
      if (isStaff) {
        projQuery = projQuery.eq('assigned_to', user.id);
        clientsQuery = clientsQuery.eq('assigned_to', user.id);
      }
      const [{ data: pData }, { data: cData }] = await Promise.all([projQuery, clientsQuery]);
      const map = (cData || []).reduce((a, c) => ({ ...a, [c.id]: c.full_name }), {});
      setProjects((pData || []).map(p => ({ ...p, client_name: map[p.client_id] || 'Unknown' })));
      setClients(cData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openAdd = () => { setFormData({ ...EMPTY_FORM, assigned_to: user.id }); setFormError(null); setIsEdit(false); setShowModal(true); };
  const openEdit = (p) => { setFormData({ id: p.id, client_id: p.client_id, title: p.title, services: p.services || '', description: p.description || '', budget: p.budget || '', status: p.status, start_date: p.start_date?.slice(0, 10) || '', end_date: p.end_date?.slice(0, 10) || '', sales_agent: p.sales_agent || '', closer: p.closer || '', assigned_to: p.assigned_to || '' }); setFormError(null); setIsEdit(true); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.client_id && !isEdit) { setFormError('Please select a client.'); return; }
    if (!formData.title) { setFormError('Project title is required.'); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = { client_id: formData.client_id, title: formData.title, services: formData.services || null, description: formData.description, budget: parseFloat(formData.budget) || 0, status: formData.status, start_date: formData.start_date || null, end_date: formData.end_date || null, sales_agent: formData.sales_agent || null, closer: formData.closer || null, assigned_to: formData.assigned_to || user.id };
      if (isEdit) { const { error } = await supabase.from('projects').update(payload).eq('id', formData.id); if (error) throw error; }
      else { const { error } = await supabase.from('projects').insert([payload]); if (error) throw error; }
      setShowModal(false); fetchData();
    } catch (e) { setFormError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this project? All associated data will be deleted.')) return;
    setSaving(true);
    try { 
      const { error: payErr } = await supabase.from('payments').delete().eq('project_id', formData.id);
      if (payErr) throw payErr;
      
      const { data, error } = await supabase.from('projects').delete().eq('id', formData.id).select(); 
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Deletion blocked by Supabase Row Level Security (RLS). Please add a DELETE policy for the 'projects' table in your Supabase dashboard.");
      }
      
      setShowModal(false); 
      fetchData(); 
    }
    catch (e) { 
      setFormError(e.message); 
      alert("Error: " + e.message);
    } finally { setSaving(false); }
  };

  const filtered = projects.filter(p => !statusFilter || p.status === statusFilter);

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} />New Project</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {[['table', TableIcon, 'Table'], ['kanban', LayoutGrid, 'Board']].map(([v, Icon, lbl]) => (
            <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)' }}>
              <Icon size={13} />{lbl}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <select className="input" style={{ paddingRight: 34, minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <Filter size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /><p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading projects…</p></div>
      ) : view === 'table' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Briefcase size={22} /></div>
              <p className="empty-title">No projects found</p>
              <p className="empty-desc">{statusFilter ? 'Try clearing the status filter.' : 'Create your first project to get started.'}</p>
              {!statusFilter && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}><Plus size={14} />New Project</button>}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Project</th><th>Services</th><th>Client</th><th>Budget</th><th>Status</th><th>Deadline</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} onClick={() => openEdit(p)}>
                      <td>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</p>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {p.services ? (
                          <span style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent-light)', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, border: '1px solid rgba(99,102,241,0.15)', display: 'inline-block' }}>
                            {p.services}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.client_name}</td>
                      <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-light)' }}>${(p.budget || 0).toLocaleString()}</td>
                      <td><span className={`badge ${STATUS_STYLES[p.status] || 'badge-slate'}`}><span className="badge-dot" />{p.status}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.end_date ? new Date(p.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); openEdit(p); }}><ChevronRight size={15} /></button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Kanban Board */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {STATUSES.map(status => {
            const cols = filtered.filter(p => p.status === status);
            return (
              <div key={status}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[status], display: 'inline-block' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{status}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px', color: 'var(--text-muted)' }}>{cols.length}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 12, border: '1px solid var(--border)', padding: 10, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cols.map(p => (
                    <motion.div key={p.id} onClick={() => openEdit(p)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                      whileHover={{ borderColor: 'var(--border-mid)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{p.title}</p>
                      {p.services && (
                        <p style={{ fontSize: 11, color: 'var(--accent-light)', marginBottom: 6, fontStyle: 'italic' }}>
                          ⚡ {p.services}
                        </p>
                      )}
                      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>{p.client_name}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)' }}>${(p.budget || 0).toLocaleString()}</span>
                        {p.end_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} />{new Date(p.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </motion.div>
                  ))}
                  {cols.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No projects</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && <ProjectModal formData={formData} setFormData={setFormData} clients={clients} saving={saving} formError={formError} onSave={handleSave} onDelete={handleDelete} onClose={() => setShowModal(false)} isEdit={isEdit} />}
      </AnimatePresence>
    </div>
  );
};

export default Projects;
