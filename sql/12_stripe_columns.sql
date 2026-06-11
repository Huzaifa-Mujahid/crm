-- ─────────────────────────────────────────────────────────────────
-- Migration 12: Stripe Integration Columns
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Stripe customer ID (created when client is added)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Default payment method ID (saved card ka Stripe PM ID)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- 3. Card display info (brand + last4) — Stripe se aata hai, koi sensitive data nahi
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_card_brand TEXT;       -- e.g. 'visa', 'mastercard'

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_card_last4 TEXT;       -- e.g. '4242'

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_card_exp_month INTEGER; -- e.g. 12

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_card_exp_year INTEGER;  -- e.g. 2028

-- 4. Old encrypted card columns (ab bhi rakhein existing data ke liye)
-- card_number, card_number_enc, card_expiry, card_cvv already exist

-- ─────────────────────────────────────────────────────────────────
-- IMPORTANT: Stripe ke columns mein RLS apply hoti hai automatically
-- kyunki ye clients table ke column hain.
-- stripe_customer_id sensitive nahi, lekin best practice:
-- sirf service_role ya authenticated users read kar sakein.
-- ─────────────────────────────────────────────────────────────────

-- Index for faster lookup by stripe customer id
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id
  ON clients(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN clients.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN clients.stripe_payment_method_id IS 'Stripe default saved card PM ID (pm_xxx)';
COMMENT ON COLUMN clients.stripe_card_brand IS 'Card brand from Stripe: visa, mastercard, amex, discover';
COMMENT ON COLUMN clients.stripe_card_last4 IS 'Last 4 digits of saved card (from Stripe, not stored manually)';
COMMENT ON COLUMN clients.stripe_card_exp_month IS 'Card expiry month (1-12)';
COMMENT ON COLUMN clients.stripe_card_exp_year IS 'Card expiry year (e.g. 2028)';
