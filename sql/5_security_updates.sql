-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Allied Marketing Solutions CRM — Security & Column Updates
-- ═══════════════════════════════════════════════════════════════

-- 1. Add encrypted card number column (if not already there)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS card_number_enc text;

-- 2. Add all new client fields (safe to run even if columns already exist)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS activity text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yelp_link text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_zip text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS services text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agent_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS closer_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS other_information text;

-- 3. Add created_by to interactions (for staff filtering)
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 4. Add created_by to meetings (for staff filtering)  
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
