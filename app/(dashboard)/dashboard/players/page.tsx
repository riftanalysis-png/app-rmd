// app/(dashboard)/players-v2/page.tsx
import PlayersHubClient from './PlayersHubClient';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PlayersHubPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { session } } = await supabase.auth.getSession();
  const isAdmin = session?.user?.email === 'scartiezin@gmail.com';

  return (
     <PlayersHubClient isAdmin={isAdmin} />
  );
}