'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { startTour } from '@/components/tour/Tour';

// Vector icons (inline SVG, no emoji per design prefs).
const icons = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h14V10',
  students: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0',
  courses: 'M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5',
  cohorts: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
  sessions: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  reports: 'M9 17v-6h6v6M4 4h16v16H4z',
  team: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
};

const nav = [
  { section: 'Workspace' },
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', ready: true },
  { href: '/students', label: 'Students', icon: 'students', ready: true, tour: 'nav-students' },
  { href: '/courses', label: 'Courses', icon: 'courses', ready: true, tour: 'nav-courses' },
  { href: '/cohorts', label: 'Cohorts', icon: 'cohorts', ready: true },
  { href: '/sessions', label: 'Sessions', icon: 'sessions', ready: true, tour: 'nav-sessions' },
  { href: '/reports', label: 'Reports', icon: 'reports', ready: true, tour: 'nav-reports' },
  { section: 'Admin', adminOnly: true },
  { href: '/users', label: 'Team', icon: 'team', ready: true, adminOnly: true },
];

function Icon({ d }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  return (
    <nav data-tour="sidebar" className="flex h-full flex-col gap-0.5 p-3">
      {nav.map((item, i) => {
        if (item.adminOnly && !isAdmin) return null;

        if (item.section) {
          return (
            <p key={`s-${i}`} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {item.section}
            </p>
          );
        }

        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        if (!item.ready) {
          return (
            <span key={item.href}
              className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-400"
              title="Coming soon">
              <span className="flex items-center gap-3"><Icon d={icons[item.icon]} />{item.label}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">Soon</span>
            </span>
          );
        }
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} data-tour={item.tour}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? 'bg-teal-50 font-medium text-teal-700' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}>
            <span className={active ? 'text-teal-600' : 'text-neutral-400 group-hover:text-neutral-600'}>
              <Icon d={icons[item.icon]} />
            </span>
            {item.label}
          </Link>
        );
      })}

      <button
        onClick={startTour}
        className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.2M12 17h.01" />
        </svg>
        Take a tour
      </button>
    </nav>
  );
}
