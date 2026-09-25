import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Smartphone,
} from 'lucide-react';

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
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ reference: string; amount: number } | null>(null);
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

  // Poll payment status until success/failed.
  useEffect(() => {
    if (!pending || paid) return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await call({ action: 'status', reference: pending.reference });
        const st = d?.topup?.status;
        if (st === 'success' || st === 'failed') {
          setPaid(st);
          if (pollRef.current) clearInterval(pollRef.current);
          if (st === 'success') {
            toast.success('Malipo yamepokelewa! Salio linaongezwa.');
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
  }, [pending, paid, call, loadHistory, onBalanceRefresh]);

  const createReference = async () => {
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < 100) {
      toast.error('Weka kiasi cha angalau TZS 100');
      return;
    }
    setCreating(true);
    setPaid(null);
    try {
      const d = await call({ action: 'create', amount: amt });
      setPending({ reference: d.reference, amount: d.amount });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copyRef = async () => {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.reference);
      toast.success('Namba ya kumbukumbu imekopwa');
    } catch {
      toast.error('Imeshindikana kukopi');
    }
  };

  const reset = () => {
    setPending(null);
    setPaid(null);
    setAmount('');
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
            Pata namba ya kumbukumbu hapa, kisha lipia kwa M-Pesa, Mixx by Yas au mtandao mwingine
            kwa kutumia namba hiyo. Malipo yanapopokelewa na Beem, salio linaongezwa moja kwa moja.
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

      {!pending && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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
          <Button onClick={createReference} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Inaandaa...
              </>
            ) : (
              'Pata namba ya kumbukumbu'
            )}
          </Button>
        </div>
      )}

      {pending && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">TZS {pending.amount.toLocaleString()}</Badge>
            {paid === 'success' && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Malipo yamepokelewa
              </Badge>
            )}
            {paid === 'failed' && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" /> Malipo yameshindikana
              </Badge>
            )}
            {!paid && (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" /> Inasubiri malipo...
              </Badge>
            )}
          </div>

          {!paid && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> Namba yako ya kumbukumbu
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold tracking-widest">{pending.reference}</span>
                <Button size="sm" variant="outline" onClick={copyRef} className="gap-1">
                  <Copy className="w-3.5 h-3.5" /> Kopi
                </Button>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Fungua M-Pesa, Mixx by Yas au mtandao wako wa simu.</li>
                <li>Chagua Lipa kwa Simu / Lipa Namba ya Beem (Bpay).</li>
                <li>
                  Weka kumbukumbu namba <strong className="text-foreground">{pending.reference}</strong> na
                  kiasi <strong className="text-foreground">TZS {pending.amount.toLocaleString()}</strong>.
                </li>
                <li>Kamilisha malipo — ukurasa huu utajisasisha mwenyewe malipo yakipokelewa.</li>
              </ol>
            </div>
          )}

          <Button size="sm" variant="ghost" onClick={reset}>
            Anza malipo mapya
          </Button>
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
