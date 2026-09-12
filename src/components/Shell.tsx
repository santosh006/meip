'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`block px-3 py-2 rounded text-sm ${
        path.startsWith(href)
          ? 'bg-[#4ea1ff1f] text-[#4ea1ff]'
          : 'text-[#9aa7b4] hover:bg-[#1c2430]'
      }`}
    >
      {label}
    </Link>
  );


  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-[#0d1117] text-[#e6edf3]">
      <aside className="bg-[#161b22] border-r border-[#2b333d] p-4 flex flex-col">
        <div className="font-bold mb-1">Market Intelligence Platform</div>
        <span className="text-[10px] text-[#e3b341] border border-[#e3b34166] rounded-full px-2 py-0.5 w-fit mb-6">
          INTERNAL DEV
        </span>
        <nav className="flex flex-col gap-1">
          {link('/dev-portal', 'DevArena')}
          {link('/app', 'StockFinder')}
        </nav>
        <button
          onClick={logout}
          className="mt-auto text-sm text-[#9aa7b4] hover:text-white text-left px-3 py-2"
        >
          ⏻ Sign out
        </button>
      </aside>
      <main className="p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
