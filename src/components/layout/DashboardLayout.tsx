import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dasLogo from '@/assets/das-logo.png';
import bgAdmin from '@/assets/bg-admin.jpg';
import bgGeneral from '@/assets/bg-general.jpg';
import { NotificationBell } from './NotificationBell';
import { TeacherUnlockGuard } from './TeacherUnlockGuard';
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
  const { isAuthenticated, user } = useAuth();
  const [scrollDebugEnabled, setScrollDebugEnabled] = useState(readScrollDebugEnabled);
  const [lastScrollDebug, setLastScrollDebug] = useState<ScrollDebugEntry | null>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const writeScrollDebug = (eventName: string, details: ScrollDebugEntry = {}) => {
      if (!scrollDebugEnabledRef.current) return;
      const entry = {
        at: new Date().toISOString(),
        event: eventName,
        path: window.location.pathname,
        standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
        displayMode: window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
        visibilityState: document.visibilityState,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
        scrollTop: Math.round(main.scrollTop),
        maxScrollTop: Math.round(main.scrollHeight - main.clientHeight),
        ...details,
      };
      lastGestureRef.current = entry;
      setLastScrollDebug(entry);
      try {
        const previous = JSON.parse(localStorage.getItem(SCROLL_DEBUG_LOG_KEY) || '[]');
        const next = Array.isArray(previous) ? [...previous.slice(-79), entry] : [entry];
        localStorage.setItem(SCROLL_DEBUG_LOG_KEY, JSON.stringify(next));
      } catch {
        // Debug logging must never break scrolling.
      }
      console.warn('[DAS scroll-debug]', eventName, entry);
    };

    const getScrollableTarget = (target: EventTarget | null) => {
      let node = target instanceof Element ? target : null;
      while (node && node !== main) {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        const canScroll = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
        if (canScroll) return element;
        node = node.parentElement;
      }
      return main;
    };

    const keepScrollAwayFromEdges = (scroller: HTMLElement = main, reason = 'scroll-edge-guard') => {
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      if (maxScrollTop <= 1) return;
      if (scroller.scrollTop <= 0) {
        scroller.scrollTop = 1;
        writeScrollDebug(reason, { adjusted: 'top', target: scroller === main ? 'main' : scroller.tagName });
      } else if (scroller.scrollTop >= maxScrollTop) {
        scroller.scrollTop = maxScrollTop - 1;
        writeScrollDebug(reason, { adjusted: 'bottom', target: scroller === main ? 'main' : scroller.tagName });
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      activeScrollerRef.current = getScrollableTarget(event.target);
      keepScrollAwayFromEdges(activeScrollerRef.current, 'touchstart-edge-guard');
      lastTouchYRef.current = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!event.cancelable) return;
      const currentY = event.touches[0]?.clientY ?? 0;
      const deltaY = currentY - lastTouchYRef.current;
      const scroller = activeScrollerRef.current || getScrollableTarget(event.target);
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      const isScrollable = maxScrollTop > 1;
      const isAtTop = !isScrollable || scroller.scrollTop <= 1;
      const isAtBottom = isScrollable && Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight - 1;
      const isPullingPastTop = isAtTop && deltaY > 0;
      const isPushingPastBottom = isAtBottom && deltaY < 0;

      if (isPullingPastTop || isPushingPastBottom) {
        event.preventDefault();
        keepScrollAwayFromEdges(scroller, 'touchmove-edge-guard');
        writeScrollDebug('overscroll-gesture-blocked', {
          direction: isPullingPastTop ? 'pull-down-at-top' : 'push-up-at-bottom',
          deltaY: Math.round(deltaY),
          target: scroller === main ? 'main' : scroller.tagName,
          targetScrollTop: Math.round(scroller.scrollTop),
          targetMaxScrollTop: Math.round(maxScrollTop),
        });
      }

      lastTouchYRef.current = currentY;
    };

    const handlePossibleRefresh = (event: Event) => {
      writeScrollDebug('page-lifecycle-possible-refresh', {
        type: event.type,
        visibilityState: document.visibilityState,
        lastGesture: lastGestureRef.current,
      });
    };

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    writeScrollDebug('dashboard-scroll-debug-ready', {
      navigationType: navigationEntry?.type ?? 'unknown',
      userAgent: navigator.userAgent,
    });

    const handleMainScroll = () => keepScrollAwayFromEdges(main, 'scroll-edge-guard');

    keepScrollAwayFromEdges(main, 'mount-edge-guard');
    main.addEventListener('scroll', handleMainScroll, { passive: true });
    document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    window.addEventListener('pagehide', handlePossibleRefresh);
    window.addEventListener('beforeunload', handlePossibleRefresh);
    document.addEventListener('visibilitychange', handlePossibleRefresh);

    return () => {
      main.removeEventListener('scroll', handleMainScroll);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      window.removeEventListener('pagehide', handlePossibleRefresh);
      window.removeEventListener('beforeunload', handlePossibleRefresh);
      document.removeEventListener('visibilitychange', handlePossibleRefresh);
    };
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.role === 'admin';
  const backgroundImage = isAdmin ? bgAdmin : bgGeneral;

  const handleRefresh = () => {
    const reload = () => window.location.reload();
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(reload);
    } else {
      reload();
    }
  };

  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden relative touch-none">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none -z-10"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Overlay for better readability */}
      <div className="fixed inset-0 bg-black/25 pointer-events-none -z-10" />
      
      {/* Content */}
      <div className="relative z-10 h-dvh overflow-hidden">
        <Sidebar />
        <main
          ref={mainRef}
          className="lg:ml-72 h-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-none"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none', overscrollBehaviorY: 'none' }}
        >
          {/* Header with Logo */}
          <header className="hidden lg:flex items-center gap-3 px-8 py-4 border-b border-white/10 bg-[#1e3a5f] sticky top-0 z-30 touch-none">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-10 h-10 object-contain" />
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
          {/* Mobile floating bell */}
          <div className="lg:hidden fixed top-4 right-4 z-40 flex items-center gap-2 touch-none">
            <button
              onClick={handleRefresh}
              className="bg-[#1e3a5f] rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-[#1e3a5f]"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="bg-[#1e3a5f] rounded-full">
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
          <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6 pb-24 lg:pb-10">
            <TeacherUnlockGuard />
            <ScrollReveal>{children}</ScrollReveal>
          </div>
        </main>
      </div>
    </div>
  );
}
