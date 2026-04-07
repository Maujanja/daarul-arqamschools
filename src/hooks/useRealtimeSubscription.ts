import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  onUpdate: () => void;
  enabled?: boolean;
}

/**
 * Subscribe to realtime changes on a Supabase table.
 * Calls `onUpdate` whenever a matching change is detected.
 */
export function useRealtimeSubscription({
  table,
  event = '*',
  filter,
  onUpdate,
  enabled = true,
}: UseRealtimeOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt-${table}-${event}-${filter || 'all'}-${Date.now()}`;

    const subscribeConfig: any = {
      event,
      schema: 'public',
      table,
    };

    if (filter) {
      subscribeConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', subscribeConfig, () => {
        callbackRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, enabled]);
}
