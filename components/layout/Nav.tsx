'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'Actions', href: '/actions' },
];

export function Nav() {
  const pathname = usePathname();
  
  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${isActive
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }
            `.trim()}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
