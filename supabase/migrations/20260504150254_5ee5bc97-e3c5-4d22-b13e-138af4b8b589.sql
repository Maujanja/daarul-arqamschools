
-- Add parent phone to family_groups
ALTER TABLE public.family_groups ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- Add parent phone to students (for special-case parents)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- SMS log table to prevent duplicate sends per installment
CREATE TABLE IF NOT EXISTS public.sms_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,            -- 'family_installment' | 'special_case_installment' | 'admin_alert' | 'low_credit'
  recipient_phone TEXT NOT NULL,
  reference_key TEXT NOT NULL,                -- e.g. family_group_id:installment_number:academic_year
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  beem_request_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_log_unique_send
  ON public.sms_notifications_log(notification_type, recipient_phone, reference_key);

ALTER TABLE public.sms_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct SELECT on sms_notifications_log" ON public.sms_notifications_log FOR SELECT USING (false);
CREATE POLICY "No direct INSERT on sms_notifications_log" ON public.sms_notifications_log FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct UPDATE on sms_notifications_log" ON public.sms_notifications_log FOR UPDATE USING (false);
CREATE POLICY "No direct DELETE on sms_notifications_log" ON public.sms_notifications_log FOR DELETE USING (false);

-- In-app alerts (for low-credit notifications to admin & accountant)
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,         -- 'low_credit' | 'zero_credit'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',  -- info | warning | critical
  target_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','accountant'],
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct SELECT on system_alerts" ON public.system_alerts FOR SELECT USING (false);
CREATE POLICY "No direct INSERT on system_alerts" ON public.system_alerts FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct UPDATE on system_alerts" ON public.system_alerts FOR UPDATE USING (false);
CREATE POLICY "No direct DELETE on system_alerts" ON public.system_alerts FOR DELETE USING (false);

-- Enable realtime for system_alerts so the bell updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts;
