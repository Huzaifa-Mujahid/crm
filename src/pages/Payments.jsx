import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, X, Loader2, TrendingUp, TrendingDown, ArrowUpRight, Plus, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureRecurringPaymentRows } from '../lib/recurringPayments';

const EMPTY_FORM = { client_id: '', project_id: '', amount: '', due_date: '', is_paid: false, payment_total: '', payment_paid_now: '', payment_type: 'One time', payment_date: new Date().toISOString().split('T')[0], selected_invoice_id: null };

const PaymentModal = ({ form, setForm, projects, clients, payments, saving, err, onSave, onCancelPayment, onClose, isAdmin }) => {
  const isEdit = !!form.id;
  const total = parseFloat(form.payment_total || 0) || 0;
  const paidNow = parseFloat(form.payment_paid_now || 0) || 0;
  const remaining = Math.max(0, total - paidNow);

  const pendingInvoices = (payments || []).filter(p => p.project_id === form.project_id && !p.is_paid && !p.is_cancelled);

  const handleSelectPending = (e) => {
    const pId = e.target.value;
    if (!pId) {
      setForm(f => ({ ...f, selected_invoice_id: null, payment_total: '', due_date: '', payment_type: 'One time' }));
      return;
    }
    const inv = pendingInvoices.find(p => p.id === pId);
    if (inv) {
      setForm(f => ({ ...f, selected_invoice_id: inv.id, payment_total: String(inv.amount || ''), due_date: inv.due_date || '', payment_type: inv.payment_type || 'One time' }));
    }
  };

  // Auto-calculate the next logical due date if project changes
  useEffect(() => {
    if (!isEdit && form.project_id) {
      const proj = projects.find(p => p.id === form.project_id);
      if (proj && proj.billing_type === 'Retainer' && proj.billing_cycle === 'Monthly') {
        // Find existing payments to guess next due date
        // Passed as a prop or we just do a rough guess based on start_date
        if (proj.start_date && !form.payment_due_date_override) {
           // We can leave it as user selected or we can just show it
        }
      }
    }
  }, [form.project_id]);

  return (
    <div className="modal-overlay">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Payment Record' : 'Log Payment'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', paddingRight: 8 }}>
          {err && <div className="alert alert-error"><span>⚠</span><span>{err}</span></div>}
          <form id="pay-form" onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Client *</label>
                <select className="input" required={!isEdit} value={form.client_id || ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, project_id: '' }))}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Project *</label>
                <select className="input" required value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} disabled={!form.client_id && !isEdit}>
                  <option value="">Select project…</option>
                  {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>

            {!isEdit ? (
              <>
                {form.project_id && pendingInvoices.length > 0 && (
                  <div>
                    <label className="label" style={{ color: 'var(--amber)' }}>Select Pending Invoice (Optional)</label>
                    <select className="input" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.02)' }} value={form.selected_invoice_id || ''} onChange={handleSelectPending}>
                      <option value="">-- Create New Payment --</option>
                      {pendingInvoices.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString() : 'No Date'} - ${p.amount} ({p.payment_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Total Amount ($) *</label>
                    <input className="input" type="number" step="0.01" min="0" required value={form.payment_total || ''} onChange={e => setForm(f => ({ ...f, payment_total: e.target.value }))} placeholder="e.g. 1500.00" />
                  </div>
                  <div>
                    <label className="label">Paid Now ($)</label>
                    <input className="input" type="number" step="0.01" min="0" value={form.payment_paid_now || ''} onChange={e => setForm(f => ({ ...f, payment_paid_now: e.target.value }))} placeholder="e.g. 500.00" />
                  </div>
                </div>

                {total > 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Remaining Balance</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: remaining > 0 ? 'var(--amber)' : 'var(--emerald)' }}>
                      ${remaining.toFixed(2)}
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Payment Type</label>
                    <select className="input" value={form.payment_type || 'One time'} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                      <option value="One time">One time</option>
                      <option value="Monthly">Monthly</option>
                      <option value="6 Months">6 Months</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Transaction Date (Paid On)</label>
                    <input className="input" type="date" value={form.payment_date || ''} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
                  </div>
                </div>
                
                <div style={{ padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Invoice Dates</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Due Date</label>
                      <input className="input" type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>The Due Date represents when this payment was officially owed or billed.</p>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Amount ($) *</label>
                    <input className="input" type="number" step="0.01" min="0" required value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">Payment Type</label>
                    <select className="input" value={form.payment_type || 'One time'} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                      <option value="One time">One time</option>
                      <option value="Monthly">Monthly</option>
                      <option value="6 Months">6 Months</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Transaction Date (Paid On)</label>
                    <input className="input" type="date" value={form.payment_date || ''} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
                  </div>
                  <div>
                    <label className="label">Due Date</label>
                    <input className="input" type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} onClick={(e) => e.target.showPicker?.()} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', marginTop: 8 }}>
                  <input type="checkbox" checked={form.is_paid || false} onChange={e => setForm(f => ({ ...f, is_paid: e.target.checked }))} style={{ marginTop: 2, width: 16, height: 16 }} />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Mark as Paid</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Record this as an immediate collection.</p>
                  </div>
                </label>
              </>
            )}
          </form>
        </div>
        <div className="modal-footer" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
          {isEdit && isAdmin && !form.is_cancelled && (
            <button type="button" className="btn btn-danger btn-sm" onClick={onCancelPayment} disabled={saving}>
              Void / Cancel
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="pay-form" type="submit" disabled={saving}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : isEdit ? 'Update Payment' : 'Log Payment'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const QuickPayModal = ({ row, date, setDate, onSave, onClose, saving }) => {
  if (!row) return null;
  return (
    <div className="modal-overlay">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">Record Payment</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Recording payment for <strong>{row.project_title}</strong> (Due: {row.due_date ? new Date(row.due_date + 'T12:00:00').toLocaleDateString() : 'N/A'})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Payment Received On (Transaction Date)</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} onClick={(e) => e.target.showPicker?.()} />
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : 'Mark Paid'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Payments = () => {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stats, setStats] = useState({ totalDue: 0, totalPaid: 0, overdue: 0 });
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [quickPayRow, setQuickPayRow] = useState(null);
  const [quickPayDate, setQuickPayDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredPayments = payments.filter(p => {
    if (activeFilter === 'Outstanding') return !p.is_paid && !p.is_cancelled; // exclude cancelled
    if (activeFilter === 'Paid') return p.is_paid;
    if (activeFilter === 'Overdue') return p.is_overdue;
    return true;
  });

  useEffect(() => { fetchData(false); }, []);

  // skipRecurring=true → skip the auto-row generator (used after manual saves to avoid duplicates)
  const fetchData = async (skipRecurring = false) => {
    setLoading(true);
    try {
      const [{ data: pData }, { data: prData }, { data: cData }] = await Promise.all([
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, title, client_id, status, billing_type, billing_cycle, budget, start_date'),
        supabase.from('clients').select('id, full_name, company'),
      ]);
      const clientMap = (cData || []).reduce((a, c) => ({ ...a, [c.id]: c.company || c.full_name }), {});
      const projectMap = (prData || []).reduce((a, p) => ({ ...a, [p.id]: { title: p.title, client_id: p.client_id, status: p.status, client_name: clientMap[p.client_id] || 'Unknown', billing_type: p.billing_type, billing_cycle: p.billing_cycle, budget: p.budget, start_date: p.start_date } }), {});

      // Only run recurring-row auto-generator on initial page load, NOT after manual saves.
      // Running it after a manual insert causes a duplicate for the same project+date.
      if (!skipRecurring) {
        await ensureRecurringPaymentRows({ supabase, projects: prData || [], payments: pData || [] });
      }
      const { data: refreshedPayments } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      const refreshedPaymentRows = refreshedPayments || [];
      
      let totalDue = 0, totalPaid = 0, overdue = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const enriched = [];

      refreshedPaymentRows.forEach(p => {
        const isOverdue = !p.is_paid && !p.is_cancelled && p.due_date && new Date(p.due_date) < today;
        const amt = p.amount || 0;
        
        if (!p.is_cancelled) {
          if (p.is_paid) totalPaid += amt;
          else {
            totalDue += amt;
            if (isOverdue) overdue += amt;
          }
        }

        const entry = { 
          ...p, 
          project_title: projectMap[p.project_id]?.title || 'Unknown', 
          client_id: projectMap[p.project_id]?.client_id || '',
          client_name: projectMap[p.project_id]?.client_name || 'Unknown',
          project_status: projectMap[p.project_id]?.status || 'Unknown',
          is_overdue: isOverdue,
          source: 'payment-row'
        };
        enriched.push(entry);
      });

      enriched.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));


      setPayments(enriched);
      setProjects(prData || []);
      setClients(cData || []);
      setStats({ totalDue, totalPaid, overdue });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.project_id) { setFormErr('Project is required.'); return; }
    
    setSaving(true); setFormErr(null);
    try {
      if (form.id) {
        const wasPaid = payments.find(pay => pay.id === form.id)?.is_paid || false;
        const isNowPaid = !!form.is_paid;
        const justMarkedPaid = !wasPaid && isNowPaid;

        const payload = { 
          project_id: form.project_id, 
          amount: parseFloat(form.amount) || 0, 
          due_date: form.due_date || null, 
          is_paid: isNowPaid, 
          payment_type: form.payment_type || 'One-time',
          payment_date: isNowPaid ? (form.payment_date || new Date().toISOString().split('T')[0]) : null 
        };
        const res = await supabase.from('payments').update(payload).eq('id', form.id);
        if (res.error) throw res.error;

        // Stripe-style: if we just toggled this invoice to paid and it's Monthly recurring,
        // immediately schedule the next month's invoice.
        if (justMarkedPaid && (form.payment_type === 'Monthly')) {
          const project = projects.find(pr => pr.id === form.project_id);
          if (project && project.billing_type === 'Retainer' && project.billing_cycle === 'Monthly') {
            const thisDue = new Date((form.due_date || payload.payment_date) + 'T12:00:00');
            const nextDue = new Date(thisDue);
            nextDue.setMonth(nextDue.getMonth() + 1);
            if (project.start_date) {
              const startDay = new Date(project.start_date + 'T12:00:00').getDate();
              nextDue.setDate(startDay);
            }
            const nextDueStr = nextDue.toISOString().split('T')[0];
            const monthPrefix = nextDueStr.slice(0, 7);
            const { data: existing } = await supabase
              .from('payments').select('id')
              .eq('project_id', form.project_id).eq('is_paid', false)
              .not('is_cancelled', 'is', true)
              .gte('due_date', monthPrefix + '-01').lte('due_date', monthPrefix + '-31').limit(1);
            if (!existing || existing.length === 0) {
              await supabase.from('payments').insert([{
                project_id: form.project_id,
                amount: parseFloat(project.budget || form.amount || 0),
                payment_type: 'Monthly',
                due_date: nextDueStr,
                is_paid: false,
                payment_date: null,
              }]);
            }
          }
        }
      } else {
        const total = parseFloat(form.payment_total) || 0;
        const paidNow = parseFloat(form.payment_paid_now) || 0;
        const remaining = Math.max(0, total - paidNow);

        if (total <= 0) {
          setFormErr('Total Amount must be greater than 0.');
          setSaving(false);
          return;
        }

        if (form.selected_invoice_id) {
          // Process payment against an existing pending invoice
          if (paidNow > 0) {
            // Update the selected pending invoice with the paid amount and date
            const { error: updErr } = await supabase.from('payments').update({
              is_paid: true,
              amount: paidNow,
              payment_date: form.payment_date || new Date().toISOString().split('T')[0]
            }).eq('id', form.selected_invoice_id);
            if (updErr) throw updErr;
          }

          if (remaining > 0) {
            // If partial payment, create a new pending invoice for the remainder carrying the original due date
            const { error: insErr } = await supabase.from('payments').insert([{
              project_id: form.project_id,
              amount: remaining,
              payment_type: form.payment_type || 'One time',
              due_date: form.due_date || null,
              is_paid: false,
              payment_date: null
            }]);
            if (insErr) throw insErr;
          }
        } else {
          // Normal flow: Insert entirely new rows
          const paymentsToInsert = [];
          const isRecurring = ['Monthly', 'Weekly', '6 Months', 'Yearly'].includes(form.payment_type);

          if (paidNow > 0) {
            paymentsToInsert.push({
              project_id: form.project_id,
              amount: paidNow,
              payment_type: form.payment_type || 'One time',
              due_date: form.due_date || new Date().toISOString().split('T')[0],
              is_paid: true,
              payment_date: form.payment_date || new Date().toISOString().split('T')[0]
            });
          }

          if (remaining > 0 || paidNow === 0) {
            // Partial payment or zero paid — create unpaid record for remaining balance
            paymentsToInsert.push({
              project_id: form.project_id,
              amount: remaining > 0 ? remaining : total,
              payment_type: form.payment_type || 'One time',
              due_date: form.due_date || null,
              is_paid: false,
              payment_date: null
            });
          }

          const { error } = await supabase.from('payments').insert(paymentsToInsert);
          if (error) throw error;
        }
      }

      setShowModal(false); fetchData(true); // skipRecurring=true — next invoice handled explicitly above

    } catch (e) { setFormErr(e.message); } finally { setSaving(false); }
  };

  const openQuickPay = (p, e) => {
    e.stopPropagation();
    setQuickPayRow(p);
    setQuickPayDate(new Date().toISOString().split('T')[0]);
  };

  const submitQuickPay = async () => {
    if (!quickPayRow) return;
    if (!quickPayDate) {
      alert('Please select the transaction date.');
      return;
    }
    const p = quickPayRow;
    setSaving(true);
    try {
      // Step 1: Mark current payment as paid
      const { error: updateErr } = await supabase
        .from('payments')
        .update({ is_paid: true, payment_date: quickPayDate })
        .eq('id', p.id);
      if (updateErr) throw updateErr;

      // Step 2 (Stripe-style): If this is a Monthly recurring invoice,
      // immediately create the next month's invoice so the client always
      // has exactly one pending invoice going forward.
      if (p.payment_type === 'Monthly') {
        const project = projects.find(pr => pr.id === p.project_id);
        if (project && project.billing_type === 'Retainer' && project.billing_cycle === 'Monthly') {
          // Compute next due date: same day-of-month as this invoice, +1 month
          const thisDue = new Date((p.due_date || quickPayDate) + 'T12:00:00');
          const nextDue = new Date(thisDue);
          nextDue.setMonth(nextDue.getMonth() + 1);
          // Anchor to project start day to avoid drift
          if (project.start_date) {
            const startDay = new Date(project.start_date + 'T12:00:00').getDate();
            nextDue.setDate(startDay);
          }
          const nextDueStr = nextDue.toISOString().split('T')[0];

          // Check: does an unpaid invoice already exist for that month?
          const monthPrefix = nextDueStr.slice(0, 7); // e.g. "2026-09"
          const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .eq('project_id', p.project_id)
            .eq('is_paid', false)
            .not('is_cancelled', 'is', true)
            .gte('due_date', monthPrefix + '-01')
            .lte('due_date', monthPrefix + '-31')
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from('payments').insert([{
              project_id: p.project_id,
              amount: parseFloat(project.budget || p.amount || 0),
              payment_type: 'Monthly',
              due_date: nextDueStr,
              is_paid: false,
              payment_date: null,
            }]);
          }
        }
      }

      fetchData(true); // skipRecurring=true — we already handled next invoice above
      setQuickPayRow(null);
    } catch (err) { 
      console.error('submitQuickPay error:', err);
      alert('Error marking payment as paid: ' + (err.message || 'Unknown error. Check console.'));
    } finally { setSaving(false); }
  };

  const handleCancelPayment = async (e) => {
    if (e) e.preventDefault();
    if (!window.confirm('Are you sure you want to void/cancel this payment? This will remove it from total revenue.')) return;
    
    setSaving(true); setFormErr(null);
    try {
      const { error } = await supabase.from('payments').update({ is_cancelled: true }).eq('id', form.id);
      if (error) throw error;
      
      setShowModal(false);
      // Run ensureRecurring after cancel so the voided row's month gets a fresh auto-row
      fetchData(false);
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setFormErr(null); setShowModal(true); };
  const openEdit = (p) => {
    // 'retainer-project' rows are UI-only virtual rows — no real DB record exists yet.
    // Editing them would silently fail (no matching DB id). Open a fresh "Log Payment"
    // form pre-filled for this project instead.
    if (p.source === 'retainer-project') {
      setForm({ ...EMPTY_FORM, project_id: p.project_id, client_id: p.client_id, payment_type: 'Monthly', payment_total: String(p.amount || '') });
      setFormErr(null);
      setShowModal(true);
      return;
    }
    setForm(p); setFormErr(null); setShowModal(true);
  };

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track invoices and collections</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} />Log Payment</button>
      </div>

      {/* Stats / Interactive Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { key: 'Outstanding', label: 'Total Outstanding', value: stats.totalDue, icon: Clock, c: '#6366f1', bgActive: 'rgba(99,102,241,0.06)' },
          { key: 'Paid', label: 'Total Revenue', value: stats.totalPaid, icon: TrendingUp, c: '#10b981', bgActive: 'rgba(16,185,129,0.06)' },
          { key: 'Overdue', label: 'Overdue Amount', value: stats.overdue, icon: TrendingDown, c: '#f43f5e', bgActive: 'rgba(244,63,94,0.06)' }
        ].map((s, i) => {
          const isActive = activeFilter === s.key;
          return (
            <motion.div 
              key={s.label} 
              initial={{ opacity: 0, y: 14 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }} 
              onClick={() => setActiveFilter(activeFilter === s.key ? 'All' : s.key)}
              className="stat-card" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                cursor: 'pointer',
                border: isActive ? `1.5px solid ${s.c}` : '1px solid var(--border)',
                background: isActive ? s.bgActive : 'var(--bg-elevated)',
                boxShadow: isActive ? `0 0 16px ${s.c}1c` : 'none',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              whileHover={{ scale: 1.01, borderColor: isActive ? s.c : 'var(--border-mid)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                <s.icon size={16} style={{ color: s.c }} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                ${(s.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {isActive && (
                <div style={{ 
                  position: 'absolute', top: 0, right: 0, 
                  background: s.c, color: '#fff', fontSize: 9, fontWeight: 800, 
                  padding: '3px 8px', borderBottomLeftRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  Active Filter
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {activeFilter !== 'All' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
              Showing {activeFilter} payments ({filteredPayments.length} records found)
            </span>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-light)', height: 28, fontSize: 11.5, padding: '0 8px' }} onClick={() => setActiveFilter('All')}>
              Clear Filter ✕
            </button>
          </div>
        )}
        {loading ? (
          <div className="empty-state"><div className="spinner" /><p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading payments…</p></div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><DollarSign size={22} /></div>
            <p className="empty-title">No transactions recorded</p>
            <p className="empty-desc">Log your first payment to start tracking revenue.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}><Plus size={14} />Log Payment</button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-icon"><DollarSign size={20} /></div>
            <p className="empty-title">No matching records</p>
            <p className="empty-desc">No payments currently match the selected "{activeFilter}" filter.</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setActiveFilter('All')}>
              Clear Filter
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Project / Ref</th><th>Client</th><th>Amount</th><th>Due Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {filteredPayments.map(p => (
                  <tr key={p.id} style={{ background: p.is_overdue ? 'rgba(244,63,94,0.03)' : undefined }}>
                    <td>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.project_title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>INV-{p.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.client_name}</p>
                    </td>
                    <td style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>${(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: p.is_overdue ? 'var(--rose)' : 'var(--text-secondary)' }}>
                          {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {p.is_cancelled ? (
                        <span className="badge badge-slate">Cancelled</span>
                      ) : (
                        <span className={`badge ${p.is_paid ? 'badge-emerald' : p.is_overdue ? 'badge-rose' : 'badge-amber'}`}>
                          {p.is_paid ? '✓ Paid' : p.is_overdue ? 'Overdue' : 'Pending'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(p)}>
                        <ArrowUpRight size={15} />
                      </button>
                      {!p.is_paid && !p.is_cancelled ? (
                        <button className="btn btn-sm" style={{ background: 'var(--emerald-glow)', color: 'var(--emerald)', border: '1px solid rgba(16,185,129,0.2)' }} onClick={e => openQuickPay(p, e)}>
                          Mark Paid
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && <PaymentModal form={form} setForm={setForm} projects={projects} clients={clients} payments={payments} saving={saving} err={formErr} onSave={handleSave} onCancelPayment={handleCancelPayment} onClose={() => setShowModal(false)} isAdmin={isAdmin} />}

        {quickPayRow && <QuickPayModal row={quickPayRow} date={quickPayDate} setDate={setQuickPayDate} onSave={submitQuickPay} onClose={() => setQuickPayRow(null)} saving={saving} />}
      </AnimatePresence>
    </div>
  );
};

export default Payments;
