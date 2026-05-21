import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Mail, Phone, Calendar, ArrowLeft, MoreVertical, Users, 
  LayoutDashboard, Briefcase, CheckSquare, MessageSquare, 
  DollarSign, History, ShieldCheck, Edit3, X, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientTimeline from '../components/ClientTimeline';
import { useAuth } from '../hooks/useAuth';
import { decryptCard } from '../lib/cardCrypto';

const STATUS_BADGE = { Active: 'badge-emerald', Onboarding: 'badge-blue', 'At Risk': 'badge-amber', Churned: 'badge-rose' };

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isManager } = useAuth();
  const [client, setClient] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [data, setData] = useState({ projects: [], tasks: [], meetings: [], interactions: [], payments: [] });

  const [revealedCard, setRevealedCard] = useState({ number: false });
  const [decryptedCard, setDecryptedCard] = useState({ number: '' });
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [decryptedCvv, setDecryptedCvv] = useState('');
  const [copied, setCopied] = useState(false);

  const handleHideCard = (field) => {
    setRevealedCard(prev => ({ ...prev, [field]: false }));
    setDecryptedCvv('');
    setCopied(false);
  };

  const handleCopyCvv = () => {
    if (!decryptedCvv) return;
    navigator.clipboard.writeText(decryptedCvv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyAndReveal = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError('');
    try {
      // Always verifies against the CURRENT live password stored in Supabase Auth.
      // If the admin changed their password via Settings, the NEW password must be used here.
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: authPassword
      });

      if (authErr || !authData?.session) {
        throw new Error('Incorrect password. Use your current (latest) password.');
      }
      
      const numVal = await decryptCard(client.card_number_enc);
      const cvvVal = client.card_cvv ? await decryptCard(client.card_cvv) : '';
      
      if (numVal) {
        setDecryptedCard(prev => ({ ...prev, number: numVal }));
        setDecryptedCvv(cvvVal);
        setRevealedCard(prev => ({ ...prev, number: true }));
        setShowReAuthModal(false);
        setAuthPassword('');
      } else {
        throw new Error('Failed to decrypt card details.');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const getHealthScore = () => {
    if (!client) return 80;
    if (client.status === 'Churned') return 0;
    
    let score = 100;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // 1. Overdue payments check
    const overduePayments = (data.payments || []).filter(p => !p.is_paid && p.due_date && new Date(p.due_date) < today);
    score -= overduePayments.length * 25;
    
    // 2. Overdue tasks check
    const overdueTasks = (data.tasks || []).filter(t => t.status !== 'Completed' && t.due_date && new Date(t.due_date) < today);
    score -= overdueTasks.length * 15;
    
    // 3. Cap based on status
    if (client.status === 'At Risk') {
      score = Math.min(score, 40);
    }
    
    // 4. Inactive check (no active projects in progress or pending)
    const activeProjects = (data.projects || []).filter(p => p.status === 'In Progress' || p.status === 'Pending');
    if (activeProjects.length === 0) {
      score -= 15;
    }
    
    return Math.max(10, Math.min(100, score));
  };

  useEffect(() => { if (id) fetchClientData(); }, [id]);

    const fetchClientData = async () => {
    setLoading(true);
    try {
      // Read from staff_keys so ALL active staff (including Employees) appear in dropdowns
      const { data: staffRows } = await supabase
        .from('staff_keys')
        .select('user_id, full_name, role')
        .eq('is_active', true);
      setStaffList(staffRows || []);

      const { data: cData } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (!cData) { setClient(null); setLoading(false); return; }
      setClient(cData);

      const [pRes, tRes, mRes, iRes] = await Promise.all([
        supabase.from('projects').select('*').eq('client_id', id),
        supabase.from('tasks').select('*').eq('client_id', id),
        supabase.from('meetings').select('*').eq('client_id', id),
        supabase.from('interactions').select('*').eq('client_id', id)
      ]);

      let payments = [];
      if (pRes.data?.length > 0) {
        const { data: payData } = await supabase.from('payments').select('*').in('project_id', pRes.data.map(p => p.id));
        payments = payData || [];
      }

      setData({ projects: pRes.data || [], tasks: tRes.data || [], meetings: mRes.data || [], interactions: iRes.data || [], payments });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').update({
        full_name: editForm.full_name,
        email: editForm.business_email,
        business_email: editForm.business_email,
        phone: editForm.phone,
        company: editForm.company,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        zip_code: editForm.zip_code,
        status: editForm.status,
        assigned_to: editForm.assigned_to || null
      }).eq('id', id);
      if (error) throw error;
      setClient({ ...client, ...editForm });
      setShowEditModal(false);
    } catch (e) {
      alert('Update failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setEditForm({ ...client });
    setShowEditModal(true);
  };

  const handleDeleteClient = async () => {
    if (!window.confirm('Are you sure you want to completely delete this client? All projects, payments, and interactions will be permanently lost.')) return;
    try {
      setLoading(true);
      if (data.projects.length > 0) {
        const { error: payErr } = await supabase.from('payments').delete().in('project_id', data.projects.map(p => p.id));
        if (payErr) throw payErr;
      }
      await supabase.from('projects').delete().eq('client_id', id);
      await supabase.from('meetings').delete().eq('client_id', id);
      await supabase.from('interactions').delete().eq('client_id', id);
      await supabase.from('tasks').delete().eq('client_id', id);
      
      const { data: delData, error } = await supabase.from('clients').delete().eq('id', id).select();
      if (error) throw error;
      if (!delData || delData.length === 0) {
        throw new Error("Deletion blocked by Supabase Row Level Security (RLS). Please add a DELETE policy for the 'clients' table in your Supabase dashboard.");
      }
      
      navigate('/clients');
    } catch (e) {
      alert('Failed to delete client: ' + e.message);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 20 }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Loading client details…</p>
    </div>
  );

  if (!client) return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="empty-icon" style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--rose)', borderColor: 'rgba(244,63,94,0.2)' }}><ShieldCheck size={28} /></div>
      <p className="empty-title">Client Not Found</p>
      <p className="empty-desc">The requested client could not be located in the database.</p>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/clients')}><ArrowLeft size={15} /> Back to Clients</button>
    </div>
  );

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'interactions', label: 'Interactions', icon: MessageSquare },
    { id: 'timeline', label: 'Timeline', icon: History }
  ];

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Top Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/clients')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-slate" style={{ fontFamily: 'monospace' }}>ID: {id.slice(0, 8)}</span>
          <button className="btn btn-secondary btn-sm" onClick={openEdit}><Edit3 size={14} /> Edit</button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteClient}>Delete Client</button>
        </div>
      </div>

      {/* Hero Profile */}
      <div className="card" style={{ padding: 32, marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ width: 120, height: 120, borderRadius: 28, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 800, color: '#fff', boxShadow: '0 16px 32px rgba(99,102,241,0.25)', flexShrink: 0 }}>
          {client.full_name?.trim()?.[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{client.full_name}</h1>
            <span className={`badge ${STATUS_BADGE[client.status] || 'badge-slate'}`}><span className="badge-dot" />{client.status}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
            {(() => {
              const assignedStaff = staffList.find(s => s.user_id === client.assigned_to);
              return [
                [Building2, 'Business Name', client.company || '—'],
                [Mail, 'Business Email', client.business_email || client.email],
                [Phone, 'Phone', client.phone || '—'],
                [Calendar, 'Added', new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                [Users, 'Assigned Staff', assignedStaff ? `${assignedStaff.full_name} (${assignedStaff.role})` : 'Unassigned']
              ].map(([Icon, lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</p>
                  </div>
                </div>
              ));
            })()}
            {client.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: 'span 2' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Street Address</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {client.address}
                    {(client.city || client.state || client.zip_code) && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>
                        ({[client.city, client.state, client.zip_code].filter(Boolean).join(', ')})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 140, padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Health Score */}
          {(() => {
            const score = getHealthScore();
            return (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Health Score</p>
                <div style={{ position: 'relative', width: 70, height: 70, margin: '0 auto' }}>
                  <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="35" cy="35" r="31" fill="none" stroke="var(--border)" strokeWidth="5" />
                    <circle cx="35" cy="35" r="31" fill="none" stroke={score >= 70 ? 'var(--emerald)' : score >= 40 ? 'var(--amber)' : 'var(--rose)'} strokeWidth="5" strokeDasharray={195} strokeDashoffset={195 - (195 * score / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{score}</span>
                </div>
              </div>
            );
          })()}

          {/* Payment Method */}
          {client.payment_method && (
            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Payment</p>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)' }}>{client.payment_method}</span>
            </div>
          )}

          {/* Masked Card Display — Admin only reveal */}
          {isAdmin && client.card_number && (
            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Card</p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', marginBottom: 4 }}>
                {revealedCard.number ? decryptedCard.number : `**** **** **** ${client.card_number?.slice(-4)}`}
              </p>
              
              {revealedCard.number && client.card_cvv && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CVV</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>***</span>
                    <button onClick={handleCopyCvv} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: copied ? 'var(--emerald)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {copied ? '✓ Copied' : '📋 Copy CVV'}
                    </button>
                  </div>
                </div>
              )}

              <button onClick={() => revealedCard.number ? handleHideCard('number') : setShowReAuthModal(true)}
                style={{ fontSize: 10, fontWeight: 700, color: revealedCard.number ? 'var(--rose)' : 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {revealedCard.number ? 'Hide' : '🔓 Reveal'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Active Projects', v: data.projects.length, icon: Briefcase, c: 'blue' },
                  { label: 'Revenue Generated', v: `$${data.payments.filter(p=>p.is_paid).reduce((a,c)=>a+(c.amount||0),0).toLocaleString()}`, icon: DollarSign, c: 'emerald' },
                  { label: 'Total Interactions', v: data.interactions.length, icon: MessageSquare, c: 'indigo' },
                  { label: 'Pending Tasks', v: data.tasks.filter(t=>t.status!=='Completed').length, icon: CheckSquare, c: 'amber' },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ padding: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${s.c}-glow)`, color: `var(--${s.c})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <s.icon size={18} />
                    </div>
                    <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{s.v}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Client Projects</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects', { state: { preselectClientId: id } })}>
                    <Briefcase size={14} /> New Project
                  </button>
                </div>
                {data.projects.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><Briefcase size={22} /></div>
                    <p className="empty-title">No projects</p>
                    <p className="empty-desc">This client has no projects yet.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Project Title</th><th>Services</th><th>Budget</th><th>Status</th><th>Deadline</th></tr></thead>
                    <tbody>
                      {data.projects.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {p.services ? (
                              <span style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent-light)', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, border: '1px solid rgba(99,102,241,0.15)', display: 'inline-block' }}>
                                {p.services}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ color: 'var(--accent-light)' }}>${(p.budget||0).toLocaleString()}</td>
                          <td><span className="badge badge-slate">{p.status}</span></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.end_date ? new Date(p.end_date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'interactions' && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Communication History</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/interactions', { state: { preselectClientId: id } })}>
                    <MessageSquare size={14} /> Log Interaction
                  </button>
                </div>
                {data.interactions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><MessageSquare size={22} /></div>
                    <p className="empty-title">No interactions</p>
                    <p className="empty-desc">No communication history recorded.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Notes</th><th>Date</th></tr></thead>
                    <tbody>
                      {data.interactions.map(int => (
                        <tr key={int.id}>
                          <td><span className="badge badge-slate">{int.type}</span></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{int.notes}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{new Date(int.interaction_date).toLocaleDateString('en-US', {month:'short',day:'numeric'})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="card" style={{ padding: 24 }}>
                <ClientTimeline clientId={id} />
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showEditModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-lg">
              <div className="modal-header">
                <span className="modal-title">Edit Client Details</span>
                <button onClick={() => setShowEditModal(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
              </div>
              <form onSubmit={handleUpdateClient}>
                <div className="modal-body grid grid-cols-2 gap-4" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
                  <div className="col-span-2">
                    <label className="label">Full Name *</label>
                    <input className="input" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="label">Business Email *</label>
                    <input className="input" type="email" value={editForm.business_email || editForm.email || ''} onChange={e => setEditForm({...editForm, business_email: e.target.value, email: e.target.value})} required />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Business Name</label>
                    <input className="input" value={editForm.company || ''} onChange={e => setEditForm({...editForm, company: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                      <option value="Active">Active</option>
                      <option value="Onboarding">Onboarding</option>
                      <option value="At Risk">At Risk</option>
                      <option value="Churned">Churned</option>
                    </select>
                  </div>
                  <div className="col-span-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Street Address</label>
                      <input className="input" value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">City</label>
                      <input className="input" value={editForm.city || ''} onChange={e => setEditForm({...editForm, city: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">State</label>
                      <input className="input" value={editForm.state || ''} onChange={e => setEditForm({...editForm, state: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Zip Code</label>
                      <input className="input" value={editForm.zip_code || ''} onChange={e => setEditForm({...editForm, zip_code: e.target.value})} />
                    </div>
                  </div>
                  {(isAdmin || isManager) && (
                    <div className="col-span-2">
                      <label className="label">Assign Client to Staff Member</label>
                      <select className="input" value={editForm.assigned_to || ''} onChange={e => setEditForm({...editForm, assigned_to: e.target.value})}>
                        <option value="">Select Staff...</option>
                        {staffList.map(s => (
                          <option key={s.user_id} value={s.user_id}>
                            {s.full_name} ({s.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReAuthModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReAuthModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-sm" style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-light)', margin: '0 auto 12px auto' }}>
                  <ShieldCheck size={24} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Security Verification</h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 10px 0' }}>
                  Enter your <strong style={{ color: 'var(--text-secondary)' }}>current password</strong> to reveal decrypted card details.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '5px 10px' }}>
                  <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>⚠ If you recently changed your password in Settings, use the NEW password.</span>
                </div>
              </div>

              <form onSubmit={handleVerifyAndReveal}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div>
                    <input 
                      type="password" 
                      className="input" 
                      placeholder="Confirm your password" 
                      value={authPassword} 
                      onChange={e => setAuthPassword(e.target.value)} 
                      required 
                      autoFocus
                    />
                  </div>
                  {authError && (
                    <p style={{ fontSize: 12, color: 'var(--rose)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠️ {authError}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowReAuthModal(false); setAuthPassword(''); setAuthError(''); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={verifying}>
                    {verifying ? <Loader2 size={13} className="animate-spin" /> : 'Confirm & Reveal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientDetail;
