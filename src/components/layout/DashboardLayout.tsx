import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dasLogo from '@/assets/das-logo.png';
import bgAdmin from '@/assets/bg-admin.jpg';
import bgGeneral from '@/assets/bg-general.jpg';
import { NotificationBell } from './NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.role === 'admin';
  const backgroundImage = isAdmin ? bgAdmin : bgGeneral;

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Overlay for better readability */}
      <div className="fixed inset-0 bg-black/30" />
      
      {/* Content */}
      <div className="relative z-10">
        <Sidebar />
        <main className="lg:ml-72 min-h-screen">
          {/* Header with Logo */}
          <header className="hidden lg:flex items-center gap-3 px-8 py-4 border-b border-white/10 bg-[#1e3a5f]/95 backdrop-blur-md sticky top-0 z-30 shadow-lg">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-10 h-10 object-contain" />
            <div className="flex-1">
              <h1 className="font-display font-bold text-white text-sm leading-tight">DAARUL-ARQAM SCHOOLS</h1>
              <p className="text-xs text-white/70">Exam Results Management System</p>
            </div>
            <NotificationBell />
          </header>
          {/* Mobile floating bell */}
          <div className="lg:hidden fixed top-4 right-4 z-40">
            <div className="bg-[#1e3a5f]/90 rounded-full shadow-lg">
              <NotificationBell />
            </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
