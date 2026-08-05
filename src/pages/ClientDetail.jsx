import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Mail, Phone, Calendar, ArrowLeft, Users, 
  LayoutDashboard, Briefcase, CheckSquare, MessageSquare, 
  DollarSign, History, ShieldCheck, Edit3, X, Loader2, CreditCard, Lock, Plus, MoreVertical, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientTimeline from '../components/ClientTimeline';
import { useAuth } from '../hooks/useAuth';
import { maskCard, formatCardBrand, cardBrandEmoji, formatExpiry } from '../lib/cardCrypto';
import { CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

const STATUS_BADGE = { Active: 'badge-emerald', Onboarding: 'badge-blue', 'At Risk': 'badge-amber', Inactive: 'badge-rose' };

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: { color: '#1e293b', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', '::placeholder': { color: '#94a3b8' }, iconColor: '#6366f1' },
    invalid: { color: '#f43f5e', iconColor: '#f43f5e' },
  },
};

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [data, setData] = useState({ projects: [], tasks: [], meetings: [], interactions: [], payments: [], paymentMethods: [] });
  const stripe = useStripe();
  const elements = useElements();

  // Stripe charge modal
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState(null); // { success, message }
  const [selectedCardId, setSelectedCardId] = useState('');

  // Add Card modal
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [cardErr, setCardErr] = useState(null);
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  const [billingZip, setBillingZip] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const cardComplete = cardNumberComplete && cardExpiryComplete && cardCvcComplete;
  const [openCardMenuId, setOpenCardMenuId] = useState(null);

  useEffect(() => {
    if (showChargeModal && data.paymentMethods?.length > 0) {
      const primary = data.paymentMethods.find(p => p.is_primary) || data.paymentMethods[0];
      setSelectedCardId(primary.stripe_payment_method_id);
    }
  }, [showChargeModal, data.paymentMethods]);

  const handleChargeCard = async (e) => {
    e.preventDefault();
    if (!selectedCardId) {
      setChargeResult({ success: false, message: 'No Stripe payment method selected.' });
      return;
    }
    const amountDollars = parseFloat(chargeAmount);
    if (!amountDollars || amountDollars < 0.50) {
      setChargeResult({ success: false, message: 'Minimum charge amount is $0.50.' });
      return;
    }
    if (!adminPassword) {
      setChargeResult({ success: false, message: 'System password is required to charge.' });
      return;
    }
    setCharging(true);
    setChargeResult(null);
    try {
      // 1. Verify Admin Password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });
      if (authError) throw new Error('Invalid system password.');

      // 2. Proceed with charge
      const chargeProjectId = selectedProjectId || (data.projects.length === 1 ? data.projects[0].id : null);
      const { data: res, error } = await supabase.functions.invoke('charge-card', {
        body: {
          customer_id: client.stripe_customer_id,
          payment_method_id: selectedCardId,
          amount: Math.round(amountDollars * 100), // convert to cents
          description: chargeDesc || `CRM Payment — ${client.full_name}`,
          project_id: chargeProjectId || undefined,
        },
      });
      if (error) {
        console.error('charge-card edge function error:', error);
        let actualMsg = error.message;
        try {
          if (error.context && typeof error.context.text === 'function') {
            const raw = await error.context.text();
            try { const p = JSON.parse(raw); actualMsg = p.error || p.message || raw; }
            catch { actualMsg = raw || actualMsg; }
          }
        } catch {}
        throw new Error(actualMsg);
      }
      if (!res?.success) throw new Error(res?.error || 'Charge failed.');
      setChargeResult({ success: true, message: `✅ $${amountDollars.toFixed(2)} charged successfully!` });
      // Log payment in our DB against selected project/invoice
      if (selectedInvoiceId) {
        const paymentToUpdate = data.payments.find(p => p.id === selectedInvoiceId);
        if (paymentToUpdate) {
          const originalAmount = parseFloat(paymentToUpdate.amount || 0);
          
          if (amountDollars < originalAmount) {
            // Partial Payment Logic
            // 1. Update original row to reflect the amount actually paid today
            await supabase.from('payments').update({
              is_paid: true,
              payment_date: new Date().toISOString(),
              amount: amountDollars
            }).eq('id', paymentToUpdate.id);
            
            // 2. Insert new row for the remaining balance with the SAME due date
            await supabase.from('payments').insert({
              project_id: paymentToUpdate.project_id,
              amount: originalAmount - amountDollars,
              payment_type: paymentToUpdate.payment_type,
              due_date: paymentToUpdate.due_date,
              is_paid: false,
              payment_date: null,
            });
          } else {
            // Full (or exact) payment
            await supabase.from('payments').update({
              is_paid: true,
              payment_date: new Date().toISOString(),
              amount: amountDollars // in case they overpaid slightly
            }).eq('id', paymentToUpdate.id);
          }
        }
      } else if (chargeProjectId) {
        // Fallback for custom one-time charge not linked to existing invoice
        await supabase.from('payments').insert({
          project_id: chargeProjectId,
          amount: amountDollars,
          payment_type: 'One-time',
          due_date: new Date().toISOString().split('T')[0],
          is_paid: true,
          payment_date: new Date().toISOString(),
        });
      }
      
      // Refresh data so the new pending invoice shows up in the table
      await fetchClientData();

      setChargeAmount('');
      setChargeDesc('');
      setAdminPassword('');
      setSelectedProjectId('');
      setSelectedInvoiceId('');
    } catch (err) {
      setChargeResult({ success: false, message: `❌ ${err.message || 'Charge failed. Please try again.'}` });
    } finally {
      setCharging(false);
    }
  };

  const getHealthScore = () => {
    if (!client) return 80;
    return client.health_score ?? 80;
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

      const { data: pmData } = await supabase
        .from('client_payment_methods')
        .select('*')
        .eq('client_id', id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      setData({ projects: pRes.data || [], tasks: tRes.data || [], meetings: mRes.data || [], interactions: iRes.data || [], payments, paymentMethods: pmData || [] });
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
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setEditForm({ ...client });
    setShowEditModal(true);
  };

  const handleDeleteClient = async () => {
    if (!isAdmin && !isManager) {
      alert("Only Admins or Managers can delete clients.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${client.full_name}? This action cannot be undone and may fail if there is associated data (like projects or tasks) that cannot be automatically deleted.`)) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      navigate('/clients', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Failed to delete client: ' + (err.message || 'Unknown error. Please check if there are associated records that need to be deleted first.'));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Card Management Functions ─────────────────────────────────
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !cardComplete) return;
    setAddingCard(true); setCardErr(null);
    try {
      // ── Step 1: Ensure client has a Stripe Customer ID ───────────
      let stripeCustomerId = client.stripe_customer_id;
      if (!stripeCustomerId) {
        const { data: custData, error: custErr } = await supabase.functions.invoke('create-stripe-customer', {
          body: { name: client.full_name, email: client.business_email || client.email, client_id: id },
        });
        if (custErr) throw new Error(`Failed to create Stripe customer: ${custErr.message}`);
        stripeCustomerId = custData?.customer_id;
        if (!stripeCustomerId) throw new Error('Stripe customer creation returned no ID. Check edge function logs.');

        const { error: updateErr } = await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', id);
        if (updateErr) throw new Error(`Failed to save Stripe customer ID: ${updateErr.message}`);
        setClient(prev => ({ ...prev, stripe_customer_id: stripeCustomerId }));
      }

      // ── Step 2: Create SetupIntent ────────────────────────────────
      const { data: siData, error: siErr } = await supabase.functions.invoke('setup-card', {
        body: { customer_id: stripeCustomerId },
      });
      if (siErr) throw new Error(`Failed to create SetupIntent: ${siErr.message}`);
      if (!siData?.client_secret) throw new Error('SetupIntent returned no client_secret. Check edge function logs.');

      // ── Step 3: Confirm card with Stripe ─────────────────────────
      const cardEl = elements.getElement(CardNumberElement);
      if (!cardEl) throw new Error('Card element not found. Please refresh and try again.');

      const { setupIntent, error: confirmErr } = await stripe.confirmCardSetup(siData.client_secret, {
        payment_method: {
          card: cardEl,
          billing_details: {
            name: cardholderName.trim() || client.full_name,
            email: client.business_email || client.email,
            ...(billingZip && { address: { postal_code: billingZip } }),
          },
        },
      });
      if (confirmErr) throw new Error(confirmErr.message);
      if (!setupIntent?.payment_method) throw new Error('Stripe returned no payment method ID after setup.');

      const pmId = setupIntent.payment_method;

      // ── Step 4: Retrieve card display info from Stripe ───────────
      let pmInfo = null;
      try {
        const { data: pmData, error: pmErr } = await supabase.functions.invoke('setup-card', {
          body: { retrieve_pm: pmId },
        });
        if (!pmErr && pmData?.last4) {
          pmInfo = pmData;
        }
      } catch (_) {
        // Not critical — card still saved, just without display info
      }

      // ── Step 5: Save to database ──────────────────────────────────
      const isFirstCard = data.paymentMethods.length === 0;

      const { error: insertErr } = await supabase.from('client_payment_methods').insert({
        client_id: id,
        stripe_payment_method_id: pmId,
        brand: pmInfo?.brand ?? null,
        last4: pmInfo?.last4 ?? null,
        exp_month: pmInfo?.exp_month ?? null,
        exp_year: pmInfo?.exp_year ?? null,
        is_primary: isFirstCard,
      });

      if (insertErr) {
        // Card is saved on Stripe but failed to save in our DB
        throw new Error(`Card was authorized by Stripe (ID: ${pmId}) but failed to save in database: ${insertErr.message}. Please contact support with this Stripe PM ID.`);
      }

      // ── Step 6: Update clients table for backwards compatibility ──
      if (isFirstCard) {
        await supabase.from('clients').update({
          stripe_payment_method_id: pmId,
          stripe_card_brand: pmInfo?.brand ?? null,
          stripe_card_last4: pmInfo?.last4 ?? null,
          stripe_card_exp_month: pmInfo?.exp_month ?? null,
          stripe_card_exp_year: pmInfo?.exp_year ?? null,
        }).eq('id', id);
      }

      // ── Step 7: Close modal and refresh ──────────────────────────
      setShowAddCardModal(false);
      setCardNumberComplete(false); setCardExpiryComplete(false); setCardCvcComplete(false); setBillingZip(''); setCardholderName('');
      await fetchClientData();
    } catch (err) {
      setCardErr(err.message || 'An unknown error occurred. Please try again.');
    } finally {
      setAddingCard(false);
    }
  };


  const handleSetPrimary = async (cardId, pmId) => {
    try {
      // Remove primary from all cards first
      await supabase.from('client_payment_methods').update({ is_primary: false }).eq('client_id', id);
      // Set selected card as primary
      await supabase.from('client_payment_methods').update({ is_primary: true }).eq('id', cardId);
      // Update clients table stripe_payment_method_id
      const card = data.paymentMethods.find(c => c.id === cardId);
      if (card) {
        await supabase.from('clients').update({
          stripe_payment_method_id: pmId,
          stripe_card_brand: card.brand,
          stripe_card_last4: card.last4,
          stripe_card_exp_month: card.exp_month,
          stripe_card_exp_year: card.exp_year,
        }).eq('id', id);
      }
      await fetchClientData();
    } catch (err) { alert('Failed to update primary card.'); }
  };

  const handleRemoveCard = async (cardId, isPrimary) => {
    if (isPrimary && data.paymentMethods.length > 1) {
      alert('Please set another card as Primary before removing this one.');
      return;
    }
    if (!window.confirm('Remove this card from the client? This cannot be undone.')) return;
    try {
      await supabase.from('client_payment_methods').delete().eq('id', cardId);
      await fetchClientData();
    } catch (err) { alert('Failed to remove card.'); }
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
    { id: 'timeline', label: 'Timeline', icon: History },
    ...(isAdmin ? [{ id: 'payment-methods', label: 'Payment Methods', icon: CreditCard }] : []),
  ];

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Top Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/clients')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={openEdit}><Edit3 size={14} /> Edit</button>
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

            {activeTab === 'payment-methods' && isAdmin && (
              <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Payment Methods</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage saved cards for {client.full_name}. Raw card data is never stored — secured by Stripe.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setShowAddCardModal(true); setCardErr(null); }}
                    >
                      <Plus size={14} /> Add New Card
                    </button>
                    {data.paymentMethods.length > 0 && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setShowChargeModal(true); setChargeResult(null); setSelectedProjectId(''); }}
                      >
                        <CreditCard size={14} /> Charge via Stripe
                      </button>
                    )}
                  </div>
                </div>

                {data.paymentMethods.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><CreditCard size={22} /></div>
                    <p className="empty-title">No payment methods</p>
                    <p className="empty-desc">Add a card to start charging this client via Stripe.</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setShowAddCardModal(true); setCardErr(null); }}>
                      <Plus size={14} /> Add First Card
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {data.paymentMethods.map(card => (
                      <div key={card.id} style={{
                        padding: '20px 24px',
                        borderRadius: 14,
                        background: card.is_primary ? 'rgba(99,102,241,0.04)' : 'var(--bg-elevated)',
                        border: `1px solid ${card.is_primary ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        position: 'relative'
                      }}>
                        {/* Card Left Side */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <div style={{ width: 48, height: 32, borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={20} style={{ color: card.is_primary ? 'var(--accent-light)' : 'var(--text-muted)' }} />
                          </div>
                          
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                              <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
                                •••• •••• •••• {card.last4}
                              </p>
                              {card.is_primary && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', background: 'rgba(99,102,241,0.1)', padding: '3px 8px', borderRadius: 20, letterSpacing: '0.05em' }}>PRIMARY</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                                {card.brand ? formatCardBrand(card.brand) : 'Card'}
                              </p>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-mid)' }} />
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                                Valid Thru: <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{String(card.exp_month || '').padStart(2,'0')}/{card.exp_year}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 3-dots menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenCardMenuId(openCardMenuId === card.id ? null : card.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 8, borderRadius: 6 }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-base)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openCardMenuId === card.id && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpenCardMenuId(null)} />
                              <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, zIndex: 20, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                {!card.is_primary && (
                                  <button onClick={() => { handleSetPrimary(card.id, card.stripe_payment_method_id); setOpenCardMenuId(null); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }} onMouseOver={e => e.currentTarget.style.background='var(--bg-base)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                                    Set as Primary
                                  </button>
                                )}
                                <button onClick={() => { handleRemoveCard(card.id, card.is_primary); setOpenCardMenuId(null); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--rose)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }} onMouseOver={e => e.currentTarget.style.background='rgba(244,63,94,0.1)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                                  Remove Card
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                      <option value="Inactive">Inactive</option>
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
                <div className="modal-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stripe Charge Modal */}
      <AnimatePresence>
        {showChargeModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowChargeModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} style={{ color: 'var(--accent-light)' }} /> Charge via Stripe
                </span>
                <button onClick={() => setShowChargeModal(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
              </div>
              <form onSubmit={handleChargeCard}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', paddingRight: '8px' }}>
                  {/* Card selector — show all saved cards */}
                  {data.paymentMethods.length > 0 && (
                    <div>
                      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={12} style={{ color: 'var(--accent-light)' }} /> Select Card to Charge
                      </label>
                      <select
                        className="input"
                        value={selectedCardId}
                        onChange={e => setSelectedCardId(e.target.value)}
                        required
                      >
                        {data.paymentMethods.map(card => (
                          <option key={card.id} value={card.stripe_payment_method_id}>
                            {card.is_primary ? '★ ' : ''}{card.brand ? formatCardBrand(card.brand) : 'Card'} ••••{card.last4} — Exp {String(card.exp_month||'').padStart(2,'0')}/{card.exp_year}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Invoice selector */}
                  <div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Select Pending Invoice (Optional)
                    </label>
                    <select
                      className="input"
                      value={selectedInvoiceId}
                      onChange={e => {
                        const invId = e.target.value;
                        setSelectedInvoiceId(invId);
                        if (invId) {
                          const inv = data.payments.find(p => p.id === invId);
                          if (inv) {
                            setChargeAmount(inv.amount || '');
                            setSelectedProjectId(inv.project_id || '');
                            const proj = data.projects.find(p => p.id === inv.project_id);
                            setChargeDesc(`Payment for ${proj?.title || 'Invoice'}`);
                          }
                        }
                      }}
                    >
                      <option value="">-- No specific invoice (Custom Charge) --</option>
                      {data.payments.filter(p => !p.is_paid && !p.is_cancelled).sort((a,b) => new Date(a.due_date||0) - new Date(b.due_date||0)).map(inv => {
                        const proj = data.projects.find(p => p.id === inv.project_id);
                        const dueStr = inv.due_date ? new Date(inv.due_date + 'T12:00:00').toLocaleDateString() : 'N/A';
                        return (
                          <option key={inv.id} value={inv.id}>
                            {proj?.title} — ${inv.amount} (Due: {dueStr})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Project selector for payment logging */}
                  {!selectedInvoiceId && (
                    <div>
                      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Log Against Project
                      </label>
                      {data.projects.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--amber)', padding: '8px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                          ⚠ No projects found — charge will process but won't be logged in payments.
                        </div>
                      ) : (
                        <select
                          className="input"
                          value={selectedProjectId}
                          onChange={e => setSelectedProjectId(e.target.value)}
                        >
                          {data.projects.length === 1
                            ? <option value={data.projects[0].id}>{data.projects[0].title}</option>
                            : (
                              <>
                                <option value="">Select project to log payment...</option>
                                {data.projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                              </>
                            )
                          }
                        </select>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="label">Amount ($) *</label>
                    <div style={{ position: 'relative' }}>
                      <DollarSign size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="input input-icon"
                        type="number"
                        step="0.01"
                        min="0.50"
                        value={chargeAmount}
                        onChange={e => setChargeAmount(e.target.value)}
                        placeholder="e.g. 500.00"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Description (optional)</label>
                    <div style={{ position: 'relative' }}>
                      <CreditCard size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="input input-icon"
                        value={chargeDesc}
                        onChange={e => setChargeDesc(e.target.value)}
                        placeholder="e.g. Monthly SEO payment"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">System Password *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="input input-icon"
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="Enter your login password to confirm"
                        required
                      />
                    </div>
                  </div>

                  {chargeResult && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                      background: chargeResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                      border: `1px solid ${chargeResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                      color: chargeResult.success ? 'var(--emerald)' : 'var(--rose)',
                    }}>
                      {chargeResult.message}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => setShowChargeModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto', whiteSpace: 'normal', height: 'auto', minHeight: '40px', padding: '8px' }} disabled={charging}>
                    {charging ? <><Loader2 size={14} className="animate-spin" /> Charging...</> : `Charge $${chargeAmount || '0.00'}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Card Modal */}
      <AnimatePresence>
        {showAddCardModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddCardModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-box" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} style={{ color: 'var(--accent-light)' }} /> Add New Card
                </span>
                <button onClick={() => setShowAddCardModal(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddCard}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {cardErr && <div className="alert alert-error"><span>⚠</span><span>{cardErr}</span></div>}
                  <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={14} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Card details are secured by Stripe. Raw card data never touches our servers.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Cardholder Name *</label>
                      <input
                        className="input"
                        value={cardholderName}
                        onChange={e => setCardholderName(e.target.value)}
                        placeholder="Name as shown on card"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Card Number</label>
                      <div style={{ padding: '12px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10 }}>
                        <CardNumberElement options={CARD_ELEMENT_OPTIONS} onChange={e => setCardNumberComplete(e.complete)} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>Expiry Date</label>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10 }}>
                          <CardExpiryElement options={CARD_ELEMENT_OPTIONS} onChange={e => setCardExpiryComplete(e.complete)} />
                        </div>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>CVC</label>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10 }}>
                          <CardCvcElement options={CARD_ELEMENT_OPTIONS} onChange={e => setCardCvcComplete(e.complete)} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>Card Type</label>
                        <select
                          className="input"
                          style={{ fontSize: 13 }}
                          disabled
                          tabIndex={-1}
                        >
                          <option>Auto-detected (Visa / Mastercard / Amex…)</option>
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>Billing Zip Code</label>
                        <input
                          className="input"
                          value={billingZip}
                          onChange={e => setBillingZip(e.target.value)}
                          placeholder="10001"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddCardModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={addingCard || !cardComplete || !cardholderName.trim()}>
                    {addingCard ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving Card…</> : 'Save Card'}
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
