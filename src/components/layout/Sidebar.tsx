import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
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
  Calendar,
  Unlock,
  ToggleLeft,
  UserCheck,
  Send
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
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin', 'teacher', 'parent', 'secretary', 'accountant', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Students', icon: GraduationCap, href: '/students', roles: ['admin', 'teacher', 'secretary'] },
  { label: 'My Class Students', icon: Users, href: '/my-class-students', roles: ['teacher'] },
  { label: 'Teachers', icon: Users, href: '/teachers', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Subjects', icon: BookOpen, href: '/subjects', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Marks Entry', icon: ClipboardList, href: '/marks-entry', roles: ['teacher'] },
  { label: 'Unlock Requests', icon: Unlock, href: '/unlock-requests', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Series Control', icon: ToggleLeft, href: '/series-control', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Parent Logins', icon: UserCheck, href: '/parent-logins', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Bulk SMS', icon: Send, href: '/bulk-sms', roles: ['admin', 'accountant', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Reports', icon: BarChart3, href: '/reports', roles: ['admin', 'teacher', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Feedback', icon: MessageSquare, href: '/feedback', roles: ['admin', 'parent', 'teacher', 'secretary', 'accountant', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Announcements', icon: FileText, href: '/announcements', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Academic Years', icon: Calendar, href: '/academic-years', roles: ['admin'] },
  { label: 'User Management', icon: UserCog, href: '/users', roles: ['admin', 'head_nursery', 'head_primary', 'head_secondary'] },
  { label: 'Settings', icon: Settings, href: '/settings', roles: ['admin'] },
];

const STAGGER = 0.05;
const PANEL_OPEN_MS = 550;
const PANEL_DELAY_BEFORE_ITEMS = 220;

const ITEM_VARIANTS: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

function getRoleDisplay(role: string) {
  const map: Record<string, string> = {
    admin: 'Admin',
    teacher: 'Teacher',
    parent: 'Parent',
    secretary: 'Secretary',
    accountant: 'Accountant',
    head_nursery: 'Head of Nursery',
    head_primary: 'Head of Primary',
    head_secondary: 'Head of Secondary',
  };
  return map[role] || role;
}

interface SidebarInnerProps {
  items: NavItem[];
  user: ReturnType<typeof useAuth>['user'];
  logout: () => void;
  pathname: string;
  onNavigate?: () => void;
  itemsVisible: boolean;
}

function SidebarInner({ items, user, logout, pathname, onNavigate, itemsVisible }: SidebarInnerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/20">
            <img src={dasLogo} alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{user?.name || 'User'}</h2>
            <p className="text-sm text-white/50">{getRoleDisplay(user?.role || 'Guest')}</p>
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-white/10" />

      <nav className="flex-1 px-4 py-5 overflow-y-auto overscroll-none touch-pan-y">
        <AnimatePresence initial={false}>
          {itemsVisible && (
            <motion.ul
              key="nav-list"
              className="space-y-1 list-none m-0 p-0"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { transition: { staggerChildren: STAGGER, delayChildren: 0.15 } },
                hidden: { transition: { staggerChildren: STAGGER, staggerDirection: -1 } },
              }}
            >
              {items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <motion.li key={item.href} variants={ITEM_VARIANTS}>
                    <NavLink
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/5',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'w-5 h-5 transition-colors duration-200',
                          isActive ? 'text-sky-300' : 'text-white/50 group-hover:text-white/80',
                        )}
                      />
                      <span className="flex-1 font-medium text-sm">{item.label}</span>
                      {isActive && <div className="w-2 h-2 rounded-full bg-sky-300" />}
                    </NavLink>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </nav>

      <div className="mx-5 h-px bg-white/10" />

      <div className="p-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Sign Out</span>
        </button>
      </div>

      <div className="p-4 pt-2">
        <div className="px-4 py-3 rounded-xl bg-white/5">
          <p className="text-xs font-semibold text-white/80 tracking-wide">DAARUL-ARQAM</p>
          <p className="text-xs text-white/40">Schools Management System</p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  // Controls items visibility separately so on close: items exit first, then panel.
  const [itemsVisible, setItemsVisible] = useState(false);
  // Keeps panel mounted/animated until items finish exiting on close.
  const [panelOpen, setPanelOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => user && item.roles.includes(user.role));

  // Sync open state -> two-phase animation
  useEffect(() => {
    if (isOpen) {
      setPanelOpen(true);
      // Phase 1: panel glides in. Phase 2: items stagger in shortly after.
      const t = setTimeout(() => setItemsVisible(true), PANEL_DELAY_BEFORE_ITEMS);
      return () => clearTimeout(t);
    } else {
      // Close: items exit first (quickly), then panel glides out.
      setItemsVisible(false);
      const exitMs = filteredNavItems.length * STAGGER * 1000 + 120;
      const t = setTimeout(() => setPanelOpen(false), exitMs);
      return () => clearTimeout(t);
    }
  }, [isOpen, filteredNavItems.length]);

  const toggleSidebar = () => setIsOpen((v) => !v);

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-[60] lg:hidden bg-[#1e3a5f] text-white hover:bg-[#1e3a5f] touch-none"
        onClick={toggleSidebar}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="inline-flex"
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="inline-flex"
            >
              <Menu className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden touch-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile animated sidebar */}
      <AnimatePresence>
        {panelOpen && (
          <motion.aside
            key="mobile-sidebar"
            data-sidebar-glass="true"
            className={cn(
              'fixed left-3 top-3 bottom-3 w-[17rem] z-50 lg:hidden',
              'rounded-3xl overflow-hidden',
              'bg-gradient-to-b from-[#1e3a5f]/55 via-[#1a3455]/55 to-[#152a45]/60',
              'border border-white/15',
              'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.55)]',
            )}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{
              x: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            }}
            // Smoother, slower tween on close so the panel glides out
            // (overrides the spring above when exiting)
            // @ts-ignore - framer-motion accepts per-state transition via exit prop variant
          >
            <SidebarInner
              items={filteredNavItems}
              user={user}
              logout={logout}
              pathname={location.pathname}
              onNavigate={() => setIsOpen(false)}
              itemsVisible={itemsVisible}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop static sidebar (always visible, items animate in once) */}
      <aside
        data-sidebar-glass="true"
        className={cn(
          'hidden lg:block fixed left-4 top-4 bottom-4 w-[17rem] z-50',
          'rounded-3xl overflow-hidden',
          'bg-gradient-to-b from-[#1e3a5f]/55 via-[#1a3455]/55 to-[#152a45]/60',
          'border border-white/15',
          'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.55)]',
        )}
      >
        <SidebarInner
          items={filteredNavItems}
          user={user}
          logout={logout}
          pathname={location.pathname}
          itemsVisible={true}
        />
      </aside>
    </>
  );
}
