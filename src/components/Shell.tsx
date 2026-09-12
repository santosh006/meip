'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import ThemeToggle from './ThemeToggle';

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const link = (href: string, label: string, icon: string) => (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${isCollapsed ? 'justify-center' : ''} ${
        path.startsWith(href)
          ? 'bg-[#4ea1ff1f] text-[#4ea1ff]'
          : 'text-[#9aa7b4] hover:bg-[#1c2430]'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {!isCollapsed && label}
    </Link>
  );


  return (
    <div className={`min-h-screen grid ${isCollapsed ? 'grid-cols-[72px_1fr]' : 'grid-cols-[240px_1fr]'} bg-[#0d1117] text-[#e6edf3]`}>
      <aside className="flex flex-col border-r border-[#2b333d] bg-[#161b22] p-4">
        <div className={`mb-1 font-bold ${isCollapsed ? 'text-center text-lg' : ''}`} title={isCollapsed ? 'Market Intelligence Platform' : undefined}>
          {isCollapsed ? 'M' : 'Market Intelligence Platform'}
        </div>
        {!isCollapsed && (
          <span className="mb-6 w-fit rounded-full border border-[#e3b34166] px-2 py-0.5 text-[10px] text-[#e3b341]">
            INTERNAL DEV
          </span>
        )}
        <nav className="flex flex-col gap-1">
          {link('/dev-portal', 'DevArena', '⌘')}
          {link('/app', 'StockFinder', '◈')}
        </nav>
        <div className="mt-auto mb-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            className={`flex items-center gap-3 px-3 py-2 text-sm text-[#9aa7b4] hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <span aria-hidden="true">{isCollapsed ? '»' : '«'}</span>
            {!isCollapsed && 'Collapse'}
          </button>
        </div>
      </aside>
      <main className="relative px-8 pb-8 pt-20 overflow-y-auto">
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="fixed right-36 top-4 z-40 rounded-full border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-[#e6edf3] shadow-lg hover:border-[#4ea1ff]"
          aria-label="Sign out"
          title="Sign out"
        >
          ⏻ Sign out
        </button>
        {children}
      </main>
    </div>
  );
}
