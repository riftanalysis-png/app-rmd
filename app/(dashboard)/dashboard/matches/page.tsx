"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { processMatchIntelligence } from '@/lib/services/analytics';
import Link from 'next/link';

const DDRAGON_VERSION = '16.5.1';

// Função utilitária para pegar a imagem do campeão
function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  if (sanitized.toLowerCase() === 'drmundo') sanitized = 'DrMundo';
  if (sanitized.toLowerCase() === 'renataglasc') sanitized = 'Renata';
  
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

// --- FUNÇÃO BLINDADA DE TIMESTAMP PARA ORDENAÇÃO ---
function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  
  const [drafts, setDrafts] = useState<Record<string, any[]>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // --- ESTADOS DOS FILTROS ---
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [globalTournament, setGlobalTournament] = useState("ALL");
  const [globalSplit, setGlobalSplit] = useState("ALL");

  useEffect(() => { fetchMatches(); }, []);

  // --- FETCH DUPLO: Cruza a View com a Tabela Original ---
  async function fetchMatches() {
    try {
      setLoading(true);
      
      const [viewRes, matchesRes] = await Promise.all([
        supabase.from('view_matches_with_teams').select('*'),
        supabase.from('matches').select('id, game_start_time, game_type, split, series_id')
      ]);
      
      if (viewRes.error) console.error("ERRO View:", viewRes.error);
      if (matchesRes.error) console.error("ERRO Matches:", matchesRes.error);
      
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

        // Ordenação Global inicial (só por segurança)
        const sortedData = enrichedData.sort((a, b) => 
          getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time)
        );
        
        setMatches(sortedData);
      }
    } catch (err) {
      console.error("Falha Crítica ao carregar partidas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDraftsForMatches(matchIds: string[]) {
    try {
      const missingIds = matchIds.filter(id => !drafts[id]);
      if (missingIds.length === 0) return;

      setLoadingDrafts(missingIds[0]); 

      const { data, error } = await supabase.from('match_drafts').select('*').in('match_id', missingIds);
      
      if (error) console.error("ERRO SUPABASE (Drafts):", error);
      
      if (data) {
        setDrafts(prev => {
          const next = { ...prev };
          missingIds.forEach(id => {
            next[id] = data.filter(d => d.match_id === id).sort((a, b) => a.sequence - b.sequence);
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Falha ao carregar drafts:", err);
    } finally {
      setLoadingDrafts(null);
    }
  }

  const toggleSeries = (series: any) => {
    if (expandedSeries === series.id) {
      setExpandedSeries(null);
    } else {
      setExpandedSeries(series.id);
      fetchDraftsForMatches(series.games.map((g: any) => g.id || g.match_id));
    }
  };

  // --- APLICAÇÃO DOS FILTROS LOCAIS ---
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const gameType = String(m.game_type || '').toUpperCase().trim();
      const isScrim = gameType === 'SCRIM';
      
      // 1. Filtro Oficial vs Scrim
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;

      // 2. Filtro de Campeonato (Só importa se NÃO for scrim)
      if (!isScrim && globalTournament !== 'ALL' && gameType !== globalTournament.toUpperCase()) return false;

      // 3. Filtro de Split
      if (globalSplit !== 'ALL' && String(m.split || '').toUpperCase() !== globalSplit.toUpperCase()) return false;

      return true;
    });
  }, [matches, matchType, globalTournament, globalSplit]);

  // --- AGRUPAMENTO DINÂMICO DOS JOGOS FILTRADOS ---
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
               d.setHours(d.getHours() - 6);
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
          logicalDate: m.game_start_time, 
          games: [],
          teamA: { tag: blueTag, logo: m.blue_logo },
          teamB: { tag: redTag, logo: m.red_logo },
          scoreA: 0, scoreB: 0
        };
      }
      
      groups[sId].games.push(m);
      
      if (m.winner_side === 'blue') groups[sId].scoreA++;
      else if (m.winner_side === 'red') groups[sId].scoreB++;
    });

    return Object.values(groups).sort((a: any, b: any) => {
      return getSafeTimestamp(b.logicalDate) - getSafeTimestamp(a.logicalDate);
    });
  }, [filteredMatches]);

  const stats = useMemo(() => {
    const total = filteredMatches.length;
    const blueWins = filteredMatches.filter(m => m.winner_side === 'blue').length;
    const redWins = filteredMatches.filter(m => m.winner_side === 'red').length;
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
      <p className="text-blue-500 font-black italic animate-pulse tracking-widest text-xs uppercase">// DECRYPTING_MATCH_HISTORY_...</p>
    </div>
  );

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-8 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
        <div className="flex flex-col gap-4">
          <div className="border-l-2 border-blue-500 pl-4">
            <h1 className="text-3xl text-white leading-none">AUDITORIA DE SÉRIES</h1>
            <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">SISTEMA DE MONITORAMENTO E DRAFT</p>
          </div>
          
          {/* COCKPIT DE FILTROS GLOBAIS */}
          <div className="flex gap-4 items-center mt-2 z-50">
            <div className="flex bg-slate-950/80 p-1.5 rounded-[16px] border border-slate-800 shadow-inner h-[50px] items-center">
              <button onClick={() => {setMatchType('ALL'); setGlobalTournament('ALL')}} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'ALL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>AMBOS</button>
              <button onClick={() => setMatchType('OFICIAL')} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-blue-900 hover:text-blue-400'}`}>OFICIAL</button>
              <button onClick={() => {setMatchType('SCRIM'); setGlobalTournament('ALL')}} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'SCRIM' ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'text-amber-900 hover:text-amber-500'}`}>SCRIMS</button>
            </div>

            {matchType !== 'SCRIM' && (
              <TournamentSelector value={globalTournament} onChange={setGlobalTournament} />
            )}
            <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
          </div>
        </div>

        <div className="flex gap-4 md:gap-6 flex-wrap items-center">
          <StatBox label="Séries / Blocos" value={stats.totalSeries} />
          <StatBox label="Jogos Totais" value={stats.totalGames} />
          
          <div className="flex items-center bg-white/[0.02] border border-white/5 px-6 py-3 rounded-2xl gap-5 shadow-inner">
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-red-500/20" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-red-500" strokeWidth="3.5" strokeDasharray={`${stats.redWR}, 100`} />
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-blue-500" strokeWidth="3.5" strokeDasharray={`${stats.blueWR}, 100`} strokeDashoffset="0" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 bg-[#121212] rounded-full"></div></div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[8px] text-slate-600 tracking-widest uppercase mb-1">Side Bias WR%</span>
              <div className="flex gap-3 items-center">
                <span className="text-blue-500 text-sm font-black tracking-tighter">{stats.blueWR}% B</span>
                <span className="text-slate-800 text-[10px]">/</span>
                <span className="text-red-500 text-sm font-black tracking-tighter">{stats.redWR}% R</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* RESULTADO VAZIO */}
      {groupedSeries.length === 0 && (
         <div className="bg-slate-900/40 border border-slate-800 rounded-[40px] p-20 flex flex-col items-center justify-center text-center shadow-inner h-full min-h-[400px]">
           <span className="text-6xl mb-6 grayscale opacity-20">🗄️</span>
           <h3 className="text-3xl text-slate-500 font-black italic">NENHUMA SÉRIE ENCONTRADA</h3>
           <p className="text-[10px] text-slate-600 mt-3 uppercase tracking-widest max-w-md">Os filtros selecionados não retornaram nenhuma partida. Tente remover o filtro de Split ou Campeonato.</p>
         </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {groupedSeries.map((series: any) => {
          const barColor = series.scoreA > series.scoreB ? 'bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                       : series.scoreB > series.scoreA ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                       : 'bg-slate-600';

          return (
            <div key={series.id} className={`bg-[#121212] border transition-all rounded-2xl shadow-lg relative ${expandedSeries === series.id ? 'border-white/20' : 'border-white/5 hover:border-white/10'}`}>
              
              <div onClick={() => toggleSeries(series)} className="p-5 md:p-6 flex items-center gap-6 cursor-pointer relative z-10">
                <div className={`w-1.5 h-12 rounded-full ${barColor}`}></div>

                {/* Lado A */}
                <div className="flex items-center gap-4 w-32 justify-end ml-2">
                  <span className={`text-xs ${series.scoreA > series.scoreB ? 'text-white' : 'text-slate-500'}`}>{series.teamA.tag}</span>
                  <div className="relative w-10 h-10 rounded-lg flex items-center justify-center p-1 overflow-hidden bg-black/40 border border-white/5">
                    {series.teamA.logo ? <img src={series.teamA.logo} className="w-full h-full object-contain relative z-10" alt="" /> : <span className="text-[10px] text-slate-700">TBD</span>}
                  </div>
                </div>

                {/* Placar Central */}
                <div className="flex flex-col items-center min-w-[140px]">
                  <div className="flex items-center gap-4 text-2xl font-black">
                    <span className={series.scoreA > series.scoreB ? 'text-blue-500' : 'text-slate-600'}>{series.scoreA}</span>
                    <span className="text-slate-800 text-xs">X</span>
                    <span className={series.scoreB > series.scoreA ? 'text-red-500' : 'text-slate-600'}>{series.scoreB}</span>
                  </div>
                  <span className={`text-[8px] tracking-widest mt-1 px-2 py-0.5 rounded-sm ${series.isScrim ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-600'}`}>{series.description}</span>
                </div>

                {/* Lado B */}
                <div className="flex items-center gap-4 w-32 mr-2">
                  <div className="relative w-10 h-10 rounded-lg flex items-center justify-center p-1 overflow-hidden bg-black/40 border border-white/5">
                    {series.teamB.logo ? <img src={series.teamB.logo} className="w-full h-full object-contain relative z-10" alt="" /> : <span className="text-[10px] text-slate-700">TBD</span>}
                  </div>
                  <span className={`text-xs ${series.scoreB > series.scoreA ? 'text-white' : 'text-slate-500'}`}>{series.teamB.tag}</span>
                </div>

                {/* TIMELINE DE BARRINHAS */}
                <div className="hidden xl:flex items-center gap-2 flex-1 px-10">
                  {[...series.games].sort((a, b) => getSafeTimestamp(a.game_start_time) - getSafeTimestamp(b.game_start_time)).map((g: any, i: number) => {
                    const isBlueWinner = g.winner_side === 'blue';
                    const winner = isBlueWinner ? series.teamA : series.teamB;
                    
                    return (
                      <div key={i} className="group/bar relative flex-1 h-1.5 cursor-help">
                        <div className={`w-full h-full rounded-full transition-all duration-300 ${isBlueWinner ? 'bg-blue-500/40 group-hover/bar:bg-blue-500' : 'bg-red-500/40 group-hover/bar:bg-red-500'}`}></div>
                        
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,1)] opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-all duration-300 z-[9999] min-w-[180px] backdrop-blur-xl scale-90 group-hover/bar:scale-100">
                           <div className="flex flex-col items-center">
                              <p className="text-[7px] text-slate-500 tracking-[0.4em] mb-3 font-mono border-b border-white/5 w-full pb-2">DATA_STREAM_G0{i + 1}</p>
                              <div className="flex items-center gap-3 mb-2">
                                 <div className="relative w-8 h-8 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-white/10 blur-md rounded-full"></div>
                                    <img src={winner.logo} className="w-6 h-6 object-contain relative z-10" alt="" />
                                 </div>
                                 <div className="text-left">
                                    <p className={`text-[12px] leading-none font-black italic ${isBlueWinner ? 'text-blue-400' : 'text-red-400'}`}>{winner.tag}</p>
                                    <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-tighter">Side: {g.winner_side}</p>
                                 </div>
                              </div>
                              <div className="w-full bg-white/5 h-[1px] my-2"></div>
                              <p className="text-[9px] text-emerald-400 font-black">VICTORY_CONFIRMED</p>
                           </div>
                           <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[8px] border-x-transparent border-t-[8px] border-t-white/10"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-none pr-2">
                   <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                     <span className="text-[10px] text-slate-600">{expandedSeries === series.id ? '▲' : '▼'}</span>
                   </div>
                </div>
              </div>

              {expandedSeries === series.id && (
                <div className="bg-black/40 border-t border-white/5 p-4 md:p-6 animate-in slide-in-from-top-2 duration-300 rounded-b-2xl">
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    
                    {/* ORDENAÇÃO DOS JOGOS EXPANDIDOS: Mais recentes primeiro (b - a) */}
                    {[...series.games]
                      .sort((a:any, b:any) => getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time))
                      .map((game: any, idx: number, arr: any[]) => {
                        
                        const matchId = game.id || game.match_id;
                        const gameDrafts = drafts[matchId] || [];
                        const realGameNumber = arr.length - idx; 
                        
                        const firstPickSide = gameDrafts.length > 0 
                          ? [...gameDrafts].sort((a,b) => a.sequence - b.sequence)[0].side?.toLowerCase() 
                          : null;
                        
                        const bluePicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                        const blueBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'blue' && String(d.tipo).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);
                        const redPicks = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo).toUpperCase() === 'PICK').sort((a,b) => a.sequence - b.sequence);
                        const redBans = gameDrafts.filter(d => d.side?.toLowerCase() === 'red' && String(d.tipo).toUpperCase() === 'BAN').sort((a,b) => a.sequence - b.sequence);

                        return (
                          <div key={matchId} className="flex flex-col bg-slate-900/40 border border-white/5 rounded-2xl relative overflow-hidden shadow-2xl">
                            
                            {/* BARRINHA DE VITÓRIA DO JOGO */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-10 ${game.winner_side === 'blue' ? 'bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`}></div>

                            <div className="flex flex-wrap items-center justify-between p-4 border-b border-white/5 bg-black/20 pl-6">
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-300 font-black italic border-r border-slate-700 pr-4">GAME {realGameNumber}</span>
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-slate-600 font-mono">PROTOCOL_ID</span>
                                  <span className="text-[9px] text-blue-400 font-mono">{matchId}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-md text-[8px] font-black tracking-widest uppercase border ${game.winner_side === 'blue' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                                  {game.winner_side === 'blue' ? (game.blue_team_tag || game.blue_tag || 'BLUE') : (game.red_team_tag || game.red_tag || 'RED')} WIN
                                </span>
                                <button onClick={(e) => handleProcessAnalytics(matchId, e)} className="px-3 py-1 border border-slate-700 bg-slate-900 rounded-md text-[8px] text-slate-400 hover:text-white hover:border-blue-500 transition-colors uppercase font-bold">
                                  {processingId === matchId ? 'SYNCING...' : 'SYNC'}
                                </button>
                                <Link href={`/dashboard/matches/${matchId}`} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-md text-[8px] text-white transition-colors shadow-lg">
                                  REPORT →
                                </Link>
                              </div>
                            </div>

                            <div className="p-4 pl-6 relative">
                              {gameDrafts.length === 0 ? (
                                <div className="text-center py-6 text-[9px] text-slate-600 tracking-widest bg-black/20 rounded-xl border border-white/5 border-dashed">
                                  {loadingDrafts === matchId ? 'CARREGANDO DRAFTS...' : 'DADOS DE DRAFT NÃO ENCONTRADOS.'}
                                </div>
                              ) : (
                                <div className="flex justify-between items-stretch gap-4 relative">
                                  
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-xl hidden sm:flex">
                                    <span className="text-[7px] text-slate-400">VS</span>
                                  </div>

                                  {/* COLUNA BLUE */}
                                  <div className="flex flex-col w-1/2 bg-blue-900/10 border border-blue-500/20 rounded-xl p-3">
                                    <div className="flex justify-between items-center border-b border-blue-500/30 pb-2 mb-3">
                                      <span className="text-[10px] text-blue-400 font-black tracking-widest">{game.blue_team_tag || game.blue_tag || 'BLUE'}</span>
                                      {firstPickSide === 'blue' && <span className="text-[7px] bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.8)]">1ST PICK</span>}
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 mb-3 flex-1">
                                      {bluePicks.map((p, i) => (
                                        <div key={`bp-${i}`} className="flex items-center gap-3 bg-blue-950/30 border border-blue-500/10 p-1.5 rounded-lg group hover:border-blue-400/40 transition-colors">
                                          <img src={getChampionImageUrl(p.champion)} className="w-8 h-8 rounded-md object-cover shadow-sm group-hover:scale-105 transition-transform" alt={p.champion} />
                                          <span className="text-[10px] text-white tracking-tighter truncate">{p.champion}</span>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1 justify-start pt-2 border-t border-slate-800/50">
                                      {blueBans.map((b, i) => (
                                        <div key={`bb-${i}`} className="relative group/ban">
                                          <img src={getChampionImageUrl(b.champion)} className="w-6 h-6 rounded border border-slate-700 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all object-cover cursor-help" alt={b.champion} />
                                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black border border-white/10 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">{b.champion}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* COLUNA RED */}
                                  <div className="flex flex-col w-1/2 bg-red-900/10 border border-red-500/20 rounded-xl p-3">
                                    <div className="flex justify-between items-center border-b border-red-500/30 pb-2 mb-3">
                                      {firstPickSide === 'red' && <span className="text-[7px] bg-red-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.8)]">1ST PICK</span>}
                                      <span className="text-[10px] text-red-400 font-black tracking-widest w-full text-right">{game.red_team_tag || game.red_tag || 'RED'}</span>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 mb-3 flex-1">
                                      {redPicks.map((p, i) => (
                                        <div key={`rp-${i}`} className="flex items-center justify-end gap-3 bg-red-950/30 border border-red-500/10 p-1.5 rounded-lg group hover:border-red-400/40 transition-colors">
                                          <span className="text-[10px] text-white tracking-tighter truncate text-right">{p.champion}</span>
                                          <img src={getChampionImageUrl(p.champion)} className="w-8 h-8 rounded-md object-cover shadow-sm group-hover:scale-105 transition-transform" alt={p.champion} />
                                        </div>
                                      ))}
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1 justify-end pt-2 border-t border-slate-800/50">
                                      {redBans.map((b, i) => (
                                        <div key={`rb-${i}`} className="relative group/ban">
                                          <img src={getChampionImageUrl(b.champion)} className="w-6 h-6 rounded border border-slate-700 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all object-cover cursor-help" alt={b.champion} />
                                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black border border-white/10 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover/ban:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">{b.champion}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="flex flex-col bg-white/[0.02] border border-white/5 px-5 py-3 rounded-2xl min-w-[100px]">
      <span className="text-[8px] text-slate-600 tracking-widest mb-1 uppercase">{label}</span>
      <span className={`text-xl font-black italic ${color}`}>{value}</span>
    </div>
  );
}

// --- COMPONENTES AUXILIARES DOS FILTROS ---
function CockpitDropdown({ label, value, onChange, options, color }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const currentLabel = options.find((o:any) => o.id === value)?.label || value;
  
  const colorClasses: Record<string, {text: string, bg: string, shadow: string}> = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', shadow: 'group-hover:drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', shadow: 'group-hover:drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', shadow: 'group-hover:drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]' }
  };
  
  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className="relative flex flex-col" ref={ref}>
      {label && <label className="text-[7px] text-slate-500 tracking-[0.2em] uppercase mb-1.5 ml-2 font-black">{label}</label>}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center justify-between gap-4 min-w-[140px] hover:border-slate-600 transition-all shadow-inner text-[9px] text-white font-black italic uppercase group"
      >
        <span className={`flex-1 text-left ${c.text} ${c.shadow} transition-all`}>{currentLabel}</span>
        <span className={`text-[8px] text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[160px] bg-[#0a0f18] border border-slate-700 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[9999] max-h-[320px] overflow-y-auto custom-scrollbar">
          {options.map((opt:any) => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0 ${value === opt.id ? c.bg : ''}`}
            >
              <span className={`text-[9px] font-black italic uppercase ${value === opt.id ? c.text : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="CAMPEONATO" value={value} onChange={onChange} color="blue" options={[
    { id: 'ALL', label: 'TODOS OS CAMPEONATOS' }, { id: 'AMERICAS_CUP', label: 'AMERICAS CUP' },
    { id: 'CBLOL', label: 'CBLOL' }, { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
    { id: 'EMEA_MASTERS', label: 'EMEA MASTERS' }, { id: 'FIRST_STAND', label: 'FIRST STAND' },
    { id: 'LCK', label: 'LCK' }, { id: 'LCS', label: 'LCS' }, { id: 'LEC', label: 'LEC' },
    { id: 'LPL', label: 'LPL' }, { id: 'MSI', label: 'MSI' }, { id: 'MUNDIAL', label: 'MUNDIAL' }
  ]} />
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="TIMELINE" value={value} onChange={onChange} color="emerald" options={[
    { id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, 
    { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }
  ]} />
}