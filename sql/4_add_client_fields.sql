-- ═══════════════════════════════════════════════════════════════
-- ClientFlow CRM — Add Missing Client Fields for Comprehensive Creation Flow
-- ═══════════════════════════════════════════════════════════════

-- Alter clients table to support all 22 required form fields
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS activity text CHECK (activity IN ('Fresh', 'Transfer', 'Upsell', 'Other'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yelp_link text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_zip text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS services text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agent_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS closer_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS other_information text;

-- ── Card Security Columns ─────────────────────────────────────────
-- card_number: stores ONLY last 4 digits (e.g. "****-****-****-4242") for display
-- card_number_enc: stores AES-GCM 256-bit encrypted full card number (base64)
-- card_expiry: stores AES-GCM encrypted expiry (base64)
-- card_cvv: stores AES-GCM encrypted CVV (base64)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS card_number_enc text;
