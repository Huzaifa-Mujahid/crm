import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, Clock, DollarSign,
  TrendingUp, Calendar, MessageSquare, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const TTStyle = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' };

const StatCard = ({ icon: Icon, label, value, color = 'indigo', onClick }) => {
  const C = { indigo: ['rgba(99,102,241,0.1)', '#818cf8'], emerald: ['rgba(16,185,129,0.1)', '#34d399'], amber: ['rgba(245,158,11,0.1)', '#fbbf24'], rose: ['rgba(244,63,94,0.1)', '#fb7185'], blue: ['rgba(59,130,246,0.1)', '#60a5fa'] };
  const [bg, fg] = C[color] || C.indigo;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fg }}>
          <Icon size={17} />
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 3 }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
    </motion.div>
  );
};

const QuickAction = ({ icon: Icon, label, desc, path, color = 'indigo' }) => {
  const nav = useNavigate();
  const C = { indigo: ['rgba(99,102,241,0.1)', '#818cf8'], emerald: ['rgba(16,185,129,0.1)', '#34d399'], amber: ['rgba(245,158,11,0.1)', '#fbbf24'], blue: ['rgba(59,130,246,0.1)', '#60a5fa'] };
  const [bg, fg] = C[color] || C.indigo;
  return (
    <button onClick={() => nav(path)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left', width: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
};

const Dashboard = () => {
  const { user, role, isAdmin: authIsAdmin, isManager: authIsManager } = useAuth();
  const isAdmin = authIsAdmin;
  const isManager = authIsManager;
  const isStaff = !isAdmin && !isManager;
  
  const [stats, setStats] = useState({ clients: 0, projects: 0, revenue: 0, overdue: 0 });
  const [projData, setProjData] = useState([]);
  const [revChartData, setRevChartData] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { 
    if (user && role !== null) {
      fetchStats(); 
    }
  }, [user, role]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const nowStr = new Date().toISOString();

      // Base queries
      let clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
      let projectsQuery = supabase.from('projects').select('*', { count: 'exact', head: true });
      let paymentsQuery = supabase.from('payments').select('amount, payment_date, is_paid, due_date').eq('is_paid', true);
      let overdueQuery = supabase.from('payments').select('*', { count: 'exact', head: true }).eq('is_paid', false).lt('due_date', nowStr);
      let tasksQuery = supabase.from('tasks').select('*, clients(full_name), assignee:user_roles!tasks_assigned_to_fkey(full_name)').order('due_date', { ascending: true }).limit(5);

      // Filtering for staff
      if (isStaff) {
        clientsQuery = clientsQuery.eq('assigned_to', user.id);
        projectsQuery = projectsQuery.eq('assigned_to', user.id);
        tasksQuery = tasksQuery.eq('assigned_to', user.id);
        
        const { data: staffProjIds } = await supabase.from('projects').select('id').eq('assigned_to', user.id);
        const pIds = staffProjIds?.map(p => p.id) || [];
        if (pIds.length > 0) {
          paymentsQuery = paymentsQuery.in('project_id', pIds);
          overdueQuery = overdueQuery.in('project_id', pIds);
        } else {
          paymentsQuery = paymentsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          overdueQuery = overdueQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const [resC, resP, resRev, resProj, resOver, resTasks] = await Promise.all([
        clientsQuery,
        projectsQuery,
        paymentsQuery,
        supabase.from('projects').select('status').filter(isStaff ? 'assigned_to' : 'id', isStaff ? 'eq' : 'neq', isStaff ? user.id : '00000000-0000-0000-0000-000000000000'),
        overdueQuery,
        tasksQuery
      ]);

      const c = resC?.count || 0;
      const p = resP?.count || 0;
      const revData = resRev?.data || [];
      const projRows = resProj?.data || [];
      const overdueCount = resOver?.count || 0;
      const taskRows = resTasks?.data || [];

      const revenue = revData.reduce((s, x) => s + (x.amount || 0), 0);
      const counts = { Pending: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
      projRows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
      
      setProjData([
        { name: 'Pending', value: counts['Pending'], color: '#f59e0b' },
        { name: 'In Progress', value: counts['In Progress'], color: '#6366f1' },
        { name: 'Completed', value: counts['Completed'], color: '#10b981' },
        { name: 'Cancelled', value: counts['Cancelled'], color: '#f43f5e' },
      ]);
      setStats({ clients: c, projects: p, revenue, overdue: overdueCount });
      setMyTasks(taskRows);

      // Build revenue chart data
      const monthsStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const curMonth = new Date().getMonth();
      const chartMap = {};
      for (let i = 5; i >= 0; i--) {
        let m = curMonth - i;
        if (m < 0) m += 12;
        chartMap[monthsStr[m]] = 0;
      }

      revData.forEach(r => {
        if (r.payment_date) {
          const mName = monthsStr[new Date(r.payment_date).getMonth()];
          if (chartMap[mName] !== undefined) chartMap[mName] += (r.amount || 0);
        }
      });
      setRevChartData(Object.keys(chartMap).map(k => ({ month: k, revenue: chartMap[k] })));
    } catch (err) { 
      console.error('FetchStats Error:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Welcome back, {user?.user_metadata?.full_name ? user.user_metadata.full_name.split(' ')[0] : 'User'}!</h1>
          <p className="page-subtitle">Here is what's happening with your accounts today.</p>
        </div>
        <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>System Active</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard icon={Users}      label="Total Clients"   value={stats.clients}      color="indigo"  onClick={() => navigate('/clients')} />
        <StatCard icon={Briefcase}  label="Active Projects" value={stats.projects}     color="blue"    onClick={() => navigate('/projects')} />
        <StatCard icon={DollarSign} label="Total Revenue"   value={fmt(stats.revenue)} color="emerald" onClick={() => navigate('/payments')} />
        <StatCard icon={Clock}      label="Overdue Items"   value={stats.overdue}      color="rose"    onClick={() => navigate('/payments')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }} className="dash-grid">
        {(isAdmin || isManager) && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <p className="section-title">Revenue Overview</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Real collected revenue over last 6 months</p>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} />Revenue
                </span>
              </div>
            </div>
            <div style={{ height: 240 }}>
              {revChartData.reduce((s, x) => s + x.revenue, 0) === 0 ? (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                   <p className="empty-desc">No revenue collected in the last 6 months.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TTStyle} formatter={(v) => [`$${v.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#rg)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 24 }}>
          <p className="section-title" style={{ marginBottom: 18 }}>Project Status</p>
          <div style={{ height: 170, marginBottom: 14 }}>
            {projData.reduce((s, x) => s + x.value, 0) === 0 ? (
               <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                 <p className="empty-desc">No active projects.</p>
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projData} margin={{ top: 0, right: 0, left: -32, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                  <Tooltip contentStyle={TTStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1"
                    label={false}
                    cell={(entry) => <rect fill={entry.color} />}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <hr className="divider" style={{ marginBottom: 14 }} />
          {projData.map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.name}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }} className="dash-grid">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p className="section-title">{isAdmin ? 'Recent Team Tasks' : 'My Assigned Tasks'}</p>
            <button onClick={() => navigate('/projects')} className="text-xs text-indigo-400 font-semibold hover:underline">View All</button>
          </div>
          
          <div className="overflow-hidden">
            {myTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <p className="empty-desc">No tasks assigned to you yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myTasks.map(task => (
                  <div key={task.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: 12, 
                    padding: '12px 14px', borderRadius: 10, 
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' 
                  }}>
                    <div style={{ 
                      width: 8, height: 8, borderRadius: '50%', 
                      background: task.status === 'Completed' ? '#10b981' : task.status === 'Pending' ? '#f59e0b' : '#6366f1' 
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {task.clients?.full_name || 'No Client'} 
                        {isAdmin && task.assignee?.full_name && (
                          <>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)' }} />
                            <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>to {task.assignee.full_name}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Date'}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{task.duration || 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!isAdmin && (
          <div className="card" style={{ padding: 24 }}>
            <p className="section-title" style={{ marginBottom: 14 }}>Quick Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <QuickAction icon={Users}         label="Clients"      desc="View your database"   path="/clients"      color="indigo" />
              <QuickAction icon={Briefcase}     label="Projects"     desc="Track status"     path="/projects"     color="blue" />
              <QuickAction icon={Calendar}      label="Meetings"    desc="Book appointments"         path="/meetings"     color="emerald" />
              <QuickAction icon={MessageSquare} label="Log Interaction"     desc="Record comms"         path="/interactions" color="amber" />
            </div>
          </div>
        )}
      </div>

      <style>{`@media(max-width:900px){.dash-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
};

export default Dashboard;
