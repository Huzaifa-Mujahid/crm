/**
 * create-stripe-customer/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Naya client add hone par Stripe mein customer create karta hai.
 * Input:  { name: string, email: string, client_id: string }
 * Output: { customer_id: string }
 *
 * Deploy: supabase functions deploy create-stripe-customer
 * Secret: STRIPE_SECRET_KEY — Supabase Dashboard > Settings > Secrets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-04-10',
    });

    const { name, email, client_id } = await req.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customer = await stripe.customers.create({
      name,
      email,
      metadata: {
        crm_client_id: client_id ?? '',
      },
    });

    return new Response(JSON.stringify({ customer_id: customer.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-stripe-customer error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
