-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Add support for multiple payment methods per client
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the new table for multiple payment methods
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

-- 2. Migrate existing cards from clients table to the new table
INSERT INTO public.client_payment_methods (
    client_id, 
    stripe_payment_method_id, 
    brand, 
    last4, 
    exp_month, 
    exp_year, 
    is_primary
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
      SELECT 1 FROM public.client_payment_methods 
      WHERE client_payment_methods.client_id = clients.id 
      AND client_payment_methods.stripe_payment_method_id = clients.stripe_payment_method_id
  );
