import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  BedDouble,
  BarChart3,
  LayoutGrid,
  ClipboardList,
  Users,
  FileBadge,
  MessageSquare,
  Megaphone,
  Unlock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  icon: React.ElementType;
  href: string;
}

const HOME: Tab = { label: 'Home', icon: LayoutDashboard, href: '/dashboard' };

const HEAD_TABS: Tab[] = [
  HOME,
  { label: 'Teachers', icon: Users, href: '/teachers' },
  { label: 'Unlocks', icon: Unlock, href: '/unlock-requests' },
  { label: 'Reports', icon: BarChart3, href: '/reports' },
];

const TABS_BY_ROLE: Record<string, Tab[]> = {
  admin: [
    HOME,
    { label: 'Students', icon: GraduationCap, href: '/students' },
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
    { label: 'Reports', icon: BarChart3, href: '/reports' },
  ],
  teacher: [
    HOME,
    { label: 'Marks', icon: ClipboardList, href: '/marks-entry' },
    { label: 'Class', icon: Users, href: '/my-class-students' },
    { label: 'Letters', icon: FileBadge, href: '/performance-letters' },
  ],
  parent: [HOME, { label: 'Feedback', icon: MessageSquare, href: '/feedback' }],
  secretary: [
    HOME,
    { label: 'Students', icon: GraduationCap, href: '/students' },
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
    { label: 'Feedback', icon: MessageSquare, href: '/feedback' },
  ],
  accountant: [
    HOME,
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
    { label: 'SMS', icon: Megaphone, href: '/marketing' },
    { label: 'Feedback', icon: MessageSquare, href: '/feedback' },
  ],
  head_nursery: HEAD_TABS,
  head_primary: HEAD_TABS,
  head_secondary: HEAD_TABS,
};

export function BottomNav() {
  const { user } = useAuth();
  const tabs = TABS_BY_ROLE[user?.role || ''] || [HOME];

  const item = 'flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors';
  const pill = 'flex items-center justify-center rounded-xl px-3.5 py-1.5 transition-colors';

  return (
    <nav
      data-floating-nav="true"
      aria-label="Main navigation"
      className="lg:hidden fixed left-3 right-3 z-30 h-[66px] rounded-[22px] bg-card border border-border flex items-center justify-around px-1 touch-none"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((t) => (
        <NavLink key={t.href} to={t.href} end className={({ isActive }) => cn(item, isActive ? 'text-primary' : 'text-muted-foreground')}>
          {({ isActive }) => (
            <>
              <span className={cn(pill, isActive && 'bg-primary/12')}>
                <t.icon className="w-5 h-5" />
              </span>
              {t.label}
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('das:toggle-menu'))}
        className={cn(item, 'text-muted-foreground')}
        aria-label="Open menu"
      >
        <span className={pill}>
          <LayoutGrid className="w-5 h-5" />
        </span>
        More
      </button>
    </nav>
  );
}
