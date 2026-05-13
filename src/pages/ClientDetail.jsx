import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Mail, Phone, Calendar, ArrowLeft, MoreVertical, 
  LayoutDashboard, Briefcase, CheckSquare, MessageSquare, 
  DollarSign, History, Rocket, ShieldCheck, Zap 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientTimeline from '../components/ClientTimeline';

const STATUS_BADGE = { Active: 'badge-emerald', Onboarding: 'badge-blue', 'At Risk': 'badge-amber', Churned: 'badge-rose' };

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({ projects: [], tasks: [], meetings: [], interactions: [], payments: [] });

  useEffect(() => { if (id) fetchClientData(); }, [id]);

  const fetchClientData = async () => {
    setLoading(true);
    try {
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
          <button className="btn btn-danger btn-sm" onClick={handleDeleteClient}>Delete Client</button>
        </div>
      </div>

      {/* Hero Profile */}
      <div className="card" style={{ padding: 32, marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ width: 120, height: 120, borderRadius: 28, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 800, color: '#fff', boxShadow: '0 16px 32px rgba(99,102,241,0.25)', flexShrink: 0 }}>
          {client.full_name?.[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{client.full_name}</h1>
            <span className={`badge ${STATUS_BADGE[client.status] || 'badge-slate'}`}><span className="badge-dot" />{client.status}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
            {[
              [Building2, 'Business Name', client.company || '—'],
              [Mail, 'Email', client.email],
              [Phone, 'Phone', client.phone || '—'],
              [Calendar, 'Added', new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
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
            ))}
            {client.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: 'span 2' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Address</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{client.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 140, padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Health Score</p>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
            <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle cx="40" cy="40" r="36" fill="none" stroke={client.health_score >= 70 ? 'var(--emerald)' : client.health_score >= 40 ? 'var(--amber)' : 'var(--rose)'} strokeWidth="6" strokeDasharray={226} strokeDashoffset={226 - (226 * (client.health_score || 80) / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{client.health_score || 80}</span>
          </div>
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
                    <thead><tr><th>Project Title</th><th>Budget</th><th>Status</th><th>Deadline</th></tr></thead>
                    <tbody>
                      {data.projects.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</td>
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
    </div>
  );
};

export default ClientDetail;
