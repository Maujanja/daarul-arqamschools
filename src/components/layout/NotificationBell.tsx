import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, Clock, Unlock, AlertTriangle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UnlockRequest {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class: string;
  subject_id: string;
  subject_name: string;
  term: string;
  academic_year: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'used' | string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  student_id: string | null;
  student_name: string | null;
  current_marks: number | null;
}

interface NotificationItem {
  id: string;
  type: 'request' | 'approved' | 'rejected' | 'low_credit' | 'zero_credit';
  title: string;
  message: string;
  time: string;
  request?: UnlockRequest;
  read: boolean;
}

interface SystemAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  target_roles: string[];
  is_read: boolean;
  created_at: string;
}

const SEEN_KEY_PREFIX = 'notif_seen_v1_';

function loadSeen(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSeen(userId: string, seen: Record<string, string>) {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + userId, JSON.stringify(seen));
  } catch {
    /* noop */
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchTable } = useSecureQuery();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  const isAdmin = user?.role === 'admin';
  const isHeadOfSchool = !!user?.role?.startsWith('head_');
  const isTeacher = user?.role === 'teacher';
  const isAccountant = user?.role === 'accountant';
  const canSeeSystemAlerts = isAdmin || isAccountant;
  const enabled = !!user && (isAdmin || isHeadOfSchool || isTeacher || isAccountant);

  const buildItems = useCallback(
    (requests: UnlockRequest[], seen: Record<string, string>): NotificationItem[] => {
      const list: NotificationItem[] = [];

      if (isAdmin || isHeadOfSchool) {
        // Approvers see pending requests
        for (const r of requests) {
          if (r.status !== 'pending') continue;
          const stamp = r.updated_at || r.created_at;
          list.push({
            id: `req-${r.id}`,
            type: 'request',
            title: 'New marks unlock request',
            message: `${r.teacher_name} requested to edit ${r.subject_name} marks${
              r.student_name ? ` for ${r.student_name}` : ''
            } (${r.class}, ${r.term})`,
            time: stamp,
            request: r,
            read: seen[`req-${r.id}`] === stamp,
          });
        }
      }

      if (isTeacher) {
        // Teachers see decisions on their own requests
        for (const r of requests) {
          if (r.teacher_id !== user?.id) continue;
          if (r.status === 'approved' || r.status === 'rejected') {
            const stamp = r.updated_at || r.created_at;
            list.push({
              id: `${r.status}-${r.id}`,
              type: r.status === 'approved' ? 'approved' : 'rejected',
              title:
                r.status === 'approved'
                  ? 'Unlock request approved'
                  : 'Unlock request rejected',
              message:
                r.status === 'approved'
                  ? `You may now edit ${r.subject_name} marks${
                      r.student_name ? ` for ${r.student_name}` : ''
                    } (${r.class}, ${r.term}).`
                  : `Your request for ${r.subject_name}${
                      r.student_name ? ` (${r.student_name})` : ''
                    } was rejected.${r.admin_note ? ' Note: ' + r.admin_note : ''}`,
              time: stamp,
              request: r,
              read: seen[`${r.status}-${r.id}`] === stamp,
            });
          }
        }
      }

      list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return list.slice(0, 30);
    },
    [isAdmin, isHeadOfSchool, isTeacher, user?.id]
  );

  const refresh = useCallback(async () => {
    if (!enabled || !user) return;
    const tasks: Promise<unknown>[] = [];
    tasks.push(
      isAdmin || isHeadOfSchool || isTeacher
        ? fetchTable<UnlockRequest>('marks_unlock_requests')
        : Promise.resolve([] as UnlockRequest[])
    );
    tasks.push(
      canSeeSystemAlerts
        ? fetchTable<SystemAlert>('system_alerts')
        : Promise.resolve([] as SystemAlert[])
    );
    const [reqData, alertData] = (await Promise.all(tasks)) as [UnlockRequest[], SystemAlert[]];
    const seen = loadSeen(user.id);
    let next = buildItems(reqData || [], seen);

    // Append system alerts (low credit / zero credit)
    if (canSeeSystemAlerts && alertData) {
      for (const a of alertData) {
        if (!a.target_roles?.includes(user.role)) continue;
        const id = `alert-${a.id}`;
        next.push({
          id,
          type: a.alert_type === 'zero_credit' ? 'zero_credit' : 'low_credit',
          title: a.title,
          message: a.message,
          time: a.created_at,
          read: a.is_read || seen[id] === a.created_at,
        });
      }
      next.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      next = next.slice(0, 30);
    }

    for (const it of next) {
      const isNew = !knownIdsRef.current.has(it.id);
      // On initial load: only toast unread credit alerts (so admins are alerted on login).
      // After first load: toast any new unread item.
      const shouldToast =
        !it.read &&
        (initialLoadRef.current
          ? it.type === 'low_credit' || it.type === 'zero_credit'
          : isNew);
      if (!shouldToast) continue;
      if (it.type === 'request') {
        toast.info(it.title, { description: it.message, duration: 6000 });
      } else if (it.type === 'approved') {
        toast.success(it.title, { description: it.message, duration: 8000 });
      } else if (it.type === 'rejected') {
        toast.error(it.title, { description: it.message, duration: 8000 });
      } else if (it.type === 'zero_credit') {
        toast.error(it.title, { description: it.message, duration: 12000 });
      } else if (it.type === 'low_credit') {
        toast.warning(it.title, { description: it.message, duration: 10000 });
      }
    }
    knownIdsRef.current = new Set(next.map((n) => n.id));
    initialLoadRef.current = false;
    setItems(next);
  }, [enabled, user, fetchTable, buildItems, isAdmin, isHeadOfSchool, isTeacher, canSeeSystemAlerts]);

  useEffect(() => {
    if (!enabled) return;
    initialLoadRef.current = true;
    refresh();
    // Poll fallback every 30s in case realtime drops
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id]);

  useRealtimeSubscription({
    table: 'marks_unlock_requests',
    onUpdate: refresh,
    enabled,
  });
  useRealtimeSubscription({
    table: 'system_alerts',
    onUpdate: refresh,
    enabled: canSeeSystemAlerts,
  });

  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    if (!user) return;
    const seen = loadSeen(user.id);
    items.forEach((it) => {
      seen[it.id] = it.time;
    });
    saveSeen(user.id, seen);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const handleClick = (item: NotificationItem) => {
    if (!user) return;
    const seen = loadSeen(user.id);
    seen[item.id] = item.time;
    saveSeen(user.id, seen);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    setOpen(false);

    if (item.type === 'low_credit' || item.type === 'zero_credit') {
      // No internal page; just dismiss
      return;
    }
    if (isTeacher && item.type === 'approved') {
      // Direct teacher to marks entry to edit
      navigate('/marks-entry');
    } else {
      navigate('/unlock-requests');
    }
  };

  if (!enabled) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#1e3a5f] animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const Icon =
                  item.type === 'request'
                    ? Unlock
                    : item.type === 'approved'
                    ? CheckCircle
                    : item.type === 'zero_credit'
                    ? Zap
                    : item.type === 'low_credit'
                    ? AlertTriangle
                    : XCircle;
                const colorClass =
                  item.type === 'approved'
                    ? 'text-success bg-success/10'
                    : item.type === 'rejected'
                    ? 'text-destructive bg-destructive/10'
                    : item.type === 'zero_credit'
                    ? 'text-destructive bg-destructive/10'
                    : item.type === 'low_credit'
                    ? 'text-warning bg-warning/10'
                    : 'text-warning bg-warning/10';
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleClick(item)}
                      className={cn(
                        'w-full text-left flex items-start gap-3 p-3 hover:bg-muted/60 transition-colors',
                        !item.read && 'bg-primary/5'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          colorClass
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.message}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(item.time)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
