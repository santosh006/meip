import Link from 'next/link';
export function SearchForm({ q, placeholder }: {q: string; placeholder: string}) {
  return <form className="flex gap-2 mb-6" method="get">
    <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} maxLength={100} className="rounded border border-[#2b333d] bg-[#161b22] px-3 py-2" />
    <button className="rounded border px-3 py-2">Search</button>
  </form>;
}
export default function PageControls({ page, hasMore, q = '' }: {page: number; hasMore: boolean; q?: string}) {
  const href = (n: number) => `?${new URLSearchParams({ page: String(n), ...(q ? {q} : {}) })}`;
  return <nav aria-label="Pages" className="mt-6 flex gap-5 items-center">
    {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
    <span>Page {page}</span>
    {hasMore && <Link href={href(page + 1)}>Next →</Link>}
  </nav>;
}
