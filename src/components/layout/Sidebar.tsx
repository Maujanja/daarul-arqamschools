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
  ChevronRight
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
  { label: 'Students', icon: GraduationCap, href: '/students', roles: ['admin', 'teacher'] },
  { label: 'Teachers', icon: Users, href: '/teachers', roles: ['admin'] },
  { label: 'Subjects', icon: BookOpen, href: '/subjects', roles: ['admin'] },
  { label: 'Marks Entry', icon: ClipboardList, href: '/marks-entry', roles: ['teacher'] },
  { label: 'Reports', icon: BarChart3, href: '/reports', roles: ['admin', 'teacher', 'parent'] },
  { label: 'Academic Records', icon: FileText, href: '/records', roles: ['parent'] },
  { label: 'Feedback', icon: MessageSquare, href: '/feedback', roles: ['admin', 'parent', 'teacher', 'secretary'] },
  { label: 'Announcements', icon: FileText, href: '/announcements', roles: ['admin', 'parent'] },
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
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-sidebar z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img src={dasLogo} alt="Daarul Arqam Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="font-display font-bold text-sidebar-foreground text-sm leading-tight">DAARUL-ARQAM</h1>
                <p className="text-xs text-sidebar-foreground/60">SCHOOLS</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "sidebar-link group",
                    isActive && "active"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                  )} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-primary" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-4 px-4">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-semibold text-sidebar-foreground">
                  {user?.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="sidebar-link w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
