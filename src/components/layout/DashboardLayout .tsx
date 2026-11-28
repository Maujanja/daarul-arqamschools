import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import dasLogo from '@/assets/das-logo.png';
import { NotificationBell } from './NotificationBell';
import { BottomNav } from './BottomNav';
import { QuickActions } from './QuickActions';
import { cn } from '@/lib/utils';
import { ScrollReveal } from './ScrollReveal';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import {
  SCROLL_DEBUG_ENABLED_KEY,
  SCROLL_DEBUG_EVENT_NAME,
  SCROLL_DEBUG_LOG_KEY,
} from '@/utils/preventPullToRefresh';

interface DashboardLayoutProps {
  children: ReactNode;
}

type ScrollDebugEntry = Record<string, unknown>;

function readScrollDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SCROLL_DEBUG_ENABLED_KEY) === '1';
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { pathname } = useLocation();
  const [scrollDebugEnabled, setScrollDebugEnabled] = useState(readScrollDebugEnabled);
  const [lastScrollDebug, setLastScrollDebug] = useState<ScrollDebugEntry | null>(null);

  useEffect(() => {
    const handleDebug = (event: Event) => {
      setScrollDebugEnabled(readScrollDebugEnabled());
      setLastScrollDebug((event as CustomEvent<ScrollDebugEntry>).detail || null);
    };
    try {
      const previous = JSON.parse(localStorage.getItem(SCROLL_DEBUG_LOG_KEY) || '[]');
      if (Array.isArray(previous) && previous.length > 0) {
        setLastScrollDebug(previous[previous.length - 1]);
      }
    } catch {
      // Ignore invalid debug history.
    }
    window.addEventListener(SCROLL_DEBUG_EVENT_NAME, handleDebug);
    return () => {
      window.removeEventListener(SCROLL_DEBUG_EVENT_NAME, handleDebug);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isHome = pathname === '/dashboard';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.name || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    teacher: 'Teacher',
    parent: 'Parent',
    secretary: 'Secretary',
    accountant: 'Accountant',
    head_nursery: 'Head of Nursery',
    head_primary: 'Head of Primary',
    head_secondary: 'Head of Secondary',
  };
  const roleLabel = roleLabels[user?.role || ''] || user?.role || '';

  const handleRefresh = () => {
    const reload = () => window.location.reload();
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(reload);
    } else {
      reload();
    }
  };

  return (
    <div className="app-viewport fixed inset-0 w-full overflow-hidden relative">
      {/* Soft brand background */}
      <div className="fixed inset-0 bg-background pointer-events-none -z-10" />
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(900px 520px at 100% -8%, hsl(var(--primary) / 0.12), transparent 62%), radial-gradient(760px 460px at -8% 108%, hsl(var(--gold) / 0.14), transparent 62%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full overflow-hidden">
        <Sidebar />
        <main
          data-app-scroll-container="true"
          data-home={isHome ? 'true' : undefined}
          className="lg:ml-72 h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-none"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none', overscrollBehaviorY: 'none', touchAction: 'pan-y' }}
        >
          {/* Header with Logo */}
          <header className="hidden lg:flex items-center gap-3 px-6 py-3 mx-6 mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(172_66%_14%)] to-[hsl(172_58%_28%)] sticky top-2 z-30 touch-none">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-10 h-10 object-cover rounded-full ring-2 ring-[hsl(var(--gold))]/70" />
            <div className="flex-1">
              <h1 className="font-display font-bold text-white text-sm leading-tight">DAARUL-ARQAM SCHOOLS</h1>
              <p className="text-xs text-white/70">Exam Results Management System</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="text-white hover:bg-white/10"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <NotificationBell />
          </header>
          {/* Mobile greeting header (home only) */}
          {isHome && (
            <div className="lg:hidden relative overflow-hidden rounded-b-[30px] bg-gradient-to-br from-[hsl(172_66%_13%)] via-[hsl(172_60%_21%)] to-[hsl(172_58%_31%)] px-5 pb-7 pt-5 text-white">
              <div
                aria-hidden
                className="absolute -right-14 -top-16 h-52 w-52 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.35), transparent 70%)' }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--gold))] text-sm font-extrabold text-[hsl(var(--gold-foreground))] ring-2 ring-white/30">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/75">{greeting}</p>
                    <h2 className="truncate text-lg font-extrabold leading-tight">{displayName}</h2>
                    <p className="text-[11px] font-medium text-white/70">{roleLabel}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 touch-none">
                  <button
                    onClick={handleRefresh}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
                    title="Refresh"
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                  <div className="rounded-full bg-white/15 text-white">
                    <NotificationBell />
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Mobile floating bell */}
          <div className={cn('lg:hidden fixed top-4 right-4 z-40 flex items-center gap-2 touch-none', isHome && 'hidden')}>
            <button
              onClick={handleRefresh}
              className="bg-[hsl(var(--sidebar-background))] rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-[hsl(var(--sidebar-accent))]"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="bg-[hsl(var(--sidebar-background))] rounded-full">
              <NotificationBell />
            </div>
          </div>
          {scrollDebugEnabled && (
            <div className="fixed left-3 right-3 bottom-3 z-[60] rounded-lg border border-sky-300/40 bg-slate-950/95 p-3 text-xs text-sky-50 lg:left-auto lg:w-[420px]">
              <div className="flex items-center justify-between gap-3">
                <strong>Scroll debug ON</strong>
                <button
                  type="button"
                  className="rounded border border-sky-300/30 px-2 py-1 text-sky-100"
                  onClick={() => {
                  localStorage.removeItem(SCROLL_DEBUG_ENABLED_KEY);
                    setScrollDebugEnabled(false);
                  }}
                >
                  Off
                </button>
              </div>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-sky-100/90">
                {lastScrollDebug ? JSON.stringify(lastScrollDebug, null, 2) : 'Waiting for scroll gesture...'}
              </pre>
            </div>
          )}
          <div data-page-content="true" className={cn('p-4 sm:p-6 lg:p-8 pb-28 lg:pb-10', isHome ? 'pt-5 lg:pt-6' : 'pt-16 lg:pt-6')}>
            {isHome && (
              <div className="lg:hidden">
                <QuickActions />
              </div>
            )}
            <ScrollReveal>{children}</ScrollReveal>
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
