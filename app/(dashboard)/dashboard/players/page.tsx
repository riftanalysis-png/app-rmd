// app/(dashboard)/players-v2/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import PlayersHubClient from './PlayersHubClient';

export const dynamic = 'force-dynamic';

export default async function PlayersHubPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(name: string, value: string, options: any) { try { cookieStore.set({ name, value, ...options }); } catch (error) {} },
      remove(name: string, options: any) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) {} },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();
  const isAdmin = session?.user?.email === 'scartiezin@gmail.com';

  return (
     <PlayersHubClient isAdmin={isAdmin} />
  );
}