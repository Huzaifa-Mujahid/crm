import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  CheckSquare, Plus, Search, Filter, 
  Clock, AlertCircle, CheckCircle2, 
  Calendar, User, Tag, ChevronRight,
  X, Loader2, Edit3, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const Tasks = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeTab, setActiveTab] = useState('Upcoming');

  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionTaskId, setCompletionTaskId] = useState(null);
  const [completionNote, setCompletionNote] = useState('');

  const [newTask, setNewTask] = useState({
    id: null,
    title: '',
    client_id: '',
    assigned_to: '',
    priority: 'Medium',
    duration: '',
    due_date: '',
    description: ''
  });

  const navigate = useNavigate();
  const location = useLocation();

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let query = supabase.from('tasks').select('*, clients(full_name)').order('due_date', { ascending: true });
      
      if (!isAdmin && !isManager) {
        query = query.eq('assigned_to', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    // Read from staff_keys but ONLY include those who have logged in (user_id is not null)
    // because assigned_to column requires a valid auth.users UUID.
    const { data } = await supabase
      .from('staff_keys')
      .select('user_id, full_name, role')
      .eq('is_active', true)
      .not('user_id', 'is', null);
    setStaffList(data || []);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, full_name');
    setClients(data || []);
  };

  const openAddTask = () => {
    setIsEdit(false);
    setNewTask({ id: null, title: '', client_id: '', assigned_to: (isAdmin || isManager) ? '' : user.id, priority: 'Medium', duration: '', due_date: '', description: '' });
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchTasks();
    fetchClients();
    if (isAdmin || isManager) {
      fetchStaff();
    }

    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      openAddTask();
      navigate(location.pathname, { replace: true });
    }
  }, [user, location.search]);

  const openEditTask = (task) => {
    setIsEdit(true);
    setNewTask({
      id: task.id,
      title: task.title,
      client_id: task.client_id || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      duration: task.duration || '',
      due_date: task.due_date || '',
      description: task.description || '',
      created_by: task.created_by || ''
    });
    setIsModalOpen(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        title: newTask.title,
        client_id: newTask.client_id || null,
        assigned_to: (isAdmin || isManager) ? (newTask.assigned_to || user.id) : user.id,
        priority: newTask.priority,
        duration: newTask.duration,
        due_date: newTask.due_date || null,
        description: newTask.description,
        created_by: isEdit ? (newTask.created_by || user.id) : user.id
      };

      if (isEdit) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', newTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert([{ ...payload, status: 'Pending' }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setNewTask({ id: null, title: '', client_id: '', assigned_to: (isAdmin || isManager) ? '' : user.id, priority: 'Medium', duration: '', due_date: '', description: '' });
      fetchTasks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      fetchTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    if (currentStatus === 'Completed') {
      try {
        const { error } = await supabase.from('tasks')
          .update({ 
            status: 'Pending',
            completion_note: null,
            completed_at: null,
            completed_by: null
          })
          .eq('id', taskId);
        if (error) throw error;
        fetchTasks();
      } catch (err) {
        alert(err.message);
      }
    } else {
      setCompletionTaskId(taskId);
      setCompletionNote('');
      setIsCompletionModalOpen(true);
    }
  };

  const handleCompleteTaskWithNote = async (e) => {
    e.preventDefault();
    if (!completionTaskId) return;
    try {
      setSaving(true);
      const note = completionNote.trim() || 'Task completed';
      const { error } = await supabase.from('tasks')
        .update({
          status: 'Completed',
          completion_note: note,
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('id', completionTaskId);
      if (error) throw error;
      
      setIsCompletionModalOpen(false);
      setCompletionTaskId(null);
      setCompletionNote('');
      fetchTasks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const isCompleted = t.status === 'Completed';
    const matchesTab = activeTab === 'Upcoming' ? !isCompleted : isCompleted;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-subtitle">Track and assign workflow responsibilities</p>
        </div>
        <button onClick={openAddTask} className="btn btn-primary">
          <Plus size={15} /> Create Task
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="tabs">
            {['Upcoming', 'Past'].map(t => (
              <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {t}
                <span style={{ fontSize: 11, background: activeTab === t ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)', color: activeTab === t ? 'var(--accent-light)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid var(--border)', marginLeft: 6 }}>
                  {tasks.filter(task => { const isCompleted = task.status === 'Completed'; return t === 'Upcoming' ? !isCompleted : isCompleted; }).length}
                </span>
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              className="input input-icon w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin text-indigo-500" size={32} style={{ margin: '0 auto' }} /></div>
        ) : filteredTasks.length === 0 ? (
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state">
              <div className="empty-icon"><CheckSquare size={22} /></div>
              <p className="empty-title">No {activeTab.toLowerCase()} tasks</p>
              <p className="empty-desc">{activeTab === 'Upcoming' ? 'Everything caught up! Create a task to get started.' : 'Completed tasks will appear here.'}</p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task, i) => {
            const isCompleted = task.status === 'Completed';
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isOverdue = task.due_date && new Date(task.due_date) < today && !isCompleted;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card"
                style={{ padding: 20, borderColor: isOverdue ? 'rgba(244,63,94,0.25)' : undefined }}>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: isCompleted ? 'var(--bg-hover)' : 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCompleted ? 'var(--text-muted)' : 'var(--accent-light)', flexShrink: 0 }}>
                      <CheckSquare size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>{task.clients?.full_name || 'Internal'}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleTaskStatus(task.id, task.status)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCompleted ? 'var(--emerald)' : 'var(--bg-elevated)', color: isCompleted ? '#fff' : 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }} title="Mark as complete">
                    <CheckCircle2 size={14} />
                  </button>
                </div>

                {task.description && (
                  <div style={{ marginTop: 4, marginBottom: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Description</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</p>
                      <p style={{ fontSize: 12, color: isOverdue ? 'var(--rose)' : 'var(--text-secondary)', fontWeight: 600 }}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Deadline'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Tag size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: task.priority === 'High' || task.priority === 'Urgent' ? 'var(--rose)' : 'var(--accent-light)' }}>{task.priority}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)' }}>
                      {task.assigned_to === user.id ? 'ME' : (staffList.find(s => s.user_id === task.assigned_to)?.full_name?.trim()?.[0]?.toUpperCase() || '?')}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{task.assigned_to === user.id ? 'Assigned to You' : (staffList.find(s => s.user_id === task.assigned_to)?.full_name || 'Member')}</span>
                  </div>
                  {(() => {
                    const taskCreator = staffList.find(s => s.user_id === task.created_by);
                    const isCreatedByAdmin = task.created_by ? (taskCreator?.role === 'Admin' || taskCreator?.role === 'Manager') : false;
                    const canEdit = isAdmin || isManager || !isCreatedByAdmin;

                    return canEdit ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEditTask(task)} title="Edit"><Edit3 size={14} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteTask(task.id)} title="Delete" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--rose)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        🔒 Locked by Admin
                      </span>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-lg">
              <div className="modal-header">
                <span className="modal-title">{isEdit ? 'Update Task' : 'Create New Task'}</span>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateTask}>
                <div className="modal-body grid grid-cols-2 gap-4" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', paddingRight: 8 }}>
                  <div className="col-span-2">
                    <label className="label">Task Title</label>
                    <input className="input" placeholder="e.g. Weekly Report Preparation" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} required />
                  </div>
                  
                  <div>
                    <label className="label">Related Client</label>
                    <select className="input" value={newTask.client_id} onChange={e => setNewTask({...newTask, client_id: e.target.value})}>
                      <option value="">Select Client (Optional)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">Assign To</label>
                    {isAdmin || isManager ? (
                      <select className="input" value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}>
                        <option value="">Assign to Admin</option>
                        {staffList.filter(s => s.user_id !== user.id).map(s => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>)}
                      </select>
                    ) : (
                      <input className="input" value={user?.user_metadata?.full_name || 'Me'} disabled style={{ opacity: 0.7 }} />
                    )}
                  </div>

                  <div>
                    <label className="label">Priority</label>
                    <select className="input" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Duration / Effort</label>
                    <input className="input" placeholder="e.g. 2 hours" value={newTask.duration} onChange={e => setNewTask({...newTask, duration: e.target.value})} />
                  </div>

                  <div>
                    <label className="label">Due Date</label>
                    <input type="date" className="input" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} onClick={(e) => e.target.showPicker?.()} />
                  </div>

                  <div className="col-span-2">
                    <label className="label">Description</label>
                    <textarea className="input min-h-[100px]" placeholder="Detailed instructions..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary min-w-[120px]" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : (isEdit ? 'Update Task' : 'Create Task')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Completion Note Modal */}
      <AnimatePresence>
        {isCompletionModalOpen && (
          <div className="modal-overlay">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-md">
              <div className="modal-header">
                <span className="modal-title">Complete Task</span>
                <button onClick={() => { setIsCompletionModalOpen(false); setCompletionTaskId(null); }} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleCompleteTaskWithNote}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Would you like to add any notes or details about completing this task?
                  </p>
                  <div>
                    <label className="label">Completion Note (Optional)</label>
                    <textarea 
                      className="input min-h-[100px]" 
                      placeholder="e.g. Completed the documentation and updated the client record. Defaults to 'Task completed'" 
                      value={completionNote} 
                      onChange={e => setCompletionNote(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setIsCompletionModalOpen(false); setCompletionTaskId(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary min-w-[120px]" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : 'Complete Task'}
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

export default Tasks;
