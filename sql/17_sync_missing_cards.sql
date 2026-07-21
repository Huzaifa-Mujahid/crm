-- Run this to sync any missing cards that were saved in the clients table 
-- but failed to insert into the new payment methods table (e.g. due to RLS before the fix)

INSERT INTO public.client_payment_methods (
    client_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_primary
)
SELECT 
    id, stripe_payment_method_id, stripe_card_brand,
    stripe_card_last4, stripe_card_exp_month, stripe_card_exp_year, true
FROM public.clients
WHERE stripe_payment_method_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.client_payment_methods 
      WHERE client_payment_methods.client_id = clients.id
  );
