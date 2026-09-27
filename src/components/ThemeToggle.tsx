'use client';
import { useEffect, useSyncExternalStore } from 'react';
const eventName = 'meip-theme-change';
function snapshot(): 'light' | 'dark' {
  const saved = localStorage.getItem('meip-theme');
  return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function subscribe(notify: () => void) {
  const media = matchMedia('(prefers-color-scheme: light)');
  window.addEventListener('storage', notify);
  window.addEventListener(eventName, notify);
  media.addEventListener('change', notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(eventName, notify); media.removeEventListener('change', notify); };
}
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return <button type="button" onClick={() => {
    localStorage.setItem('meip-theme', theme === 'dark' ? 'light' : 'dark');
    window.dispatchEvent(new Event(eventName));
  }} className="fixed right-5 top-4 z-40 rounded-full border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    {theme === 'dark' ? '☀ Light' : '☾ Dark'}
  </button>;
}
