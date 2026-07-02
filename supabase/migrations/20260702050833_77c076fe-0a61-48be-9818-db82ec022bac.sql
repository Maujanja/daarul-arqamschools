CREATE TABLE public.sso_used_jtis (
  jti text PRIMARY KEY,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.sso_used_jtis TO service_role;
ALTER TABLE public.sso_used_jtis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to sso_used_jtis" ON public.sso_used_jtis FOR ALL USING (false) WITH CHECK (false);