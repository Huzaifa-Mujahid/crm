/**
 * charge-card/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Stripe customer ke saved payment method se payment karta hai.
 * Amount cents mein hona chahiye (e.g., $50 = 5000).
 *
 * Input:  {
 *   customer_id: string,
 *   payment_method_id: string,
 *   amount: number,          // in CENTS (e.g. 5000 = $50.00)
 *   description?: string,
 *   currency?: string,        // default: 'usd'
 *   project_id?: string       // optional: project budget validation ke liye
 * }
 * Output: { success: boolean, payment_intent_id: string }
 *
 * SECURITY:
 *   - JWT verification from Authorization header
 *   - Only Admin role can charge
 *   - Amount validated against project budget (if project_id provided)
 *
 * Deploy: supabase functions deploy charge-card
 * Secrets: STRIPE_SECRET_KEY, SUPABASE_URL (SUPABASE_SERVICE_ROLE_KEY auto-injected)
 *          — Supabase Dashboard > Settings > Secrets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: Extract JWT & verify user ────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(jwt);

    if (authErr || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Auth: Check Admin role from user_roles table ────────────────
    const { data: roleData, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .single();

    if (roleErr || !roleData) {
      return new Response(
        JSON.stringify({ error: 'User role not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (roleData.role !== 'Admin') {
      return new Response(
        JSON.stringify({ error: 'Only Admin users can charge cards' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Parse request body ──────────────────────────────────────────
    const {
      customer_id,
      payment_method_id,
      amount,
      description = 'CRM Payment',
      currency = 'usd',
      project_id,
    } = await req.json();

    if (!customer_id || !payment_method_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'customer_id, payment_method_id, and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < 50) {
      return new Response(
        JSON.stringify({ error: 'Minimum charge is $0.50 (50 cents)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Amount validation: check against project budget ─────────────
    if (project_id) {
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('budget')
        .eq('id', project_id)
        .single();

      if (projErr || !project) {
        return new Response(
          JSON.stringify({ error: 'Selected project not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (project.budget && Math.round(amount) > Math.round(project.budget * 100)) {
        return new Response(
          JSON.stringify({
            error: `Amount $${(amount / 100).toFixed(2)} exceeds project budget of $${Number(project.budget).toFixed(2)}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Process charge ──────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-04-10',
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      customer: customer_id,
      payment_method: payment_method_id,
      description,
      confirm: true,
      off_session: true,
    });

    // ── Audit log ───────────────────────────────────────────────────
    await supabase.from('activity_log').insert({
      table_name: 'payments',
      record_id: paymentIntent.id,
      action: 'stripe_charge',
      new_data: {
        customer_id,
        amount: Math.round(amount),
        payment_intent_id: paymentIntent.id,
        project_id: project_id || null,
        status: paymentIntent.status,
        performed_by: authUser.id,
      },
      performed_by: authUser.id,
    });

    return new Response(
      JSON.stringify({ success: true, payment_intent_id: paymentIntent.id, status: paymentIntent.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('charge-card error:', err);

    // ── Handle authentication_required specifically ─────────────────
    if (err.type === 'StripeCardError' && err.code === 'authentication_required') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Card requires authentication. Please ask the client to re-authenticate their card or use a different payment method.',
          code: 'authentication_required',
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
