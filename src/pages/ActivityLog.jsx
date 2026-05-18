import React, { useState, useEffect } from 'react';
import { 
  History, Search, Filter, ChevronDown, ChevronUp, User, 
  Calendar, Clock, PlusCircle, RefreshCw, Trash2, Database, AlertCircle, Info, CheckSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ACTION_ICONS = {
  INSERT: <PlusCircle size={15} style={{ color: 'var(--emerald)' }} />,
  UPDATE: <RefreshCw size={15} style={{ color: 'var(--indigo)' }} />,
  DELETE: <Trash2 size={15} style={{ color: 'var(--rose)' }} />
};

const TABLE_LABELS = {
  clients: 'Client',
  projects: 'Project',
  payments: 'Payment',
  interactions: 'Interaction',
  tasks: 'Task',
  meetings: 'Meeting'
};

const getActionIcon = (log) => {
  if (log.table_name === 'tasks' && log.action === 'UPDATE' && log.new_data && log.old_data) {
    if (log.old_data.status !== log.new_data.status) {
      if (log.new_data.status === 'Completed') {
        return <CheckSquare size={15} style={{ color: 'var(--emerald)' }} />;
      }
      if (log.new_data.status === 'Pending') {
        return <RefreshCw size={15} style={{ color: 'var(--amber)' }} />;
      }
    }
  }
  return ACTION_ICONS[log.action] || <AlertCircle size={15} />;
};

const ActivityLog = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: logsData }, { data: staffData }] = await Promise.all([
        supabase.from('activity_log').select('*').order('performed_at', { ascending: false }).limit(200),
        supabase.from('user_roles').select('user_id, full_name, role')
      ]);

      const staffMap = (staffData || []).reduce((acc, curr) => ({ ...acc, [curr.user_id]: curr }), {});
      
      const enriched = (logsData || []).map(log => ({
        ...log,
        user: staffMap[log.performed_by] || { full_name: 'System / Auth', role: 'System' }
      }));

      setLogs(enriched);
      setStaffList(staffData || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getReadableDescription = (log) => {
    const data = log.action === 'DELETE' ? log.old_data : log.new_data;
    if (!data) return `${log.action} action on ${TABLE_LABELS[log.table_name] || log.table_name}`;

    const entity = TABLE_LABELS[log.table_name] || log.table_name;

    switch (log.table_name) {
      case 'clients':
        return `${log.action === 'INSERT' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'} Client: "${data.full_name || 'Unnamed'}"`;
      case 'projects':
        return `${log.action === 'INSERT' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'} Project: "${data.title || 'Untitled'}"`;
      case 'payments':
        const amt = (data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
        return `${log.action === 'INSERT' ? 'Logged' : log.action === 'UPDATE' ? 'Updated' : 'Removed'} Payment of $${amt}`;
      case 'interactions':
        return `${log.action === 'INSERT' ? 'Logged' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'} Interaction of type "${data.type || 'Other'}"`;
      case 'tasks':
        if (log.action === 'UPDATE' && log.old_data && log.new_data) {
          if (log.old_data.status !== log.new_data.status) {
            if (log.new_data.status === 'Completed') {
              return `Completed Task: "${log.new_data.title || 'Untitled'}"`;
            } else if (log.new_data.status === 'Pending') {
              return `Reopened Task: "${log.new_data.title || 'Untitled'}"`;
            }
          }
        }
        return `${log.action === 'INSERT' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'} Task: "${data.title || 'Untitled'}"`;
      case 'meetings':
        return `${log.action === 'INSERT' ? 'Scheduled' : log.action === 'UPDATE' ? 'Rescheduled' : 'Deleted'} Meeting: "${data.title || 'Untitled'}"`;
      default:
        return `${log.action} on ${entity}`;
    }
  };

  const renderDataDiff = (oldData, newData) => {
    if (!oldData || !newData) return null;
    const skipFields = ['id', 'created_at', 'updated_at', 'card_number_enc', 'card_expiry', 'card_cvv', 'assigned_to'];
    const keys = Object.keys({ ...oldData, ...newData }).filter(k => !skipFields.includes(k));
    
    const diffs = [];
    keys.forEach(k => {
      if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
        diffs.push({
          field: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          old: oldData[k] !== null && oldData[k] !== undefined ? String(oldData[k]) : '—',
          new: newData[k] !== null && newData[k] !== undefined ? String(newData[k]) : '—'
        });
      }
    });

    if (diffs.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          <Info size={13} />
          <span>No notable data field changes or only secure credentials updated.</span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, background: 'rgba(0,0,0,0.15)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Audit Inspector (Field Changes)</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 12px', fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Field</div>
          <div style={{ fontWeight: 700, color: 'var(--rose)' }}>Before</div>
          <div style={{ fontWeight: 700, color: 'var(--emerald)' }}>After</div>
          {diffs.map(d => (
            <React.Fragment key={d.field}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.field}</div>
              <div style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{d.old}</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.new}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderInsertedData = (newData) => {
    if (!newData) return null;
    const skipFields = ['id', 'created_at', 'updated_at', 'card_number_enc', 'card_expiry', 'card_cvv', 'assigned_to'];
    const keys = Object.keys(newData).filter(k => !skipFields.includes(k) && newData[k] !== null && newData[k] !== '');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, background: 'rgba(0,0,0,0.15)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Created Parameters Logged</p>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '6px 12px', fontSize: 12.5 }}>
          {keys.map(k => (
            <React.Fragment key={k}>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
              <div style={{ color: 'var(--text-primary)' }}>{String(newData[k])}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const filteredLogs = logs.filter(log => {
    const desc = getReadableDescription(log).toLowerCase();
    const name = log.user.full_name.toLowerCase();
    const query = search.toLowerCase();

    const matchSearch = desc.includes(query) || name.includes(query);
    const matchAction = !actionFilter || log.action === actionFilter;
    const matchTable = !tableFilter || log.table_name === tableFilter;
    const matchStaff = !staffFilter || log.performed_by === staffFilter;

    return matchSearch && matchAction && matchTable && matchStaff;
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History style={{ color: 'var(--indigo)' }} />
            Activity Log
          </h1>
          <p className="page-subtitle">Real-time audit trail of all staff activities across Allied Marketing Solutions</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={13} /> Refresh Log
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: 36 }} 
            placeholder="Search logs/staff…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        {/* Staff dropdown */}
        <div style={{ position: 'relative' }}>
          <select className="input" style={{ paddingRight: 32 }} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="">All Staff Members</option>
            {staffList.map(s => (
              <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>
            ))}
          </select>
          <User size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Action filter */}
        <div style={{ position: 'relative' }}>
          <select className="input" style={{ paddingRight: 32 }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">All Action Types</option>
            <option value="INSERT">Create (INSERT)</option>
            <option value="UPDATE">Update (UPDATE)</option>
            <option value="DELETE">Delete (DELETE)</option>
          </select>
          <Filter size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Table Filter */}
        <div style={{ position: 'relative' }}>
          <select className="input" style={{ paddingRight: 32 }} value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
            <option value="">All Entities</option>
            {Object.keys(TABLE_LABELS).map(k => (
              <option key={k} value={k}>{TABLE_LABELS[k]}</option>
            ))}
          </select>
          <Database size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Activity Feed stream */}
      <div className="card" style={{ padding: 24, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Fetching security logs…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-icon"><AlertCircle size={22} style={{ color: 'var(--text-muted)' }} /></div>
            <p className="empty-title">No activities recorded</p>
            <p className="empty-desc">Adjust your filters or query terms to locate records.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredLogs.map(log => {
              const isExpanded = expandedLog === log.id;
              const formattedTime = new Date(log.performed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
              const formattedDate = new Date(log.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              
              return (
                <div 
                  key={log.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border)', 
                    paddingBottom: 16, 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Action Icon Pill */}
                      <div style={{ 
                        width: 30, height: 30, borderRadius: 8, 
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                      }}>
                        {getActionIcon(log)}
                      </div>

                      <div>
                        {/* Event Text */}
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {getReadableDescription(log)}
                        </p>
                        
                        {/* Performed By User Details */}
                        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                          Performed by <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{log.user.full_name}</span> 
                          <span style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, marginLeft: 6, border: '1px solid var(--border)' }}>
                            {log.user.role}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Time logs */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {formattedTime}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} /> {formattedDate}
                        </p>
                      </div>

                      {/* Expand Details Trigger */}
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        style={{ width: 28, height: 28, borderRadius: 6 }}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded audit data details */}
                  {isExpanded && (
                    <div style={{ marginLeft: 40, animation: 'slide-down 0.2s ease-out' }}>
                      {log.action === 'UPDATE' && renderDataDiff(log.old_data, log.new_data)}
                      {log.action === 'INSERT' && renderInsertedData(log.new_data)}
                      {log.action === 'DELETE' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, background: 'rgba(244,63,94,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(244,63,94,0.1)' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rose)', marginBottom: 4 }}>Deleted Record Backup Logged</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '6px 12px', fontSize: 12.5 }}>
                            {Object.keys(log.old_data || {}).filter(k => !['id', 'created_at', 'updated_at', 'card_number_enc'].includes(k) && log.old_data[k]).map(k => (
                              <React.Fragment key={k}>
                                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                                <div style={{ color: 'var(--text-primary)', opacity: 0.8 }}>{String(log.old_data[k])}</div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
