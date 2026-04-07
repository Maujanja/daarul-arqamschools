import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeOptions {
  table: string;
  onUpdate: () => void;
  enabled?: boolean;
}

/**
 * Subscribe to realtime Broadcast events for a given table.
 * The data-management edge function broadcasts after each mutation.
 */
export function useRealtimeSubscription({
  table,
  onUpdate,
  enabled = true,
}: UseRealtimeOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `table-changes-${table}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'mutation' }, () => {
        callbackRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled]);
}
