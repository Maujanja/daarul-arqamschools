import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const LOW_THRESHOLD = 10;

export function BeemBalanceCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('beem-balance');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch balance');
      setBalance(Number(data.balance));
      setCheckedAt(new Date().toLocaleTimeString());
      if (!silent) toast.success(`Salio la SMS: ${data.balance} credits`);
    } catch (e: any) {
      if (!silent) toast.error(e.message || 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const id = setInterval(() => refresh(true), 5 * 60 * 1000); // every 5 min
    return () => clearInterval(id);
  }, [refresh]);

  const isLow = balance !== null && balance < LOW_THRESHOLD;
  const isZero = balance !== null && balance <= 0;
  const stateClass = isZero
    ? 'border-destructive/40 bg-destructive/5'
    : isLow
    ? 'border-warning/40 bg-warning/5'
    : 'border-border';

  return (
    <Card className={`p-4 ${stateClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isZero
                ? 'bg-destructive/15 text-destructive'
                : isLow
                ? 'bg-warning/15 text-warning'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {isZero || isLow ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <MessageSquare className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Beem SMS Balance
            </p>
            <p className="text-2xl font-bold mt-0.5">
              {balance === null ? '—' : `${balance}`}{' '}
              <span className="text-sm font-normal text-muted-foreground">credits</span>
            </p>
            {checkedAt && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Last checked: {checkedAt}
              </p>
            )}
            {isZero && (
              <p className="text-xs text-destructive mt-1 font-medium">
                Salio limeisha. SMS hazitatumwa hadi uweke credits.
              </p>
            )}
            {isLow && !isZero && (
              <p className="text-xs text-warning mt-1 font-medium">
                Salio linakaribia kuisha. Weka credits hivi karibuni.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => refresh(false)} disabled={loading}>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant={isLow || isZero ? 'default' : 'outline'}
            asChild
          >
            <a
              href="https://login.beem.africa/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              Top Up <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}