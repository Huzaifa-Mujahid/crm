/**
 * setup-card/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Stripe SetupIntent create karta hai taake card save ho sake bina
 * koi payment liye. Frontend CardElement se confirmCardSetup karega.
 *
 * Input:  { customer_id: string }
 * Output: { client_secret: string }
 *
 * Deploy: supabase functions deploy setup-card
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

    const { customer_id } = await req.json();

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customer_id,
      payment_method_types: ['card'],
      usage: 'off_session', // Future charges ke liye
    });

    return new Response(JSON.stringify({ client_secret: setupIntent.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('setup-card error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
