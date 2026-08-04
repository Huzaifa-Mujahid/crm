-- ════════════════════════════════════════════════════════════════════
-- Prevent duplicate recurring payments for the same project and due date
-- Run this once in Supabase SQL Editor to harden the payments table.
-- It also includes diagnostic cleanup queries for existing duplicates.
-- ════════════════════════════════════════════════════════════════════

-- 1) Find any existing active duplicate rows for project_id + due_date
--    (active means not cancelled)
SELECT
  project_id,
  due_date,
  COUNT(*) AS duplicate_count,
  BOOL_AND(is_cancelled IS NOT TRUE) AS all_active
FROM payments
GROUP BY project_id, due_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2) Inspect duplicates in detail for the problematic project(s)
--    Replace the project_id and due_date below with values from query #1.
SELECT *
FROM payments
WHERE project_id = '<PROJECT_ID>'
  AND due_date = 'YYYY-MM-DD'
ORDER BY created_at ASC;

-- 3) Cleanup duplicates by keeping one row and cancelling/removing others.
--    Use one of the two statements below after reviewing the rows above.

-- Option A: mark all older duplicate rows cancelled except the newest one.
-- WARNING: review the selection carefully before running.
WITH duplicates AS (
  SELECT id,
         project_id,
         due_date,
         ROW_NUMBER() OVER (PARTITION BY project_id, due_date ORDER BY created_at DESC) AS rn
  FROM payments
  WHERE project_id = '<PROJECT_ID>'
    AND due_date = 'YYYY-MM-DD'
    AND is_cancelled IS NOT TRUE
)
UPDATE payments
SET is_cancelled = true
FROM duplicates d
WHERE payments.id = d.id
  AND d.rn > 1;

-- Option B: delete duplicate rows directly.
-- WARNING: only use if you are sure the duplicate row is not needed.
-- DELETE FROM payments
-- WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY project_id, due_date ORDER BY created_at DESC) AS rn
--     FROM payments
--     WHERE project_id = '<PROJECT_ID>'
--       AND due_date = 'YYYY-MM-DD'
--       AND is_cancelled IS NOT TRUE
--   ) x
--   WHERE rn > 1
-- );

-- 4) Create a partial unique index to prevent future duplicates.
--    This prevents more than one active payment row with the same project_id + due_date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_project_due_unique
ON payments (project_id, due_date)
WHERE is_cancelled IS NOT TRUE;

-- 5) Optional: verify the index and check for a clean duplicate-free state.
SELECT
  project_id,
  due_date,
  COUNT(*) AS count_active
FROM payments
WHERE is_cancelled IS NOT TRUE
GROUP BY project_id, due_date
HAVING COUNT(*) > 1
ORDER BY count_active DESC;

-- End of script.
