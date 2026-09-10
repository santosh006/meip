// import { createSupabaseServer } from '@/lib/supabase-server';
// import ImpactClient from './ImpactClient';

// export const dynamic = 'force-dynamic';

// export type ImpactRecord = {
//   id: string;
//   title: string;
//   category: string;
//   description: string;
//   metric_label: string | null;
//   metric_value: string | null;
//   occurred_on: string | null;
//   created_at: string;
// };

// export default async function ImpactPage() {
//   const supabase = await createSupabaseServer();

//   const { data, error } = await supabase
//     .from('impact_records')
//     .select('*')
//     .order('occurred_on', { ascending: false, nullsFirst: false });

//   if (error) {
//     return (
//       <div className="text-[#f85149] text-sm">
//         Failed to load Impact Records: {error.message}
//       </div>
//     );
//   }

//   return <ImpactClient records={(data ?? []) as ImpactRecord[]} />;
// }
