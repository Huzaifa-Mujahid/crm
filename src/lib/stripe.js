/**
 * stripe.js — Stripe Frontend Initialization
 * ─────────────────────────────────────────────
 * Stripe publishable key (safe to expose in browser).
 * Secret key kabhi yahan mat likhna — sirf Supabase Secrets mein.
 */

import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Singleton promise — ek baar load hota hai
let stripePromise = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
};

export default getStripe;
