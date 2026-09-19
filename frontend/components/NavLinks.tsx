'use client';

// Top bar links. The link for the current page is marked for sighted people and screen readers.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-6 text-lg">
      {links.map((l) => {
        const base = l.href === '/check-in/current' ? '/check-in' : l.href;
        const current = pathname === base || pathname.startsWith(`${base}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? 'page' : undefined}
            className={`border-b-4 pb-1 font-medium focus-visible:outline-3 focus-visible:outline-accent ${current ? 'border-accent text-accent' : 'border-transparent text-ink hover:text-accent'}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
