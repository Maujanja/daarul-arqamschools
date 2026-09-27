import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';

type Purchase = {
  id: string; user_name: string | null; user_role: string | null; user_id: string;
  credits: number; amount_tzs: number; status: string; created_at: string;
};

export default function PaymentApprovalsPage() {
  const [params] = useSearchParams();
  const token = params.get('k') || '';
  const [rows, setRows] = useState<Purchase[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(
    (action: string, id?: string) => supabase.functions.invoke('wa-credits', { body: { action, token, id } }),
    [token],
  );

  const load = useCallback(async () => {
    const { data } = await call('approver_list');
    if (!data?.success) { setError('Hauna ruhusa ya kuona ukurasa huu.'); return; }
    setError(''); setRows(data.purchases);
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, approve: boolean) => {
    if (approve && !confirm('Umehakiki kwenye Snippe kuwa malipo ya TZS 50,000 yamepokelewa?')) return;
    setBusy(id);
    await call(approve ? 'approver_approve' : 'approver_reject', id);
    setBusy(null);
    load();
  };

  const pending = rows.filter((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Uidhinishaji wa malipo — WhatsApp credits</h1>
          <Button variant="outline" size="icon" onClick={load} aria-label="Sasisha"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        {error ? <Card className="p-6">{error}</Card> : (
          <>
            <p className="text-sm text-muted-foreground">Yanayosubiri: {pending.length}</p>
            {rows.map((r) => (
              <Card key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.user_name || r.user_id} <span className="text-xs text-muted-foreground">({r.user_role})</span></div>
                  <div className="text-sm text-muted-foreground">
                    Credit {r.credits.toLocaleString()} • TZS {r.amount_tzs.toLocaleString()} • {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(r.id, true)} disabled={busy === r.id} className="gap-1">
                      {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Thibitisha
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, false)} disabled={busy === r.id} className="gap-1">
                      <X className="w-4 h-4" /> Kataa
                    </Button>
                  </div>
                ) : (
                  <Badge variant={r.status === 'approved' ? 'default' : 'secondary'}>
                    {r.status === 'approved' ? 'Imethibitishwa' : 'Imekataliwa'}
                  </Badge>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
