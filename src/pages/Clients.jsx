import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Loader2, ArrowUpRight, Building2, X, CreditCard, Briefcase, DollarSign, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCardBrand } from '../lib/cardCrypto';

const STATUS_BADGE = {
  Active:     'badge-emerald',
  Onboarding: 'badge-blue',
  'At Risk':  'badge-amber',
  Churned:    'badge-rose',
};

const SERVICE_OPTIONS = [
  'GMB + WEBSITE DEVELOPMENT',
  'SOCIAL MEDIA',
  'LANDING PAGE - MARKETING',
  'WEBSITE REDESIGN & DEVELOPMENT',
  'GMB + LANDING PAGE MARKETING',
  'GMB + SOCIAL MEDIA (PAID)',
  'GMB+WEBSITE DEVELOPMENT',
  'GOOGLE BUSINESS PROFILE ( SEO )',
  'GMB CREATION ONE TIME',
  'GOOGLE ADS',
];

const AVATAR_BG = ['var(--accent-glow)', 'var(--emerald-glow)', 'var(--amber-glow)', 'var(--blue-glow)', 'var(--rose-glow)'];
const AVATAR_FG = ['var(--accent-light)', 'var(--emerald)', 'var(--amber)', 'var(--blue)', 'var(--rose)'];
const av = (name) => { const i = (name?.charCodeAt(0) || 0) % 5; return [AVATAR_BG[i], AVATAR_FG[i]]; };

/* ── Stripe CardElement styles ──────────────────────────────── */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#e2e8f0',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: '14px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#64748b' },
      iconColor: '#6366f1',
    },
    invalid: { color: '#f43f5e', iconColor: '#f43f5e' },
  },
};

