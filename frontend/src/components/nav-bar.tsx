'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/strategies', label: '策略' },
  { href: '/market', label: '市場' },
  { href: '/guide', label: '說明' },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>
          <span>QuantDesk</span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? 'active' : ''}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-spacer" />
        <span className="nav-tag">美股 · 回測 · 教育用途</span>
      </div>
    </nav>
  );
}
