import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, Mail, Edit2, 
  Trash2, Check, X, AlertCircle, Key, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'];

const Staff = () => {
  const { user, isAdmin } = useAuth();
  const [staff, setStaff] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStaff, setNewStaff] = useState({ id: null, full_name: '', username: '', role: 'Sales Agent', key: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStaff();
    fetchKeys();
  }, []);

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

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage 6-digit keys and roles for your team</p>
        </div>
        <button 
          onClick={openAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <UserPlus size={16} />
          <span>Create Staff Key</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
          <AlertCircle size={18} />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="p-4 border-b border-[var(--border)] flex flex-col md:flex-row gap-4 items-center justify-between bg-[rgba(255,255,255,0.01)]">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search staff or keys..." 
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
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Staff Name</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Login Key</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-20"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-slate-800 rounded-full w-20"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                    <td className="px-6 py-5"></td>
                    <td className="px-6 py-5"></td>
                  </tr>
                ))
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-slate-500">No staff keys found. Create one to get started.</td>
                </tr>
              ) : (
                filteredKeys.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                          {s.full_name?.[0] || 'S'}
                        </div>
                        <span className="text-sm font-semibold text-white">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 font-mono text-indigo-400 font-bold tracking-widest bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10 w-fit">
                        <Key size={12} className="opacity-50" />
                        {s.key}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        s.role === 'Manager' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button 
                        onClick={() => handleToggleStatus(s.id, s.is_active)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${s.is_active ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-slate-500/10'}`}
                      >
                        {s.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-5 text-xs text-slate-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEdit(s)}
                        className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" 
                        title="Edit Staff"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteKey(s.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 transition-colors" 
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

      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box max-w-md">
              <div className="modal-header">
                <span className="modal-title">{isEdit ? 'Update Staff Access' : 'Create New Staff Key'}</span>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateKey}>
                <div className="modal-body flex flex-col gap-4">
                  <div>
                    <label className="label">Staff Member Name</label>
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
                      <button type="button" onClick={generateKey} className="text-indigo-400 hover:text-indigo-300">Regenerate</button>
                    </label>
                    <input 
                      className="input font-mono font-bold tracking-widest text-center text-lg" 
                      value={newStaff.key}
                      onChange={e => setNewStaff({ ...newStaff, key: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="XXXXXX"
                    />
                  </div>
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

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/10">
          <Shield size={24} className="text-indigo-400 mb-4" />
          <h3 className="text-sm font-bold text-white mb-2">Role Permissions</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Admins have full access. Managers can view all clients but cannot manage staff. Staff members only see their assigned data.
          </p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
          <Users size={24} className="text-emerald-400 mb-4" />
          <h3 className="text-sm font-bold text-white mb-2">Team Efficiency</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Assigning clients and tasks to specific roles ensures better accountability and specialized customer success.
          </p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
          <AlertCircle size={24} className="text-amber-400 mb-4" />
          <h3 className="text-sm font-bold text-white mb-2">Audit Logs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every action taken by a staff member is recorded in the activity log for administrative review and quality control.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Staff;
