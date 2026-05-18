DO $$
DECLARE
    conname_val text;
BEGIN
    FOR conname_val IN
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'clients' 
          AND con.contype = 'c' 
          AND con.conname LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS ' || quote_ident(conname_val);
    END LOOP;
END $$;

ALTER TABLE public.clients 
ADD CONSTRAINT clients_status_check 
CHECK (status IN ('Lead', 'Active', 'Inactive', 'Churned', 'Onboarding', 'At Risk'));

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'One-time';

DO $$
DECLARE
    conname_val text;
BEGIN
    FOR conname_val IN
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'staff_keys' 
          AND con.contype = 'c' 
          AND con.conname LIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.staff_keys DROP CONSTRAINT IF EXISTS ' || quote_ident(conname_val);
    END LOOP;
END $$;

ALTER TABLE public.staff_keys 
ADD CONSTRAINT staff_keys_role_check 
CHECK (role IN ('Manager', 'Customer Success', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'));

DO $$
DECLARE
    conname_val text;
BEGIN
    FOR conname_val IN
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'user_roles' 
          AND con.contype = 'c' 
          AND con.conname LIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS ' || quote_ident(conname_val);
    END LOOP;
END $$;

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('Admin', 'Manager', 'Customer Success', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee'));
