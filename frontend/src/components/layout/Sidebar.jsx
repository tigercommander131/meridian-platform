'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { startTour } from '@/components/tour/Tour';
import { Icon } from '@/components/ui/kit';

// Vector icons (inline SVG, no emoji per design prefs).
const icons = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h6v-6h2v6h6V10',
  courses: 'M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5',
  instructors: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
  students: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0',
  accreditation: 'M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z',
  team: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
};

const nav = [
  { section: 'Operations' },
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/courses', label: 'Courses', icon: 'courses', tour: 'nav-courses' },
  { href: '/instructors', label: 'Instructors', icon: 'instructors', tour: 'nav-instructors' },
  { href: '/students', label: 'Students', icon: 'students' },
  { section: 'Configuration' },
  { href: '/accreditation', label: 'Accreditation & Rules', icon: 'accreditation', tour: 'nav-accreditation' },
  { section: 'Admin', adminOnly: true },
  { href: '/users', label: 'Team', icon: 'team', adminOnly: true },
];

export default function Sidebar({ user, onNavigate }) {
  const pathname = usePathname();
  const isAdmin = user?.roles?.some((r) => ['admin', 'organisation_admin'].includes(r));

  return (
    <nav data-tour="sidebar" className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {nav.map((item, i) => {
        if (item.adminOnly && !isAdmin) return null;
        if (item.section) {
          return (
            <p key={`s-${i}`} className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
              {item.section}
            </p>
          );
        }
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} data-tour={item.tour}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? 'bg-teal-50 font-medium text-teal-800' : 'text-[var(--ink-2)] hover:bg-neutral-100 hover:text-[var(--ink)]'
            }`}>
            {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-1 rounded-r-full bg-teal-600" />}
            <span className={active ? 'text-teal-600' : 'text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'}>
              <Icon d={icons[item.icon]} className="h-[18px] w-[18px]" />
            </span>
            {item.label}
          </Link>
        );
      })}

      <button
        onClick={startTour}
        className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ink-3)] transition-colors hover:bg-neutral-100 hover:text-[var(--ink)]"
      >
        <Icon d={['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.2M12 17h.01']} className="h-[18px] w-[18px]" />
        Take a tour
      </button>
    </nav>
  );
}
