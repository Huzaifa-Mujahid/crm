-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Allied Marketing Solutions CRM — Complete Audit Trail Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. CLIENT DELETE TRIGGER
CREATE OR REPLACE FUNCTION public.log_client_delete()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
    VALUES ('clients', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_delete_trigger ON public.clients;
CREATE TRIGGER client_delete_trigger
    AFTER DELETE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.log_client_delete();


-- 2. PROJECT DELETE TRIGGER
CREATE OR REPLACE FUNCTION public.log_project_delete()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
    VALUES ('projects', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS project_delete_trigger ON public.projects;
CREATE TRIGGER project_delete_trigger
    AFTER DELETE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.log_project_delete();


-- 3. PAYMENT UPDATE & DELETE TRIGGERS
CREATE OR REPLACE FUNCTION public.log_payment_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES ('payments', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
        VALUES ('payments', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_change_trigger ON public.payments;
CREATE TRIGGER payment_change_trigger
    AFTER UPDATE OR DELETE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.log_payment_change();


-- 4. INTERACTION UPDATE & DELETE TRIGGERS
CREATE OR REPLACE FUNCTION public.log_interaction_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES ('interactions', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
        VALUES ('interactions', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS interaction_change_trigger ON public.interactions;
CREATE TRIGGER interaction_change_trigger
    AFTER UPDATE OR DELETE ON public.interactions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_interaction_change();


-- 5. TASK CRUD TRIGGERS
CREATE OR REPLACE FUNCTION public.log_task_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
        VALUES ('tasks', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES ('tasks', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
        VALUES ('tasks', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_change_trigger ON public.tasks;
CREATE TRIGGER task_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_change();


-- 6. MEETING CRUD TRIGGERS
CREATE OR REPLACE FUNCTION public.log_meeting_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, new_data, performed_by)
        VALUES ('meetings', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES ('meetings', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log (table_name, record_id, action, old_data, performed_by)
        VALUES ('meetings', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS meeting_change_trigger ON public.meetings;
CREATE TRIGGER meeting_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.log_meeting_change();
