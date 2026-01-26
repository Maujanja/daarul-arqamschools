import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  FileText, 
  Settings, 
  LogOut,
  GraduationCap,
  ClipboardList,
  BarChart3,
  MessageSquare,
  UserCog,
  Menu,
  X,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import dasLogo from '@/assets/das-logo.png';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin', 'teacher', 'parent', 'secretary'] },
  { label: 'Students', icon: GraduationCap, href: '/students', roles: ['admin', 'teacher', 'secretary'] },
  { label: 'My Class Students', icon: Users, href: '/my-class-students', roles: ['teacher'] },
  { label: 'Teachers', icon: Users, href: '/teachers', roles: ['admin'] },
  { label: 'Subjects', icon: BookOpen, href: '/subjects', roles: ['admin'] },
  { label: 'Marks Entry', icon: ClipboardList, href: '/marks-entry', roles: ['teacher'] },
  { label: 'Reports', icon: BarChart3, href: '/reports', roles: ['admin', 'teacher'] },
  { label: 'Feedback', icon: MessageSquare, href: '/feedback', roles: ['admin', 'parent', 'teacher', 'secretary'] },
  { label: 'Announcements', icon: FileText, href: '/announcements', roles: ['admin'] },
  { label: 'Academic Years', icon: Calendar, href: '/academic-years', roles: ['admin'] },
  { label: 'User Management', icon: UserCog, href: '/users', roles: ['admin'] },
  { label: 'Settings', icon: Settings, href: '/settings', roles: ['admin'] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-[#1e3a5f]/90 text-white hover:bg-[#1e3a5f] shadow-lg"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full w-72 z-40 lg:translate-x-0",
          "bg-gradient-to-b from-[#1e3a5f] via-[#1a3455] to-[#152a45]",
          "shadow-2xl transition-all",
          isOpen 
            ? "translate-x-0 animate-sidebar-in" 
            : "-translate-x-full lg:translate-x-0 animate-sidebar-out"
        )}
        style={{
          animationDuration: '0.4s',
          animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div className={cn(
          "flex flex-col h-full",
          isOpen && "animate-content-wiggle"
        )}>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-5 right-4 lg:hidden text-white/60 hover:text-white transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* User Profile Section */}
          <div className="p-6 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/20 shadow-lg backdrop-blur-sm">
                <img src={dasLogo} alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-white truncate">
                  {user?.name || 'User'}
                </h2>
                <p className="text-sm text-white/50 capitalize">{user?.role || 'Guest'}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/10" />

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item, index) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive 
                      ? "bg-white/15 text-white shadow-md" 
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                  style={{
                    animationDelay: isOpen ? `${index * 30}ms` : '0ms'
                  }}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive ? "text-sky-300" : "text-white/50 group-hover:text-white/80"
                  )} />
                  <span className="flex-1 font-medium text-sm">{item.label}</span>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-sky-300" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/10" />

          {/* Logout section */}
          <div className="p-4">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>

          {/* School branding */}
          <div className="p-4 pt-2">
            <div className="px-4 py-3 rounded-xl bg-white/5">
              <p className="text-xs font-semibold text-white/80 tracking-wide">DAARUL-ARQAM</p>
              <p className="text-xs text-white/40">Schools Management System</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Add custom animation styles */}
      <style>{`
        @keyframes sidebar-in {
          0% {
            transform: translateX(-100%);
            opacity: 0.5;
          }
          50% {
            transform: translateX(3%);
          }
          70% {
            transform: translateX(-1%);
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes sidebar-out {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(-100%);
            opacity: 0.5;
          }
        }
        
        @keyframes content-wiggle {
          0% {
            transform: translateX(-5px);
            opacity: 0;
          }
          30% {
            transform: translateX(3px);
            opacity: 0.7;
          }
          60% {
            transform: translateX(-2px);
            opacity: 0.9;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-sidebar-in {
          animation: sidebar-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .animate-sidebar-out {
          animation: sidebar-out 0.3s ease-out forwards;
        }
        
        .animate-content-wiggle {
          animation: content-wiggle 0.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
