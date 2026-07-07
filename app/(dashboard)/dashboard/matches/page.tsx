"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { processMatchIntelligence } from '@/lib/services/analytics';
import Link from 'next/link';

const DDRAGON_VERSION = '16.5.1';

// --- CLASSIFICADOR DE CAMPEONATOS ---
function normalizeTournamentScope(rawName: string | null): string {
  const name = String(rawName || '').toUpperCase();
  if (name.includes('SCRIM')) return 'SCRIM';
  if (name.includes('CBLOL') && (name.includes('ACADEMY') || name.includes('DESAFIANTE'))) return 'CIRCUITO DESAFIANTE';
  if (name.includes('CIRCUITO DESAFIANTE') || name.includes('LIGA IGNIS')) return 'CIRCUITO DESAFIANTE';
  if (name.includes('LCK') && (name.includes('CHALLENGERS') || name.includes(' CL'))) return 'LCK CHALLENGERS';
  if (name.includes('LCS') && (name.includes('CHALLENGERS') || name.includes('NACL'))) return 'LCS CHALLENGERS';
  if (name.includes('EMEA') && name.includes('MASTERS')) return 'EMEA MASTERS';
  
  if (name.includes('CBLOL') && name.includes('CUP')) return 'CBLOL CUP';
  if (name.includes('LCK') && name.includes('CUP')) return 'LCK CUP';
  if (name.includes('LCS') && name.includes('CUP')) return 'LCS CUP';
  if (name.includes('LEC') && name.includes('CUP')) return 'LEC CUP';

  if (name.includes('CBLOL')) return 'CBLOL';
  if (name.includes('LCK')) return 'LCK';
  if (name.includes('LCS')) return 'LCS';
  if (name.includes('LEC')) return 'LEC';
  if (name.includes('LPL')) return 'LPL';

  if (name.includes('EWC') && (name.includes('QUALIFIER') || name.includes('CLOSED') || name.includes('OPEN') || name.includes('CQ'))) return 'EWC QUALIFIER';
  if (name.includes('EWC') || name.includes('ESPORTS WORLD CUP')) return 'EWC';
  if (name.includes('WORLD CUP') || name.includes('COPA DO MUNDO') || name.includes('NATIONS')) return 'WORLD CUP';
  if (name.includes('AMERICAS CUP')) return 'AMERICAS CUP';
  if (name.includes('FIRST STAND')) return 'FIRST STAND';
  if (name.includes('MSI') || name.includes('MID SEASON')) return 'MSI';
  if (name.includes('WORLDS') || name.includes('MUNDIAL')) return 'MUNDIAL';

  return 'OUTRO';
}

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
  
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${sanitized}_0.jpg`;
}

function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const safeDate = String(dateString).trim().replace(' ', 'T');
  const time = new Date(safeDate.includes('T') && !safeDate.includes('Z') && !safeDate.includes('-') && !safeDate.includes('+') ? `${safeDate}Z` : safeDate).getTime();
  return isNaN(time) ? 0 : time;
}

function getScoreColor(score: number | null) {
  if (!score) return "text-zinc-600";
  if (score >= 90) return "text-purple-500"; 
  if (score >= 80) return "text-blue-500";     
  if (score >= 70) return "text-emerald-500"; 
  if (score >= 60) return "text-amber-500";  
  return "text-red-500";                                 
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  
  const [drafts, setDrafts] = useState<Record<string, any[]>>({});
  const [playerStats, setPlayerStats] = useState<Record<string, any[]>>({}); 
  const [globalBans, setGlobalBans] = useState<Record<string, number>>({}); 
  const [teamsDict, setTeamsDict] = useState<Record<string, string>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);

  // Estados de Filtro (Circuito Desafiante como Padrão)
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [globalTournament, setGlobalTournament] = useState("CIRCUITO DESAFIANTE");
  const [globalSplit, setGlobalSplit] = useState("ALL");
  const [validSplitsMap, setValidSplitsMap] = useState<Record<string, string[]>>({});

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Resetar página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [matchType, globalTournament, globalSplit]);

  useEffect(() => {
    async function loadSplitsMap() {
      const { data } = await supabase.from('bff_matches_history').select('game_type, split');
      if (data) {
        const map: Record<string, Set<string>> = {};
        data.forEach((d: any) => {
          if (d.game_type && d.split) {
            const scope = normalizeTournamentScope(d.game_type);
            if (!map[scope]) map[scope] = new Set();
            map[scope].add(d.split.trim().toUpperCase());
          }
        });
        const finalMap: Record<string, string[]> = {};
        for (const k in map) finalMap[k] = Array.from(map[k]);
        setValidSplitsMap(finalMap);
      }
    }
    loadSplitsMap();
  }, []);

  useEffect(() => { fetchMatches(); }, []);

  const dynamicAvailableSplits = useMemo(() => {
    if (globalTournament === 'ALL') {
      return ['CUP', 'SPLIT 1', 'SPLIT 2', 'SPLIT 3', 'EVENTO GLOBAL', 'OFF-SEASON'];
    }
    if (validSplitsMap[globalTournament]) {
      const order = ['CUP', 'SPLIT 1', 'SPLIT 2', 'SPLIT 3', 'EVENTO GLOBAL', 'OFF-SEASON'];
      return validSplitsMap[globalTournament].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    return [];
  }, [globalTournament, validSplitsMap]);

  useEffect(() => {
    if (globalSplit !== 'ALL' && dynamicAvailableSplits.length > 0 && !dynamicAvailableSplits.includes(globalSplit)) {
      setGlobalSplit('ALL');
    }
  }, [dynamicAvailableSplits, globalSplit]);

  async function fetchMatches() {
    try {
      setLoading(true);
      
      const [viewRes, bansRes, teamsRes] = await Promise.all([
        supabase.from('bff_matches_history').select('*').limit(50000),
        supabase.from('bff_matches_bans').select('*').limit(200),
        supabase.from('bff_matches_teams').select('*') 
      ]);

      if (teamsRes.data) {
        const tDict: Record<string, string> = {};
        teamsRes.data.forEach((t: any) => tDict[t.acronym] = t.name || t.acronym);
        setTeamsDict(tDict);
      }
      
      if (viewRes.data) {
        const enrichedData = viewRes.data.map((v: any) => ({
           ...v,
           normalized_scope: normalizeTournamentScope(v.game_type),
        }));

        const sortedData = enrichedData.sort((a, b) => 
          getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time)
        );
        
        setMatches(sortedData);

        if (bansRes.data) {
           const totalMatches = viewRes.data.length || 1;
           const banMap: Record<string, number> = {};
           bansRes.data.forEach((b: any) => {
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
         supabase.from('bff_matches_stats_expanded').select('*').in('match_id', missingIds).limit(10000)
      ]);
      
      if (draftsResponse.data) {
        setDrafts(prev => {
          const next = { ...prev };
          missingIds.forEach(id => {
            next[id] = draftsResponse.data.filter((d: any) => d.match_id === id).sort((a: any, b: any) => Number(a.sequence) - Number(b.sequence));
          });
          return next;
        });
      }

      if (statsResponse.data) {
         setPlayerStats(prev => {
            const next = { ...prev };
            missingIds.forEach(id => {
               next[id] = statsResponse.data.filter((s: any) => s.match_id === id);
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
      fetchDraftsAndStatsForMatches(series.games.map((g: any) => g.match_id));
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const scope = m.normalized_scope || 'OUTRO';
      const isScrim = scope === 'SCRIM';
      
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;
      if (!isScrim && globalTournament !== 'ALL' && scope !== globalTournament) return false;
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

      const isScrim = m.normalized_scope === 'SCRIM';
      
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
        sId = sId || `solo_${m.match_id}`;
      }

      if (!groups[sId]) {
        groups[sId] = {
          id: sId,
          description: desc,
          isScrim: isScrim,
          tournament: m.game_type, 
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

      let winningTag = null;
      if (isBlueWin) winningTag = blueTag;
      else if (isRedWin) winningTag = redTag;

      if (winningTag === groups[sId].teamA.tag) groups[sId].scoreA++;
      else if (winningTag === groups[sId].teamB.tag) groups[sId].scoreB++;
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

  // Recorte da paginação
  const paginatedSeries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return groupedSeries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [groupedSeries, currentPage]);

  const totalPages = Math.ceil(groupedSeries.length / ITEMS_PER_PAGE);

  const handleProcessAnalytics = async (match_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(match_id);
    try { await processMatchIntelligence(match_id); } 
    catch (err: any) { alert("ERRO: " + err.message); } 
    finally { setProcessingId(null); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-4">
      <div className="w-10 h-10 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">Sincronizando Histórico de Partidas...</p>
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 font-sans pb-20 relative">
      
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10 pb-6 pt-4 border-b border-zinc-800/80 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-[999] rounded-b-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] px-2 -mx-2">
        <div className="flex flex-col gap-5 w-full xl:w-auto">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">MATCH HISTORY</h1>
            <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest mt-1">Séries, Scrims e Draft Analytics</p>
          </div>
          
          <div className="flex gap-3 items-center z-50 flex-wrap">
            <div className="flex bg-zinc-900 p-1.5 rounded-lg border border-zinc-800 items-center">
              <button onClick={() => {setMatchType('ALL'); setGlobalTournament('ALL')}} className={`px-4 py-2 rounded-md text-[10px] font-bold transition-colors uppercase tracking-widest ${matchType === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>TODOS</button>
              <button onClick={() => setMatchType('OFICIAL')} className={`px-4 py-2 rounded-md text-[10px] font-bold transition-colors uppercase tracking-widest ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>OFICIAL</button>
              <button onClick={() => {setMatchType('SCRIM'); setGlobalTournament('ALL')}} className={`px-4 py-2 rounded-md text-[10px] font-bold transition-colors uppercase tracking-widest ${matchType === 'SCRIM' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>SCRIMS</button>
            </div>

            {matchType !== 'SCRIM' && <TournamentSelector value={globalTournament} onChange={setGlobalTournament} />}
            <SplitSelector value={globalSplit} onChange={setGlobalSplit} availableSplits={dynamicAvailableSplits} />
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
                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
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

      {paginatedSeries.length === 0 && (
         <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-20 flex flex-col items-center justify-center text-center shadow-sm">
           <h3 className="text-xl text-zinc-400 font-bold tracking-tight uppercase">Nenhum dado encontrado</h3>
           <p className="text-xs text-zinc-600 mt-2 max-w-md tracking-widest uppercase">Não há séries registradas para os filtros atuais. Verifique o Split ou Campeonato selecionado.</p>
         </div>
      )}

      <div className="flex flex-col gap-3">
        {paginatedSeries.map((series: any) => {
          const isTeamAWin = series.scoreA > series.scoreB;
          const isTeamBWin = series.scoreB > series.scoreA;
          
          let blueSideWins = 0;
          let redSideWins = 0;

          series.games.forEach((g: any) => {
             const rWin = String(g.winner_side || '').toLowerCase().trim();
             if (rWin === 'blue' || rWin === '100') blueSideWins++;
             else if (rWin === 'red' || rWin === '200') redSideWins++;
          });

          let barColor = 'bg-zinc-800';
          let barTitle = 'Série Empatada / Neutra';

          if (blueSideWins > redSideWins) {
             barColor = 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
             barTitle = `Blue Side Dominante (${blueSideWins} vitórias)`;
          } else if (redSideWins > blueSideWins) {
             barColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
             barTitle = `Red Side Dominante (${redSideWins} vitórias)`;
          }

          const teamAName = teamsDict[series.teamA.tag] || series.teamA.tag;
          const teamBName = teamsDict[series.teamB.tag] || series.teamB.tag;

          return (
            <div key={series.id} className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors shadow-sm">
              
              <div onClick={() => toggleSeries(series)} className="flex items-stretch cursor-pointer">
                
                <div className={`w-1.5 flex-shrink-0 transition-colors ${barColor}`} title={barTitle}></div>

                <div className="flex-1 flex flex-col md:flex-row items-center justify-between p-4 px-6 gap-6">
                   
                   <div className="flex flex-col w-full md:w-1/4">
                      <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase">
                         {series.isScrim ? 'TREINO / SCRIM' : (series.tournament ? series.tournament : 'OFICIAL')}
                      </span>
                      <span className="text-sm font-bold text-zinc-200 mt-0.5 truncate uppercase tracking-tight">{series.description}</span>
                   </div>

                   <div className="flex items-center gap-4 justify-center flex-1 min-w-0">
                      
                      <div className="flex items-center gap-4 justify-end flex-1 min-w-0">
                        <span className={`text-sm font-black uppercase truncate text-right ${isTeamAWin ? 'text-white' : 'text-zinc-500'}`} title={teamAName}>
                          {teamAName}
                        </span>
                        {series.teamA.logo ? (
                          <img src={series.teamA.logo} className="w-12 h-12 object-contain shrink-0" alt="" />
                        ) : (
                          <div className="w-12 h-12 bg-zinc-800 rounded-md border border-zinc-700 shrink-0"></div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 rounded-md border border-zinc-800 shadow-inner shrink-0">
                        <span className={`text-xl font-black ${isTeamAWin ? 'text-white' : 'text-zinc-500'}`}>{series.scoreA}</span>
                        <span className="text-zinc-600 text-xs font-bold">-</span>
                        <span className={`text-xl font-black ${isTeamBWin ? 'text-white' : 'text-zinc-500'}`}>{series.scoreB}</span>
                      </div>

                      <div className="flex items-center gap-4 justify-start flex-1 min-w-0">
                        {series.teamB.logo ? (
                          <img src={series.teamB.logo} className="w-12 h-12 object-contain shrink-0" alt="" />
                        ) : (
                          <div className="w-12 h-12 bg-zinc-800 rounded-md border border-zinc-700 shrink-0"></div>
                        )}
                        <span className={`text-sm font-black uppercase truncate text-left ${isTeamBWin ? 'text-white' : 'text-zinc-500'}`} title={teamBName}>
                          {teamBName}
                        </span>
                      </div>

                   </div>

                   <div className="flex items-center justify-end w-full md:w-1/4 gap-4">
                      <div className="flex gap-1">
                         {[...series.games].sort((a, b) => getSafeTimestamp(a.game_start_time) - getSafeTimestamp(b.game_start_time)).map((g: any, i: number) => {
                            const rWin = String(g.winner_side || '').toLowerCase().trim();
                            const isBLU = rWin === 'blue' || rWin === '100';
                            
                            const gameBlueTag = g.blue_team_tag || g.blue_tag || 'BLU';
                            const gameRedTag = g.red_team_tag || g.red_tag || 'RED';
                            const winnerTag = isBLU ? gameBlueTag : gameRedTag;

                            return (
                               <div key={i} className={`w-3 h-3 rounded-sm shadow-sm ${isBLU ? 'bg-blue-500' : 'bg-red-500'}`} title={`Game ${i+1}: ${winnerTag} win (${isBLU ? 'Blue' : 'Red'} side)`}></div>
                            );
                         })}
                      </div>
                      <div className={`text-zinc-600 ml-2 transition-transform duration-300 ${expandedSeries === series.id ? 'rotate-180' : ''}`}>
                         ▼
                      </div>
                   </div>
                </div>
              </div>

              {expandedSeries === series.id && (
                <div className="bg-zinc-950 border-t border-zinc-800 p-4 md:p-6 flex flex-col gap-4 shadow-inner">
                  {[...series.games]
                    .sort((a:any, b:any) => getSafeTimestamp(a.game_start_time) - getSafeTimestamp(b.game_start_time))
                    .map((game: any, idx: number) => {
                      
                      const matchId = game.match_id;
                      const gameDrafts = drafts[matchId] || [];
                      const gameStats = playerStats[matchId] || []; 
                      const gameNum = idx + 1;
                      
                      const picksOnly = [...gameDrafts].filter(d => String(d.tipo || d.action_type).toUpperCase() === 'PICK').sort((a, b) => Number(a.sequence) - Number(b.sequence));
                      const firstPickSide = picksOnly.length > 0 ? picksOnly[0].side?.toLowerCase() : null;
                      const lastPickSide = firstPickSide === 'blue' ? 'red' : firstPickSide === 'red' ? 'blue' : null;

                      const bluePicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo || d.action_type).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                      const blueBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo || d.action_type).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);
                      const redPicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo || d.action_type).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                      const redBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo || d.action_type).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);

                      const rWin = String(game.winner_side || '').toLowerCase().trim();
                      const gameIsBlueWin = rWin === 'blue' || rWin === '100';
                      
                      const gameBlueName = game.blue_name || teamsDict[game.blue_team_tag || game.blue_tag] || game.blue_team_tag || game.blue_tag || 'BLUE TEAM';
                      const gameRedName  = game.red_name || teamsDict[game.red_team_tag || game.red_tag]   || game.red_team_tag || game.red_tag   || 'RED TEAM';

                      return (
                        <div key={matchId} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative shadow-sm">
                          
                          <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-3">
                               <span className="bg-zinc-800 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded tracking-widest border border-zinc-700">GAME {gameNum}</span>
                               <span className="text-[10px] text-zinc-500 font-mono tracking-widest hidden md:block">ID: {matchId.split('_')[1] || matchId}</span>
                             </div>
                             <div className="flex items-center gap-3">
                               {gameIsBlueWin ? (
                                 <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded border border-blue-500/20 tracking-widest">BLUE WIN</span>
                               ) : (
                                 <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 tracking-widest">RED WIN</span>
                               )}
                               
                               <button onClick={(e) => handleProcessAnalytics(matchId, e)} disabled={processingId === matchId} className="group relative flex items-center justify-center text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1 rounded transition-colors uppercase tracking-widest overflow-hidden">
                                 {processingId === matchId ? (
                                   <span className="flex items-center gap-2"><div className="w-2 h-2 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div> SYNCING</span>
                                 ) : (
                                   <>
                                     <span className="relative z-10 group-hover:text-white transition-colors">SYNC DATA</span>
                                     <div className="absolute inset-0 w-0 bg-blue-600 group-hover:w-full transition-all duration-300 ease-out z-0 opacity-20"></div>
                                   </>
                                 )}
                               </button>

                               <Link href={`/dashboard/matches/${matchId}`} className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 px-4 py-1 rounded transition-colors uppercase tracking-widest shadow-[0_0_10px_rgba(37,99,235,0.2)]">
                                 REPORT →
                               </Link>
                             </div>
                          </div>

                          {gameDrafts.length === 0 ? (
                            <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-950/50 rounded-md border border-zinc-800 border-dashed uppercase tracking-widest font-bold">
                               {loadingDrafts === matchId ? 'Analisando Base de Dados...' : 'Nenhum draft registrado nesta partida.'}
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-950 p-4 rounded-md border border-zinc-800/80 shadow-inner">
                               
                               {/* === LADO AZUL === */}
                               <div className="flex flex-col gap-3 flex-1 w-full md:w-auto overflow-hidden">
                                  <div className="flex items-center justify-between px-1">
                                     <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs font-black text-blue-500 uppercase tracking-tight truncate max-w-[150px]" title={gameBlueName}>{gameBlueName}</span>
                                        {firstPickSide === 'blue' && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.6)] tracking-widest shrink-0">1ST PICK</span>}
                                        {lastPickSide === 'blue' && <span className="text-[8px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.6)] tracking-widest shrink-0">COUNTER</span>}
                                     </div>
                                     <div className="flex gap-1.5 shrink-0">
                                        {blueBans.map((b, i) => {
                                          const normChamp = normalizeChampName(b.champion);
                                          const banR = globalBans[normChamp] || 0;
                                          return (
                                            <div key={i} className="relative group/ban">
                                              <img src={getChampionIconUrl(b.champion)} className="w-8 h-8 rounded-md object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all border border-zinc-700 hover:border-zinc-400 cursor-help shadow-sm" alt={b.champion} />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] p-2 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-2xl flex flex-col items-center gap-1 transition-all duration-200">
                                                 <span className="font-black uppercase tracking-widest text-zinc-300">{b.champion}</span>
                                                 <span className="font-mono text-yellow-500">{banR}% BAN RATE</span>
                                                 <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-700"></div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                     </div>
                                  </div>
                                  <div className="flex gap-1.5 justify-start">
                                     {bluePicks.map((p, i) => {
                                        const pStat = gameStats.find((s: any) => normalizeChampName(s.champion) === normalizeChampName(p.champion)) || {};
                                        const pName = pStat.summoner_name || 'UNKNOWN';
                                        const ratLane = Number(pStat.lane_rating || 0).toFixed(1);
                                        const ratImp = Number(pStat.impact_rating || 0).toFixed(1);
                                        const ratConv = Number(pStat.conversion_rating || 0).toFixed(1);
                                        const ratVis = Number(pStat.vision_rating || 0).toFixed(1);

                                        return (
                                          <div key={i} className="flex-1 relative h-28 md:h-36 rounded-lg overflow-hidden group/card border border-zinc-800 hover:border-blue-500 transition-all shadow-sm cursor-crosshair">
                                             <img src={getChampionSplashUrl(p.champion)} className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover/card:scale-110 group-hover/card:blur-[2px] opacity-80 group-hover/card:opacity-40" alt={p.champion} />
                                             
                                             <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-8 z-10 transition-opacity duration-300 group-hover/card:opacity-0">
                                               <p className="text-[10px] text-white font-black truncate drop-shadow-md text-center uppercase tracking-widest">{pName}</p>
                                             </div>

                                             <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-1.5 gap-2 z-20">
                                                <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest text-center truncate w-full border-b border-blue-500/30 pb-1">{pName}</span>
                                                <div className="grid grid-cols-1 gap-y-1 text-[9px] w-full px-1 font-bold">
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">LAN</span><span className={`font-mono ${getScoreColor(Number(ratLane))}`}>{ratLane}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">IMP</span><span className={`font-mono ${getScoreColor(Number(ratImp))}`}>{ratImp}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">CON</span><span className={`font-mono ${getScoreColor(Number(ratConv))}`}>{ratConv}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">VIS</span><span className={`font-mono ${getScoreColor(Number(ratVis))}`}>{ratVis}</span></div>
                                                </div>
                                             </div>
                                          </div>
                                        );
                                     })}
                                     {Array.from({length: Math.max(0, 5 - bluePicks.length)}).map((_, i) => (
                                        <div key={`empty-b-${i}`} className="flex-1 relative h-28 md:h-36 bg-zinc-900 rounded-lg border border-zinc-800 shadow-inner"></div>
                                     ))}
                                  </div>
                               </div>

                               <div className="hidden md:flex flex-col items-center justify-center px-4 shrink-0">
                                  <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">VS</span>
                               </div>

                               {/* === LADO VERMELHO === */}
                               <div className="flex flex-col gap-3 flex-1 w-full md:w-auto overflow-hidden">
                                  <div className="flex items-center justify-between px-1">
                                     <div className="flex gap-1.5 shrink-0">
                                        {redBans.map((b, i) => {
                                          const normChamp = normalizeChampName(b.champion);
                                          const banR = globalBans[normChamp] || 0;
                                          return (
                                            <div key={i} className="relative group/ban">
                                              <img src={getChampionIconUrl(b.champion)} className="w-8 h-8 rounded-md object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all border border-zinc-700 hover:border-zinc-400 cursor-help shadow-sm" alt={b.champion} />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] p-2 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-2xl flex flex-col items-center gap-1 transition-all duration-200">
                                                 <span className="font-black uppercase tracking-widest text-zinc-300">{b.champion}</span>
                                                 <span className="font-mono text-yellow-500">{banR}% BAN RATE</span>
                                                 <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-700"></div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                     </div>
                                     <div className="flex items-center gap-2 min-w-0">
                                        {firstPickSide === 'red' && <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.6)] tracking-widest shrink-0">1ST PICK</span>}
                                        {lastPickSide === 'red' && <span className="text-[8px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.6)] tracking-widest shrink-0">COUNTER</span>}
                                        <span className="text-xs font-black text-red-500 uppercase tracking-tight text-right truncate max-w-[150px]" title={gameRedName}>{gameRedName}</span>
                                     </div>
                                  </div>
                                  <div className="flex gap-1.5 justify-end">
                                     {redPicks.map((p, i) => {
                                        const pStat = gameStats.find((s: any) => normalizeChampName(s.champion) === normalizeChampName(p.champion)) || {};
                                        const pName = pStat.summoner_name || 'UNKNOWN';
                                        const ratLane = Number(pStat.lane_rating || 0).toFixed(1);
                                        const ratImp = Number(pStat.impact_rating || 0).toFixed(1);
                                        const ratConv = Number(pStat.conversion_rating || 0).toFixed(1);
                                        const ratVis = Number(pStat.vision_rating || 0).toFixed(1);

                                        return (
                                          <div key={i} className="flex-1 relative h-28 md:h-36 rounded-lg overflow-hidden group/card border border-zinc-800 hover:border-red-500 transition-all shadow-sm cursor-crosshair">
                                             <img src={getChampionSplashUrl(p.champion)} className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover/card:scale-110 group-hover/card:blur-[2px] opacity-80 group-hover/card:opacity-40" alt={p.champion} />
                                             
                                             <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-8 z-10 transition-opacity duration-300 group-hover/card:opacity-0">
                                               <p className="text-[10px] text-white font-black truncate drop-shadow-md text-center uppercase tracking-widest">{pName}</p>
                                             </div>

                                             <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-1.5 gap-2 z-20">
                                                <span className="text-[8px] text-red-400 font-black uppercase tracking-widest text-center truncate w-full border-b border-red-500/30 pb-1">{pName}</span>
                                                <div className="grid grid-cols-1 gap-y-1 text-[9px] w-full px-1 font-bold">
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">LAN</span><span className={`font-mono ${getScoreColor(Number(ratLane))}`}>{ratLane}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">IMP</span><span className={`font-mono ${getScoreColor(Number(ratImp))}`}>{ratImp}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">CON</span><span className={`font-mono ${getScoreColor(Number(ratConv))}`}>{ratConv}</span></div>
                                                   <div className="flex justify-between items-center"><span className="text-zinc-400 tracking-widest text-[7px]">VIS</span><span className={`font-mono ${getScoreColor(Number(ratVis))}`}>{ratVis}</span></div>
                                                </div>
                                             </div>
                                          </div>
                                        );
                                     })}
                                     {Array.from({length: Math.max(0, 5 - redPicks.length)}).map((_, i) => (
                                        <div key={`empty-r-${i}`} className="flex-1 relative h-28 md:h-36 bg-zinc-900 rounded-lg border border-zinc-800 shadow-inner"></div>
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

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
            Página {currentPage} / {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
          </button>
        </div>
      )}

    </div>
  );
}

// --- COMPONENTES DOS DROPDOWNS INTELIGENTES ---

function CockpitDropdown({ label, value, onChange, options, isHighlighted = false }: any) {
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
      {label && <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">{label}</label>}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[160px] transition-colors text-[10px] font-bold uppercase shadow-sm ${isHighlighted ? 'border-amber-500/50 text-amber-500 hover:border-amber-400' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
      >
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <span className={`text-[8px] transition-transform ${isOpen ? (isHighlighted ? 'rotate-180 text-amber-500' : 'rotate-180 text-blue-500') : 'text-zinc-500'}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[180px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar">
          {options.map((opt:any) => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === opt.id ? (isHighlighted ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-600/10 text-blue-400') : 'text-zinc-400'}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const isHighlighted = value !== 'ALL';

  const TOURNAMENT_GROUPS = [
    {
      label: "LIGAS TIER 1",
      options: [
        { id: 'CBLOL', label: 'CBLOL' },
        { id: 'LCK', label: 'LCK' },
        { id: 'LCS', label: 'LCS' },
        { id: 'LEC', label: 'LEC' },
        { id: 'LPL', label: 'LPL' }
      ]
    },
    {
      label: "LIGAS CHALLENGERS",
      options: [
        { id: 'CIRCUITO DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
        { id: 'LCK CHALLENGERS', label: 'LCK CHALLENGERS' },
        { id: 'LCS CHALLENGERS', label: 'LCS CHALLENGERS' },
        { id: 'EMEA MASTERS', label: 'EMEA MASTERS' }
      ]
    },
    {
      label: "TORNEIOS GLOBAIS",
      options: [
        { id: 'AMERICAS CUP', label: 'AMERICAS CUP' },
        { id: 'EWC QUALIFIER', label: 'EWC QUALIFIER' },
        { id: 'EWC', label: 'ESPORTS WORLD CUP' },
        { id: 'FIRST STAND', label: 'FIRST STAND' },
        { id: 'MSI', label: 'MSI' },
        { id: 'MUNDIAL', label: 'MUNDIAL' },
        { id: 'WORLD CUP', label: 'WORLD CUP' }
      ]
    },
    {
      label: "OFF-SEASON",
      options: [
        { id: 'CBLOL CUP', label: 'CBLOL CUP' },
        { id: 'LCK CUP', label: 'LCK CUP' },
        { id: 'LCS CUP', label: 'LCS CUP' },
        { id: 'LEC CUP', label: 'LEC CUP' }
      ]
    }
  ];

  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const currentLabel = value === 'ALL' 
    ? 'TODOS OS CAMPEONATOS' 
    : TOURNAMENT_GROUPS.flatMap(g => g.options).find(o => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col" ref={ref}>
      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">ESCOPO DE LIGA</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[220px] transition-colors text-[10px] font-bold uppercase shadow-sm ${isHighlighted ? 'border-amber-500/50 text-amber-500 hover:border-amber-400' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
      >
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <span className={`text-[8px] transition-transform ${isOpen ? (isHighlighted ? 'rotate-180 text-amber-500' : 'rotate-180 text-blue-500') : 'text-zinc-500'}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-[260px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[400px] flex flex-col">
          
          <button 
            onClick={() => { onChange('ALL'); setIsOpen(false); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-zinc-800 shrink-0 ${value === 'ALL' ? 'bg-blue-600/10 text-blue-400' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
          >
             <span className="text-[10px] font-black uppercase tracking-widest pl-1">TODAS AS LIGAS</span>
          </button>

          <div className="overflow-y-auto custom-scrollbar">
            {TOURNAMENT_GROUPS.map((group, gIndex) => (
              <div key={group.label} className={gIndex > 0 ? "border-t border-zinc-800/50" : ""}>
                <div className="px-4 py-2 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                   <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{group.label}</span>
                </div>
                {group.options.map((opt) => {
                  const isSelected = value === opt.id;
                  return (
                    <button 
                      key={opt.id} 
                      onClick={() => { onChange(opt.id); setIsOpen(false); }} 
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors ${isSelected ? 'bg-zinc-800/50 text-white' : 'text-zinc-400'}`}
                    >
                      <span className={`text-[10px] font-bold uppercase pl-1 ${isSelected ? 'text-amber-500' : ''}`}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SplitSelector({ value, onChange, availableSplits }: { value: string, onChange: (val: string) => void, availableSplits: string[] }) {
  const isHighlighted = value !== 'ALL';
  
  const LABELS: Record<string, string> = {
    'CUP': 'SEASON CUP',
    'SPLIT 1': 'SPLIT 1',
    'SPLIT 2': 'SPLIT 2',
    'SPLIT 3': 'SPLIT 3',
    'EVENTO GLOBAL': 'EVENTO GLOBAL',
    'OFF-SEASON': 'OFF-SEASON'
  };

  const dynamicOptions = [
    { id: 'ALL', label: 'TODOS OS RECORTES' },
    ...availableSplits.map(s => ({ id: s, label: LABELS[s] || s }))
  ];

  return (
    <CockpitDropdown 
      label="RECORTE TEMPORAL" 
      value={value} 
      onChange={onChange} 
      isHighlighted={isHighlighted}
      options={dynamicOptions} 
    />
  );
}