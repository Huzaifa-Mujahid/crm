import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, Mail, Edit2, 
  Trash2, Check, X, AlertCircle, Key, Loader2,
  CheckCircle2, Clock, Tag, User, Calendar, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'];

const PRIORITY_BADGE = {
  Low:    { bg: 'var(--bg-elevated)',   fg: 'var(--text-secondary)', border: 'var(--border)' },
  Medium: { bg: 'var(--accent-glow)',   fg: 'var(--accent-light)',   border: 'var(--border-accent)' },
  High:   { bg: 'var(--amber-glow)',    fg: 'var(--amber)',          border: 'var(--amber-glow)' },
  Urgent: { bg: 'var(--rose-glow)',     fg: 'var(--rose)',           border: 'var(--rose-glow)' },
};

const Staff = () => {
  const { user, isAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'tasks'

  // --- Access Keys state ---
  const [staff, setStaff] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStaff, setNewStaff] = useState({ id: null, full_name: '', username: '', role: 'Sales Agent', key: '' });
  const [error, setError] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState({});

  // --- Staff Tasks state ---
  const [allTasks, setAllTasks] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Completed'

  const toggleReveal = (id) => setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    fetchStaff();
    fetchKeys();
  }, []);

  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchAllTasks();
    }
  }, [activeTab]);

  const fetchStaff = async () => {
    try {
      const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
      setStaff(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('staff_keys').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setKeys(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAllTasks = async () => {
    try {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, clients(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllTasks(data || []);
    } catch (err) { console.error(err); } finally { setTasksLoading(false); }
  };

  const openAdd = () => {
    setIsEdit(false);
    setNewStaff({ id: null, full_name: '', username: '', role: 'Sales Agent', key: '' });
    setError(null);
    setIsModalOpen(true);
    generateKey();
  };

  const openEdit = (staffKey) => {
    setIsEdit(true);
    setNewStaff({ 
      id: staffKey.id, 
      full_name: staffKey.full_name, 
      username: staffKey.username || '',
      role: staffKey.role, 
      key: staffKey.key 
    });
    setError(null);
    setIsModalOpen(true);
  };

  const generateKey = () => {
    const key = Math.floor(100000 + Math.random() * 900000).toString();
    setNewStaff(prev => ({ ...prev, key }));
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newStaff.full_name) { setError('Please enter the staff member name.'); return; }
    if (newStaff.key.length !== 6) { setError('Access key must be exactly 6 digits.'); return; }
    
    try {
      setSaving(true);
      setError(null);
      const payload = {
        full_name: newStaff.full_name,
        username: newStaff.username,
        role: newStaff.role,
        key: newStaff.key,
        created_by: user.id
      };

      if (isEdit) {
        const { error } = await supabase.from('staff_keys').update(payload).eq('id', newStaff.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_keys').insert([payload]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setNewStaff({ id: null, full_name: '', role: 'Sales Agent', key: '' });
      fetchKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    await supabase.from('staff_keys').update({ is_active: !currentStatus }).eq('id', id);
    fetchKeys();
  };

  const handleDeleteKey = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff access key?')) return;
    try {
      const { error } = await supabase.from('staff_keys').delete().eq('id', id);
      if (error) throw error;
      fetchKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredKeys = keys.filter(s => 
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helpers to resolve staff names from the user_roles table
  const getStaffName = (userId) => {
    if (!userId) return '—';
    const found = staff.find(s => s.user_id === userId);
    return found?.full_name || 'Unknown';
  };

  const filteredTasks = allTasks.filter(t => {
    const matchSearch =
      t.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
      getStaffName(t.created_by).toLowerCase().includes(taskSearch.toLowerCase()) ||
      getStaffName(t.assigned_to).toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.clients?.full_name?.toLowerCase().includes(taskSearch.toLowerCase());
    const matchStatus = taskStatusFilter === 'All' || t.status === taskStatusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = allTasks.filter(t => t.status !== 'Completed').length;
  const completedCount = allTasks.filter(t => t.status === 'Completed').length;

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage team access keys, roles, and staff task activity</p>
        </div>
        {activeTab === 'keys' && (
          <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
            <UserPlus size={16} />
            <span>Create User Key</span>
          </button>
        )}
        {activeTab === 'tasks' && (
          <button onClick={fetchAllTasks} className="btn btn-secondary flex items-center gap-2">
            <Loader2 size={14} className={tasksLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button
          className={`tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          <Key size={14} style={{ marginRight: 6 }} />
          User Access Keys
          <span style={{ fontSize: 11, background: activeTab === 'keys' ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)', color: activeTab === 'keys' ? 'var(--accent-light)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid var(--border)', marginLeft: 6 }}>
            {keys.length}
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckCircle2 size={14} style={{ marginRight: 6 }} />
          Staff Tasks
          <span style={{ fontSize: 11, background: activeTab === 'tasks' ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)', color: activeTab === 'tasks' ? 'var(--accent-light)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid var(--border)', marginLeft: 6 }}>
            {allTasks.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
          <AlertCircle size={18} />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* ─── USER ACCESS KEYS TAB ─────────────────────────────────── */}
      {activeTab === 'keys' && (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="p-4 border-b border-[var(--border)] flex flex-col md:flex-row gap-4 items-center justify-between bg-[rgba(255,255,255,0.01)]">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search users or keys..." 
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[rgba(255,255,255,0.02)]">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">User Name</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Login Key</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Role</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Created</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-5"><div className="h-4 bg-[var(--border)] rounded w-32"></div></td>
                        <td className="px-6 py-5"><div className="h-4 bg-[var(--border)] rounded w-20"></div></td>
                        <td className="px-6 py-5"><div className="h-6 bg-[var(--border)] rounded-full w-20"></div></td>
                        <td className="px-6 py-5"><div className="h-4 bg-[var(--border)] rounded w-16"></div></td>
                        <td className="px-6 py-5"></td>
                        <td className="px-6 py-5"></td>
                      </tr>
                    ))
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center text-[var(--text-muted)]">No user keys found. Create one to get started.</td>
                    </tr>
                  ) : (
                    filteredKeys.map((s) => (
                      <tr key={s.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--accent-glow)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent-light)] font-bold text-sm">
                              {(s.full_name?.trim()?.[0] || 'S').toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">{s.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 font-mono text-[var(--accent-light)] font-bold tracking-widest bg-[var(--accent-glow)] px-2 py-1 rounded border border-[var(--border-accent)] w-fit">
                              <Key size={12} className="opacity-50" />
                              {revealedKeys[s.id] ? s.key : '••••••'}
                            </div>
                            <button
                              onClick={() => toggleReveal(s.id)}
                              className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-accent)]"
                              title={revealedKeys[s.id] ? 'Hide Key' : 'Reveal Key'}
                            >
                              {revealedKeys[s.id] ? 'Hide' : 'Reveal'}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.role === 'Manager' ? 'bg-[var(--amber-glow)] text-[var(--amber)] border border-[var(--amber-glow)]' :
                            'bg-[var(--border)] text-[var(--text-secondary)] border border-[var(--border)]'
                          }`}>
                            {s.role}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <button 
                            onClick={() => handleToggleStatus(s.id, s.is_active)}
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${s.is_active ? 'text-[var(--emerald)] bg-[var(--emerald-glow)] border-[var(--emerald-glow)]' : 'text-[var(--text-secondary)] bg-[var(--bg-hover)] border-[var(--border)]'}`}
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-xs text-[var(--text-secondary)]">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEdit(s)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors" 
                            title="Edit User"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteKey(s.id)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--rose)] transition-colors" 
                            title="Delete Key"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/10">
              <Shield size={24} className="text-[var(--accent-light)] mb-4" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Role Permissions</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Admins have full access. Managers can view all clients but cannot manage users. Users only see their assigned data.
              </p>
            </div>
            <div className="card p-6 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
              <Users size={24} className="text-[var(--emerald)] mb-4" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Team Efficiency</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Assigning clients and tasks to specific roles ensures better accountability and specialized customer success.
              </p>
            </div>
            <div className="card p-6 bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
              <AlertCircle size={24} className="text-[var(--amber)] mb-4" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Audit Logs</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Every action taken by a user is recorded in the activity log for administrative review and quality control.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ─── STAFF TASKS TAB ──────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Tasks', value: allTasks.length, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
              { label: 'Pending',     value: pendingCount,    color: 'var(--amber)',        bg: 'var(--amber-glow)' },
              { label: 'Completed',   value: completedCount,  color: 'var(--emerald)',      bg: 'var(--emerald-glow)' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, flexShrink: 0 }}>
                  <CheckCircle2 size={17} />
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={15} />
              <input
                type="text"
                placeholder="Search by task, staff, or client..."
                className="input input-icon"
                style={{ width: '100%' }}
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
              />
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {['All', 'Pending', 'Completed'].map(s => (
                <button
                  key={s}
                  className={`tab-btn ${taskStatusFilter === s ? 'active' : ''}`}
                  onClick={() => setTaskStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Task List */}
          {tasksLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Loader2 className="animate-spin" size={30} style={{ margin: '0 auto', color: 'var(--accent-light)' }} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><CheckCircle2 size={22} /></div>
                <p className="empty-title">No tasks found</p>
                <p className="empty-desc">No staff tasks match your current filter.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTasks.map((task, i) => {
                const isCompleted = task.status === 'Completed';
                const today = new Date(); today.setHours(0,0,0,0);
                const isOverdue = task.due_date && new Date(task.due_date) < today && !isCompleted;
                const pb = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.Medium;
                const creatorName = getStaffName(task.created_by);
                const assigneeName = getStaffName(task.assigned_to);
                const completerName = isCompleted && task.completed_by ? getStaffName(task.completed_by) : null;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="card"
                    style={{ padding: '16px 20px', borderColor: isOverdue ? 'rgba(244,63,94,0.25)' : undefined }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      {/* Status dot */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: isCompleted ? 'var(--emerald-glow)' : isOverdue ? 'var(--rose-glow)' : 'var(--accent-glow)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isCompleted ? 'var(--emerald)' : isOverdue ? 'var(--rose)' : 'var(--accent-light)',
                        marginTop: 2
                      }}>
                        <CheckCircle2 size={17} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title + priority */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                            {task.title}
                          </p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: pb.bg, color: pb.fg, border: `1px solid ${pb.border}`, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {task.priority}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
                            background: isCompleted ? 'var(--emerald-glow)' : isOverdue ? 'var(--rose-glow)' : 'var(--bg-elevated)',
                            color: isCompleted ? 'var(--emerald)' : isOverdue ? 'var(--rose)' : 'var(--text-muted)',
                            border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.2)' : isOverdue ? 'rgba(244,63,94,0.2)' : 'var(--border)'}`,
                          }}>
                            {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                          </span>
                        </div>

                        {/* Client */}
                        {task.clients?.full_name && (
                          <p style={{ fontSize: 11.5, color: 'var(--accent-light)', fontWeight: 600, marginBottom: 8 }}>
                            📁 {task.clients.full_name}
                          </p>
                        )}

                        {/* Meta row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: isCompleted && task.completion_note ? 10 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <User size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              Created by: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{creatorName}</span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Users size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              Assigned to: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{assigneeName}</span>
                            </span>
                          </div>
                          {task.due_date && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Calendar size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: isOverdue ? 'var(--rose)' : 'var(--text-muted)', fontWeight: isOverdue ? 600 : 400 }}>
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {isCompleted && task.completed_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Clock size={12} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: 'var(--emerald)', fontWeight: 600 }}>
                                Completed: {new Date(task.completed_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {completerName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <CheckCircle2 size={12} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Completed by: <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>{completerName}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Completion note */}
                        {isCompleted && task.completion_note && (
                          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--emerald-glow)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <FileText size={13} style={{ color: 'var(--emerald)', marginTop: 1, flexShrink: 0 }} />
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--emerald)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Completion Note</p>
                              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{task.completion_note}</p>
                            </div>
                          </div>
                        )}

                        {/* Task description */}
                        {task.description && (
                          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Description</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Key Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-md">
              <div className="modal-header">
                <span className="modal-title">{isEdit ? 'Update User Access' : 'Create New User Key'}</span>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateKey}>
                <div className="modal-body flex flex-col gap-4">
                  <div>
                    <label className="label">User Name</label>
                    <input 
                      className="input" 
                      placeholder="e.g. Sarah Connor" 
                      value={newStaff.full_name}
                      onChange={e => setNewStaff({ ...newStaff, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input 
                      className="input" 
                      placeholder="e.g. sarah_c" 
                      value={newStaff.username}
                      onChange={e => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Assign Role</label>
                    <select 
                      className="input"
                      value={newStaff.role}
                      onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label flex justify-between">
                      Login Key (6 Digits)
                      <button type="button" onClick={generateKey} className="text-[var(--accent-light)] hover:text-[var(--accent)]">Regenerate</button>
                    </label>
                    <input 
                      className="input font-mono font-bold tracking-widest text-center text-lg" 
                      value={newStaff.key}
                      onChange={e => setNewStaff({ ...newStaff, key: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="XXXXXX"
                    />
                  </div>
                  {error && (
                    <div style={{ fontSize: 13, color: 'var(--rose)', background: 'var(--rose-glow)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(244,63,94,0.2)' }}>
                      {error}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary min-w-[140px]" disabled={saving}>
                    {saving ? (
                      <><Loader2 size={16} className="animate-spin mr-2" /> Saving...</>
                    ) : (
                      <>{isEdit ? 'Update Access Key' : 'Generate & Assign Key'}</>
                    )}
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

export default Staff;
