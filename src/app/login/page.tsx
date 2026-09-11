'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dev-portal');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-[#e6edf3]">
      <form onSubmit={handleLogin} className="bg-[#161b22] border border-[#2b333d] rounded-xl p-8 w-80">
        <h1 className="text-xl font-bold mb-1">Market Intelligence</h1>
        <p className="text-sm text-[#9aa7b4] mb-6">Internal dev portal — sign in</p>
        <input
          className="w-full mb-3 px-3 py-2 rounded bg-[#0d1117] border border-[#2b333d] focus:border-[#4ea1ff] outline-none"
          type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="w-full mb-4 px-3 py-2 rounded bg-[#0d1117] border border-[#2b333d] focus:border-[#4ea1ff] outline-none"
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <p className="text-[#f85149] text-sm mb-3">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-[#4ea1ff] text-black font-semibold disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
