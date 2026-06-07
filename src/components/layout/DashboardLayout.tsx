import { ReactNode, useEffect, useRef } from 'react';
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

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    let startY = 0;
    let startScrollTop = 0;

    const handleTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
      startScrollTop = main.scrollTop;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? 0;
      const isPullingDownFromTop = startScrollTop <= 0 && main.scrollTop <= 0 && currentY > startY;
      if (isPullingDownFromTop) {
        event.preventDefault();
      }
    };

    main.addEventListener('touchstart', handleTouchStart, { passive: true });
    main.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      main.removeEventListener('touchstart', handleTouchStart);
      main.removeEventListener('touchmove', handleTouchMove);
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
    <div className="min-h-dvh relative overflow-x-hidden">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none -z-10"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Overlay for better readability */}
      <div className="fixed inset-0 bg-black/25 pointer-events-none -z-10" />
      
      {/* Content */}
      <div className="relative z-10">
        <Sidebar />
        <main
          ref={mainRef}
          className="lg:ml-72 h-[100dvh] min-h-[100dvh] overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          {/* Header with Logo */}
          <header className="hidden lg:flex items-center gap-3 px-8 py-4 border-b border-white/10 bg-[#1e3a5f] sticky top-0 z-30">
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
          <div className="lg:hidden fixed top-4 right-4 z-40 flex items-center gap-2">
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
          <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6 pb-24 lg:pb-10">
            <TeacherUnlockGuard />
            <ScrollReveal>{children}</ScrollReveal>
          </div>
        </main>
      </div>
    </div>
  );
}
