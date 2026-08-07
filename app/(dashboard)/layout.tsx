import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import DashboardLayoutClient from './DashboardLayoutClient';
import { createServerSupabaseClient, isStaffRole } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/Login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, photo_url')
    .eq('id', user.id)
    .maybeSingle();

  const { data: config } = await supabase
    .from('squad_config')
    .select('my_team_tag')
    .limit(1)
    .maybeSingle();

  const defaultTeamLogo = 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/90/RMD_Gaminglogo_square.png';
  let teamLogo = defaultTeamLogo;

  if (config?.my_team_tag) {
    const { data: teamData } = await supabase
      .from('teams')
      .select('logo_url')
      .eq('acronym', String(config.my_team_tag).toUpperCase())
      .maybeSingle();

    if (teamData?.logo_url) {
      teamLogo = teamData.logo_url;
    }
  }

  const userName = profile?.full_name || user.user_metadata?.full_name || 'JOGADOR DESCONHECIDO';
  const userRole = profile?.role || user.user_metadata?.role || 'JOGADOR';
  const userPhoto = profile?.photo_url || '';
  const canAccessAdmin = isStaffRole(userRole);

  return (
    <DashboardLayoutClient
      initialUserName={userName}
      initialUserRole={userRole}
      initialUserPhoto={userPhoto}
      initialTeamLogo={teamLogo}
      canAccessAdmin={canAccessAdmin}
    >
      {children}
    </DashboardLayoutClient>
  );
}
