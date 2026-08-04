-- ════════════════════════════════════════════════════════════════════
-- 22_cleanup_duplicate_payments.sql
-- Diagnose + clean existing duplicate payment rows (same project, same month).
-- Run in Supabase SQL Editor. Review each step before executing.
-- ════════════════════════════════════════════════════════════════════

-- STEP 1: Find ALL projects that have more than one UNPAID, non-cancelled
--         payment row in the same calendar month. These are your duplicates.
SELECT
  project_id,
  TO_CHAR(due_date::date, 'YYYY-MM') AS month,
  COUNT(*)                            AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at)  AS row_ids,
  ARRAY_AGG(amount ORDER BY created_at) AS amounts
FROM payments
WHERE is_paid      IS NOT TRUE
  AND is_cancelled IS NOT TRUE
  AND due_date IS NOT NULL
GROUP BY project_id, TO_CHAR(due_date::date, 'YYYY-MM')
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, month;


-- STEP 2: See detailed info for the problematic "Landing Page SEO Plan"
--         (Integrity Painting) rows visible in your screenshot.
--         The invoice IDs shown were: 00E311BF and 9820B6C6.
SELECT
  id,
  project_id,
  amount,
  due_date,
  is_paid,
  is_cancelled,
  payment_type,
  created_at
FROM payments
WHERE (id ILIKE '00e311bf%' OR id ILIKE '9820b6c6%')
ORDER BY created_at ASC;


-- STEP 3: AUTO-CLEANUP — Keep the OLDEST unpaid row per project per month,
--         void/cancel all newer duplicate rows.
--         ⚠️  Review STEP 1 output BEFORE running this block.
WITH ranked AS (
  SELECT
    id,
    project_id,
    due_date,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, TO_CHAR(due_date::date, 'YYYY-MM')
      ORDER BY created_at ASC     -- keep the earliest created row
    ) AS rn
  FROM payments
  WHERE is_paid      IS NOT TRUE
    AND is_cancelled IS NOT TRUE
    AND due_date IS NOT NULL
)
UPDATE payments
SET    is_cancelled = TRUE
FROM   ranked r
WHERE  payments.id = r.id
  AND  r.rn > 1;   -- cancel all except the first (oldest) per month


-- STEP 4: Verify — should return 0 rows if cleanup succeeded.
SELECT
  project_id,
  TO_CHAR(due_date::date, 'YYYY-MM') AS month,
  COUNT(*) AS remaining_dupes
FROM payments
WHERE is_paid      IS NOT TRUE
  AND is_cancelled IS NOT TRUE
  AND due_date IS NOT NULL
GROUP BY project_id, TO_CHAR(due_date::date, 'YYYY-MM')
HAVING COUNT(*) > 1;


-- STEP 5: (Optional but recommended) Add a DB-level unique constraint so
--         this can never happen again even from direct DB inserts.
--         This replaces the old exact-date unique index with a month-level one.
--         ⚠️  Drop the old index first if it exists:
DROP INDEX IF EXISTS idx_payments_project_due_unique;

-- Month-level unique index: only one active unpaid row per project per month.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_project_month_unique
ON payments (project_id, TO_CHAR(due_date::date, 'YYYY-MM'))
WHERE is_paid IS NOT TRUE AND is_cancelled IS NOT TRUE;

-- End of script.
