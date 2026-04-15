"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { processMatchIntelligence } from '@/lib/services/analytics';
import Link from 'next/link';

const DDRAGON_VERSION = '16.5.1';

// --- TRITURADOR DE STRINGS ---
function normalizeChampName(name: string | null): string {
  if (!name) return 'unknown';
  let n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'wukong') return 'monkeyking';
  if (n === 'renataglasc') return 'renata';
  if (n.includes('nunu')) return 'nunu';
  return n;
}

// --- IMAGENS ---
function getChampionIconUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  if (sanitized.toLowerCase() === 'drmundo') sanitized = 'DrMundo';
  if (sanitized.toLowerCase() === 'renataglasc') sanitized = 'Renata';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  if (sanitized.toLowerCase() === 'drmundo') sanitized = 'DrMundo';
  if (sanitized.toLowerCase() === 'renataglasc') sanitized = 'Renata';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sanitized}_0.jpg`;
}

function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const safeDate = String(dateString).trim().replace(' ', 'T');
  const time = new Date(safeDate.includes('T') && !safeDate.includes('Z') && !safeDate.includes('-') && !safeDate.includes('+') ? `${safeDate}Z` : safeDate).getTime();
  return isNaN(time) ? 0 : time;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  
  const [drafts, setDrafts] = useState<Record<string, any[]>>({});
  const [playerStats, setPlayerStats] = useState<Record<string, any[]>>({}); 
  const [globalBans, setGlobalBans] = useState<Record<string, number>>({}); 
  const [loadingDrafts, setLoadingDrafts] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [globalTournament, setGlobalTournament] = useState("ALL");
  const [globalSplit, setGlobalSplit] = useState("ALL");

  useEffect(() => { fetchMatches(); }, []);

  async function fetchMatches() {
    try {
      setLoading(true);
      
      const [viewRes, matchesRes, bansRes] = await Promise.all([
        supabase.from('view_matches_with_teams').select('*').limit(50000),
        supabase.from('matches').select('id, game_start_time, game_type, split, series_id').limit(50000),
        supabase.from('view_champion_ban_stats').select('*').limit(200) 
      ]);
      
      if (viewRes.data && matchesRes.data) {
        const matchMeta: Record<string, any> = {};
        matchesRes.data.forEach(m => { matchMeta[m.id] = m; });

        const enrichedData = viewRes.data.map(v => {
           const mId = v.match_id || v.id;
           const meta = matchMeta[mId] || {};
           return {
              ...v,
              game_start_time: meta.game_start_time,
              game_type: meta.game_type || v.game_type,
              split: meta.split || v.split,
              series_id: meta.series_id || v.series_id
           };
        });

        const sortedData = enrichedData.sort((a, b) => 
          getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time)
        );
        
        setMatches(sortedData);

        if (bansRes.data) {
           const totalMatches = matchesRes.data.length || 1;
           const banMap: Record<string, number> = {};
           bansRes.data.forEach(b => {
              const rate = (Number(b.total_bans) / totalMatches) * 100;
              banMap[normalizeChampName(b.champion)] = Number(rate.toFixed(1));
           });
           setGlobalBans(banMap);
        }
      }
    } catch (err) {
      console.error("Falha ao carregar partidas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDraftsAndStatsForMatches(matchIds: string[]) {
    try {
      const missingIds = matchIds.filter(id => !drafts[id]);
      if (missingIds.length === 0) return;

      setLoadingDrafts(missingIds[0]); 

      const [draftsResponse, statsResponse] = await Promise.all([
         supabase.from('match_drafts').select('*').in('match_id', missingIds).limit(10000),
         supabase.from('player_stats_detailed').select('match_id, champion, summoner_name, lane_rating, impact_rating, conversion_rating, vision_rating').in('match_id', missingIds).limit(10000)
      ]);
      
      if (draftsResponse.data) {
        setDrafts(prev => {
          const next = { ...prev };
          missingIds.forEach(id => {
            next[id] = draftsResponse.data.filter(d => d.match_id === id).sort((a, b) => Number(a.sequence) - Number(b.sequence));
          });
          return next;
        });
      }

      if (statsResponse.data) {
         setPlayerStats(prev => {
            const next = { ...prev };
            missingIds.forEach(id => {
               next[id] = statsResponse.data.filter(s => s.match_id === id);
            });
            return next;
         });
      }
    } catch (err) {
      console.error("Falha ao carregar drafts/stats:", err);
    } finally {
      setLoadingDrafts(null);
    }
  }

  const toggleSeries = (series: any) => {
    if (expandedSeries === series.id) {
      setExpandedSeries(null);
    } else {
      setExpandedSeries(series.id);
      fetchDraftsAndStatsForMatches(series.games.map((g: any) => g.id || g.match_id));
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const gameType = String(m.game_type || '').toUpperCase().trim();
      const isScrim = gameType === 'SCRIM';
      
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;
      if (!isScrim && globalTournament !== 'ALL' && gameType !== globalTournament.toUpperCase()) return false;
      if (globalSplit !== 'ALL' && String(m.split || '').toUpperCase() !== globalSplit.toUpperCase()) return false;

      return true;
    });
  }, [matches, matchType, globalTournament, globalSplit]);

  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    filteredMatches.forEach(m => {
      let sId = m.series_id;
      let desc = m.series_description || `${m.game_type || 'UNKNOWN'} - ${m.split || ''}`;
      
      const blueTag = m.blue_team_tag || m.blue_tag || 'BLU';
      const redTag = m.red_team_tag || m.red_tag || 'RED';

      const gameType = String(m.game_type || '').toUpperCase().trim();
      const isScrim = gameType === 'SCRIM';
      
      if (isScrim) {
        let dateRaw = 'unknown-date';
        
        if (m.game_start_time) {
            const d = new Date(String(m.game_start_time).replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
               d.setHours(d.getHours() - 3); 
               const year = d.getFullYear();
               const month = String(d.getMonth() + 1).padStart(2, '0');
               const day = String(d.getDate()).padStart(2, '0');
               dateRaw = `${year}-${month}-${day}`;
            }
        }
        
        const teamsSorted = [blueTag, redTag].sort().join('-');
        sId = `SCRIM_${dateRaw}_${teamsSorted}`;
        const dateBR = dateRaw !== 'unknown-date' ? dateRaw.split('-').reverse().join('/') : dateRaw;
        desc = `BLOCO DE SCRIMS - ${dateBR}`;
      } else {
        sId = sId || `solo_${m.id || m.match_id}`;
      }

      if (!groups[sId]) {
        groups[sId] = {
          id: sId,
          description: desc,
          isScrim: isScrim,
          tournament: gameType, // Adicionando o nome do campeonato para o header
          logicalDate: m.game_start_time, 
          games: [],
          teamA: { tag: blueTag, logo: m.blue_logo },
          teamB: { tag: redTag, logo: m.red_logo },
          scoreA: 0, scoreB: 0
        };
      }
      
      groups[sId].games.push(m);
      
      const rawWinner = String(m.winner_side || '').toLowerCase().trim();
      const isBlueWin = rawWinner === 'blue' || rawWinner === '100';
      const isRedWin = rawWinner === 'red' || rawWinner === '200';

      if (isBlueWin) groups[sId].scoreA++;
      else if (isRedWin) groups[sId].scoreB++;
    });

    return Object.values(groups).sort((a: any, b: any) => {
      return getSafeTimestamp(b.logicalDate) - getSafeTimestamp(a.logicalDate);
    });
  }, [filteredMatches]);

  const stats = useMemo(() => {
    const total = filteredMatches.length;
    const blueWins = filteredMatches.filter(m => {
        const w = String(m.winner_side || '').toLowerCase().trim();
        return w === 'blue' || w === '100';
    }).length;
    
    const redWins = filteredMatches.filter(m => {
        const w = String(m.winner_side || '').toLowerCase().trim();
        return w === 'red' || w === '200';
    }).length;

    return {
      totalSeries: groupedSeries.length,
      totalGames: total,
      blueWR: total ? Math.round((blueWins / total) * 100) : 0,
      redWR: total ? Math.round((redWins / total) * 100) : 0
    };
  }, [groupedSeries, filteredMatches]);

  const handleProcessAnalytics = async (match_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(match_id);
    try { await processMatchIntelligence(match_id); } 
    catch (err: any) { alert("ERRO: " + err.message); } 
    finally { setProcessingId(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh]">
      <p className="text-zinc-500 font-mono text-sm tracking-widest uppercase animate-pulse">Consultando Banco de Dados...</p>
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 font-sans pb-20">
      
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10 pb-8 border-b border-zinc-800/80">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">MATCH HISTORY</h1>
            <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest mt-1">Séries, Scrims e Draft Analytics</p>
          </div>
          
          <div className="flex gap-3 items-center z-50">
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 items-center">
              <button onClick={() => {setMatchType('ALL'); setGlobalTournament('ALL')}} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-colors ${matchType === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>TODOS</button>
              <button onClick={() => setMatchType('OFICIAL')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-colors ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>OFICIAL</button>
              <button onClick={() => {setMatchType('SCRIM'); setGlobalTournament('ALL')}} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-colors ${matchType === 'SCRIM' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>SCRIMS</button>
            </div>

            {matchType !== 'SCRIM' && <TournamentSelector value={globalTournament} onChange={setGlobalTournament} />}
            <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
          </div>
        </div>

        <div className="flex gap-4 md:gap-8 flex-wrap items-center">
          <div className="text-right">
             <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">SÉRIES REGISTRADAS</p>
             <p className="text-3xl font-black text-white leading-none">{stats.totalSeries}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">TOTAL DE JOGOS</p>
             <p className="text-3xl font-black text-white leading-none">{stats.totalGames}</p>
          </div>
          
          <div className="flex flex-col border-l border-zinc-800 pl-6 ml-2">
             <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-2">WR POR LADO (MAPA)</span>
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                   <span className="text-blue-500 font-bold text-xs">BLUE</span>
                   <span className="text-white font-black text-sm">{stats.blueWR}%</span>
                </div>
                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                   <div className="h-full bg-blue-500" style={{ width: `${stats.blueWR}%` }}></div>
                   <div className="h-full bg-red-500" style={{ width: `${stats.redWR}%` }}></div>
                </div>
                <div className="flex flex-col items-start">
                   <span className="text-red-500 font-bold text-xs">RED</span>
                   <span className="text-white font-black text-sm">{stats.redWR}%</span>
                </div>
             </div>
          </div>
        </div>
      </header>

      {groupedSeries.length === 0 && (
         <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-20 flex flex-col items-center justify-center text-center">
           <h3 className="text-xl text-zinc-400 font-bold">Nenhum dado encontrado</h3>
           <p className="text-xs text-zinc-600 mt-2 max-w-md">Não há séries registradas para os filtros atuais. Verifique o Split ou Campeonato selecionado.</p>
         </div>
      )}

      <div className="flex flex-col gap-3">
        {groupedSeries.map((series: any) => {
          const isBlueWin = series.scoreA > series.scoreB;
          const isRedWin = series.scoreB > series.scoreA;
          const barColor = isBlueWin ? 'bg-blue-500' : isRedWin ? 'bg-red-500' : 'bg-zinc-600';

          return (
            <div key={series.id} className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors">
              
              <div onClick={() => toggleSeries(series)} className="flex items-stretch cursor-pointer">
                
                <div className={`w-1.5 flex-shrink-0 ${barColor}`}></div>

                <div className="flex-1 flex flex-col md:flex-row items-center justify-between p-4 px-6 gap-6">
                   
                   <div className="flex flex-col w-full md:w-1/3">
                      <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase">
                         {series.isScrim ? 'TREINO / SCRIM' : (series.tournament ? series.tournament.replace(/_/g, ' ') : 'OFICIAL')}
                      </span>
                      <span className="text-sm font-bold text-zinc-200 mt-0.5 truncate">{series.description}</span>
                   </div>

                   <div className="flex items-center gap-6 justify-center flex-1">
                      <div className="flex items-center gap-3 justify-end w-24">
                        <span className={`text-base font-black ${isBlueWin ? 'text-white' : 'text-zinc-500'}`}>{series.teamA.tag}</span>
                        {series.teamA.logo ? <img src={series.teamA.logo} className="w-8 h-8 object-contain" alt="" /> : <div className="w-8 h-8 bg-zinc-800 rounded-md"></div>}
                      </div>

                      <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-900 rounded-md border border-zinc-800">
                        <span className={`text-xl font-black ${isBlueWin ? 'text-blue-500' : 'text-zinc-400'}`}>{series.scoreA}</span>
                        <span className="text-zinc-600 text-xs font-bold">-</span>
                        <span className={`text-xl font-black ${isRedWin ? 'text-red-500' : 'text-zinc-400'}`}>{series.scoreB}</span>
                      </div>

                      <div className="flex items-center gap-3 justify-start w-24">
                        {series.teamB.logo ? <img src={series.teamB.logo} className="w-8 h-8 object-contain" alt="" /> : <div className="w-8 h-8 bg-zinc-800 rounded-md"></div>}
                        <span className={`text-base font-black ${isRedWin ? 'text-white' : 'text-zinc-500'}`}>{series.teamB.tag}</span>
                      </div>
                   </div>

                   <div className="flex items-center justify-end w-full md:w-1/3 gap-4">
                      <div className="flex gap-1">
                         {[...series.games].sort((a, b) => getSafeTimestamp(a.game_start_time) - getSafeTimestamp(b.game_start_time)).map((g: any, i: number) => {
                            const rWin = String(g.winner_side || '').toLowerCase().trim();
                            const isBLU = rWin === 'blue' || rWin === '100';
                            return (
                               <div key={i} className={`w-3 h-3 rounded-sm ${isBLU ? 'bg-blue-500' : 'bg-red-500'}`} title={`Game ${i+1}: ${isBLU ? 'Blue' : 'Red'} win`}></div>
                            );
                         })}
                      </div>
                      <div className="text-zinc-600 ml-2">
                         {expandedSeries === series.id ? '▲' : '▼'}
                      </div>
                   </div>
                </div>
              </div>

              {expandedSeries === series.id && (
                <div className="bg-zinc-950 border-t border-zinc-800 p-4 md:p-6 flex flex-col gap-4">
                  {[...series.games]
                    .sort((a:any, b:any) => getSafeTimestamp(a.game_start_time) - getSafeTimestamp(b.game_start_time))
                    .map((game: any, idx: number) => {
                      
                      const matchId = game.id || game.match_id;
                      const gameDrafts = drafts[matchId] || [];
                      const gameStats = playerStats[matchId] || []; 
                      const gameNum = idx + 1;
                      
                      const picksOnly = [...gameDrafts].filter(d => String(d.tipo).toUpperCase() === 'PICK').sort((a, b) => Number(a.sequence) - Number(b.sequence));
                      const firstPickSide = picksOnly.length > 0 ? picksOnly[0].side?.toLowerCase() : null;
                      const lastPickSide = firstPickSide === 'blue' ? 'red' : firstPickSide === 'red' ? 'blue' : null;

                      const bluePicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                      const blueBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);
                      const redPicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                      const redBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);

                      const rWin = String(game.winner_side || '').toLowerCase().trim();
                      const gameIsBlueWin = rWin === 'blue' || rWin === '100';

                      return (
                        <div key={matchId} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative">
                          
                          <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-3">
                               <span className="bg-zinc-800 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded">GAME {gameNum}</span>
                               <span className="text-xs text-zinc-500 font-mono hidden md:block">ID: {matchId}</span>
                             </div>
                             <div className="flex items-center gap-2">
                               {gameIsBlueWin ? (
                                 <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">BLUE WIN</span>
                               ) : (
                                 <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">RED WIN</span>
                               )}
                               <button onClick={(e) => handleProcessAnalytics(matchId, e)} className="text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition-colors uppercase">
                                 {processingId === matchId ? 'SYNCING...' : 'SYNC DATA'}
                               </button>
                               <Link href={`/dashboard/matches/${matchId}`} className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded transition-colors uppercase">
                                 REPORT COMPLETO →
                               </Link>
                             </div>
                          </div>

                          {gameDrafts.length === 0 ? (
                            <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-950/50 rounded-md border border-zinc-800 border-dashed">
                               {loadingDrafts === matchId ? 'Carregando draft...' : 'Nenhum draft registrado nesta partida.'}
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-950 p-4 rounded-md border border-zinc-800/80">
                               
                               {/* === LADO AZUL === */}
                               <div className="flex flex-col gap-3 flex-1 w-full md:w-auto">
                                  <div className="flex items-center justify-between px-1">
                                     <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-blue-500 uppercase">{game.blue_team_tag || game.blue_tag || 'BLUE TEAM'}</span>
                                        {firstPickSide === 'blue' && <span className="text-[7px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.8)]">1ST PICK</span>}
                                        {lastPickSide === 'blue' && <span className="text-[7px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.8)]">COUNTER</span>}
                                     </div>
                                     <div className="flex gap-1.5">
                                        {blueBans.map((b, i) => {
                                          const normChamp = normalizeChampName(b.champion);
                                          const banR = globalBans[normChamp] || 0;
                                          return (
                                            <div key={i} className="relative group/ban">
                                              <img src={getChampionIconUrl(b.champion)} className="w-8 h-8 rounded-[4px] object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all border border-zinc-700 cursor-help" alt={b.champion} />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] p-2 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-2xl flex flex-col items-center gap-1 transition-all duration-200">
                                                 <span className="font-black uppercase tracking-widest text-zinc-300">{b.champion}</span>
                                                 <span className="font-mono text-amber-500">{banR}% BAN RATE</span>
                                                 <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-700"></div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                     </div>
                                  </div>
                                  <div className="flex gap-1.5 justify-start">
                                     {bluePicks.map((p, i) => {
                                        const pStat = gameStats.find(s => normalizeChampName(s.champion) === normalizeChampName(p.champion)) || {};
                                        const pName = pStat.summoner_name || 'UNKNOWN';
                                        const ratLane = Number(pStat.lane_rating || 0).toFixed(1);
                                        const ratImp = Number(pStat.impact_rating || 0).toFixed(1);
                                        const ratConv = Number(pStat.conversion_rating || 0).toFixed(1);
                                        const ratVis = Number(pStat.vision_rating || 0).toFixed(1);

                                        return (
                                          <div key={i} className="flex-1 relative h-28 md:h-36 rounded-lg overflow-hidden group/card border border-zinc-800 hover:border-blue-500 transition-all">
                                             <img src={getChampionSplashUrl(p.champion)} className="absolute inset-0 w-full h-full object-cover object-[center_20%] transition-transform duration-500 group-hover/card:scale-110 group-hover/card:blur-[2px]" alt={p.champion} />
                                             
                                             <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-6 z-10 transition-opacity duration-300 group-hover/card:opacity-0">
                                               <p className="text-[10px] text-white font-black truncate drop-shadow-md text-center uppercase tracking-wider">{pName}</p>
                                             </div>

                                             <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-1.5 gap-2 z-20">
                                                <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest text-center truncate w-full">{pName}</span>
                                                <div className="grid grid-cols-1 gap-y-1 text-[9px] w-full px-1">
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">LAN</span><span className="text-white font-mono font-bold">{ratLane}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">IMP</span><span className="text-white font-mono font-bold">{ratImp}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">CON</span><span className="text-white font-mono font-bold">{ratConv}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">VIS</span><span className="text-white font-mono font-bold">{ratVis}</span></div>
                                                </div>
                                             </div>
                                          </div>
                                        );
                                     })}
                                     {Array.from({length: Math.max(0, 5 - bluePicks.length)}).map((_, i) => (
                                        <div key={`empty-b-${i}`} className="flex-1 relative h-28 md:h-36 bg-zinc-800 rounded-md border border-zinc-700"></div>
                                     ))}
                                  </div>
                               </div>

                               <div className="hidden md:flex flex-col items-center justify-center px-2">
                                  <span className="text-[10px] font-black text-zinc-600">VS</span>
                               </div>

                               {/* === LADO VERMELHO === */}
                               <div className="flex flex-col gap-3 flex-1 w-full md:w-auto">
                                  <div className="flex items-center justify-between px-1">
                                     <div className="flex gap-1.5">
                                        {redBans.map((b, i) => {
                                          const normChamp = normalizeChampName(b.champion);
                                          const banR = globalBans[normChamp] || 0;
                                          return (
                                            <div key={i} className="relative group/ban">
                                              <img src={getChampionIconUrl(b.champion)} className="w-8 h-8 rounded-[4px] object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all border border-zinc-700 cursor-help" alt={b.champion} />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] p-2 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-2xl flex flex-col items-center gap-1 transition-all duration-200">
                                                 <span className="font-black uppercase tracking-widest text-zinc-300">{b.champion}</span>
                                                 <span className="font-mono text-amber-500">{banR}% BAN RATE</span>
                                                 <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-700"></div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                     </div>
                                     <div className="flex items-center gap-2">
                                        {firstPickSide === 'red' && <span className="text-[7px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.8)]">1ST PICK</span>}
                                        {lastPickSide === 'red' && <span className="text-[7px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.8)]">COUNTER</span>}
                                        <span className="text-xs font-black text-red-500 uppercase text-right">{game.red_team_tag || game.red_tag || 'RED TEAM'}</span>
                                     </div>
                                  </div>
                                  <div className="flex gap-1.5 justify-end">
                                     {redPicks.map((p, i) => {
                                        const pStat = gameStats.find(s => normalizeChampName(s.champion) === normalizeChampName(p.champion)) || {};
                                        const pName = pStat.summoner_name || 'UNKNOWN';
                                        const ratLane = Number(pStat.lane_rating || 0).toFixed(1);
                                        const ratImp = Number(pStat.impact_rating || 0).toFixed(1);
                                        const ratConv = Number(pStat.conversion_rating || 0).toFixed(1);
                                        const ratVis = Number(pStat.vision_rating || 0).toFixed(1);

                                        return (
                                          <div key={i} className="flex-1 relative h-28 md:h-36 rounded-lg overflow-hidden group/card border border-zinc-800 hover:border-red-500 transition-all">
                                             <img src={getChampionSplashUrl(p.champion)} className="absolute inset-0 w-full h-full object-cover object-[center_20%] transition-transform duration-500 group-hover/card:scale-110 group-hover/card:blur-[2px]" alt={p.champion} />
                                             
                                             <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-6 z-10 transition-opacity duration-300 group-hover/card:opacity-0">
                                               <p className="text-[10px] text-white font-black truncate drop-shadow-md text-center uppercase tracking-wider">{pName}</p>
                                             </div>

                                             <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-1.5 gap-2 z-20">
                                                <span className="text-[8px] text-red-400 font-black uppercase tracking-widest text-center truncate w-full">{pName}</span>
                                                <div className="grid grid-cols-1 gap-y-1 text-[9px] w-full px-1">
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">LAN</span><span className="text-white font-mono font-bold">{ratLane}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">IMP</span><span className="text-white font-mono font-bold">{ratImp}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">CON</span><span className="text-white font-mono font-bold">{ratConv}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-500 tracking-widest">VIS</span><span className="text-white font-mono font-bold">{ratVis}</span></div>
                                                </div>
                                             </div>
                                          </div>
                                        );
                                     })}
                                     {Array.from({length: Math.max(0, 5 - redPicks.length)}).map((_, i) => (
                                        <div key={`empty-r-${i}`} className="flex-1 relative h-28 md:h-36 bg-zinc-800 rounded-md border border-zinc-700"></div>
                                     ))}
                                  </div>
                               </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CockpitDropdown({ label, value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const currentLabel = options.find((o:any) => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col" ref={ref}>
      {label && <label className="text-[9px] text-zinc-500 font-bold mb-1 ml-1">{label}</label>}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-md flex items-center justify-between gap-4 min-w-[140px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase"
      >
        <span className="flex-1 text-left">{currentLabel}</span>
        <span className={`text-[8px] text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden shadow-xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar">
          {options.map((opt:any) => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === opt.id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
            >
              <span className="text-[10px] font-bold uppercase">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="CAMPEONATO" value={value} onChange={onChange} options={[
    { id: 'ALL', label: 'TODOS OS CAMPEONATOS' }, { id: 'AMERICAS_CUP', label: 'AMERICAS CUP' },
    { id: 'CBLOL', label: 'CBLOL' }, { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
    { id: 'EMEA_MASTERS', label: 'EMEA MASTERS' }, { id: 'FIRST_STAND', label: 'FIRST STAND' },
    { id: 'LCK', label: 'LCK' }, { id: 'LCS', label: 'LCS' }, { id: 'LEC', label: 'LEC' },
    { id: 'LPL', label: 'LPL' }, { id: 'MSI', label: 'MSI' }, { id: 'MUNDIAL', label: 'MUNDIAL' }
  ]} />
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="TIMELINE" value={value} onChange={onChange} options={[
    { id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, 
    { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }
  ]} />
}