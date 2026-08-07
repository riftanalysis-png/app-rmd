import { createServerClient, type CookieOptions } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignore cookie write failures in Server Components during prerender.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Ignore cookie removal failures in Server Components during prerender.
          }
        },
      },
    }
  );
}

export function isStaffRole(role?: string | null): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return ['analista', 'treinador', 'diretor', 'coach', 'head coach'].includes(normalizedRole);
}
