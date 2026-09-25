import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, AlertTriangle, ExternalLink } from 'lucide-react';

const LOW_BALANCE = 10;
const BEEM_TOPUP_URL = 'https://app.beem.africa';

export function BeemTopupCard({
  balance,
  onBalanceRefresh,
}: {
  balance: number | null;
  onBalanceRefresh: () => void;
}) {
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
          <h2 className="font-semibold">Salio la Bulk SMS</h2>
          <p className="text-sm text-muted-foreground">
            Salio la sasa:{' '}
            <strong className="text-foreground">
              {balance === null ? '—' : `${balance.toLocaleString()} credits`}
            </strong>
            . Salio linanunuliwa kwenye akaunti yako ya Beem, sehemu ya Top Up — hapo Beem
            inakupa kumbukumbu namba ya kulipia kwa M-Pesa, Mixx by Yas au mtandao mwingine.
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

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={BEEM_TOPUP_URL} target="_blank" rel="noopener noreferrer" className="gap-1">
            <ExternalLink className="w-4 h-4" /> Fungua Top Up ya Beem
          </a>
        </Button>
        <Button variant="outline" onClick={onBalanceRefresh}>
          Sasisha salio
        </Button>
      </div>
    </Card>
  );
}
