CREATE TABLE public.wa_credit_balances (
  user_id text PRIMARY KEY,
  user_name text,
  user_role text,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wa_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_name text,
  user_role text,
  credits integer NOT NULL DEFAULT 10000,
  amount_tzs integer NOT NULL DEFAULT 50000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE TABLE public.wa_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  numbers integer NOT NULL,
  credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wa_approver_access (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
INSERT INTO public.wa_approver_access (id) VALUES (1);
GRANT ALL ON public.wa_credit_balances, public.wa_credit_purchases, public.wa_credit_usage, public.wa_approver_access TO service_role;
ALTER TABLE public.wa_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_approver_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wa_consume_credits(_user_id text, _numbers int)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  UPDATE wa_credit_balances SET balance = balance - _numbers, updated_at = now()
   WHERE user_id = _user_id AND balance >= _numbers RETURNING balance INTO nb;
  IF nb IS NULL THEN RETURN -1; END IF;
  INSERT INTO wa_credit_usage(user_id, numbers, credits) VALUES (_user_id, _numbers, _numbers);
  RETURN nb;
END $$;

CREATE OR REPLACE FUNCTION public.wa_approve_purchase(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p wa_credit_purchases;
BEGIN
  UPDATE wa_credit_purchases SET status='approved', decided_at=now()
   WHERE id=_id AND status='pending' RETURNING * INTO p;
  IF p.id IS NULL THEN RETURN false; END IF;
  INSERT INTO wa_credit_balances(user_id,user_name,user_role,balance)
   VALUES (p.user_id,p.user_name,p.user_role,p.credits)
   ON CONFLICT (user_id) DO UPDATE SET balance = wa_credit_balances.balance + p.credits, updated_at=now();
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.wa_consume_credits(text,int), public.wa_approve_purchase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_consume_credits(text,int), public.wa_approve_purchase(uuid) TO service_role;