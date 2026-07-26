// app/(dashboard)/dashboard-v2/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import DashboardClient from './DashboardClient';

// Garante que o painel mostre sempre os dados mais recentes (sem cache estático)
export const dynamic = 'force-dynamic';

export default async function DashboardV2Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  // 1. Resolvemos a Promise dos cookies (exigência do Next.js 15+)
  const cookieStore = await cookies();
  
  // 2. Criamos o cliente mapeando os métodos manualmente para satisfazer o TypeScript
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // O try/catch é obrigatório em Server Components ao setar cookies
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // O try/catch é obrigatório em Server Components ao remover cookies
        }
      },
    },
  });

  // 3. Busca a Configuração do Squad (Para saber a tag do time: RMD)
  const { data: squadConfig } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
  const myTeamTag = squadConfig?.my_team_tag?.toUpperCase() || 'RMD';

  // 4. Busca e monta o Perfil do Usuário Logado
  const { data: { user } } = await supabase.auth.getUser();
  let loggedUser = { 
    id: 'dev', 
    role: 'analista', 
    puuid: 'TESTE', 
    name: 'HEAD COACH', 
    photo: `https://ui-avatars.com/api/?name=C&background=18181b&color=3b82f6` 
  };

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) {
      loggedUser = {
        id: user.id,
        role: profile.role || 'jogador',
        puuid: profile.puuid || '',
        name: profile.full_name || 'JOGADOR',
        photo: profile.photo_url || `https://ui-avatars.com/api/?name=${profile.full_name || 'User'}&background=18181b&color=3b82f6`
      };
    }
  }

  // 5. O GRANDE SALTO DE PERFORMANCE: Promessas Paralelas
  // Buscamos os dados das nossas Novas Views (agregadas) e as tabelas de suporte ao mesmo tempo
  const [
    { data: playerStats },
    { data: radarStats },
    { data: h2hStats },
    { data: roster },
    { data: teams },
    { data: rawMatches },
    { data: rawMissions },
    { data: rawScrims },
    { data: teamWellness }
  ] = await Promise.all([
    supabase.from('vw_dashboard_player_stats').select('*'), // Nossa Nova View
    supabase.from('vw_dashboard_radar_stats').select('*'),  // Nossa Nova View
    supabase.from('vw_dashboard_h2h_stats').select('*'),    // Nossa Nova View
    supabase.from('bff_admin_players').select('*'),
    supabase.from('bff_admin_teams').select('*'),
    
    // Para o histórico, o limite diminuiu drasticamente porque não calculamos mais coisas pesadas na UI
    supabase.from('bff_matches_history').select('*').order('game_start_time', { ascending: false }).limit(2000), 
    
    supabase.from('missions').select('*'),
    supabase.from('scrim_reports').select('*'),
    supabase.from('player_wellness').select('*').order('record_date', { ascending: false }).limit(500)
  ]);

  // 6. Ajusta o nome/foto do usuário caso ele esteja no Roster
  const activeRoster = (roster || []).filter((p: any) => String(p.team_acronym || p.team || '').toUpperCase().includes(myTeamTag));
  const myPlayerInfo = activeRoster.find((p: any) => String(p.puuid).toLowerCase() === String(loggedUser.puuid).toLowerCase());
  
  if (myPlayerInfo) { 
      loggedUser.name = myPlayerInfo.nickname || myPlayerInfo.name || loggedUser.name; 
      if (myPlayerInfo.photo_url) loggedUser.photo = myPlayerInfo.photo_url; 
  }

  // 7. Passa TUDO limpo e mastigado para o Frontend (DashboardClient) renderizar
  return (
    <DashboardClient 
      sessionUser={loggedUser}
      squadConfig={squadConfig || {}}
      playerStats={playerStats || []}
      radarStats={radarStats || []}
      h2hStats={h2hStats || []}
      roster={activeRoster}
      teams={teams || []}
      rawMatches={rawMatches || []}
      rawMissions={rawMissions || []}
      rawScrims={rawScrims || []}
      teamWellness={teamWellness || []}
    />
  );
}