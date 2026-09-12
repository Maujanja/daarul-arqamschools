CREATE TABLE public.voice_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  created_by_role text,
  title text,
  audio_path text,
  audio_mime text,
  source text NOT NULL DEFAULT 'upload',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  seconds_used integer NOT NULL DEFAULT 0,
  balance_after integer
);

GRANT ALL ON public.voice_campaigns TO service_role;
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.voice_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  campaign_id uuid NOT NULL REFERENCES public.voice_campaigns(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  raw_phone text,
  status text NOT NULL DEFAULT 'pending',
  provider_call_id text,
  duration_seconds integer,
  delivery_status text,
  delivery_checked_at timestamptz,
  error text
);

GRANT ALL ON public.voice_recipients TO service_role;
ALTER TABLE public.voice_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_voice_recipients_campaign ON public.voice_recipients(campaign_id);

CREATE TABLE public.voice_credit_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  seconds_delta integer NOT NULL,
  reason text NOT NULL,
  reference text,
  created_by text,
  campaign_id uuid REFERENCES public.voice_campaigns(id) ON DELETE SET NULL
);

GRANT ALL ON public.voice_credit_ledger TO service_role;
ALTER TABLE public.voice_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_voice_campaigns_updated_at
BEFORE UPDATE ON public.voice_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();