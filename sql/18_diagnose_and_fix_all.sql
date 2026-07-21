-- ══════════════════════════════════════════════════════════════════════
-- 18_diagnose_and_fix_all.sql
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor
-- This script diagnoses AND fixes ALL card-related issues permanently
-- ══════════════════════════════════════════════════════════════════════

-- ── STEP 1: Ensure the table exists ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    stripe_payment_method_id text NOT NULL,
    brand text,
    last4 text,
    exp_month integer,
    exp_year integer,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- ── STEP 2: Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

-- ── STEP 3: Drop ALL old policies (in case of duplicates/conflicts) ──
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.client_payment_methods;

-- ── STEP 4: Create FRESH, clean policies ─────────────────────────────
CREATE POLICY "cpm_select" ON public.client_payment_methods
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "cpm_insert" ON public.client_payment_methods
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cpm_update" ON public.client_payment_methods
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cpm_delete" ON public.client_payment_methods
    FOR DELETE TO authenticated USING (true);

-- ── STEP 5: Sync any missing cards from old clients table ─────────────
-- (For clients whose card was saved in 'clients' table but missed the new table)
INSERT INTO public.client_payment_methods (
    client_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_primary
)
SELECT 
    id as client_id,
    stripe_payment_method_id,
    stripe_card_brand,
    stripe_card_last4,
    stripe_card_exp_month,
    stripe_card_exp_year,
    true as is_primary
FROM public.clients
WHERE stripe_payment_method_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.client_payment_methods cpm
      WHERE cpm.client_id = clients.id
        AND cpm.stripe_payment_method_id = clients.stripe_payment_method_id
  )
ON CONFLICT DO NOTHING;

-- ── STEP 6: Verify — show current policies ───────────────────────────
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'client_payment_methods';

-- ── STEP 7: Verify — show all saved cards ────────────────────────────
SELECT 
    c.full_name,
    c.company,
    cpm.brand,
    cpm.last4,
    cpm.exp_month,
    cpm.exp_year,
    cpm.is_primary,
    cpm.stripe_payment_method_id,
    cpm.created_at
FROM public.client_payment_methods cpm
JOIN public.clients c ON c.id = cpm.client_id
ORDER BY cpm.created_at DESC;
