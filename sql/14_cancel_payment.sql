-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Add missing column for Cancelled Payments
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_cancelled boolean DEFAULT false;
