-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Allied Marketing Solutions CRM — Add task completion fields
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);

-- Refresh schema cache (Supabase auto-does this, but good to have)
comment on table public.tasks is 'CRM tasks with creator, assignee and completion details';