/* ── Add Client Modal ─────────────────────────────────────────── */
const AddClientModal = ({ onClose, onSaved }) => {
  const { user, isAdmin, isManager, role } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const isCS = role === 'Customer Success Manager';
  const isCloser = role === 'Sales Closer';
  const isAgent = role === 'Sales Agent';
  const canHandlePayment = isAdmin || isManager || isCS || isCloser || isAgent;
  const [customService, setCustomService] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const [form, setForm] = useState({ 
    // Client Info
    full_name: '', 
    email: '', 
    phone: '', 
    company: '', 
    address: '', 
    status: 'Active', 
    assigned_to: '',
    
    // New Client fields
    date: new Date().toISOString().split('T')[0],
    activity: 'Fresh',
    yelp_link: '',
    business_email: '',
    city: '',
    state: '',
    zip_code: '',
    services: '',
    agent_name: '',
    closer_name: '',
    other_information: '',

    // Payment Info (Stripe — no raw card data)
    payment_method: '',
    billing_zip: '',

    // Project Info
    create_project: false,
    project_title: '',
    project_description: '',
    project_budget: '',
    project_status: 'Pending',
    project_start_date: '',
    project_end_date: '',

    // Initial Payment Info
    create_payment: false,
    payment_total: '',
    payment_paid_now: '',
    payment_type: 'One-time',
    payment_due_date: '',
  });

  const isCardPayment = ['Visa', 'MasterCard', 'AMEX', 'Discover'].includes(form.payment_method);
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCardChange = (e) => {
    setCardComplete(e.complete);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    // Read from staff_keys so ALL active staff (including Employees who haven't
    // logged in yet) appear in dropdowns the moment Admin creates them.
    const { data } = await supabase
      .from('staff_keys')
      .select('user_id, full_name, role')
      .eq('is_active', true);
    setStaffList(data || []);
    if (!isAdmin && !isManager) {
      up('assigned_to', user.id);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.business_email) { setErr('Name and Business Email are required.'); return; }
    setSaving(true); setErr(null);
    try {
      // ── Step 1: Insert Client (without card data first) ──────────
      const clientPayload = {
        full_name: form.full_name,
        email: form.business_email,
        phone: form.phone,
        company: form.company,
        address: form.address,
        status: form.status,
        assigned_to: form.assigned_to || user.id,
        health_score: 80,
        
        // New columns
        date: form.date || null,
        activity: form.activity || null,
        yelp_link: form.yelp_link || null,
        business_email: form.business_email || null,
        billing_zip: form.billing_zip || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        agent_name: form.agent_name || null,
        closer_name: form.closer_name || null,
        other_information: form.other_information || null,
        
        payment_method: form.payment_method || null,
      };

      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .insert([clientPayload])
        .select();

      if (clientErr) throw clientErr;
      const newClient = clientData?.[0];
      if (!newClient) throw new Error('Failed to retrieve new client ID.');

      // ── Step 2: Stripe Card Save (if card payment selected) ──────
      if (isCardPayment && cardComplete && stripe && elements) {
        try {
          // 2a. Create Stripe Customer
          const { data: custData, error: custErr } = await supabase.functions.invoke('create-stripe-customer', {
            body: { name: form.full_name, email: form.business_email, client_id: newClient.id },
          });
          if (custErr) throw custErr;
          const stripeCustomerId = custData?.customer_id;
          if (!stripeCustomerId) throw new Error('Stripe customer creation failed.');

          // 2b. Create SetupIntent
          const { data: siData, error: siErr } = await supabase.functions.invoke('setup-card', {
            body: { customer_id: stripeCustomerId },
          });
          if (siErr) throw siErr;
          const clientSecret = siData?.client_secret;
          if (!clientSecret) throw new Error('SetupIntent creation failed.');

          // 2c. Confirm card with Stripe (card never touches our server)
          const cardEl = elements.getElement(CardElement);
          const { setupIntent, error: confirmErr } = await stripe.confirmCardSetup(clientSecret, {
            payment_method: { card: cardEl, billing_details: { name: form.full_name, email: form.business_email } },
          });
          if (confirmErr) throw new Error(confirmErr.message);

          const pmId = setupIntent.payment_method;

          // 2d. Retrieve card details (brand + last4) from Stripe
          // We use the setupIntent's payment_method to get display info
          // Save customer_id + pm_id + display info to our DB
          const { data: pmData } = await supabase.functions.invoke('setup-card', {
            body: { customer_id: stripeCustomerId, retrieve_pm: pmId },
          }).catch(() => ({ data: null }));

          // Update client with Stripe info
          await supabase.from('clients').update({
            stripe_customer_id: stripeCustomerId,
            stripe_payment_method_id: pmId,
            // Display info will be populated when user visits ClientDetail
          }).eq('id', newClient.id);

        } catch (stripeErr) {
          // Stripe error — client already saved, just warn
          console.error('Stripe card setup error:', stripeErr);
          setErr(`Client saved, but card setup failed: ${stripeErr.message}`);
          setSaving(false);
          return onSaved(); // Still close and refresh
        }
      }

      // 2. Insert Project (if requested)
      if (form.create_project && form.project_title) {
        const projectPayload = {
          client_id: newClient.id,
          title: form.project_title,
          description: form.project_description || null,
          budget: parseFloat(form.project_budget) || 0,
          status: form.project_status || 'Pending',
          start_date: form.project_start_date || null,
          end_date: form.project_end_date || null,
          sales_agent: form.agent_name || null,
          closer: form.closer_name || null,
          assigned_to: form.assigned_to || user.id,
          services: form.services || null
        };

        const { data: projectData, error: projectErr } = await supabase
          .from('projects')
          .insert([projectPayload])
          .select();

        if (projectErr) throw projectErr;
        const newProject = projectData?.[0];

        // 3. Insert Payments (if requested)
        if (form.create_payment && newProject) {
          const total = parseFloat(form.payment_total) || 0;
          const paidNow = parseFloat(form.payment_paid_now) || 0;
          const remaining = Math.max(0, total - paidNow);

          const paymentsToInsert = [];

          // Row 1: Amount already paid (if any)
          if (paidNow > 0) {
            paymentsToInsert.push({
              project_id: newProject.id,
              amount: paidNow,
              payment_type: form.payment_type || 'One-time',
              due_date: new Date().toISOString().split('T')[0],
              is_paid: true,
              payment_date: new Date().toISOString()
            });
          }

          // Row 2: Remaining balance (if any)
          if (remaining > 0) {
            paymentsToInsert.push({
              project_id: newProject.id,
              amount: remaining,
              payment_type: form.payment_type || 'One-time',
              due_date: form.payment_due_date || null,
              is_paid: false,
              payment_date: null
            });
          }

          if (paymentsToInsert.length > 0) {
            const { error: paymentErr } = await supabase
              .from('payments')
              .insert(paymentsToInsert);
            if (paymentErr) throw paymentErr;
          }
        }
      }

      onSaved();
    } catch (e) { 
      setErr(e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="modal-box" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <span className="modal-title">Add New Client & Setup Services</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          {err && <div className="alert alert-error"><span>⚠</span><span>{err}</span></div>}
          <form id="add-client-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Section 1: Client Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={15} /> 1. Client & Business Details
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label className="label">Customer Name *</label>
                  <input className="input" value={form.full_name} onChange={e => up('full_name', e.target.value)} placeholder="John Smith" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div>
                  <label className="label">Sale Date</label>
                  <input className="input" type="date" value={form.date} onChange={e => up('date', e.target.value)} onClick={(e) => e.target.showPicker?.()} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Lead Type</label>
                  <select className="input" value={form.activity} onChange={e => up('activity', e.target.value)}>
                    <option value="Fresh">Fresh (New Lead)</option>
                    <option value="Transfer">Transfer (Assigned/Moved)</option>
                    <option value="Upsell">Upsell (Existing Expansion)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Yelp Business Profile Link</label>
                  <input className="input" value={form.yelp_link} onChange={e => up('yelp_link', e.target.value)} placeholder="https://yelp.com/biz/..." />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Business Name</label>
                  <input className="input" value={form.company} onChange={e => up('company', e.target.value)} placeholder="Acme Inc." />
                </div>
                <div>
                  <label className="label">Business Email *</label>
                  <input className="input" type="email" value={form.business_email} onChange={e => { up('business_email', e.target.value); up('email', e.target.value); }} placeholder="info@acme.com" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Street Address</label>
                  <input className="input" value={form.address} onChange={e => up('address', e.target.value)} placeholder="123 Main St" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => up('city', e.target.value)} placeholder="New York" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={form.state} onChange={e => up('state', e.target.value)} placeholder="NY" />
                </div>
                <div>
                  <label className="label">Zip Code</label>
                  <input className="input" value={form.zip_code} onChange={e => up('zip_code', e.target.value)} placeholder="10001" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Agent Name</label>
                  <select className="input" value={form.agent_name} onChange={e => up('agent_name', e.target.value)}>
                    <option value="">Select Agent...</option>
                    {staffList.filter(s => s.role === 'Sales Agent').map(s => (
                      <option key={s.user_id} value={s.full_name}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Closer Name</label>
                  <select className="input" value={form.closer_name} onChange={e => up('closer_name', e.target.value)}>
                    <option value="">Select Closer...</option>
                    {staffList.filter(s => s.role === 'Sales Closer').map(s => (
                      <option key={s.user_id} value={s.full_name}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => up('status', e.target.value)}>
                    {['Active', 'Onboarding', 'At Risk', 'Churned'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {(isAdmin || isManager) && (
                <div>
                  <label className="label">Assign Client to Staff Member</label>
                  <select className="input" value={form.assigned_to} onChange={e => up('assigned_to', e.target.value)}>
                    <option value="">Select Staff...</option>
                    {staffList.map(s => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.full_name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Other Information</label>
                <textarea className="input" rows={2} value={form.other_information} onChange={e => up('other_information', e.target.value)} placeholder="Additional notes about client..." />
              </div>
            </div>

            {/* Section 2: Payment Details */}
            {canHandlePayment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={15} /> 2. Payment & Billing Information
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div>
                    <label className="label">Payment Options</label>
                    <select className="input" value={form.payment_method} onChange={e => up('payment_method', e.target.value)}>
                      <option value="">Select Option...</option>
                      <option value="Visa">Visa</option>
                      <option value="MasterCard">MasterCard</option>
                      <option value="AMEX">AMEX</option>
                      <option value="Discover">Discover</option>
                      <option value="Merchant Link">Merchant Link</option>
                      <option value="Wire Transfer">Wire Transfer</option>
                      <option value="PayPal">PayPal</option>
                    </select>
                  </div>
                </div>

                {isCardPayment && (
                  <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Stripe CardElement — card data never touches our server */}
                    <div>
                      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={12} style={{ color: 'var(--emerald)' }} />
                        Card Details (Secured by Stripe)
                      </label>
                      <div style={{
                        padding: '12px 14px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        transition: 'border-color 0.2s',
                      }}>
                        <CardElement options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange} />
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🔒 Card info goes directly to Stripe — never stored on our servers
                      </p>
                    </div>
                    <div>
                      <label className="label">Billing Zip Code</label>
                      <input
                        className="input"
                        value={form.billing_zip}
                        onChange={e => up('billing_zip', e.target.value)}
                        placeholder="10001"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Project Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Briefcase size={15} /> 3. Project Setup
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <input type="checkbox" checked={form.create_project} onChange={e => up('create_project', e.target.checked)} style={{ width: 14, height: 14 }} />
                  Create Project
                </label>
              </div>

              {form.create_project && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Project Title *</label>
                      <input className="input" required={form.create_project} value={form.project_title} onChange={e => up('project_title', e.target.value)} placeholder="e.g. Website Redesign" />
                    </div>
                    <div>
                      <label className="label">Services Included</label>
                      {!customService && (SERVICE_OPTIONS.includes(form.services) || !form.services) ? (
                        <select className="input" value={form.services} onChange={e => {
                          const val = e.target.value;
                          if (val === 'Custom') {
                            setCustomService(true);
                            up('services', '');
                          } else {
                            up('services', val);
                          }
                        }}>
                          <option value="">Select Service...</option>
                          {SERVICE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          <option value="Custom">✨ Write Custom Service...</option>
                        </select>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input className="input" style={{ flex: 1 }} value={form.services} onChange={e => up('services', e.target.value.toUpperCase())} placeholder="Write custom service..." />
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0 10px', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                            type="button"
                            onClick={() => { setCustomService(false); up('services', ''); }}>
                            ✕ Dropdown
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label">Project Description</label>
                    <textarea className="input" rows={2} value={form.project_description} onChange={e => up('project_description', e.target.value)} placeholder="Brief project description..." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Budget ($)</label>
                      <input className="input" type="number" min="0" step="0.01" value={form.project_budget} onChange={e => up('project_budget', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Project Status</label>
                      <select className="input" value={form.project_status} onChange={e => up('project_status', e.target.value)}>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Start Date</label>
                      <input className="input" type="date" value={form.project_start_date} onChange={e => up('project_start_date', e.target.value)} onClick={(e) => e.target.showPicker?.()} />
                    </div>
                    <div>
                      <label className="label">Deadline</label>
                      <input className="input" type="date" value={form.project_end_date} onChange={e => up('project_end_date', e.target.value)} onClick={(e) => e.target.showPicker?.()} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Initial Invoice / Payment Setup */}
            {form.create_project && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DollarSign size={15} /> 4. Initial Invoice / Payment
                  </h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.create_payment} onChange={e => up('create_payment', e.target.checked)} style={{ width: 14, height: 14 }} />
                    Log Payment / Invoice
                  </label>
                </div>

                {form.create_payment && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Total + Paid split */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label">Total Amount ($) *</label>
                        <input className="input" type="number" step="0.01" min="0"
                          required={form.create_payment}
                          value={form.payment_total}
                          onChange={e => up('payment_total', e.target.value)}
                          placeholder="e.g. 1500.00" />
                      </div>
                      <div>
                        <label className="label">Paid Now ($)</label>
                        <input className="input" type="number" step="0.01" min="0"
                          value={form.payment_paid_now}
                          onChange={e => up('payment_paid_now', Math.min(e.target.value, form.payment_total || e.target.value))}
                          placeholder="e.g. 500.00" />
                      </div>
                    </div>

                    {/* Auto-calculated remaining */}
                    {form.payment_total && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Remaining Balance</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: Math.max(0, parseFloat(form.payment_total||0) - parseFloat(form.payment_paid_now||0)) > 0 ? 'var(--amber)' : 'var(--emerald)' }}>
                          ${Math.max(0, parseFloat(form.payment_total||0) - parseFloat(form.payment_paid_now||0)).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label">Payment Type</label>
                        <select className="input" value={form.payment_type} onChange={e => up('payment_type', e.target.value)}>
                          <option value="One-time">One-time</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Setup Fee">Setup Fee</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Remaining Due Date</label>
                        <input className="input" type="date" value={form.payment_due_date}
                          onChange={e => up('payment_due_date', e.target.value)}
                          onClick={e => e.target.showPicker?.()}
                          placeholder="When is balance due?" />
                      </div>
                    </div>

                    {/* Summary preview */}
                    {form.payment_total && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Payment Summary</p>
                        {parseFloat(form.payment_paid_now||0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>✓ Paid Now (Collected)</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>${parseFloat(form.payment_paid_now||0).toFixed(2)}</span>
                          </div>
                        )}
                        {Math.max(0, parseFloat(form.payment_total||0) - parseFloat(form.payment_paid_now||0)) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⏳ Remaining (Pending)</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>${Math.max(0, parseFloat(form.payment_total||0) - parseFloat(form.payment_paid_now||0)).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="add-client-form" type="submit" disabled={saving}>
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</> : 'Add Client'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Clients Page ─────────────────────────────────────────────── */
const Clients = () => {
  const { isAdmin, role } = useAuth();
  const canAddClient = ['Admin', 'Manager', 'Customer Success Manager', 'Sales Agent', 'Sales Closer'].includes(role);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchClients();

    // Handle Quick actions
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true' && canAddClient) {
      setShowModal(true);
      // Clear the param from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, role]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setClients(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client{clients.length !== 1 ? 's' : ''} in your database</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canAddClient && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} />Add Client</button>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select className="input" style={{ paddingRight: 34, minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['Active', 'Onboarding', 'At Risk', 'Churned'].map(s => <option key={s}>{s}</option>)}
          </select>
          <Filter size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Loading clients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Search size={22} /></div>
            <p className="empty-title">No clients found</p>
            <p className="empty-desc">{search || statusFilter ? 'Try adjusting your search or filter.' : 'Add your first client to get started.'}</p>
            {!search && !statusFilter && canAddClient && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={14} />Add Client</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Business Name</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Health Score</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((client, idx) => {
                    const [abg, afg] = av(client.full_name);
                    const score = client.health_score || 80;
                    const scoreColor = score >= 70 ? 'var(--emerald)' : score >= 40 ? 'var(--amber)' : 'var(--rose)';
                    return (
                      <motion.tr key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                        onClick={() => navigate(`/clients/${client.id}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="avatar" style={{ background: abg, color: afg, width: 36, height: 36, fontSize: 13, borderRadius: 10 }}>{(client.full_name?.trim()?.[0] || 'U').toUpperCase()}</div>
                            <div>
                              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{client.full_name}</p>
                              <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{client.company || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {client.payment_method ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CreditCard size={12} style={{ color: 'var(--accent-light)' }} /> {client.payment_method}
                              </p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                                {client.stripe_card_last4 ? `**** **** **** ${client.stripe_card_last4}` : '—'}
                              </p>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[client.status] || 'badge-slate'}`}>
                            <span className="badge-dot" />
                            {client.status || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-fill" style={{ width: `${score}%`, background: scoreColor }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor }}>{score}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); navigate(`/clients/${client.id}`); }}>
                            <ArrowUpRight size={15} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && <AddClientModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchClients(); }} />}
      </AnimatePresence>
    </div>
  );
};

export default Clients;
