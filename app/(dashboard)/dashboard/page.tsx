import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardV2Page() {
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

  const { data: squadConfig } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
  const myTeamTag = squadConfig?.my_team_tag?.toUpperCase() || 'RMD';

  const { data: { user } } = await supabase.auth.getUser();
  let loggedUser = { id: 'dev', role: 'analista', puuid: 'TESTE', name: 'HEAD COACH', photo: `https://ui-avatars.com/api/?name=C&background=18181b&color=3b82f6` };

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) {
      loggedUser = {
        id: user.id, role: profile.role || 'jogador', puuid: profile.puuid || '',
        name: profile.full_name || 'JOGADOR', photo: profile.photo_url || `https://ui-avatars.com/api/?name=${profile.full_name || 'User'}&background=18181b&color=3b82f6`
      };
    }
  }

  // --- FILTRO INTELIGENTE DE DATA (Evita baixar anos de dados mortos) ---
  const cutoffDateObj = new Date();
  cutoffDateObj.setMonth(cutoffDateObj.getMonth() - 4); // Limita aos últimos 4 meses
  const cutoffDate = cutoffDateObj.toISOString().split('T')[0];

  // --- BUSCA ULTRARRÁPIDA (Com os índices do banco ativados) ---
  const [
    { data: playerStats }, { data: radarStats }, { data: h2hStats }, { data: roster },
    { data: teams }, { data: rawMatches }, { data: rawMissions }, { data: rawScrims }, { data: teamWellness }
  ] = await Promise.all([
    // Filtrado pela equipe
    supabase.from('vw_dashboard_player_stats').select('*').ilike('team_acronym', `%${myTeamTag}%`),
    supabase.from('vw_dashboard_radar_stats').select('*').ilike('team_acronym', `%${myTeamTag}%`),
    supabase.from('vw_dashboard_h2h_stats').select('*'), // H2H já costuma ser leve
    
    supabase.from('bff_admin_players').select('*'),
    supabase.from('bff_admin_teams').select('*'),
    
    // Filtrado pela equipe (Azul ou Vermelho) E com limite de carga
    supabase.from('bff_matches_history')
      .select('*')
      .or(`blue_team_tag.ilike.%${myTeamTag}%,red_team_tag.ilike.%${myTeamTag}%`)
      .order('game_start_time', { ascending: false })
      .limit(150), 
    
    // Scrims e Missões limitadas à equipe e aos últimos 4 meses
    supabase.from('missions')
      .select('*')
      .ilike('team_acronym', `%${myTeamTag}%`)
      .gte('mission_date', cutoffDate),
      
    supabase.from('scrim_reports')
      .select('*')
      .ilike('team_acronym', `%${myTeamTag}%`)
      .gte('scrim_date', cutoffDate),
      
    // Wellness limitado apenas aos últimos registros úteis
    supabase.from('player_wellness').select('*').order('record_date', { ascending: false }).limit(100)
  ]);

  const activeRoster = (roster || []).filter((p: any) => String(p.team_acronym || p.team || '').toUpperCase().includes(myTeamTag));
  const myPlayerInfo = activeRoster.find((p: any) => String(p.puuid).toLowerCase() === String(loggedUser.puuid).toLowerCase());
  
  if (myPlayerInfo) { 
      loggedUser.name = myPlayerInfo.nickname || myPlayerInfo.name || loggedUser.name; 
      if (myPlayerInfo.photo_url) loggedUser.photo = myPlayerInfo.photo_url; 
  }

  // --- TARGET INTEL NO SERVIDOR ---
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const safeMissions = rawMissions || [];
  const upcoming = safeMissions
    .filter((m: any) => m.mission_date >= todayStr)
    .sort((a: any, b: any) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`));
  
  const targetMission = upcoming.find((m: any) => m.mission_type === 'OFFICIAL') || upcoming[0];
  let targetIntelData = { team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [], date: null };

  if (targetMission) {
     const nextOp = targetMission.opponent_acronym;
     const [picksRes, bansRes, carryRes, kpisRes, objRes] = await Promise.all([
        supabase.from('dash_view_target_picks').select('*').ilike('team_acronym', `%${nextOp}%`).order('total_picks', { ascending: false }).limit(3),
        supabase.from('dash_view_target_bans').select('*').ilike('team_acronym', `%${nextOp}%`).order('total_bans', { ascending: false }).limit(3),
        supabase.from('dash_view_target_carry').select('*').ilike('team_acronym', `%${nextOp}%`).single(),
        supabase.from('dash_view_target_kpis').select('*').ilike('team_acronym', `%${nextOp}%`).single(),
        supabase.from('bff_hub_objectives').select('objective_type, avg_minute').ilike('team_acronym', `%${nextOp}%`)
     ]);

     let topPicks = picksRes.data ? picksRes.data.map((p:any) => ({ name: p.champion, winRate: p.win_rate, isFlex: p.is_flex, roles: p.roles, isBlind: p.is_blind })) : [];
     let topBans = bansRes.data ? bansRes.data.map((b:any) => ({ name: b.champion })) : [];
     
     const winConditions: any[] = [];
     if (kpisRes.data) {
         const { blue_games, blue_wins, red_games, red_wins, avg_lane } = kpisRes.data;
         const bWR = blue_games > 0 ? Math.round((blue_wins/blue_games)*100) : 0;
         const rWR = red_games > 0 ? Math.round((red_wins/red_games)*100) : 0;
         if (blue_games > 0 || red_games > 0) winConditions.push({ type: 'wr', blue: bWR, red: rWR });
         if (avg_lane) winConditions.push({ type: avg_lane >= 50 ? 'early' : 'scaling', text: avg_lane >= 50 ? `Early Game Forte (Lane Score: ${Math.round(avg_lane)})` : `Estilo Scaling (Lane Score: ${Math.round(avg_lane)})` });
     }
     if (carryRes.data) winConditions.push({ type: 'pressure', text: `Foco de Pressão: Anular ${String(carryRes.data.primary_role).toUpperCase()} (${carryRes.data.nickname})`, player: carryRes.data });
     
     if (objRes && objRes.data) {
         const firstDrake = objRes.data.find((o:any) => o.objective_type === 'DRAGON' && o.avg_minute > 4 && o.avg_minute < 10);
         const firstGrubs = objRes.data.find((o:any) => o.objective_type === 'HORDE' || o.objective_type === 'GRUBS');
         if (firstDrake || firstGrubs) winConditions.push({ type: 'macro', drakeTime: firstDrake ? Number(firstDrake.avg_minute).toFixed(1) : '-', grubsTime: firstGrubs ? Number(firstGrubs.avg_minute).toFixed(1) : '-' });
     }
     if (winConditions.length === 0) winConditions.push({ type: 'empty', text: 'Aguardando coleta de dados.' });

     targetIntelData = { team: nextOp, topPicks, topBans, winConditions, date: targetMission.mission_date as any };
  }

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
      preloadedTargetIntel={targetIntelData} 
    />
  );
}