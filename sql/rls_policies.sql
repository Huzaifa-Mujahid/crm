-- ==============================================================================
-- ClientFlowCRM Supabase Row Level Security (RLS) Policies
-- ==============================================================================
-- ⚠️ Run this script in the Supabase Dashboard SQL Editor
-- This ensures the frontend cannot bypass security roles via browser console

-- 1. Enable RLS on all tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- user_roles
-- ==============================================================================
-- Users can read their own role. Only Admin can insert/update/delete.

CREATE POLICY "user_roles_select_own"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "user_roles_admin_all"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'Admin'
  )
);

-- ==============================================================================
-- staff_keys
-- ==============================================================================
-- Only Admin can read/write staff keys.

CREATE POLICY "staff_keys_admin_only"
ON public.staff_keys FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'Admin'
  )
);

-- ==============================================================================
-- payments
-- ==============================================================================
-- Only Admin and Manager can see and modify payments.

CREATE POLICY "payments_admin_manager_only"
ON public.payments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('Admin', 'Manager')
  )
);

-- ==============================================================================
-- clients
-- ==============================================================================
-- Any authenticated user can read clients (might be restricted further later)
-- Only Admin and Manager can modify clients.

-- Create a helper function for Manager (Bypasses recursion just like Admin)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'Manager'
  );
$$;

-- 1. READ: Admin/Manager read all. Others read their own clients.
CREATE POLICY "clients_read"
ON public.clients FOR SELECT
USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

-- 2. INSERT: Anyone can insert, but non-admins must assign it to themselves.
CREATE POLICY "clients_insert"
ON public.clients FOR INSERT
WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

-- 3. UPDATE: Admin/Manager update all. Others update their own clients.
CREATE POLICY "clients_update"
ON public.clients FOR UPDATE
USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() )
WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

CREATE POLICY "clients_admin_manager_delete"
ON public.clients FOR DELETE
USING ( public.is_admin() OR public.is_manager() );

-- ==============================================================================
-- Secure Access for other tables (Ownership based)
-- ==============================================================================

CREATE POLICY "projects_all_secure" ON public.projects FOR ALL 
USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() )
WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

CREATE POLICY "tasks_all_secure" ON public.tasks FOR ALL 
USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() )
WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

CREATE POLICY "meetings_auth_all" ON public.meetings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "interactions_auth_all" ON public.interactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "activity_log_auth_all" ON public.activity_log FOR ALL USING (auth.role() = 'authenticated');
