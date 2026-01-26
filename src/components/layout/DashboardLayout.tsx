import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dasLogo from '@/assets/das-logo.png';
import bgAdmin from '@/assets/bg-admin.jpg';
import bgGeneral from '@/assets/bg-general.jpg';

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
          <header className="hidden lg:flex items-center gap-3 px-8 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-display font-bold text-foreground text-sm leading-tight">DAARUL-ARQAM SCHOOLS</h1>
              <p className="text-xs text-muted-foreground">Exam Results Management System</p>
            </div>
          </header>
          <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
