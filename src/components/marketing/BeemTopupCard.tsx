import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Wallet, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';

const BPAY_JS = 'https://checkout.beem.africa/dist/0.1_alpha/bpay.min.js';
const BPAY_CSS = 'https://checkout.beem.africa/dist/0.1_alpha/bpay.min.css';
const LOW_BALANCE = 10;

interface Topup {
  id: string;
  reference: string;
  amount: number;
  msisdn: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  paid_at: string | null;
}

declare global {
  interface Window {
    InitializeBeem?: () => void;
  }
}

let bpayLoaded = false;
function loadBpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (bpayLoaded && window.InitializeBeem) return resolve();
    if (!document.querySelector(`link[href="${BPAY_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = BPAY_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${BPAY_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      bpayLoaded = true;
      return resolve();
    }
    const s = document.createElement('script');
    s.src = BPAY_JS;
    s.onload = () => {
      bpayLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error('Imeshindikana kupakia Beem checkout'));
    document.body.appendChild(s);
  });
}

export function BeemTopupCard({
  balance,
  onBalanceRefresh,
}: {
  balance: number | null;
  onBalanceRefresh: () => void;
}) {
  const { user } = useAuth();
  const role = user?.role || '';

  const [amount, setAmount] = useState('');
  const [mobile, setMobile] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkout, setCheckout] = useState<{
    reference: string;
    transactionId: string;
    secureToken: string;
    amount: number;
    mobile: string | null;
  } | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [paid, setPaid] = useState<'success' | 'failed' | null>(null);
  const [history, setHistory] = useState<Topup[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const call = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('beem-topup', {
        body: { ...payload, userRole: role, userName: user?.name || null },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Request failed');
      return data;
    },
    [role, user]
  );

  const loadHistory = useCallback(async () => {
    try {
      const d = await call({ action: 'history' });
      setHistory(d.topups || []);
    } catch {
      /* silent */
    }
  }, [call]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Once a checkout transaction exists, mount the Beem button + iframe container.
  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    loadBpay()
      .then(() => {
        if (cancelled) return;
        window.InitializeBeem?.();
        setCheckoutReady(true);
      })
      .catch((e) => toast.error(e.message));
    return () => {
      cancelled = true;
    };
  }, [checkout]);

  // Poll payment status until success/failed.
  useEffect(() => {
    if (!checkout || paid) return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await call({ action: 'status', transactionId: checkout.transactionId });
        const st = d?.topup?.status;
        if (st === 'success' || st === 'failed') {
          setPaid(st);
          if (pollRef.current) clearInterval(pollRef.current);
          if (st === 'success') {
            toast.success('Malipo yamekamilika! Salio linaongezwa.');
            onBalanceRefresh();
          } else {
            toast.error('Malipo yameshindikana au yameghairiwa.');
          }
          loadHistory();
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkout, paid, call, loadHistory, onBalanceRefresh]);

  const startCheckout = async () => {
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < 100) {
      toast.error('Weka kiasi cha angalau TZS 100');
      return;
    }
    setCreating(true);
    setPaid(null);
    setCheckoutReady(false);
    try {
      const d = await call({ action: 'create', amount: amt, mobile: mobile.trim() || null });
      setCheckout({
        reference: d.reference,
        transactionId: d.transactionId,
        secureToken: d.secureToken,
        amount: d.amount,
        mobile: d.mobile,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setCheckout(null);
    setPaid(null);
    setCheckoutReady(false);
    setAmount('');
    setMobile('');
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            balance !== null && balance <= 0
              ? 'bg-destructive/15 text-destructive'
              : balance !== null && balance < LOW_BALANCE
              ? 'bg-warning/15 text-warning'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {balance !== null && balance < LOW_BALANCE ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Wallet className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Nunua salio la Bulk SMS</h2>
          <p className="text-sm text-muted-foreground">
            Lipia moja kwa moja hapa ndani ya mfumo kwa mobile money — bila kutoka nje. Baada ya
            malipo kukamilika, credits zinaingia kwenye akaunti yako ya Beem.
          </p>
          {balance !== null && balance <= 0 && (
            <p className="text-xs text-destructive mt-1 font-medium">
              Salio limeisha. SMS hazitatumwa hadi uweke credits.
            </p>
          )}
          {balance !== null && balance > 0 && balance < LOW_BALANCE && (
            <p className="text-xs text-warning mt-1 font-medium">
              Salio linakaribia kuisha. Weka credits hivi karibuni.
            </p>
          )}
        </div>
      </div>

      {!checkout && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label>Kiasi (TZS)</Label>
            <Input
              type="number"
              min={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Mfano: 10000"
            />
          </div>
          <div className="space-y-1">
            <Label>Namba ya simu inayolipa (si lazima)</Label>
            <Input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="0754 123 456"
            />
          </div>
          <Button onClick={startCheckout} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Inaandaa...
              </>
            ) : (
              'Lipa sasa'
            )}
          </Button>
        </div>
      )}

      {checkout && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Ref: {checkout.reference}</Badge>
            <Badge variant="secondary">TZS {checkout.amount.toLocaleString()}</Badge>
            {paid === 'success' && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Malipo yamekamilika
              </Badge>
            )}
            {paid === 'failed' && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" /> Malipo yameshindikana
              </Badge>
            )}
            {!paid && (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" /> Subiri malipo...
              </Badge>
            )}
          </div>

          {!paid && (
            <>
              {/* Beem checkout button + iframe container (rendered by bpay library) */}
              <div
                id="beem-button"
                data-price={String(checkout.amount)}
                data-token={checkout.secureToken}
                data-reference={checkout.reference}
                data-transaction={checkout.transactionId}
                {...(checkout.mobile ? { 'data-mobile': checkout.mobile } : {})}
              />
              <div id="beem-page" className="beem-page" />
              {!checkoutReady && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Inapakia kitufe cha malipo cha Beem...
                </p>
              )}
            </>
          )}

          {(paid || checkoutReady) && (
            <Button size="sm" variant="ghost" onClick={reset}>
              Anza malipo mapya
            </Button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Historia ya malipo
          </p>
          <div className="space-y-1">
            {history.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm border border-border rounded-md px-3 py-1.5"
              >
                <span className="text-muted-foreground">
                  {new Date(t.created_at).toLocaleString('en-GB')} • {t.reference}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">TZS {t.amount.toLocaleString()}</span>
                  {t.status === 'success' ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Imelipwa</Badge>
                  ) : t.status === 'failed' ? (
                    <Badge variant="destructive">Imefeli</Badge>
                  ) : (
                    <Badge variant="outline">Inasubiri</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
