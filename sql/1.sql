-- ═══════════════════════════════════════════════════════════════
-- ClientFlow CRM — Complete Supabase Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLES
-- ═══════════════════════════════════════════════════════════════

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('Admin', 'Employee')),
    created_at  timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     text NOT NULL,
    email         text UNIQUE,
    phone         text,
    company       text,
    address       text,
    status        text NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Active', 'Inactive', 'Churned')),
    health_score  int NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title         text NOT NULL,
    description   text,
    budget        decimal(12,2) DEFAULT 0,
    status        text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    start_date    date,
    end_date      date,
    created_at    timestamptz DEFAULT now()
);

-- Interactions
CREATE TABLE IF NOT EXISTS public.interactions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type              text NOT NULL CHECK (type IN ('Call', 'Email', 'Meeting', 'Note')),
    notes             text,
    interaction_date  timestamptz DEFAULT now(),
    follow_up_date    date,
    created_by        uuid REFERENCES auth.users(id),
    created_at        timestamptz DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    amount        decimal(12,2) NOT NULL,
    payment_date  date,
    is_paid       boolean DEFAULT false,
    due_date      date,
    created_at    timestamptz DEFAULT now()
);

-- Activity Log (Audit Trail)
CREATE TABLE IF NOT EXISTS public.activity_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name    text NOT NULL,
    record_id     uuid,
    action        text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data      jsonb,
    new_data      jsonb,
    performed_by  uuid,
    performed_at  timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_client_id ON public.interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_record_id ON public.activity_log(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_table_name ON public.activity_log(table_name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_health_score ON public.clients(health_score);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_is_paid ON public.payments(is_paid);
CREATE INDEX IF NOT EXISTS idx_interactions_follow_up ON public.interactions(follow_up_date);

-- ═══════════════════════════════════════════════════════════════
-- 3. FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Function: Log client updates to activity_log
CREATE OR REPLACE FUNCTION public.log_client_update()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
    VALUES (
        'clients',
        NEW.id,
        'UPDATE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER client_update_trigger
    AFTER UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.log_client_update();

-- Function: Log client inserts
CREATE OR REPLACE FUNCTION public.log_client_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
    VALUES (
        'clients',
        NEW.id,
        'INSERT',
        to_jsonb(NEW),
        auth.uid()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER client_insert_trigger
    AFTER INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.log_client_insert();

-- Function: Log interaction inserts and recalculate health score
CREATE OR REPLACE FUNCTION public.on_interaction_insert()
RETURNS TRIGGER AS $$
DECLARE
    overdue_payments_count int;
    last_interaction_date timestamptz;
    days_since_last int;
    new_score int;
BEGIN
    -- Log to activity log
    INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
    VALUES ('interactions', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());

    -- Recalculate health score for the client
    new_score := 100;

    -- Count overdue payments for this client
    SELECT COUNT(*) INTO overdue_payments_count
    FROM public.payments p
    JOIN public.projects pr ON pr.id = p.project_id
    WHERE pr.client_id = NEW.client_id
      AND p.due_date < CURRENT_DATE
      AND p.is_paid = false;

    new_score := new_score - (overdue_payments_count * 15);

    -- Check last interaction date (excluding the one just inserted)
    SELECT MAX(interaction_date) INTO last_interaction_date
    FROM public.interactions
    WHERE client_id = NEW.client_id
      AND id != NEW.id;

    IF last_interaction_date IS NOT NULL THEN
        days_since_last := EXTRACT(DAY FROM (now() - last_interaction_date));
        IF days_since_last > 30 THEN
            new_score := new_score - 20;
        ELSIF days_since_last > 14 THEN
            new_score := new_score - 10;
        END IF;
    END IF;

    -- Clamp score
    new_score := GREATEST(0, LEAST(100, new_score));

    -- Update client health score
    UPDATE public.clients SET health_score = new_score WHERE id = NEW.client_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER interaction_insert_trigger
    AFTER INSERT ON public.interactions
    FOR EACH ROW
    EXECUTE FUNCTION public.on_interaction_insert();

-- Function: Log payment inserts
CREATE OR REPLACE FUNCTION public.on_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
    client_uuid uuid;
    overdue_payments_count int;
    last_interaction_date timestamptz;
    days_since_last int;
    new_score int;
BEGIN
    -- Log to activity log
    INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
    VALUES ('payments', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());

    -- Get client id from project
    SELECT client_id INTO client_uuid FROM public.projects WHERE id = NEW.project_id;

    IF client_uuid IS NOT NULL THEN
        -- Recalculate health score
        new_score := 100;

        SELECT COUNT(*) INTO overdue_payments_count
        FROM public.payments p
        JOIN public.projects pr ON pr.id = p.project_id
        WHERE pr.client_id = client_uuid
          AND p.due_date < CURRENT_DATE
          AND p.is_paid = false;

        new_score := new_score - (overdue_payments_count * 15);

        SELECT MAX(interaction_date) INTO last_interaction_date
        FROM public.interactions
        WHERE client_id = client_uuid;

        IF last_interaction_date IS NOT NULL THEN
            days_since_last := EXTRACT(DAY FROM (now() - last_interaction_date));
            IF days_since_last > 30 THEN
                new_score := new_score - 20;
            ELSIF days_since_last > 14 THEN
                new_score := new_score - 10;
            END IF;
        ELSE
            new_score := new_score - 20;
        END IF;

        new_score := GREATEST(0, LEAST(100, new_score));
        UPDATE public.clients SET health_score = new_score WHERE id = client_uuid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER payment_insert_trigger
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.on_payment_insert();

-- Function: Auto status transition (health_score < 30 → Churned)
CREATE OR REPLACE FUNCTION public.auto_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.health_score < 30 AND OLD.health_score >= 30 THEN
        NEW.status := 'Churned';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auto_status_transition_trigger
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_status_transition();

-- Function: Log project changes
CREATE OR REPLACE FUNCTION public.log_project_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
        VALUES ('projects', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES ('projects', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER project_change_trigger
    AFTER INSERT OR UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.log_project_change();

-- ═══════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'Admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- user_roles policies
CREATE POLICY "Users can view their own role"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    USING (public.is_admin());

-- clients policies
CREATE POLICY "Authenticated users can view clients"
    ON public.clients FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert clients"
    ON public.clients FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update clients"
    ON public.clients FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete clients"
    ON public.clients FOR DELETE
    USING (public.is_admin());

-- projects policies
CREATE POLICY "Authenticated users can view projects"
    ON public.projects FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete projects"
    ON public.projects FOR DELETE
    USING (public.is_admin());

-- interactions policies
CREATE POLICY "Authenticated users can view interactions"
    ON public.interactions FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own interactions"
    ON public.interactions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can update their own interactions"
    ON public.interactions FOR UPDATE
    USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can delete interactions"
    ON public.interactions FOR DELETE
    USING (public.is_admin());

-- payments policies
CREATE POLICY "Authenticated users can view payments"
    ON public.payments FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payments"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payments"
    ON public.payments FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete payments"
    ON public.payments FOR DELETE
    USING (public.is_admin());

-- activity_log policies
CREATE POLICY "Authenticated users can view activity log"
    ON public.activity_log FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert activity log"
    ON public.activity_log FOR INSERT
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. ENABLE REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ═══════════════════════════════════════════════════════════════
-- 6. DEFAULT ADMIN ROLE SETUP
-- ═══════════════════════════════════════════════════════════════
-- After creating your first user in Supabase Auth, run:
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('<your-user-uuid>', 'Admin');


-- Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title             text NOT NULL,
    description       text,
    scheduled_at      timestamptz NOT NULL,
    duration_minutes  int DEFAULT 30,
    location          text,
    is_completed      boolean DEFAULT false,
    created_by        uuid REFERENCES auth.users(id),
    created_at        timestamptz DEFAULT now()
);

-- Enable RLS & Realtime
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage meetings" ON public.meetings FOR ALL USING (auth.uid() IS NOT NULL);
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;




DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete interactions" ON public.interactions;

CREATE POLICY "Allow delete for authenticated users" ON public.clients
FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON public.projects
FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON public.payments
FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON public.interactions
FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON public.meetings
FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    title       text NOT NULL,
    status      text DEFAULT 'Pending',
    due_date    date,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.tasks FOR ALL TO authenticated USING (true);



