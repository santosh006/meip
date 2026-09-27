import Shell from '@/components/Shell';
import NewsIngestionClient from './NewsIngestionClient';

export const dynamic = 'force-dynamic';

export default function NewsIngestionPage() {
  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold">News Incubator</h1>

      <p className="mb-6 text-[#9aa7b4]">
        Review market news before adding it to NewsFinder.
      </p>

      <NewsIngestionClient />
    </Shell>
  );
}
