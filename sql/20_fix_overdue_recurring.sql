-- ════════════════════════════════════════════════════════════════
-- Fix: Overdue Recurring Payments — Missing Next-Cycle Records
-- Run this ONCE in Supabase SQL Editor to fix EXISTING data
-- New payments are handled by updated frontend logic
-- ════════════════════════════════════════════════════════════════

-- STEP 1: Diagnose — See which recurring payments have NO unpaid partner record
-- (These are the ones missing from overdue tracking)
SELECT 
  p.id,
  p.project_id,
  p.amount,
  p.payment_type,
  p.due_date,
  p.is_paid,
  p.payment_date,
  cl.full_name AS client_name
FROM payments p
JOIN projects pr ON pr.id = p.project_id
JOIN clients cl ON cl.id = pr.client_id
WHERE p.is_paid = true
  AND p.payment_type IN ('Monthly', 'Weekly', '6 Months', 'Yearly')
  -- Only rows where there is NO other unpaid record for the same project
  AND NOT EXISTS (
    SELECT 1 FROM payments p2
    WHERE p2.project_id = p.project_id
      AND p2.is_paid = false
      AND p2.is_cancelled IS NOT TRUE
  )
ORDER BY cl.full_name;

-- ════════════════════════════════════════════════════════════════
-- STEP 2: Fix missing payment_date on paid records
-- (Some old records were marked paid but payment_date was never set)
-- ════════════════════════════════════════════════════════════════
UPDATE payments
SET payment_date = created_at
WHERE is_paid = true
  AND payment_date IS NULL
  AND is_cancelled IS NOT TRUE;

-- ════════════════════════════════════════════════════════════════
-- STEP 3: MANUAL FIX INSTRUCTIONS
-- For each client found in STEP 1 above, you need to manually
-- go to Payments page → Log Payment for that client's project
-- with:
--   • Total Amount = [same monthly amount]
--   • Paid Now = 0 (leave empty)
--   • Type = Monthly
--   • Remaining Due Date = [next payment deadline]
--
-- This will create the unpaid tracking record.
-- Going forward, the new frontend code handles this automatically.
-- ════════════════════════════════════════════════════════════════
