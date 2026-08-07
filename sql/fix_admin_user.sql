-- ═══════════════════════════════════════════════════════════════
-- FIX ADMIN USER SCRIPT
-- Yeh script pehli AI ki galat query ka nuksaan theek karegi
-- Aur digital@crm.com ko properly Admin set karegi
-- ═══════════════════════════════════════════════════════════════

-- ── STEP 1: Galat admin@crm.com user ka data saaf karein ────────
-- (Woh user jo pehli AI ki query se bana tha)

DELETE FROM public.user_roles WHERE email = 'admin@crm.com';
-- Note: auth.users se delete karna Supabase Dashboard > Authentication > Users se karein
-- Ya neeche ki commented query SQL Editor mein (Service Role key chahiye):
-- DELETE FROM auth.users WHERE email = 'admin@crm.com';

-- ── STEP 2: digital@crm.com ka user_roles check aur clean ───────

-- Pehle purana record hata dein (agar koi duplicate hai)
DELETE FROM public.user_roles WHERE email = 'digital@crm.com';

-- ── STEP 3: digital@crm.com ko Admin set karein ────────────────
-- Yeh query auth.users se ID uthayegi aur user_roles mein Admin banayegi

INSERT INTO public.user_roles (user_id, role, full_name, email)
SELECT 
    id, 
    'Admin', 
    COALESCE(raw_user_meta_data->>'full_name', 'Main Admin'),
    email
FROM auth.users
WHERE email = 'digital@crm.com'
ON CONFLICT (user_id) DO UPDATE 
SET 
    role = 'Admin',
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

-- ── STEP 4: Verify karein ke kaam ho gaya ───────────────────────
SELECT 
    ur.user_id,
    ur.role,
    ur.full_name,
    ur.email,
    au.email as auth_email,
    au.email_confirmed_at,
    ur.created_at
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.email = 'digital@crm.com';


-- ── STEP 5: RLS Policies Theek Karein ───────────────────────────
-- (Agar login ke baad kuch nahi dikhra toh yeh fix karein)

-- Helper Functions (Safe version)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'Admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'Manager'
  );
$$;

-- user_roles ki policies reset karein
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_own" ON public.user_roles;

-- Policies dobara banayein
-- Admin sab kuch dekh aur manage kar sake
CREATE POLICY "user_roles_admin_all"
ON public.user_roles FOR ALL
USING ( public.is_admin() );

-- Har user apna record dekh sake (login ke liye zaroori)
CREATE POLICY "user_roles_select_own"
ON public.user_roles FOR SELECT
USING ( auth.uid() = user_id );

-- ── FINAL CHECK ──────────────────────────────────────────────────
-- Yeh run karein verify karne ke liye:

SELECT 
    'SUCCESS: Admin user ready!' as status,
    email,
    role
FROM public.user_roles
WHERE email = 'digital@crm.com' AND role = 'Admin';


-- digital@crm.com ko Admin set karein
INSERT INTO public.user_roles (user_id, role, full_name, email)
SELECT id, 'Admin', 'Main Admin', email
FROM auth.users
WHERE email = 'digital@crm.com'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'Admin';
