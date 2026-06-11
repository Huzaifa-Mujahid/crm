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
 *   currency?: string        // default: 'usd'
 * }
 * Output: { success: boolean, payment_intent_id: string }
 *
 * Deploy: supabase functions deploy charge-card
 * Secret: STRIPE_SECRET_KEY — Supabase Dashboard > Settings > Secrets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-04-10',
    });

    const {
      customer_id,
      payment_method_id,
      amount,
      description = 'CRM Payment',
      currency = 'usd',
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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // cents
      currency,
      customer: customer_id,
      payment_method: payment_method_id,
      description,
      confirm: true,
      off_session: true, // CRM se bina customer ke
    });

    return new Response(
      JSON.stringify({ success: true, payment_intent_id: paymentIntent.id, status: paymentIntent.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('charge-card error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
