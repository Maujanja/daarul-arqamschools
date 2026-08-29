import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dasLogo from '@/assets/das-logo.png';
import bgAdmin from '@/assets/bg-admin.jpg';
import bgGeneral from '@/assets/bg-general.jpg';
import { NotificationBell } from './NotificationBell';
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
    <div className="app-viewport fixed inset-0 w-full overflow-hidden relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none -z-10"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Overlay for better readability */}
      <div className="fixed inset-0 bg-black/25 pointer-events-none -z-10" />
      
      {/* Content */}
      <div className="relative z-10 h-full overflow-hidden">
        <Sidebar />
        <main
          data-app-scroll-container="true"
          className="lg:ml-72 h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-none"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none', overscrollBehaviorY: 'none', touchAction: 'pan-y' }}
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
            
            <ScrollReveal>{children}</ScrollReveal>
          </div>
        </main>
      </div>
    </div>
  );
}
