-- ════════════════════════════════════════════════════════════════════
-- STEP 1: Pehle dekhein — kaunse projects mein same due_date pe
--         2 ya zyada active (unpaid, non-cancelled) rows hain
-- ════════════════════════════════════════════════════════════════════
SELECT
  p.project_id,
  pr.title            AS project_name,
  p.due_date,
  COUNT(*)            AS total_rows,
  ARRAY_AGG(p.id ORDER BY p.created_at ASC)     AS row_ids_oldest_first,
  ARRAY_AGG(p.amount ORDER BY p.created_at ASC) AS amounts
FROM payments p
LEFT JOIN projects pr ON pr.id = p.project_id
WHERE p.is_paid      IS NOT TRUE
  AND p.is_cancelled IS NOT TRUE
  AND p.due_date IS NOT NULL
GROUP BY p.project_id, pr.title, p.due_date
HAVING COUNT(*) > 1
ORDER BY total_rows DESC, p.due_date;


-- ════════════════════════════════════════════════════════════════════
-- STEP 2: CLEANUP — Purani (oldest) row rakho, baaki sab cancel karo.
--         Ye sirf un rows ko cancel karta hai jo duplicates hain.
--         ✅ Safe hai: sirf is_cancelled = true set hota hai, delete nahi.
-- ════════════════════════════════════════════════════════════════════
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, due_date
      ORDER BY created_at ASC   -- oldest row survive karega
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
  AND  r.rn > 1;


-- ════════════════════════════════════════════════════════════════════
-- STEP 3: Verify — 0 rows aani chahiye agar cleanup successful raha
-- ════════════════════════════════════════════════════════════════════
SELECT
  project_id,
  due_date,
  COUNT(*) AS remaining_dupes
FROM payments
WHERE is_paid      IS NOT TRUE
  AND is_cancelled IS NOT TRUE
  AND due_date IS NOT NULL
GROUP BY project_id, due_date
HAVING COUNT(*) > 1;
