-- ═══════════════════════════════════════════════════════════════
-- ClientFlow CRM — Consolidated Supabase Schema
-- Includes all migrations from 1 to 23
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
    role        text NOT NULL CHECK (role IN ('Admin', 'Manager', 'Customer Success', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee')),
    full_name   text,
    email       text,
    login_key   text,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Staff Keys
CREATE TABLE IF NOT EXISTS public.staff_keys (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         text UNIQUE NOT NULL CHECK (length(key) = 6),
    role        text NOT NULL CHECK (role IN ('Manager', 'Customer Success', 'Customer Success Manager', 'Sales Agent', 'Sales Closer', 'Employee')),
    full_name   text,
    user_id     uuid REFERENCES auth.users(id),
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    created_by  uuid REFERENCES auth.users(id)
);

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     text NOT NULL,
    email         text UNIQUE,
    phone         text,
    company       text,
    address       text,
    status        text NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Active', 'Inactive', 'Churned', 'Onboarding', 'At Risk')),
    health_score  int NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    assigned_to   uuid REFERENCES auth.users(id),
    date          date,
    activity      text,
    yelp_link     text,
    business_email text,
    billing_zip   text,
    city          text,
    state         text,
    zip_code      text,
    services      text,
    agent_name    text,
    closer_name   text,
    other_information text,
    card_number_enc text,
    stripe_customer_id TEXT,
    stripe_payment_method_id TEXT,
    stripe_card_brand TEXT,
    stripe_card_last4 TEXT,
    stripe_card_exp_month INTEGER,
    stripe_card_exp_year INTEGER,
    payment_method text,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- Client Payment Methods
CREATE TABLE IF NOT EXISTS public.client_payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    stripe_payment_method_id text NOT NULL,
    brand text,
    last4 text,
    exp_month integer,
    exp_year integer,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
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
    assigned_to   uuid REFERENCES auth.users(id),
    services      text,
    sales_agent   text,
    closer        text,
    billing_type  text DEFAULT 'One-time' CHECK (billing_type IN ('One-time', 'Retainer')),
    billing_cycle text CHECK (billing_cycle IN ('Monthly', 'Quarterly', 'Yearly')),
    created_at    timestamptz DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    title       text NOT NULL,
    status      text DEFAULT 'Pending',
    due_date    date,
    assigned_to uuid REFERENCES auth.users(id),
    duration    text,
    start_time  timestamptz,
    description text,
    priority    text DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    created_by  uuid REFERENCES auth.users(id),
    completion_note text,
    completed_at timestamptz,
    completed_by uuid REFERENCES auth.users(id),
    created_at  timestamptz DEFAULT now()
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

-- Meetings
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

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    amount        decimal(12,2) NOT NULL,
    payment_date  date,
    is_paid       boolean DEFAULT false,
    due_date      date,
    payment_type  text DEFAULT 'One-time',
    is_cancelled  boolean DEFAULT false,
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
-- 2. INDEXES & CONSTRAINTS
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
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON public.clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON public.projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON public.clients(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_project_month_unique ON public.payments (project_id, EXTRACT(YEAR FROM due_date), EXTRACT(MONTH FROM due_date)) WHERE is_paid IS NOT TRUE AND is_cancelled IS NOT TRUE;

-- ═══════════════════════════════════════════════════════════════
-- 3. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'Admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'Manager'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 4. TRIGGERS & LOGGING
-- ═══════════════════════════════════════════════════════════════

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto status transition (health_score < 30 → Churned)
CREATE OR REPLACE FUNCTION public.auto_status_transition() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.health_score < 30 AND OLD.health_score >= 30 THEN
        NEW.status := 'Churned';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_status_transition_trigger ON public.clients;
CREATE TRIGGER auto_status_transition_trigger BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.auto_status_transition();

-- Activity Log Triggers
CREATE OR REPLACE FUNCTION public.log_client_insert() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('clients', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid()); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_insert_trigger ON public.clients;
CREATE TRIGGER client_insert_trigger AFTER INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.log_client_insert();

CREATE OR REPLACE FUNCTION public.log_client_update() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('clients', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_update_trigger ON public.clients;
CREATE TRIGGER client_update_trigger AFTER UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.log_client_update();

CREATE OR REPLACE FUNCTION public.log_client_delete() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('clients', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_delete_trigger ON public.clients;
CREATE TRIGGER client_delete_trigger AFTER DELETE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.log_client_delete();

CREATE OR REPLACE FUNCTION public.log_project_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('projects', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('projects', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS project_change_trigger ON public.projects;
CREATE TRIGGER project_change_trigger AFTER INSERT OR UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.log_project_change();

CREATE OR REPLACE FUNCTION public.log_project_delete() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('projects', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS project_delete_trigger ON public.projects;
CREATE TRIGGER project_delete_trigger AFTER DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.log_project_delete();

CREATE OR REPLACE FUNCTION public.log_payment_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('payments', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('payments', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_change_trigger ON public.payments;
CREATE TRIGGER payment_change_trigger AFTER UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.log_payment_change();

CREATE OR REPLACE FUNCTION public.log_interaction_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('interactions', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('interactions', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS interaction_change_trigger ON public.interactions;
CREATE TRIGGER interaction_change_trigger AFTER UPDATE OR DELETE ON public.interactions
    FOR EACH ROW EXECUTE FUNCTION public.log_interaction_change();

CREATE OR REPLACE FUNCTION public.log_task_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('tasks', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('tasks', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('tasks', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_change_trigger ON public.tasks;
CREATE TRIGGER task_change_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.log_task_change();

CREATE OR REPLACE FUNCTION public.log_meeting_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('meetings', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by) VALUES ('meetings', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()); RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by) VALUES ('meetings', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()); RETURN OLD; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS meeting_change_trigger ON public.meetings;
CREATE TRIGGER meeting_change_trigger AFTER INSERT OR UPDATE OR DELETE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION public.log_meeting_change();

-- Complex insert triggers
CREATE OR REPLACE FUNCTION public.on_interaction_insert()
RETURNS TRIGGER AS $$
DECLARE
    overdue_payments_count int; last_interaction_date timestamptz; days_since_last int; new_score int;
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('interactions', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    new_score := 100;
    SELECT COUNT(*) INTO overdue_payments_count FROM public.payments p JOIN public.projects pr ON pr.id = p.project_id WHERE pr.client_id = NEW.client_id AND p.due_date < CURRENT_DATE AND p.is_paid = false AND p.is_cancelled IS NOT TRUE;
    new_score := new_score - (overdue_payments_count * 15);
    SELECT MAX(interaction_date) INTO last_interaction_date FROM public.interactions WHERE client_id = NEW.client_id AND id != NEW.id;
    IF last_interaction_date IS NOT NULL THEN
        days_since_last := EXTRACT(DAY FROM (now() - last_interaction_date));
        IF days_since_last > 30 THEN new_score := new_score - 20; ELSIF days_since_last > 14 THEN new_score := new_score - 10; END IF;
    END IF;
    new_score := GREATEST(0, LEAST(100, new_score));
    UPDATE public.clients SET health_score = new_score WHERE id = NEW.client_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS interaction_insert_trigger ON public.interactions;
CREATE TRIGGER interaction_insert_trigger AFTER INSERT ON public.interactions
    FOR EACH ROW EXECUTE FUNCTION public.on_interaction_insert();

CREATE OR REPLACE FUNCTION public.on_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
    client_uuid uuid; overdue_payments_count int; last_interaction_date timestamptz; days_since_last int; new_score int;
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by) VALUES ('payments', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    SELECT client_id INTO client_uuid FROM public.projects WHERE id = NEW.project_id;
    IF client_uuid IS NOT NULL THEN
        new_score := 100;
        SELECT COUNT(*) INTO overdue_payments_count FROM public.payments p JOIN public.projects pr ON pr.id = p.project_id WHERE pr.client_id = client_uuid AND p.due_date < CURRENT_DATE AND p.is_paid = false AND p.is_cancelled IS NOT TRUE;
        new_score := new_score - (overdue_payments_count * 15);
        SELECT MAX(interaction_date) INTO last_interaction_date FROM public.interactions WHERE client_id = client_uuid;
        IF last_interaction_date IS NOT NULL THEN
            days_since_last := EXTRACT(DAY FROM (now() - last_interaction_date));
            IF days_since_last > 30 THEN new_score := new_score - 20; ELSIF days_since_last > 14 THEN new_score := new_score - 10; END IF;
        ELSE new_score := new_score - 20; END IF;
        new_score := GREATEST(0, LEAST(100, new_score));
        UPDATE public.clients SET health_score = new_score WHERE id = client_uuid;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_insert_trigger ON public.payments;
CREATE TRIGGER payment_insert_trigger AFTER INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.on_payment_insert();

-- ═══════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL USING (public.is_admin());

-- staff_keys
CREATE POLICY "staff_keys_admin_only" ON public.staff_keys FOR ALL USING (public.is_admin());

-- payments
CREATE POLICY "payments_admin_manager_only" ON public.payments FOR ALL USING (public.is_admin() OR public.is_manager());

-- clients
CREATE POLICY "clients_read" ON public.clients FOR SELECT USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() ) WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );
CREATE POLICY "clients_admin_manager_delete" ON public.clients FOR DELETE USING ( public.is_admin() OR public.is_manager() );

-- projects
CREATE POLICY "projects_all_secure" ON public.projects FOR ALL USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() ) WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

-- tasks
CREATE POLICY "tasks_all_secure" ON public.tasks FOR ALL USING ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() ) WITH CHECK ( public.is_admin() OR public.is_manager() OR assigned_to = auth.uid() );

-- meetings
CREATE POLICY "meetings_admin_manager_all" ON public.meetings FOR ALL USING (public.is_admin() OR public.is_manager());
CREATE POLICY "meetings_own_all" ON public.meetings FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- interactions
CREATE POLICY "interactions_admin_manager_all" ON public.interactions FOR ALL USING (public.is_admin() OR public.is_manager());
CREATE POLICY "interactions_own_all" ON public.interactions FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- activity_log
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT USING (public.is_admin() OR public.is_manager());
CREATE POLICY "activity_log_admin_all" ON public.activity_log FOR ALL USING (public.is_admin());

-- client_payment_methods
CREATE POLICY "cpm_select" ON public.client_payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpm_insert" ON public.client_payment_methods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpm_update" ON public.client_payment_methods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpm_delete" ON public.client_payment_methods FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 6. ENABLE REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
