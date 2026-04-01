DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'school_section'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.school_section AS ENUM ('nursery', 'primary', 'secondary');
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_nursery';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_primary';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_secondary';

CREATE TABLE IF NOT EXISTS public.accountant_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accountant_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accountant_credentials'
      AND policyname = 'No direct SELECT on accountant_credentials'
  ) THEN
    CREATE POLICY "No direct SELECT on accountant_credentials"
    ON public.accountant_credentials
    FOR SELECT
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accountant_credentials'
      AND policyname = 'No direct INSERT on accountant_credentials'
  ) THEN
    CREATE POLICY "No direct INSERT on accountant_credentials"
    ON public.accountant_credentials
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accountant_credentials'
      AND policyname = 'No direct UPDATE on accountant_credentials'
  ) THEN
    CREATE POLICY "No direct UPDATE on accountant_credentials"
    ON public.accountant_credentials
    FOR UPDATE
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accountant_credentials'
      AND policyname = 'No direct DELETE on accountant_credentials'
  ) THEN
    CREATE POLICY "No direct DELETE on accountant_credentials"
    ON public.accountant_credentials
    FOR DELETE
    USING (false);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.accountant_credentials_public AS
SELECT id, username, full_name, created_at
FROM public.accountant_credentials;

CREATE TABLE IF NOT EXISTS public.head_of_school_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department public.school_section NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_head_of_school_credentials_department
  ON public.head_of_school_credentials (department);

ALTER TABLE public.head_of_school_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'head_of_school_credentials'
      AND policyname = 'No direct SELECT on head_of_school_credentials'
  ) THEN
    CREATE POLICY "No direct SELECT on head_of_school_credentials"
    ON public.head_of_school_credentials
    FOR SELECT
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'head_of_school_credentials'
      AND policyname = 'No direct INSERT on head_of_school_credentials'
  ) THEN
    CREATE POLICY "No direct INSERT on head_of_school_credentials"
    ON public.head_of_school_credentials
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'head_of_school_credentials'
      AND policyname = 'No direct UPDATE on head_of_school_credentials'
  ) THEN
    CREATE POLICY "No direct UPDATE on head_of_school_credentials"
    ON public.head_of_school_credentials
    FOR UPDATE
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'head_of_school_credentials'
      AND policyname = 'No direct DELETE on head_of_school_credentials'
  ) THEN
    CREATE POLICY "No direct DELETE on head_of_school_credentials"
    ON public.head_of_school_credentials
    FOR DELETE
    USING (false);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.head_of_school_credentials_public AS
SELECT id, username, full_name, department, created_at
FROM public.head_of_school_credentials;