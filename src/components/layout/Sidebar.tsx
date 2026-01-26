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
        className="fixed top-4 left-4 z-50 lg:hidden bg-sidebar/90 text-sidebar-foreground hover:bg-sidebar"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-72 z-40 transform transition-all duration-500 ease-out lg:translate-x-0",
        "bg-gradient-to-b from-[hsl(222,47%,14%)] via-[hsl(222,47%,11%)] to-[hsl(222,47%,8%)]",
        "shadow-2xl shadow-black/20",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* User Profile Section */}
          <div className="p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center ring-2 ring-white/10 shadow-lg">
                <img src={dasLogo} alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-sidebar-foreground truncate">
                  {user?.name || 'User'}
                </h2>
                <p className="text-sm text-sidebar-foreground/50 capitalize">{user?.role || 'Guest'}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out",
                    isActive 
                      ? "bg-white/10 text-white shadow-lg shadow-black/10" 
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                  )} />
                  <span className="flex-1 font-medium text-sm">{item.label}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Logout section */}
          <div className="p-4">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>

          {/* School branding */}
          <div className="p-4 pt-2">
            <div className="px-4 py-3 rounded-xl bg-white/5">
              <p className="text-xs font-semibold text-sidebar-foreground/80 tracking-wide">DAARUL-ARQAM</p>
              <p className="text-xs text-sidebar-foreground/40">Schools Management System</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
