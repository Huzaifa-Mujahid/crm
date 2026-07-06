-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Add missing columns for Clients and Projects to fix saving issues
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sales_agent text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS closer text;
