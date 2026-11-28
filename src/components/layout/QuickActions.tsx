import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  ToggleLeft,
  Megaphone,
  BedDouble,
  ClipboardList,
  Users,
  FileBadge,
  BarChart3,
  MessageSquare,
  Unlock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Action {
  label: string;
  icon: React.ElementType;
  href: string;
}

const HEAD_ACTIONS: Action[] = [
  { label: 'Teachers', icon: Users, href: '/teachers' },
  { label: 'Unlocks', icon: Unlock, href: '/unlock-requests' },
  { label: 'Series', icon: ToggleLeft, href: '/series-control' },
  { label: 'Reports', icon: BarChart3, href: '/reports' },
];

const ACTIONS_BY_ROLE: Record<string, Action[]> = {
  admin: [
    { label: 'Students', icon: GraduationCap, href: '/students' },
    { label: 'Series', icon: ToggleLeft, href: '/series-control' },
    { label: 'Announce', icon: Megaphone, href: '/announcements' },
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
  ],
  teacher: [
    { label: 'Marks', icon: ClipboardList, href: '/marks-entry' },
    { label: 'My Class', icon: Users, href: '/my-class-students' },
    { label: 'Letters', icon: FileBadge, href: '/performance-letters' },
    { label: 'Reports', icon: BarChart3, href: '/reports' },
  ],
  secretary: [
    { label: 'Students', icon: GraduationCap, href: '/students' },
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
    { label: 'Feedback', icon: MessageSquare, href: '/feedback' },
  ],
  accountant: [
    { label: 'Dorms', icon: BedDouble, href: '/dormitories' },
    { label: 'SMS', icon: Megaphone, href: '/marketing' },
    { label: 'Feedback', icon: MessageSquare, href: '/feedback' },
  ],
  head_nursery: HEAD_ACTIONS,
  head_primary: HEAD_ACTIONS,
  head_secondary: HEAD_ACTIONS,
};

const TINTS = [
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-600',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-600',
];

export function QuickActions() {
  const { user } = useAuth();
  const actions = ACTIONS_BY_ROLE[user?.role || ''];
  if (!actions || actions.length < 2) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-2.5 px-0.5 text-sm font-extrabold">Quick Actions</h3>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions.map((a, i) => (
          <NavLink
            key={a.href}
            to={a.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-1 py-3 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TINTS[i % TINTS.length]}`}>
              <a.icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-bold leading-tight">{a.label}</span>
          </NavLink>
        ))}
      </div>
    </section>
  );
}

