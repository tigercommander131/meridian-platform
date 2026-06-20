'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

// Vector icons (inline SVG, no emoji per design prefs).
const icons = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h14V10',
  students: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0',
  cohorts: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
  sessions: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  reports: 'M9 17v-6h6v6M4 4h16v16H4z',
};

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', ready: true },
  { href: '/students', label: 'Students', icon: 'students', ready: true },
  { href: '/cohorts', label: 'Cohorts', icon: 'cohorts', ready: true },
  { href: '/sessions', label: 'Sessions', icon: 'sessions', ready: true },
  { href: '/reports', label: 'Reports', icon: 'reports', ready: true },
];

function Icon({ d }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {nav.map((item) => {
        const active = pathname === item.href;
        if (!item.ready) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400"
              title="Coming soon"
            >
              <span className="flex items-center gap-3">
                <Icon d={icons[item.icon]} />
                {item.label}
              </span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-teal-50 font-medium text-teal-700'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <Icon d={icons[item.icon]} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
