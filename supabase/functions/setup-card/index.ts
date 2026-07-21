/**
 * setup-card/index.ts
 * ─────────────────────────────────────────────────────────────────
 * Dual-mode edge function:
 *
 * MODE A — SetupIntent banana (card save karna):
 *   Input:  { customer_id: string }
 *   Output: { client_secret: string }
 *
 * MODE B — PaymentMethod display info retrieve karna:
 *   Input:  { retrieve_pm: string }   (Stripe pm_xxx ID)
 *   Output: { brand, last4, exp_month, exp_year }
 *
 * Note: Actual card data kabhi hamare server se nahi guzarta (PCI compliant).
 *       Sirf display info (brand, last4, expiry) wapas return hoti hai.
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

    const body = await req.json();

    // ── MODE B: PaymentMethod display info retrieve karna ──────────
    if (body.retrieve_pm) {
      const pm = await stripe.paymentMethods.retrieve(body.retrieve_pm);

      if (!pm.card) {
        return new Response(JSON.stringify({ error: 'Payment method has no card data.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          brand:     pm.card.brand,      // "visa", "mastercard", "amex", etc.
          last4:     pm.card.last4,      // "4242"
          exp_month: pm.card.exp_month,  // 12
          exp_year:  pm.card.exp_year,   // 2027
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── MODE A: SetupIntent banana (existing behavior) ──────────────
    const { customer_id } = body;

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id or retrieve_pm is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customer_id,
      payment_method_types: ['card'],
      usage: 'on_session', // User is present when card is being saved — higher bank acceptance rate
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
