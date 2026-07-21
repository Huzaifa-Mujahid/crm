import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, Clock, DollarSign,
  TrendingUp, Calendar, MessageSquare, ChevronRight,
  CheckCircle2, FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const TTStyle = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' };

const StatCard = ({ icon: Icon, label, value, color = 'indigo', onClick }) => {
  const C = { 
    indigo: ['var(--accent-glow)', 'var(--accent-light)'], 
    emerald: ['var(--emerald-glow)', 'var(--emerald)'], 
    amber: ['var(--amber-glow)', 'var(--amber)'], 
    rose: ['var(--rose-glow)', 'var(--rose)'], 
    blue: ['var(--blue-glow)', 'var(--blue)'] 
  };
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
  const C = { 
    indigo: ['var(--accent-glow)', 'var(--accent-light)'], 
    emerald: ['var(--emerald-glow)', 'var(--emerald)'], 
    amber: ['var(--amber-glow)', 'var(--amber)'], 
    blue: ['var(--blue-glow)', 'var(--blue)'] 
  };
  const [bg, fg] = C[color] || C.indigo;
  return (
    <button onClick={() => nav(path)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left', width: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
  const { user, role, userFullName, isAdmin: authIsAdmin, isManager: authIsManager } = useAuth();
  const isAdmin = authIsAdmin;
  const isManager = authIsManager;
  const isStaff = !isAdmin && !isManager;
  
  const [stats, setStats] = useState({ clients: 0, projects: 0, revenue: 0, overdue: 0 });
  const [projData, setProjData] = useState([]);
  const [revChartData, setRevChartData] = useState([]);
  const [rawRevData, setRawRevData] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topClientsData, setTopClientsData] = useState([]);
  const [cityData, setCityData] = useState([]);
  const [remainingDuesData, setRemainingDuesData] = useState([]);
  const [monthlyClientsData, setMonthlyClientsData] = useState([]);
  const [allDuePaymentsData, setAllDuePaymentsData] = useState({ total: 0, list: [] });
  const [newClientsMonthData, setNewClientsMonthData] = useState({ count: 0, list: [] });
  const [monthlyClientChartData, setMonthlyClientChartData] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
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
      const monthsStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const nowStr = new Date().toISOString();

      // Base queries
      let clientsQuery = (isAdmin || isManager) 
        ? supabase.from('clients').select('id, full_name, city, created_at, date') 
        : supabase.from('clients').select('*', { count: 'exact', head: true });
      let projectsQuery = (isAdmin || isManager) 
        ? supabase.from('projects').select('id, client_id, status, budget') 
        : supabase.from('projects').select('*', { count: 'exact', head: true });
      let paymentsQuery = supabase.from('payments').select('id, amount, payment_date, is_paid, due_date, project_id, payment_type');
      let overdueQuery = supabase.from('payments').select('*', { count: 'exact', head: true }).eq('is_paid', false).lt('due_date', nowStr);
      let tasksQuery = supabase.from('tasks').select('*, clients(full_name)').order('due_date', { ascending: true }).limit(5);
      let projStatusQuery = supabase.from('projects').select('status');

      // Filtering for staff
      if (isStaff) {
        clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true }).eq('assigned_to', user.id);
        projectsQuery = supabase.from('projects').select('*', { count: 'exact', head: true }).eq('assigned_to', user.id);
        tasksQuery = tasksQuery.eq('assigned_to', user.id);
        projStatusQuery = projStatusQuery.eq('assigned_to', user.id);
        
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

      const completedTasksQuery = (isAdmin || isManager)
        ? supabase
            .from('tasks')
            .select('id, title, completion_note, completed_at, completed_by, assigned_to, created_by, clients(full_name)')
            .eq('status', 'Completed')
            .order('completed_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] });

      const [resC, resP, resRev, resProj, resOver, resTasks, resStaff, resCompleted] = await Promise.all([
        clientsQuery,
        projectsQuery,
        paymentsQuery,
        projStatusQuery,
        overdueQuery,
        tasksQuery,
        supabase.from('staff_keys').select('user_id, full_name').eq('is_active', true),
        completedTasksQuery
      ]);

      const c = (isAdmin || isManager) ? (resC?.data?.length || 0) : (resC?.count || 0);
      const p = (isAdmin || isManager) ? (resP?.data?.length || 0) : (resP?.count || 0);
      const revData = resRev?.data || [];
      const projRows = resProj?.data || [];
      const overdueCount = resOver?.count || 0;
      const taskRows = resTasks?.data || [];
      const staffRows = resStaff?.data || [];
      const completedTaskRows = resCompleted?.data || [];

      const revenue = revData.filter(x => x.is_paid).reduce((s, x) => s + (x.amount || 0), 0);
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
      setStaffList(staffRows);
      setCompletedTasks(completedTaskRows);

      // Admin/Manager Special Charts Calculation
      if (isAdmin || isManager) {
        const clientsList = resC?.data || [];
        const projectsList = resP?.data || [];
        const paymentsList = revData;

        // 1. Clients by City (filtering out empty/null cities)
        const cityCounts = {};
        clientsList.forEach(cl => {
          if (cl.city && cl.city.trim() !== '') {
            const city = cl.city.trim();
            cityCounts[city] = (cityCounts[city] || 0) + 1;
          }
        });
        const sortedCities = Object.keys(cityCounts)
          .map(name => ({ name, value: cityCounts[name] }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setCityData(sortedCities);

        // 2. Top Clients by Revenue
        const projToClient = {};
        projectsList.forEach(pr => {
          projToClient[pr.id] = pr.client_id;
        });

        const clientRev = {};
        paymentsList.forEach(pay => {
          if (pay.is_paid) {
            const clientId = projToClient[pay.project_id];
            if (clientId) {
              clientRev[clientId] = (clientRev[clientId] || 0) + (pay.amount || 0);
            }
          }
        });

        const clientNameMap = {};
        clientsList.forEach(cl => {
          clientNameMap[cl.id] = cl.full_name;
        });

        const sortedClients = Object.keys(clientRev)
          .map(id => ({
            name: clientNameMap[id] || 'Unknown Client',
            revenue: clientRev[id]
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setTopClientsData(sortedClients);

        // 3. Top Clients by Remaining Dues (Total project budget minus total paid amount)
        const clientRemaining = {};
        clientsList.forEach(cl => {
          clientRemaining[cl.id] = {
            name: cl.full_name,
            budget: 0,
            paid: 0
          };
        });

        projectsList.forEach(pr => {
          const cId = pr.client_id;
          if (clientRemaining[cId]) {
            clientRemaining[cId].budget += parseFloat(pr.budget || 0);
          }
        });

        paymentsList.forEach(pay => {
          const cId = projToClient[pay.project_id];
          if (cId && pay.is_paid && clientRemaining[cId]) {
            clientRemaining[cId].paid += parseFloat(pay.amount || 0);
          }
        });

        const sortedRemaining = Object.keys(clientRemaining)
          .map(id => ({
            id,
            name: clientRemaining[id].name,
            remaining: Math.max(0, clientRemaining[id].budget - clientRemaining[id].paid)
          }))
          .filter(item => item.remaining > 0.01)
          .sort((a, b) => b.remaining - a.remaining)
          .slice(0, 5);

        setRemainingDuesData(sortedRemaining);

        // 4. Monthly/Weekly Recurring Active Clients Alert Panel
        const monthlyMap = {};
        paymentsList.forEach(pay => {
          if (pay.payment_type === 'Monthly' || pay.payment_type === 'Weekly') {
            const cId = projToClient[pay.project_id];
            if (cId) {
              const cName = clientNameMap[cId] || 'Unknown Client';
              const amt = parseFloat(pay.amount || 0);
              
              if (!monthlyMap[cId]) {
                monthlyMap[cId] = {
                  id: cId,
                  name: cName,
                  type: pay.payment_type,
                  amount: amt,
                  due_date: pay.due_date,
                  is_paid: pay.is_paid
                };
              } else {
                if (!pay.is_paid && monthlyMap[cId].is_paid) {
                  monthlyMap[cId] = {
                    id: cId,
                    name: cName,
                    type: pay.payment_type,
                    amount: amt,
                    due_date: pay.due_date,
                    is_paid: pay.is_paid
                  };
                }
              }
            }
          }
        });
        
        const sortedMonthly = Object.values(monthlyMap)
          .sort((a, b) => {
            if (a.is_paid && !b.is_paid) return 1;
            if (!a.is_paid && b.is_paid) return -1;
            return new Date(a.due_date || 0) - new Date(b.due_date || 0);
          })
          .slice(0, 5);
          
        setMonthlyClientsData(sortedMonthly);

        // 5. All Due Payments
        const dueList = [];
        let totalDue = 0;
        paymentsList.forEach(pay => {
          if (!pay.is_paid) {
            const cId = projToClient[pay.project_id];
            if (cId) {
              const cName = clientNameMap[cId] || 'Unknown Client';
              const amt = parseFloat(pay.amount || 0);
              totalDue += amt;
              dueList.push({
                id: pay.id,
                name: cName,
                amount: amt,
                dueDate: pay.due_date
              });
            }
          }
        });
        dueList.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
        setAllDuePaymentsData({ total: totalDue, list: dueList });

        // 6. Clients this month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthClients = [];
        
        // Setup data for 6 month chart
        const clientsChartMap = {};
        for (let i = 5; i >= 0; i--) {
          let m = currentMonth - i;
          if (m < 0) m += 12;
          clientsChartMap[monthsStr[m]] = 0;
        }

        clientsList.forEach(cl => {
          const joinDateStr = cl.date || cl.created_at;
          if (joinDateStr) {
            const dt = new Date(joinDateStr);
            if (dt.getMonth() === currentMonth && dt.getFullYear() === currentYear) {
              monthClients.push(cl);
            }
            // Add to chart map if in last 6 months (approximate by month name)
            const mName = monthsStr[dt.getMonth()];
            if (clientsChartMap[mName] !== undefined) {
              clientsChartMap[mName] += 1;
            }
          }
        });
        setNewClientsMonthData({ count: monthClients.length, list: monthClients });
        setMonthlyClientChartData(Object.keys(clientsChartMap).map(k => ({ month: k, clients: clientsChartMap[k] })));
      }

      // Build revenue chart data
      const curMonth = new Date().getMonth();
      const chartMap = {};
      for (let i = 5; i >= 0; i--) {
        let m = curMonth - i;
        if (m < 0) m += 12;
        chartMap[monthsStr[m]] = 0;
      }

      revData.forEach(r => {
        if (r.is_paid && r.payment_date) {
          const mName = monthsStr[new Date(r.payment_date).getMonth()];
          if (chartMap[mName] !== undefined) chartMap[mName] += (r.amount || 0);
        }
      });
      setRevChartData(Object.keys(chartMap).map(k => ({ month: k, revenue: chartMap[k] })));
      setRawRevData(revData);
    } catch (err) { 
      console.error('FetchStats Error:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const chartDataToDisplay = React.useMemo(() => {
    if (!selectedMonth) return revChartData;
    const intervals = { '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0, '26-31': 0 };
    const monthsStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    rawRevData.forEach(r => {
      if (r.is_paid && r.payment_date) {
        const dt = new Date(r.payment_date);
        if (monthsStr[dt.getMonth()] === selectedMonth) {
          const d = dt.getDate();
          if (d <= 5) intervals['1-5'] += (r.amount || 0);
          else if (d <= 10) intervals['6-10'] += (r.amount || 0);
          else if (d <= 15) intervals['11-15'] += (r.amount || 0);
          else if (d <= 20) intervals['16-20'] += (r.amount || 0);
          else if (d <= 25) intervals['21-25'] += (r.amount || 0);
          else intervals['26-31'] += (r.amount || 0);
        }
      }
    });
    return Object.keys(intervals).map(k => ({ month: k, revenue: intervals[k] }));
  }, [selectedMonth, revChartData, rawRevData]);

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Welcome back, {userFullName ? userFullName.split(' ')[0] : 'User'}!</h1>
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
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {selectedMonth
                    ? `Revenue for ${selectedMonth}: ${fmt(revChartData.find(d => d.month === selectedMonth)?.revenue || 0)}`
                    : 'Real collected revenue over last 6 months'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} />Revenue
                </span>
                <select className="input" style={{ padding: '2px 6px', fontSize: 11, minWidth: 110 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                  <option value="">All (6 Months)</option>
                  {revChartData.map(d => (
                    <option key={d.month} value={d.month}>{d.month} — ${d.revenue.toLocaleString()}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ height: 240 }}>
              {chartDataToDisplay.reduce((s, x) => s + x.revenue, 0) === 0 ? (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                   <p className="empty-desc">No revenue collected in {selectedMonth || 'the last 6 months'}.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDataToDisplay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' }} formatter={(v) => [`$${v.toLocaleString()}`, 'Revenue']} />
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
                  <Tooltip contentStyle={TTStyle} cursor={{ fill: 'var(--bg-hover)', radius: 4 }}/>
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

      {/* Admin/Manager Analytics: Top Clients & Cities */}
      {(isAdmin || isManager) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="dash-grid">
          {/* Top Clients Chart */}
          <div className="card" style={{ padding: 24 }}>
            <p className="section-title" style={{ marginBottom: 18 }}>Top Clients by Revenue</p>
            <div style={{ height: 200 }}>
              {topClientsData.length === 0 ? (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                  <p className="empty-desc">No revenue recorded for top clients.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClientsData} layout="vertical" margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="clientRevGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.8)" />
                        <stop offset="100%" stopColor="rgba(129, 140, 248, 0.95)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `$${v}`} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-primary)', fontWeight: 600 }} width={80} />
                    <Tooltip 
                      contentStyle={{ ...TTStyle, backdropFilter: 'blur(8px)', boxShadow: 'var(--shadow-card)' }} 
                      cursor={{ fill: 'var(--bg-hover)', radius: 6 }} 
                      formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} 
                    />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="url(#clientRevGrad)" barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cities breakdown Chart */}
          <div className="card" style={{ padding: 24 }}>
            <p className="section-title" style={{ marginBottom: 18 }}>Clients by City Breakdown</p>
            <div style={{ height: 200 }}>
              {cityData.length === 0 ? (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                  <p className="empty-desc">No client city data available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityData} margin={{ top: 5, right: 10, left: -24, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cityCountGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.75)" />
                        <stop offset="100%" stopColor="rgba(52, 211, 153, 0.95)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-primary)', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ ...TTStyle, backdropFilter: 'blur(8px)', boxShadow: 'var(--shadow-card)' }} 
                      cursor={{ fill: 'var(--bg-hover)', radius: 6 }} 
                      formatter={v => [v, 'Clients']} 
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#cityCountGrad)" barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Tracking & Alerts Panel */}
      {(isAdmin || isManager) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="dash-grid">
          {/* Outstanding Remaining Dues Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p className="section-title">Outstanding Client Balances</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Remaining contract amounts (Budget - Collected)</p>
              </div>
              <button onClick={() => navigate('/payments')} className="text-xs text-[var(--accent-light)] font-semibold hover:underline">Receive Payments</button>
            </div>
            
            {remainingDuesData.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p className="empty-desc">All client balances are fully paid!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {remainingDuesData.map(client => (
                  <div key={client.id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Pending Contract Dues
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: 14, fontWeight: 800, color: 'var(--amber)',
                        background: 'rgba(245,158,11,0.08)', padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(245,158,11,0.15)', display: 'inline-block'
                      }}>
                        ${client.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly / Weekly Recurring Clients Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p className="section-title">Active Recurring Contracts</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Clients on recurring subscriptions</p>
              </div>
              <button onClick={() => navigate('/clients')} className="text-xs text-[var(--accent-light)] font-semibold hover:underline">View Clients</button>
            </div>

            {monthlyClientsData.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p className="empty-desc">No active recurring clients.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {monthlyClientsData.map(sub => (
                  <div key={sub.id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.name}
                        </p>
                        <span style={{ 
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)',
                          padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                        }}>
                          {sub.type}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {sub.is_paid ? 'Paid for current cycle' : `Due: ${sub.due_date ? new Date(sub.due_date).toLocaleDateString() : 'N/A'}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-light)' }}>
                        ${sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ 
                        fontSize: 9, fontWeight: 800,
                        color: sub.is_paid ? 'var(--emerald)' : 'var(--rose)',
                        background: sub.is_paid ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                        padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                        border: sub.is_paid ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(244,63,94,0.15)'
                      }}>
                        {sub.is_paid ? 'Collected' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Cards requested by User */}
      {(isAdmin || isManager) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="dash-grid">
          {/* Due Payments Card */}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p className="section-title">All Due Payments</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pending payments across all clients</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Due</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--rose)' }}>
                  ${allDuePaymentsData.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            {allDuePaymentsData.list.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: '24px 0' }}>
                <p className="empty-desc">No pending payments.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 300 }}>
                {allDuePaymentsData.list.map((due, idx) => (
                  <div key={due.id || idx} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {due.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Due: {due.dueDate ? new Date(due.dueDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: 14, fontWeight: 800, color: 'var(--rose)',
                        background: 'rgba(244,63,94,0.08)', padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(244,63,94,0.15)', display: 'inline-block'
                      }}>
                        ${due.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clients Joined Trend Card */}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p className="section-title">Client Growth Trend</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Clients joined in the last 6 months</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--emerald)' }}>
                  {newClientsMonthData.count}
                </p>
              </div>
            </div>

            <div style={{ height: 240, flex: 1 }}>
              {monthlyClientChartData.reduce((s, x) => s + x.clients, 0) === 0 ? (
                <div className="empty-state" style={{ height: '100%', padding: 0 }}>
                  <p className="empty-desc">No new clients in the last 6 months.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyClientChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="clientGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.75)" />
                        <stop offset="100%" stopColor="rgba(52, 211, 153, 0.95)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ ...TTStyle, backdropFilter: 'blur(8px)', boxShadow: 'var(--shadow-card)' }} 
                      cursor={{ fill: 'var(--bg-hover)', radius: 6 }} 
                      formatter={v => [v, 'New Clients']} 
                    />
                    <Bar dataKey="clients" radius={[4, 4, 0, 0]} fill="url(#clientGrad)" barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }} className="dash-grid">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p className="section-title">{isAdmin ? 'Recent Team Tasks' : 'My Assigned Tasks'}</p>
            <button onClick={() => navigate('/tasks')} className="text-xs text-[var(--accent-light)] font-semibold hover:underline">View All</button>
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
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: task.status === 'Completed' ? '#10b981' : task.status === 'Pending' ? '#f59e0b' : '#6366f1' 
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {task.clients?.full_name || 'No Client'} 
                        {isAdmin && (
                          <>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)' }} />
                            <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                              to {staffList.find(s => s.user_id === task.assigned_to)?.full_name || 'Staff'}
                            </span>
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

        {/* Right column: Admin/Manager → Completed Tasks feed | Staff → Quick Actions */}
        {(isAdmin || isManager) ? (
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p className="section-title">Staff Task Completions</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Recently completed by team</p>
              </div>
              <button onClick={() => navigate('/staff')} className="text-xs text-[var(--accent-light)] font-semibold hover:underline">View All</button>
            </div>

            {completedTasks.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: '20px 0' }}>
                <div className="empty-icon"><CheckCircle2 size={20} /></div>
                <p className="empty-desc">No completed tasks yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                {completedTasks.map(task => {
                  const completer = staffList.find(s => s.user_id === task.completed_by);
                  const creator   = staffList.find(s => s.user_id === task.created_by);
                  return (
                    <div key={task.id} style={{
                      padding: '11px 13px', borderRadius: 10,
                      background: 'rgba(16,185,129,0.04)',
                      border: '1px solid rgba(16,185,129,0.12)',
                    }}>
                      {/* Task title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <CheckCircle2 size={13} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {task.title}
                        </p>
                      </div>

                      {/* Completer + time */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: task.completion_note ? 7 : 0 }}>
                        {completer && (
                          <span style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>
                            ✓ {completer.full_name}
                          </span>
                        )}
                        {creator && completer?.user_id !== creator?.user_id && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            by {creator.full_name}
                          </span>
                        )}
                        {task.clients?.full_name && (
                          <span style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 600 }}>
                            📁 {task.clients.full_name}
                          </span>
                        )}
                        {task.completed_at && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            {new Date(task.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Completion note */}
                      {task.completion_note && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 9px', background: 'rgba(16,185,129,0.07)', borderRadius: 7, border: '1px solid rgba(16,185,129,0.1)' }}>
                          <FileText size={11} style={{ color: 'var(--emerald)', marginTop: 1, flexShrink: 0 }} />
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                            {task.completion_note}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <p className="section-title" style={{ marginBottom: 14 }}>Quick Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <QuickAction icon={Users}         label="Clients"         desc="View your database"  path="/clients"      color="indigo" />
              <QuickAction icon={Briefcase}     label="Projects"        desc="Track status"        path="/projects"     color="blue" />
              <QuickAction icon={Calendar}      label="Meetings"        desc="Book appointments"   path="/meetings"     color="emerald" />
              <QuickAction icon={MessageSquare} label="Log Interaction" desc="Record comms"        path="/interactions" color="amber" />
            </div>
          </div>
        )}
      </div>

      <style>{`@media(max-width:900px){.dash-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
};

export default Dashboard;
