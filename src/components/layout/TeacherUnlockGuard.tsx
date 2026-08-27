import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UnlockRequest {
  id: string;
  teacher_id: string;
  status: string;
  subject_name: string;
  class: string;
  term: string;
  student_id: string | null;
  student_name: string | null;
  updated_at: string;
  admin_note?: string | null;
}

const NOTIFIED_KEY = 'teacher_unlock_notified_v1';
const REJECTED_NOTIFIED_KEY = 'teacher_unlock_rejected_notified_v1';

function loadNotified(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY + '_' + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveNotified(userId: string, data: Record<string, string>) {
  try {
    localStorage.setItem(NOTIFIED_KEY + '_' + userId, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

function loadRejectedNotified(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(REJECTED_NOTIFIED_KEY + '_' + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveRejectedNotified(userId: string, data: Record<string, string>) {
  try {
    localStorage.setItem(REJECTED_NOTIFIED_KEY + '_' + userId, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

export function TeacherUnlockGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchTable } = useSecureQuery();

  const [pendingApproved, setPendingApproved] = useState<UnlockRequest[]>([]);
  const [navWarn, setNavWarn] = useState<{ to: string } | null>(null);
  const allowNextNavRef = useRef(false);

  const isTeacher = user?.role === 'teacher';

  const refresh = useCallback(async () => {
    if (!isTeacher || !user) return;
    const data = await fetchTable<UnlockRequest>('marks_unlock_requests');
    let mine = data.filter(
      (r) => r.teacher_id === user.id && r.status === 'approved'
    );

    // Ignore approvals whose student has since been removed from the system —
    // the teacher can no longer act on them, so they must not block anything.
    if (mine.some((r) => r.student_id)) {
      const classes = Array.from(new Set(mine.map((r) => r.class).filter(Boolean)));
      const rosters = await Promise.all(
        classes.map((c) =>
          fetchTable<{ id: string }>('students', { class: c }, { select: 'id' })
        )
      );
      const existing = new Set(rosters.flat().map((s) => s.id));
      mine = mine.filter((r) => !r.student_id || existing.has(r.student_id));
    }

    setPendingApproved(mine);


    // Toast brand-new approvals once per approval
    const notified = loadNotified(user.id);
    let changed = false;
    for (const r of mine) {
      const stamp = r.updated_at;
      if (notified[r.id] !== stamp) {
        toast.success('Marks unlock approved', {
          description: `Edit ${r.subject_name}${
            r.student_name ? ` for ${r.student_name}` : ''
          } in ${r.class} (${r.term}). You will be locked to Marks Entry until done.`,
          duration: 9000,
          action: {
            label: 'Open Marks Entry',
            onClick: () => navigate('/marks-entry'),
          },
        });
        notified[r.id] = stamp;
        changed = true;
      }
    }
    if (changed) saveNotified(user.id, notified);

    // Notify rejected requests once each — does NOT block teacher
    const rejectedMine = data.filter(
      (r) => r.teacher_id === user.id && r.status === 'rejected'
    );
    const rejNotified = loadRejectedNotified(user.id);
    let rejChanged = false;
    for (const r of rejectedMine) {
      const stamp = r.updated_at;
      if (rejNotified[r.id] !== stamp) {
        toast.error('Marks unlock request rejected', {
          description: `Your request to edit ${r.subject_name}${
            r.student_name ? ` for ${r.student_name}` : ''
          } in ${r.class} (${r.term}) was rejected.${
            r.admin_note ? ` Note: ${r.admin_note}` : ''
          }`,
          duration: 9000,
        });
        rejNotified[r.id] = stamp;
        rejChanged = true;
      }
    }
    if (rejChanged) saveRejectedNotified(user.id, rejNotified);
  }, [isTeacher, user, fetchTable, navigate]);

  useEffect(() => {
    if (!isTeacher) return;
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, user?.id]);

  useRealtimeSubscription({
    table: 'marks_unlock_requests',
    onUpdate: refresh,
    enabled: isTeacher,
  });

  // Auto-redirect on first detection if not already on marks-entry
  const redirectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isTeacher) return;
    if (pendingApproved.length === 0) return;
    const firstId = pendingApproved[0].id;
    if (location.pathname === '/marks-entry') {
      redirectedRef.current = firstId;
      return;
    }
    if (redirectedRef.current !== firstId) {
      redirectedRef.current = firstId;
      navigate('/marks-entry');
    }
  }, [pendingApproved, isTeacher, location.pathname, navigate]);

  // Intercept clicks on links/anchors when there are pending approvals and the
  // teacher is NOT going to marks-entry. Soft warn.
  useEffect(() => {
    if (!isTeacher) return;
    if (pendingApproved.length === 0) return;

    const handler = (e: MouseEvent) => {
      if (allowNextNavRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (href === '/marks-entry') return;
      // Allow logout button (it's a <button>, not <a>)
      e.preventDefault();
      e.stopPropagation();
      setNavWarn({ to: href });
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isTeacher, pendingApproved]);

  if (!isTeacher) return null;

  const showBanner = pendingApproved.length > 0;

  return (
    <>
      {showBanner && (
        <div className="sticky top-0 z-40 bg-amber-500 text-amber-950">
          <div className="px-4 py-2 flex items-center gap-3 max-w-screen-2xl mx-auto">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1 text-sm">
              <strong>Action required:</strong>{' '}
              {pendingApproved.length === 1
                ? `Your marks unlock for ${pendingApproved[0].subject_name}${
                    pendingApproved[0].student_name
                      ? ` (${pendingApproved[0].student_name})`
                      : ''
                  } in ${pendingApproved[0].class} (${pendingApproved[0].term}) was approved. Please complete the edit before doing anything else.`
                : `You have ${pendingApproved.length} approved unlock requests pending. Please complete them in Marks Entry.`}
            </div>
            {location.pathname !== '/marks-entry' && (
              <button
                onClick={() => navigate('/marks-entry')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-950 text-amber-50 text-xs font-medium hover:bg-amber-900"
              >
                Go to Marks Entry <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!navWarn} onOpenChange={(o) => !o && setNavWarn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Pending approved unlock
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have an approved marks unlock request that has not been used
              yet. You should complete editing those marks before navigating
              away. Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNavWarn(null)}>
              Stay here
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const to = navWarn?.to;
                setNavWarn(null);
                if (to) {
                  allowNextNavRef.current = true;
                  navigate(to);
                  setTimeout(() => {
                    allowNextNavRef.current = false;
                  }, 500);
                }
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
