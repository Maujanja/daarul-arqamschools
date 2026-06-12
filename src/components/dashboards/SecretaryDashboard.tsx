import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';

const EXTERNAL_ENROLLMENT_URL =
  'https://daarul-arqam-schools-enrollment-tracker.lovable.app/';

export function SecretaryDashboard(_props: { isAdminMode?: boolean } = {}) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrollment-pull');
      if (error) throw error;
      if (data?.ok) {
        toast({
          title: 'Sync complete',
          description: `Created ${data.created || 0}, updated ${data.updated || 0} student(s).`,
        });
      } else {
        toast({
          title: 'Sync finished with issues',
          description: data?.error || `${data?.failed || 0} record(s) failed.`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: 'Sync failed',
        description: e?.message || 'Could not contact external enrollment system.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(var(--app-viewport-height)-9rem)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Enrollment Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            Register students directly in the external enrollment system below.
            New records sync automatically into this system.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Now
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(EXTERNAL_ENROLLMENT_URL, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in new tab
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reload"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-border bg-card shadow-lg min-h-[500px]">
        <iframe
          key={iframeKey}
          src={EXTERNAL_ENROLLMENT_URL}
          title="Enrollment Tracker"
          className="w-full h-full block"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}