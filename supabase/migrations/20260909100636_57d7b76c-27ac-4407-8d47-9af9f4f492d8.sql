CREATE TABLE public.bulk_sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  created_by_role text,
  title text,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  balance_after numeric
);

GRANT ALL ON public.bulk_sms_campaigns TO service_role;
ALTER TABLE public.bulk_sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bulk_sms_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  campaign_id uuid NOT NULL REFERENCES public.bulk_sms_campaigns(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  raw_phone text,
  status text NOT NULL DEFAULT 'pending',
  delivery_status text,
  delivery_checked_at timestamptz,
  beem_request_id text,
  error text
);

GRANT ALL ON public.bulk_sms_recipients TO service_role;
ALTER TABLE public.bulk_sms_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_bulk_sms_recipients_campaign ON public.bulk_sms_recipients(campaign_id);
