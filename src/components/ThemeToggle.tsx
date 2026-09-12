'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('meip-theme');
    const browserPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const nextTheme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : browserPrefersLight ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem('meip-theme', nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-5 top-4 z-40 rounded-full border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-[#e6edf3] shadow-lg hover:border-[#4ea1ff]"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀ Light' : '☾ Dark'}
    </button>
  );
}
