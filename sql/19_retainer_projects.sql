-- 19_retainer_projects.sql
-- Add billing type for retainer/ongoing projects

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'One-time' CHECK (billing_type IN ('One-time', 'Retainer')),
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('Monthly', 'Quarterly', 'Yearly'));

-- Add comment on the table to document the change
COMMENT ON COLUMN public.projects.billing_type IS 'Indicates if the project is a one-time project or a recurring retainer';
COMMENT ON COLUMN public.projects.billing_cycle IS 'For retainers, how often it bills (Monthly, Quarterly, Yearly)';
