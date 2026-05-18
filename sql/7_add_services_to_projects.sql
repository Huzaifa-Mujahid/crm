-- Allied Marketing Solutions CRM — Services Column Migration
-- Run this SQL in your Supabase Dashboard → SQL Editor

-- 1. ADD SERVICES COLUMN TO PROJECTS TABLE
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS services text;
