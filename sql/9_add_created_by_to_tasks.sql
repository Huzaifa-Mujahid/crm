-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Allied Marketing Solutions CRM — Add created_by column to Tasks
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update existing tasks to have user_id of the person they are assigned to as fallback
UPDATE public.tasks SET created_by = assigned_to WHERE created_by IS NULL;
