"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const DDRAGON_VERSION = '16.5.1';

// Funções utilitárias
function normalizeChampName(name: string | null): string {
  if (!name) return 'unknown';
  let n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'wukong') return 'monkeyking';
  if (n === 'renataglasc') return 'renata';
  if (n.includes('nunu')) return 'nunu';
  return n;
}

function getChampionIconUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777') return '';
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sanitized}_0.jpg`;
}

function getOverallColor(score: number | string | null | undefined) {
  const val = Number(score ?? 0);
  if (val === 0) return "text-zinc-600";
  if (val >= 9.0 || val >= 90) return "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"; 
  if (val >= 8.0 || val >= 80) return "text-white";                                                
  if (val >= 7.0 || val >= 70) return "text-zinc-300";                                             
  if (val >= 6.0 || val >= 60) return "text-zinc-500";                                             
  return "text-red-500/70";                                                                        
}

const ROLE_ORDER: Record<string, number> = {
  top: 1, 
  jng: 2, jungle: 2, 
  mid: 3, middle: 3, 
  adc: 4, bottom: 4, bot: 4, 
  sup: 5, support: 5, utility: 5
};

function getRoleOrder(player: any) {
  const normLane = String(player.lane || '').toLowerCase().trim();
  const normRole = String(player.role || player.primary_role || '').toLowerCase().trim();
  if (normLane === 'bottom' && normRole.includes('support')) return 5;
  if (normLane === 'bottom' && normRole.includes('carry')) return 4;
  return ROLE_ORDER[normLane] || ROLE_ORDER[normRole] || 99;
}

export default function MatchDetailsPage() {
  const params = useParams();
  const matchId = params.match_id as string;

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [teamInfo, setTeamInfo] = useState<Record<string, any>>({});
  const [seriesMatches, setSeriesMatches] = useState<any[]>([]);
  
  const [hoverStats, setHoverStats] = useState<{ teamMatches: any, bans: any, players: any }>({ teamMatches: {}, bans: {}, players: {} });

  useEffect(() => {
    if (matchId) fetchMatchDetails();
  }, [matchId]);

  async function fetchMatchDetails() {
    try {
      setLoading(true);
      
      const [matchRes, draftsRes, statsRes, teamsRes] = await Promise.all([
        supabase.from('bff_matches_history').select('*').eq('match_id', matchId).single(),
        supabase.from('match_drafts').select('*').eq('match_id', matchId).order('sequence', { ascending: true }),
        supabase.from('core_player_stats').select('*').eq('match_id', matchId),
        supabase.from('bff_matches_teams').select('*')
      ]);

      if (matchRes.data) {
        setMatchData(matchRes.data);
        const currentMatch = matchRes.data;
        let sMatches: any[] = [];

        if (currentMatch.series_id) {
           const { data } = await supabase.from('bff_matches_history')
              .select('match_id, game_start_time, winner_side, blue_team_tag, red_team_tag')
              .eq('series_id', currentMatch.series_id)
              .order('game_start_time', { ascending: true });
           if (data) sMatches = data;
        } else {
           const isScrim = String(currentMatch.game_type).toUpperCase().includes('SCRIM');
           if (isScrim && currentMatch.game_start_time) {
              const dateOnly = String(currentMatch.game_start_time).substring(0, 10);
              const { data } = await supabase.from('bff_matches_history')
                 .select('match_id, game_start_time, winner_side, blue_team_tag, red_team_tag')
                 .ilike('game_type', '%SCRIM%')
                 .gte('game_start_time', `${dateOnly}T00:00:00Z`)
                 .lte('game_start_time', `${dateOnly}T23:59:59Z`);

              if (data) {
                 const teamA = currentMatch.blue_team_tag || currentMatch.blue_tag;
                 const teamB = currentMatch.red_team_tag || currentMatch.red_tag;
                 sMatches = data.filter((m: any) => {
                    const mTeamA = m.blue_team_tag || m.blue_tag;
                    const mTeamB = m.red_team_tag || m.red_tag;
                    return (mTeamA === teamA && mTeamB === teamB) || (mTeamA === teamB && mTeamB === teamA);
                 }).sort((a: any, b: any) => new Date(a.game_start_time).getTime() - new Date(b.game_start_time).getTime());
              }
           }
        }
        setSeriesMatches(sMatches);

        // PRE-FETCH DO HOVER DE DRAFT
        const blueTag = currentMatch.blue_team_tag || currentMatch.blue_tag;
        const redTag  = currentMatch.red_team_tag || currentMatch.red_tag;
        const puuids  = (statsRes.data || []).map((p:any) => p.puuid).filter(Boolean);
        const names   = (statsRes.data || []).map((p:any) => p.summoner_name || p.player_name).filter(Boolean);

        let playerQuery = supabase.from('bff_player_matches').select('puuid, nickname, champion, is_win, lane_rating, impact_rating, conversion_rating, vision_rating, perf_score');
        if (puuids.length > 0) playerQuery = playerQuery.in('puuid', puuids);
        else playerQuery = playerQuery.in('nickname', names);

        const [teamStatsRes, teamBansRes, playerHistRes] = await Promise.all([
           supabase.from('bff_dashboard_team_stats').select('team_acronym, side').in('team_acronym', [blueTag, redTag]),
           supabase.from('bff_hub_draft').select('team_acronym, champion, side, total_count').in('team_acronym', [blueTag, redTag]).eq('type', 'BAN'),
           playerQuery.limit(10000)
        ]);

        const tMatches: any = { [blueTag]: { total: 0, blue: 0, red: 0 }, [redTag]: { total: 0, blue: 0, red: 0 } };
        if (teamStatsRes.data) {
           teamStatsRes.data.forEach((r:any) => {
              const t = r.team_acronym;
              const s = String(r.side).toLowerCase();
              if (tMatches[t]) {
                 tMatches[t].total++;
                 if (s === 'blue') tMatches[t].blue++;
                 if (s === 'red') tMatches[t].red++;
              }
           });
        }

        const tBans: any = { [blueTag]: {}, [redTag]: {} };
        if (teamBansRes.data) {
           teamBansRes.data.forEach((b:any) => {
              const t = b.team_acronym;
              const c = b.champion;
              if (!tBans[t]) tBans[t] = {};
              if (!tBans[t][c]) tBans[t][c] = { total: 0, blue: 0, red: 0 };
              tBans[t][c].total += b.total_count;
              if (String(b.side).toLowerCase() === 'blue') tBans[t][c].blue += b.total_count;
              if (String(b.side).toLowerCase() === 'red') tBans[t][c].red += b.total_count;
           });
        }

        const pHist: any = {};
        if (playerHistRes.data) {
           playerHistRes.data.forEach((m:any) => {
              const pId = m.puuid || m.nickname;
              const c = m.champion;
              if (!pHist[pId]) pHist[pId] = { totalGames: 0, champs: {} };
              pHist[pId].totalGames++;
              
              if (!pHist[pId].champs[c]) pHist[pId].champs[c] = { games: 0, wins: 0, sumLan: 0, sumImp: 0, sumCon: 0, sumVis: 0, sumOvr: 0 };
              const ch = pHist[pId].champs[c];
              
              ch.games++;
              if (m.is_win) ch.wins++;
              ch.sumLan += Number(m.lane_rating || 0);
              ch.sumImp += Number(m.impact_rating || 0);
              ch.sumCon += Number(m.conversion_rating || 0);
              ch.sumVis += Number(m.vision_rating || 0);
              ch.sumOvr += Number(m.perf_score || ((Number(m.lane_rating||0)+Number(m.impact_rating||0)+Number(m.conversion_rating||0)+Number(m.vision_rating||0))/4) || 0);
           });
        }

        setHoverStats({ teamMatches: tMatches, bans: tBans, players: pHist });
      }
      
      if (draftsRes.data) setDrafts(draftsRes.data);
      if (statsRes.data) {
        const sortedStats = statsRes.data.sort((a, b) => getRoleOrder(a) - getRoleOrder(b));
        setPlayerStats(sortedStats);
      }

      if (teamsRes.data) {
        const tDict: Record<string, any> = {};
        teamsRes.data.forEach((t: any) => tDict[t.acronym] = t);
        setTeamInfo(tDict);
      }

    } catch (err) {
      console.error("Erro ao carregar detalhes da partida:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-4">
      <div className="w-10 h-10 border-4 border-zinc-800 border-t-amber-500 rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">Gerando Intelligence Report...</p>
    </div>
  );

  if (!matchData) return <div className="text-white text-center mt-20 font-mono tracking-widest">Partida não encontrada.</div>;

  const rWin = String(matchData.winner_side || '').toLowerCase().trim();
  const isBlueWin = rWin === 'blue' || rWin === '100';
  
  const blueTeam = teamInfo[matchData.blue_team_tag || matchData.blue_tag] || { acronym: matchData.blue_team_tag || 'BLU', name: matchData.blue_name, logo_url: matchData.blue_logo };
  const redTeam = teamInfo[matchData.red_team_tag || matchData.red_tag] || { acronym: matchData.red_team_tag || 'RED', name: matchData.red_name, logo_url: matchData.red_logo };

  const blueStats = playerStats.filter(s => String(s.side).toLowerCase() === 'blue');
  const redStats = playerStats.filter(s => String(s.side).toLowerCase() === 'red');

  const blueTotalDpm = blueStats.reduce((acc, curr) => acc + Number(curr.dpm || 0), 0);
  const redTotalDpm = redStats.reduce((acc, curr) => acc + Number(curr.dpm || 0), 0);
  const maxDpm = Math.max(...playerStats.map(s => Number(s.dpm || 0)), 1);

  const winningTeamStats = isBlueWin ? blueStats : redStats;
  let mvpIdentifier: string | null = null;
  if (winningTeamStats.length > 0) {
     const mvpPlayer = winningTeamStats.reduce((max, p) => {
        const pScore = Number(p.perf_score || ((Number(p.lane_rating||0)+Number(p.impact_rating||0)+Number(p.conversion_rating||0)+Number(p.vision_rating||0))/4));
        const maxScore = Number(max.perf_score || ((Number(max.lane_rating||0)+Number(max.impact_rating||0)+Number(max.conversion_rating||0)+Number(max.vision_rating||0))/4));
        return pScore > maxScore ? p : max;
     }, winningTeamStats[0]);
     mvpIdentifier = mvpPlayer?.puuid || mvpPlayer?.summoner_name || mvpPlayer?.player_name;
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 font-sans pb-20 relative">
      
      <nav className="mb-8 flex items-center justify-between">
        <Link href="/dashboard/matches" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
          <span>← Voltar para Histórico</span>
        </Link>
        <div className="text-right">
          <span className="text-[10px] text-zinc-500 tracking-widest font-mono block">MATCH ID</span>
          <span className="text-sm font-black text-zinc-300">{matchId}</span>
        </div>
      </nav>

      {seriesMatches.length > 1 && (
        <div className="flex flex-col items-center justify-center mb-6 z-20 relative">
           <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Partidas nesta Série</span>
           <div className="flex flex-wrap items-center justify-center gap-2 bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md">
              {seriesMatches.map((m, idx) => {
                 const isCurrent = m.match_id === matchId;
                 const rawWin = String(m.winner_side || '').toLowerCase().trim();
                 const isBlueW = rawWin === 'blue' || rawWin === '100';
                 
                 const winnerTag = isBlueW ? (m.blue_team_tag || 'BLU') : (m.red_team_tag || 'RED');
                 const winnerTeam = teamInfo[winnerTag];
                 const dotColor = isBlueW ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';

                 return (
                    <Link
                      key={m.match_id}
                      href={`/dashboard/matches/${m.match_id}`}
                      className={`group relative flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300 ${isCurrent ? 'bg-zinc-800 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] pointer-events-none' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer'}`}
                    >
                       <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${isCurrent ? 'text-amber-500' : 'text-zinc-400 group-hover:text-white'}`}>
                         GAME {idx + 1}
                       </span>
                       
                       {winnerTeam?.logo_url ? (
                         <img src={winnerTeam.logo_url} alt={winnerTag} className="w-5 h-5 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                       ) : (
                         <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                       )}
                       
                       {!isCurrent && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 flex items-center gap-1.5 shadow-xl">
                             {winnerTeam?.logo_url && <img src={winnerTeam.logo_url} className="w-3 h-3 object-contain" alt="" />}
                             <span className="font-bold">{winnerTeam?.name || winnerTag} WINS</span>
                          </div>
                       )}
                    </Link>
                 )
              })}
           </div>
        </div>
      )}

      <div className={`relative bg-zinc-950 border rounded-2xl p-8 mb-8 overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 ${isBlueWin ? 'border-blue-900/50' : 'border-red-900/50'}`}>
        <div className={`absolute -top-24 ${isBlueWin ? '-left-24 bg-blue-600/20' : '-right-24 bg-red-600/20'} w-96 h-96 rounded-full blur-3xl pointer-events-none`}></div>

        <div className="flex flex-col items-center md:items-start z-10 w-full md:w-1/3">
          <span className="text-[10px] font-black tracking-widest uppercase text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 mb-4">{matchData.game_type} - {matchData.split}</span>
          <div className="flex items-center gap-4">
            {blueTeam.logo_url && <img src={blueTeam.logo_url} alt="Blue Team" className="w-16 h-16 object-contain drop-shadow-xl" />}
            <div className="flex flex-col">
              <span className="text-blue-500 font-black text-sm tracking-widest">BLUE SIDE</span>
              <span className="text-4xl font-black text-white" title={blueTeam.name}>{blueTeam.acronym}</span>
            </div>
          </div>
          {isBlueWin && <span className="mt-4 bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.5)]">VICTORY</span>}
        </div>

        <div className="flex flex-col items-center justify-center z-10 text-center">
          <span className="text-zinc-600 font-mono text-xs tracking-widest uppercase mb-2">VS</span>
          {playerStats[0]?.game_duration && (
             <>
               <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Duração</span>
               <span className="text-xl font-mono text-white bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                 {Math.floor(playerStats[0].game_duration / 60)}:{(playerStats[0].game_duration % 60).toString().padStart(2, '0')}
               </span>
             </>
          )}
        </div>

        <div className="flex flex-col items-center md:items-end z-10 w-full md:w-1/3 text-right">
          <div className="flex items-center gap-4 flex-row-reverse">
            {redTeam.logo_url && <img src={redTeam.logo_url} alt="Red Team" className="w-16 h-16 object-contain drop-shadow-xl" />}
            <div className="flex flex-col items-end">
              <span className="text-red-500 font-black text-sm tracking-widest">RED SIDE</span>
              <span className="text-4xl font-black text-white" title={redTeam.name}>{redTeam.acronym}</span>
            </div>
          </div>
          {!isBlueWin && <span className="mt-4 bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.5)]">VICTORY</span>}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="mb-10 relative z-50">
          <h2 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            Timeline do Draft
          </h2>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-2 sm:p-4 md:p-6 relative">
            <div className="relative w-full">
               {/* Linha escondida no mobile, com espaçamento lateral seguro no desktop */}
               <div className="hidden md:block absolute top-1/2 left-4 right-4 h-px bg-zinc-800 -translate-y-1/2 z-0"></div>

               {/* Container 100% fluido: justify-between e flex-1 nos filhos distribuem perfeitamente */}
               <div className="flex flex-nowrap justify-between gap-1 md:gap-2 py-6 -my-6 relative z-10 items-center w-full">
                  {drafts.map((action, idx) => {
                     const isBlue = action.side?.toLowerCase() === 'blue';
                     const isBan = String(action.tipo || action.action_type).toUpperCase() === 'BAN';
                     const teamTag = isBlue ? blueTeam.acronym : redTeam.acronym;
                     
                     let tooltipContent = null;
                     
                     // ... Lógica JS de tooltip (mantida 100% igual)
                     if (isBan) {
                        const tMatches = hoverStats.teamMatches[teamTag] || { total: 1, blue: 1, red: 1 };
                        const bStats = hoverStats.bans[teamTag]?.[action.champion] || { total: 0, blue: 0, red: 0 };
                        
                        const totalPct = ((bStats.total / Math.max(tMatches.total, 1)) * 100).toFixed(1);
                        const sidePct = isBlue 
                            ? ((bStats.blue / Math.max(tMatches.blue, 1)) * 100).toFixed(1)
                            : ((bStats.red / Math.max(tMatches.red, 1)) * 100).toFixed(1);

                        tooltipContent = (
                           <div className="w-56 p-3 bg-zinc-950 border border-zinc-700 shadow-2xl rounded-lg text-[10px]">
                              <span className="text-zinc-500 font-black tracking-widest block border-b border-zinc-800 pb-2 mb-2">BANIDO POR {teamTag}</span>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-zinc-400 font-bold uppercase">Ban Rate (Geral):</span> 
                                <span className="text-white font-mono bg-zinc-900 px-1.5 py-0.5 rounded">{totalPct}%</span>
                              </div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-zinc-400 font-bold uppercase">Ban ({isBlue ? 'Blue' : 'Red'} Side):</span> 
                                <span className="text-white font-mono bg-zinc-900 px-1.5 py-0.5 rounded">{sidePct}%</span>
                              </div>
                              <span className="text-[8px] text-zinc-600 uppercase tracking-widest mt-2 block pt-2 border-t border-zinc-800/50 text-right">Base: Histórico do Time</span>
                           </div>
                        );
                     } else {
                        const player = playerStats.find(p => p.champion === action.champion && String(p.side).toLowerCase() === (isBlue ? 'blue' : 'red'));
                        const pId = player?.puuid || player?.summoner_name || player?.player_name;
                        const pHist = hoverStats.players[pId];
                        
                        if (pHist && pHist.champs[action.champion]) {
                           const ch = pHist.champs[action.champion];
                           const wr = ((ch.wins / ch.games) * 100).toFixed(1);
                           const pr = ((ch.games / pHist.totalGames) * 100).toFixed(1);
                           const aLan = (ch.sumLan / ch.games).toFixed(1);
                           const aImp = (ch.sumImp / ch.games).toFixed(1);
                           const aCon = (ch.sumCon / ch.games).toFixed(1);
                           const aVis = (ch.sumVis / ch.games).toFixed(1);
                           const aOvr = (ch.sumOvr / ch.games).toFixed(1);

                           tooltipContent = (
                              <div className="w-64 p-3 bg-zinc-950 border border-zinc-700 shadow-2xl rounded-lg text-[10px]">
                                 <span className="text-zinc-500 font-black tracking-widest block border-b border-zinc-800 pb-2 mb-2 truncate">
                                   <span className={isBlue ? 'text-blue-500' : 'text-red-500'}>{player?.player_name || player?.summoner_name || 'UNKNOWN'}</span> 
                                   <span className="text-zinc-600"> COM </span>{action.champion}
                                 </span>
                                 <div className="grid grid-cols-2 gap-2 mb-3">
                                   <div className="bg-zinc-900 p-1.5 rounded flex flex-col items-center border border-zinc-800/50">
                                     <span className="text-[8px] text-zinc-500 uppercase font-bold">Win Rate</span>
                                     <span className="text-white font-mono">{wr}%</span>
                                   </div>
                                   <div className="bg-zinc-900 p-1.5 rounded flex flex-col items-center border border-zinc-800/50">
                                     <span className="text-[8px] text-zinc-500 uppercase font-bold">Pick Rate</span>
                                     <span className="text-white font-mono">{pr}%</span>
                                   </div>
                                 </div>
                                 <div className="grid grid-cols-5 gap-1 text-center font-mono border border-zinc-800 bg-zinc-900/50 rounded p-1">
                                     <div className="flex flex-col items-center"><span className="text-[7px] text-zinc-500 font-bold">LAN</span><span className="text-blue-400">{aLan}</span></div>
                                     <div className="flex flex-col items-center"><span className="text-[7px] text-zinc-500 font-bold">IMP</span><span className="text-emerald-400">{aImp}</span></div>
                                     <div className="flex flex-col items-center"><span className="text-[7px] text-zinc-500 font-bold">CON</span><span className="text-amber-400">{aCon}</span></div>
                                     <div className="flex flex-col items-center"><span className="text-[7px] text-zinc-500 font-bold">VIS</span><span className="text-purple-400">{aVis}</span></div>
                                     <div className="flex flex-col items-center bg-zinc-800/50 rounded w-full"><span className="text-[7px] text-zinc-500 font-bold">OVR</span><span className={getOverallColor(aOvr)}>{aOvr}</span></div>
                                 </div>
                                 <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-800/50">
                                   <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Base: Histórico Pessoal</span>
                                   <span className="text-[8px] text-zinc-500 font-mono bg-zinc-900 px-1 rounded border border-zinc-800">{ch.games} Jogos</span>
                                 </div>
                              </div>
                           );
                        } else {
                           tooltipContent = (
                              <div className="w-48 p-3 bg-zinc-950 border border-zinc-700 shadow-2xl rounded-lg text-[10px]">
                                 <span className="text-zinc-500 font-black tracking-widest block mb-1 truncate">
                                   {player?.player_name || player?.summoner_name || 'UNKNOWN'} COM {action.champion}
                                 </span>
                                 <span className="text-zinc-600 text-[9px] uppercase tracking-widest font-bold border-t border-zinc-800 pt-2 block">Sem histórico registrado.</span>
                              </div>
                           )
                        }
                     }
                     
                     return (
                        <div key={idx} className="flex flex-col items-center justify-center h-28 md:h-32 relative group/pick cursor-help z-10 flex-1 min-w-0 max-w-[48px]">
                           {isBlue && !isBan && <span className="text-[7px] md:text-[8px] font-black uppercase mb-1 md:mb-2 px-1 rounded text-blue-500">PICK</span>}
                           {isBlue && isBan && <span className="text-[7px] md:text-[8px] font-black uppercase mb-1 md:mb-2 px-1 rounded text-zinc-500">BAN</span>}
                           
                           <div className={`relative transform transition-transform ${!isBlue ? 'mt-auto' : 'mb-auto'}`}>
                              {/* Classes de Width/Height responsivas, elas encolhem sozinhas se a tela diminuir */}
                              <img 
                                src={getChampionIconUrl(action.champion)} 
                                alt={action.champion}
                                className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 object-cover border-2 shadow-md transition-all 
                                  ${isBan ? 'grayscale opacity-50 rounded-full border-zinc-700' : 'rounded-md border-zinc-500 group-hover/pick:border-white'}
                                  ${isBlue && !isBan ? 'border-blue-500' : ''} 
                                  ${!isBlue && !isBan ? 'border-red-500' : ''}`}
                              />
                           </div>

                           {!isBlue && isBan && <span className="text-[7px] md:text-[8px] font-black uppercase mt-1 md:mt-2 px-1 rounded text-zinc-500">BAN</span>}
                           {!isBlue && !isBan && <span className="text-[7px] md:text-[8px] font-black uppercase mt-1 md:mt-2 px-1 rounded text-red-500">PICK</span>}

                           {/* TOOLTIP BLINDADO: Z-INDEX 99999 e sem interferência de caixas */}
                           <div className={`absolute ${isBlue ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 opacity-0 group-hover/pick:opacity-100 transition-all duration-200 pointer-events-none z-[99999] scale-95 group-hover/pick:scale-100 origin-[center_${isBlue ? 'top' : 'bottom'}]`}>
                              {tooltipContent}
                           </div>
                        </div>
                     )
                  })}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARAÇÃO DE EQUIPES (SCOREBOARD) */}
      <div className="flex flex-col gap-8 relative z-0">
        
        {/* === TIME AZUL === */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end border-b border-blue-900/30 pb-2 px-2">
            <h3 className="text-xl font-black text-blue-500 uppercase tracking-tight">{blueTeam.name || blueTeam.acronym}</h3>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Desempenho Blue Side</span>
          </div>
          
          <div className="flex flex-col gap-1.5 overflow-x-auto custom-scrollbar pb-2">
            <div className="flex text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-4 py-2 min-w-[860px]">
               <div className="w-[200px]">Jogador</div>
               <div className="w-[100px] text-center">KDA</div>
               <div className="flex-1 text-left px-4">Impacto em Luta (DPM / % Time)</div>
               <div className="w-[300px] text-right flex justify-end gap-5 pr-2">
                  <span className="w-8 text-center text-blue-500/70">LAN</span>
                  <span className="w-8 text-center text-emerald-500/70">IMP</span>
                  <span className="w-8 text-center text-amber-500/70">CON</span>
                  <span className="w-8 text-center text-purple-500/70">VIS</span>
                  <div className="w-px h-3 bg-zinc-800 mx-1"></div>
                  <span className="w-12 text-center text-zinc-300">OVR</span>
               </div>
            </div>

            {blueStats.map((p, i) => (
              <PlayerPerformanceRow 
                 key={i} player={p} maxDpm={maxDpm} teamTotalDpm={blueTotalDpm} teamColor="blue" 
                 isMvp={(p.puuid || p.summoner_name || p.player_name) === mvpIdentifier} 
              />
            ))}
          </div>
        </div>

        {/* === TIME VERMELHO === */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end border-b border-red-900/30 pb-2 px-2 mt-4">
            <h3 className="text-xl font-black text-red-500 uppercase tracking-tight">{redTeam.name || redTeam.acronym}</h3>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Desempenho Red Side</span>
          </div>
          
          <div className="flex flex-col gap-1.5 overflow-x-auto custom-scrollbar pb-2">
            {redStats.map((p, i) => (
              <PlayerPerformanceRow 
                 key={i} player={p} maxDpm={maxDpm} teamTotalDpm={redTotalDpm} teamColor="red" 
                 isMvp={(p.puuid || p.summoner_name || p.player_name) === mvpIdentifier} 
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: LINHA DE PERFORMANCE DO JOGADOR
// ==========================================
function PlayerPerformanceRow({ player, maxDpm, teamTotalDpm, teamColor, isMvp }: { player: any, maxDpm: number, teamTotalDpm: number, teamColor: 'blue' | 'red', isMvp: boolean }) {
  const isBlue = teamColor === 'blue';
  
  const dpm = Number(player.dpm || 0);
  const dmgPercentVal = teamTotalDpm > 0 ? (dpm / teamTotalDpm) * 100 : 0;
  const dpmPercentageToMax = maxDpm > 0 ? (dpm / maxDpm) * 100 : 0;
  
  const kills = player.kills ?? 0;
  const deaths = player.deaths ?? 0;
  const assists = player.assists ?? 0;

  const kdaText = `${kills}/${deaths}/${assists}`;
  const kdaRatio = deaths === 0 ? 'Perfeito' : ((kills + assists) / deaths).toFixed(2);

  const overallScore = Number(player.perf_score || ((Number(player.lane_rating||0) + Number(player.impact_rating||0) + Number(player.conversion_rating||0) + Number(player.vision_rating||0)) / 4) || 0);

  const splashUrl = getChampionSplashUrl(player.champion);
  
  return (
    <div className={`relative group flex items-center bg-zinc-900 border ${isMvp ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] z-10' : (isBlue ? 'border-zinc-800 hover:border-blue-500/50' : 'border-zinc-800 hover:border-red-500/50')} rounded-lg overflow-hidden transition-colors h-16 min-w-[860px]`}>
      
      {isMvp && (
        <div className="absolute top-0 left-0 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-br-lg shadow-[0_0_10px_rgba(245,158,11,0.8)] z-50 border-r border-b border-amber-300 tracking-widest">
           MVP
        </div>
      )}

      <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none">
         <img src={splashUrl} className="w-full h-full object-cover object-[center_20%]" alt="" />
         <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/90 to-zinc-950"></div>
      </div>

      <div className="relative z-10 flex items-center w-full px-4 gap-4">
        
        <div className="flex items-center gap-3 w-[200px] shrink-0 pl-1">
          <img src={getChampionIconUrl(player.champion)} className="w-10 h-10 rounded border border-zinc-700 shadow-md" alt={player.champion} />
          <div className="flex flex-col">
            <span className={`text-sm font-black tracking-tight uppercase truncate ${isMvp ? 'text-amber-400' : 'text-white'}`} title={player.player_name || player.summoner_name}>{player.player_name || player.summoner_name || 'UNKNOWN'}</span>
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">{player.lane}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center w-[100px] shrink-0">
          <span className="text-sm font-mono font-bold text-white tracking-wider">{kdaText}</span>
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">{kdaRatio} KDA</span>
        </div>

        <div className="flex-1 flex flex-col justify-center px-4">
          <div className="flex justify-between items-end mb-1.5">
             <span className="text-xs font-mono font-bold text-zinc-300">{Math.round(dpm)} DPM</span>
             <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{dmgPercentVal.toFixed(1)}% do Time</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
             <div 
               className={`h-full rounded-full transition-all duration-1000 ${isBlue ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} 
               style={{ width: `${dpmPercentageToMax}%` }}
             ></div>
          </div>
        </div>

        <div className="w-[300px] shrink-0 flex justify-end gap-5 font-mono text-sm bg-zinc-950/50 py-2 px-3 rounded border border-zinc-800/50 mr-2 items-center">
          <span className="text-blue-500 w-8 text-center" title="Lane Rating">{Number(player.lane_rating || 0).toFixed(1)}</span>
          <span className="text-emerald-500 w-8 text-center" title="Impact Rating">{Number(player.impact_rating || 0).toFixed(1)}</span>
          <span className="text-amber-500 w-8 text-center" title="Conversion Rating">{Number(player.conversion_rating || 0).toFixed(1)}</span>
          <span className="text-purple-500 w-8 text-center" title="Vision Rating">{Number(player.vision_rating || 0).toFixed(1)}</span>
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>
          <span className={`${getOverallColor(overallScore)} w-12 text-center font-black text-base transition-colors`} title="Overall Performance">{overallScore.toFixed(1)}</span>
        </div>

      </div>
    </div>
  );
}