CREATE TABLE public.sms_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  transaction_id text NOT NULL UNIQUE,
  secure_token text,
  amount integer NOT NULL,
  msisdn text,
  status text NOT NULL DEFAULT 'pending',
  created_by text,
  created_by_role text,
  paid_at timestamptz,
  callback_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sms_topups TO authenticated;
GRANT ALL ON public.sms_topups TO service_role;
ALTER TABLE public.sms_topups ENABLE ROW LEVEL SECURITY;