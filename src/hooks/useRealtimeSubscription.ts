import { useEffect } from 'react';
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
  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${event}-${filter || 'all'}`;
    
    const channelConfig: Parameters<typeof supabase.channel>[1] = {};
    
    const subscribeConfig: any = {
      event,
      schema: 'public',
      table,
    };
    
    if (filter) {
      subscribeConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName, channelConfig)
      .on('postgres_changes', subscribeConfig, () => {
        onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, onUpdate, enabled]);
}
