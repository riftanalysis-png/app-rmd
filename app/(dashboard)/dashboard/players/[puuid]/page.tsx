"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, AreaChart, Area, Legend, ComposedChart, Bar
} from 'recharts';

const DDRAGON_VERSION = '16.5.1';
const DEFAULT_AVATAR = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";

// --- MAPEAMENTO E ORDENAÇÃO DE ROLES ---
const ROLES_ORDER = ['top', 'jng', 'mid', 'adc', 'support'];

const normalizeRole = (lane: string | null): string => {
  if (!lane) return 'mid';
  const l = lane.toLowerCase().trim();
  if (l.includes('top')) return 'top';
  if (l.includes('jungle') || l.includes('jng') || l === 'jg' || l.includes('jug')) return 'jng';
  if (l.includes('mid')) return 'mid';
  if (l.includes('bot') || l.includes('adc')) return 'adc';
  if (l.includes('sup') || l.includes('utility')) return 'support';
  return 'support'; 
};

function sortPlayersByRole(playersArray: any[]) {
  return [...playersArray].sort((a, b) => {
    const roleA = normalizeRole(a.primary_role);
    const roleB = normalizeRole(b.primary_role);
    return ROLES_ORDER.indexOf(roleA) - ROLES_ORDER.indexOf(roleB);
  });
}

const getRoleIcon = (role: string, size: string = "w-5 h-5") => {
  const mapping: Record<string, string> = {
    top: 'top', jungle: 'jungle', jng: 'jungle', mid: 'middle', middle: 'middle', 
    adc: 'bottom', bottom: 'bottom', sup: 'utility', support: 'utility', utility: 'utility'
  };
  const key = mapping[role?.toLowerCase()] || 'middle';
  const url = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${key}.png`;
  return <img src={url} alt={role} className={`${size} object-contain brightness-200`} />;
};

// --- CORES TIER 2 ---
function getScoreColor(score: any) {
  const s = Number(score);
  if (!s || s === 0) return "text-slate-600 border-slate-800 bg-slate-900/20";
  if (s >= 90) return "text-purple-400 border-purple-400/40 bg-purple-400/10 shadow-[0_0_15px_rgba(192,132,252,0.15)]"; 
  if (s >= 80) return "text-blue-400 border-blue-400/40 bg-blue-400/10 shadow-[0_0_15px_rgba(96,165,250,0.15)]";     
  if (s >= 70) return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_15px_rgba(52,211,153,0.15)]"; 
  if (s >= 60) return "text-yellow-400 border-yellow-400/40 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.15)]";  
  return "text-red-400 border-red-400/40 bg-red-400/10 shadow-[0_0_15px_rgba(248,113,113,0.15)]";                               
}

function getScoreColorText(score: any) {
  const s = Number(score);
  if (!s || s === 0) return "text-slate-500";
  if (s >= 90) return "text-purple-400";
  if (s >= 80) return "text-blue-400";
  if (s >= 70) return "text-emerald-400";
  if (s >= 60) return "text-yellow-400";
  return "text-red-400";
}

// --- MATEMÁTICA: REGRESSÃO LINEAR E R² ---
function calculateRegression(data: any[], xKey: string, yKey: string) {
  const n = data.length;
  if (n < 2) return { points: [], r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const d of data) {
    const x = Number(d[xKey]) || 0; const y = Number(d[yKey]) || 0;
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const divisor = n * sumX2 - sumX * sumX;
  const slope = divisor === 0 ? 0 : (n * sumXY - sumX * sumY) / divisor;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const d of data) {
    const x = Number(d[xKey]) || 0; const y = Number(d[yKey]) || 0;
    const forecast = slope * x + intercept;
    ssRes += Math.pow(y - forecast, 2); 
    ssTot += Math.pow(y - yMean, 2);
  }
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  const minX = Math.min(...data.map(d => Number(d[xKey]) || 0));
  const maxX = Math.max(...data.map(d => Number(d[xKey]) || 0));
  return { points: [ { [xKey]: minX, [yKey]: slope * minX + intercept }, { [xKey]: maxX, [yKey]: slope * maxX + intercept } ], r2: Math.min(1, Math.max(0, r2)) };
}

// --- ESTATÍSTICAS BOXPLOT ---
function calculateBoxPlotStats(data: number[]) {
  if (data.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0, count: 0, q3_diff: 0 };
  const sorted = [...data].sort((a, b) => a - b);
  const pos = (p: number) => {
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index); 
    const upper = Math.ceil(index); 
    if (lower === upper) return sorted[lower]; 
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };
  const stats: any = { min: sorted[0], q1: pos(0.25), median: pos(0.5), q3: pos(0.75), max: sorted[sorted.length - 1], count: data.length };
  stats.q3_diff = stats.q3 - stats.q1;
  return stats;
}

export default function PlayerProfilePage() {
  const rawParams = useParams();
  const puuid = Array.isArray(rawParams.puuid) ? rawParams.puuid[0] : rawParams.puuid;
  const router = useRouter();
  const dropdownRef = useRef<any>(null);
  
  // --- ESTADOS DE DADOS BRUTOS ---
  const [player, setPlayer] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [rosterList, setRosterList] = useState<any[]>([]); 
  const [allMatchesRaw, setAllMatchesRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // --- ESTADOS DO COCKPIT TÁTICO ---
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [globalSplit, setGlobalSplit] = useState("ALL");
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');
  const [opponentFilter, setOpponentFilter] = useState<string>('ALL');

  // --- FETCH MESTRE (Puxa tudo do jogador de uma vez só) ---
  const fetchTacticalData = useCallback(async () => {
    if (!puuid) return;
    setLoading(true);
    
    try {
      const [pRes, tRes, allPRes, perfRes, statsRes] = await Promise.all([
        supabase.from('view_players_with_stats').select('*').eq('puuid', puuid).single(),
        supabase.from('teams').select('*').order('acronym'),
        supabase.from('players').select('puuid, team_acronym, nickname, primary_role'),
        supabase.from('hub_players_performance').select('match_id, game_type, split').eq('puuid', puuid),
        supabase.from('player_stats_detailed').select('*').eq('puuid', puuid).order('match_id', { ascending: true })
      ]);

      if (pRes.data && allPRes.data) {
        setPlayer(pRes.data);
        const teamLookup: Record<string, string> = {};
        allPRes.data.forEach(p => { teamLookup[p.puuid] = p.team_acronym; });

        // Cruzamento de Partidas
        if (statsRes.data && statsRes.data.length > 0) {
          const matchIds = statsRes.data.map(m => m.match_id);
          const { data: participants } = await supabase.from('player_stats_detailed').select('match_id, puuid').in('match_id', matchIds);
          const { data: matchesMeta } = await supabase.from('matches').select('id, game_type, split').in('id', matchIds);
          
          const matchMetaMap: Record<string, any> = {};
          matchesMeta?.forEach(m => { matchMetaMap[m.id] = m; });
          
          const enriched = statsRes.data.map(m => {
            const myTeam = teamLookup[m.puuid] || 'Unknown';
            const matchParticipants = participants?.filter(p => p.match_id === m.match_id) || [];
            const opponent = matchParticipants.find(p => { 
              const t = teamLookup[p.puuid]; 
              return t && t.toUpperCase() !== myTeam.toUpperCase(); 
            });

            const meta = matchMetaMap[m.match_id] || {};
            
            return { 
              ...m, 
              opponent_acronym: opponent ? teamLookup[opponent.puuid] : 'MIX', 
              is_win: m.win === true || String(m.win).toLowerCase() === 'win' || String(m.win).toLowerCase() === 'true', 
              kp_val: parseFloat(String(m.kp || 0).replace('%', '')),
              eff_val: Number(m.gold_efficiency) || 1,
              game_type: meta.game_type || 'UNKNOWN',
              split: meta.split || 'UNKNOWN'
            };
          });
          setAllMatchesRaw(enriched);
        } else {
          setAllMatchesRaw([]);
        }

        // Salva todos os rosters em memória para o filtro de equipes
        let rosterQuery = supabase.from('hub_players_roster').select('puuid, nickname, team_acronym, game_type');
        if (globalSplit !== 'ALL') rosterQuery = rosterQuery.eq('split', globalSplit);

        const { data: rosterData } = await rosterQuery;
        if (rosterData) {
          setRosterList(rosterData);
          setTeams(tRes.data || []);
          setAllPlayers(allPRes.data || []);
        }
      }
    } catch (err) { 
      console.error("Erro no protocolo tático:", err); 
    } finally { 
      setLoading(false); 
    }
  }, [puuid, globalSplit]);

  useEffect(() => { 
    fetchTacticalData(); 
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fetchTacticalData]);


  // --- MOTOR DE FILTRAGEM LOCAL (INSTANTÂNEO E CASE INSENSITIVE) ---
  const filteredMatches = useMemo(() => {
    return allMatchesRaw.filter(m => {
      const isScrim = m.game_type?.toUpperCase() === 'SCRIM' || m.game_type?.toUpperCase() === 'SCRIMS';
      
      // 1. Filtro Oficial vs Scrim
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;

      // 2. Filtro de Split
      if (globalSplit !== 'ALL' && m.split?.toUpperCase() !== globalSplit.toUpperCase()) return false;

      // 3. Filtro de Lado
      if (sideFilter !== 'ALL' && m.side?.toUpperCase() !== sideFilter) return false;

      // 4. Filtro de Adversário
      if (opponentFilter !== 'ALL' && m.opponent_acronym?.toUpperCase() !== opponentFilter.toUpperCase()) return false;

      return true;
    });
  }, [allMatchesRaw, matchType, globalSplit, sideFilter, opponentFilter]);

  // --- LISTA DINÂMICA DE ADVERSÁRIOS PARA O DROPDOWN 'VS' ---
  const availableOpponents = useMemo(() => {
    const opps = new Set(filteredMatches.map(m => m.opponent_acronym?.toUpperCase()));
    opps.delete('MIX'); 
    opps.delete(undefined);
    return Array.from(opps).sort() as string[];
  }, [filteredMatches]);

  // --- MÁGICA: FILTRO DE EQUIPAS DO CAMPEONATO ---
  const displayedTeams = useMemo(() => {
    if (!teams.length || !rosterList.length) return teams;
    
    // Descobre quais torneios este jogador jogou (exceto Scrims)
    const validTourneys = Array.from(new Set(allMatchesRaw.map(m => m.game_type).filter(g => g && g !== 'SCRIM' && g !== 'UNKNOWN')));
    
    const activeInTourney = new Set(
       rosterList
          .filter(r => validTourneys.includes(r.game_type?.toUpperCase() || r.game_type))
          .map(r => r.team_acronym?.toUpperCase())
    );
    
    return teams.filter(t => activeInTourney.has(t.acronym?.toUpperCase()) || t.acronym?.toUpperCase() === player?.team_acronym?.toUpperCase());
  }, [teams, rosterList, allMatchesRaw, player]);


  // --- CÁLCULOS ANALÍTICOS GERAIS ---
  const bubbleData = useMemo(() => filteredMatches.map(m => ({ x: Number(m.gpm) || 0, y: Number(m.dpm) || 0, z: m.eff_val, is_win: m.is_win, champion: m.champion, opponent_acronym: m.opponent_acronym, side: m.side })), [filteredMatches]);
  
  const goldBoxPlotData = useMemo(() => {
    const wins = filteredMatches.filter(m => m.is_win).map(m => Number(m.gold_diff_at_12) || 0); const losses = filteredMatches.filter(m => !m.is_win).map(m => Number(m.gold_diff_at_12) || 0);
    return [{ name: 'VITÓRIAS', ...calculateBoxPlotStats(wins), color: '#fbbf24' }, { name: 'DERROTAS', ...calculateBoxPlotStats(losses), color: '#ef4444' }];
  }, [filteredMatches]);
  
  const xpBoxPlotData = useMemo(() => {
    const wins = filteredMatches.filter(m => m.is_win).map(m => Number(m.xp_diff_at_12) || 0); const losses = filteredMatches.filter(m => !m.is_win).map(m => Number(m.xp_diff_at_12) || 0);
    return [{ name: 'VITÓRIAS', ...calculateBoxPlotStats(wins), color: '#3b82f6' }, { name: 'DERROTAS', ...calculateBoxPlotStats(losses), color: '#ef4444' }];
  }, [filteredMatches]);

  const goldChanceCurve = useMemo(() => {
    const ranges = [-3000, -2250, -1500, -750, 0, 750, 1500, 2250, 3000];
    return ranges.map(t => {
      const relevant = filteredMatches.filter(m => { const d = Number(m.gold_diff_at_12) || 0; return d >= t - 375 && d <= t + 375; });
      const wins = relevant.filter(m => m.is_win).length; return { val: t, chance: relevant.length ? Math.round((wins / relevant.length) * 100) : null, wins, total: relevant.length, type: 'GOLD' };
    });
  }, [filteredMatches]);

  const xpChanceCurve = useMemo(() => {
    const ranges = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
    return ranges.map(t => {
      const relevant = filteredMatches.filter(m => { const d = Number(m.xp_diff_at_12) || 0; return d >= t - 250 && d <= t + 250; });
      const wins = relevant.filter(m => m.is_win).length; return { val: t, chance: relevant.length ? Math.round((wins / relevant.length) * 100) : null, wins, total: relevant.length, type: 'XP' };
    });
  }, [filteredMatches]);

  const topChampions = useMemo(() => {
    if (!filteredMatches.length) return [];
    const pool = filteredMatches.reduce((acc: any, m: any) => {
      const c = m.champion; if (!acc[c]) acc[c] = { name: c, wins: 0, games: 0, lane: [], impact: [], conversion: [], vision: [] };
      acc[c].games++; if (m.is_win) acc[c].wins++; acc[c].lane.push(m.lane_rating || 0); acc[c].impact.push(m.impact_rating || 0); acc[c].conversion.push(m.conversion_rating || 0); acc[c].vision.push(m.vision_rating || 0);
      return acc;
    }, {});
    const calcMed = (arr: any[]) => arr.length ? [...arr].sort((a,b)=>a-b)[Math.floor(arr.length/2)] : 0;
    return Object.values(pool).map((c: any) => { const ml = calcMed(c.lane); const mi = calcMed(c.impact); const mc = calcMed(c.conversion); const mv = calcMed(c.vision); return { ...c, ml, mi, mc, mv, avg: (ml+mi+mc+mv)/4 }; }).sort((a: any, b: any) => b.games - a.games).slice(0, 5);
  }, [filteredMatches]);

  const playerStatsFiltered = useMemo(() => {
      if(!filteredMatches.length) return { lane: 0, impact: 0, conv: 0, vision: 0, avg: 0 };
      const lane = filteredMatches.map(m => m.lane_rating || 0);
      const impact = filteredMatches.map(m => m.impact_rating || 0);
      const conv = filteredMatches.map(m => m.conversion_rating || 0);
      const vision = filteredMatches.map(m => m.vision_rating || 0);

      const calcMed = (arr: any[]) => arr.length ? [...arr].sort((a,b)=>a-b)[Math.floor(arr.length/2)] : 0;
      const l = calcMed(lane), i = calcMed(impact), c = calcMed(conv), v = calcMed(vision);

      return { lane: l, impact: i, conv: c, vision: v, avg: (l+i+c+v)/4 }
  }, [filteredMatches]);


  if (loading && !player) return <div className="p-20 text-blue-500 font-black text-center animate-pulse italic uppercase tracking-[0.2em]">Circuito Desafiante: Syncing System...</div>;
  if (!loading && !player) return <div className="p-20 text-red-500 font-black text-center uppercase tracking-widest">Operativo não encontrado no banco de dados.</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1700px] mx-auto space-y-8 bg-[#06090f] min-h-screen text-white font-black uppercase italic tracking-tighter relative overflow-visible">
      
      {/* CAMADA 1: HEADER E NAVEGAÇÃO */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-slate-800 pb-8 relative z-[250]">
        <div className="flex items-center gap-6">
           <Link href="/dashboard/players" className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-full hover:bg-blue-600 hover:border-blue-500 transition-all group">
             <span className="text-xl text-slate-500 group-hover:text-white transition-colors">←</span>
           </Link>
           <div className="border-l-4 border-blue-500 pl-4">
             <h1 className="text-4xl text-white leading-none">OPERATIVE <span className="text-blue-500">INTEL</span></h1>
             <p className="text-[9px] text-slate-500 tracking-[0.4em] mt-2 font-black">DOSSIER TÁTICO INDIVIDUAL</p>
           </div>
        </div>

        {/* COCKPIT DE ESTADO GERAL (CAMADA 2) */}
        <div className="flex gap-6 items-end bg-transparent">
           <div className="flex bg-slate-950/80 p-1.5 rounded-[16px] border border-slate-800 shadow-inner h-[50px] items-center">
              <button onClick={() => setMatchType('ALL')} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'ALL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>AMBOS</button>
              <button onClick={() => setMatchType('OFICIAL')} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-blue-900 hover:text-blue-400'}`}>OFICIAL</button>
              <button onClick={() => setMatchType('SCRIM')} className={`px-4 py-2 rounded-xl text-[9px] transition-all ${matchType === 'SCRIM' ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'text-amber-900 hover:text-amber-500'}`}>SCRIMS</button>
           </div>

           <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
        </div>
      </header>

      {/* CAMADA 3: BARRA DE TIMES E MICRO-ANÁLISE (VS + LADO) */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-900/40 p-4 rounded-[32px] border border-slate-800 shadow-2xl backdrop-blur-md relative z-[200]">
        
        {/* BARRA DE TIMES DINÂMICA (Só do Campeonato Atual) */}
        <div className="flex items-center gap-4 w-full lg:w-auto" ref={dropdownRef}>
          <div className="flex flex-wrap gap-4 px-4 justify-center lg:justify-start w-full">
            {displayedTeams.map((t: any) => {
              // Garante que o dropdown respeita a ordem Top -> Sup
              const teamRoster = sortPlayersByRole(allPlayers.filter((p:any) => p.team_acronym === t.acronym));
              
              return (
                <div key={t.acronym} className="relative">
                  <button onClick={() => setActiveDropdown(activeDropdown === t.acronym ? null : t.acronym)} className="transition-all hover:scale-110 outline-none shrink-0 py-1">
                    <img src={t.logo_url} className={`w-8 h-8 object-contain transition-all ${t.acronym === player.team_acronym || activeDropdown === t.acronym ? 'opacity-100 scale-125' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`} alt={t.acronym} />
                  </button>
                  
                  {/* DROPDOWN DOS JOGADORES DAQUELE TIME */}
                  {activeDropdown === t.acronym && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] min-w-[200px] overflow-hidden z-[9999]">
                      {teamRoster.map((tm:any) => (
                        <button key={tm.puuid} onClick={() => { router.push(`/dashboard/players/${tm.puuid}`); setActiveDropdown(null); }} className={`w-full flex items-center gap-3 px-4 py-3 text-[10px] hover:bg-blue-600 border-b border-slate-800/50 last:border-0 transition-colors ${tm.puuid === player.puuid ? 'bg-blue-900/40 text-blue-400' : 'text-white'}`}>
                          <span className="opacity-70">{getRoleIcon(tm.primary_role, "w-4 h-4")}</span>
                          <span className="font-black italic uppercase">{tm.nickname}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {displayedTeams.length === 0 && (
               <p className="text-[10px] text-slate-500 font-mono py-2 italic uppercase">SEM TIMES DISPONÍVEIS</p>
            )}
          </div>
        </div>

        {/* MICRO-ANÁLISE IN-GAME */}
        <div className="flex items-center gap-4 shrink-0 lg:border-l lg:border-slate-800/60 lg:pl-6 w-full lg:w-auto justify-end">
           <div className="flex items-center gap-2">
              <span className="text-[8px] text-slate-500 tracking-widest uppercase">VS</span>
              <CockpitDropdown 
                 label="" 
                 value={opponentFilter} 
                 onChange={setOpponentFilter} 
                 options={[{ id: 'ALL', label: 'TODOS OS TIMES' }, ...availableOpponents.map(opp => ({ id: opp, label: opp }))]} 
                 color="purple"
               />
           </div>

           <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner ml-2">
             <button onClick={() => setSideFilter('ALL')} className={`px-4 py-1.5 rounded-lg text-[9px] transition-all ${sideFilter === 'ALL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>BOTH</button>
             <button onClick={() => setSideFilter('BLUE')} className={`px-4 py-1.5 rounded-lg text-[9px] transition-all flex items-center gap-1.5 ${sideFilter === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-blue-900 hover:text-blue-400'}`}><div className="w-1.5 h-1.5 rounded-full bg-current"></div> BLUE</button>
             <button onClick={() => setSideFilter('RED')} className={`px-4 py-1.5 rounded-lg text-[9px] transition-all flex items-center gap-1.5 ${sideFilter === 'RED' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-red-900 hover:text-red-400'}`}><div className="w-1.5 h-1.5 rounded-full bg-current"></div> RED</button>
           </div>
        </div>
      </div>

      {/* MANUAL TÁTICO BOTÃO */}
      <button onClick={() => setShowGuide(true)} className="fixed bottom-10 right-10 z-[250] flex items-center justify-center w-14 h-14 bg-blue-600 border-2 border-blue-400 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-110 active:scale-95 transition-all group">
        <span className="text-2xl font-black italic">?</span>
        <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping group-hover:hidden"></div>
      </button>

      <div className="grid grid-cols-12 gap-6 items-stretch">
        
        {/* CARTINHA DO OPERATIVO */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-6 z-[150] sticky top-6 h-fit">
          
          <div className="bg-slate-900/60 border border-slate-800 rounded-[32px] p-6 relative overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
            
            <p className="absolute top-4 left-5 text-[8px] text-slate-500 font-mono tracking-widest uppercase">ID: {(player.puuid || "00").substring(0,8)}</p>
            <div className="absolute top-3 right-4 bg-black/40 px-3 py-1.5 rounded-lg border border-slate-800">
               <p className="text-[8px] text-slate-400 tracking-[0.2em] font-mono"><span className="text-blue-400">{filteredMatches.length}</span> MATCHES</p>
            </div>

            <div className="flex flex-col items-center mt-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-500"></div>
                
                <div className="relative w-36 h-36 rounded-2xl border border-slate-700 bg-slate-950 p-1.5 shadow-inner overflow-visible">
                  <img src={player.photo_url || DEFAULT_AVATAR} alt={player.nickname} className="w-full h-full object-cover rounded-xl grayscale-[20%] group-hover:grayscale-0 transition-all duration-500" />
                  <div className="absolute -bottom-4 -right-4 bg-[#06090f] border border-slate-700 p-2.5 rounded-xl shadow-xl z-20 group-hover:border-blue-500/50 transition-colors">
                    {getRoleIcon(player.primary_role, "w-6 h-6")}
                  </div>
                </div>
              </div>
              
              <h2 className="text-3xl font-black mt-8 text-white tracking-tighter drop-shadow-md">{player.nickname}</h2>
              <div className="flex items-center gap-2 mt-2">
                 <p className="text-blue-400 text-[9px] tracking-[0.3em] uppercase font-mono bg-blue-900/20 px-3 py-1.5 rounded-md border border-blue-500/20">{player.team_acronym}</p>
                 <p className="text-slate-400 text-[9px] tracking-[0.3em] uppercase font-mono bg-slate-800/50 px-3 py-1.5 rounded-md border border-slate-700/50">{player.primary_role}</p>
              </div>

              {/* OVERALL EM DESTAQUE */}
              {filteredMatches.length > 0 && (
                <div className="mt-8 text-center w-full border-t border-slate-800/60 pt-6">
                   <p className="text-[8px] text-slate-500 font-black tracking-[0.3em] uppercase mb-1">RATING TÁTICO</p>
                   <p className={`text-5xl font-black ${getScoreColor(playerStatsFiltered.avg).split(' ')[0]}`}>{Math.round(playerStatsFiltered.avg)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="bg-slate-950/80 py-3 px-6 border-b border-slate-800 flex justify-between items-center">
              <p className="text-[8px] text-slate-400 tracking-[0.3em] uppercase">Estatísticas Filtradas</p>
              <span className="text-[7px] font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">LIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-800">
              <StatBadge label="LANE" val={playerStatsFiltered.lane} />
              <StatBadge label="IMPACTO" val={playerStatsFiltered.impact} />
              <StatBadge label="CONV" val={playerStatsFiltered.conv} />
              <StatBadge label="VISION" val={playerStatsFiltered.vision} />
            </div>
          </div>

          {/* Módulo 3: Champion Pool */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[32px] p-6 shadow-2xl backdrop-blur-md">
            <p className="text-[9px] text-slate-400 tracking-[0.3em] uppercase mb-4 border-b border-slate-800/80 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rotate-45"></span>
              Operativos Utilizados
            </p>
            
            <div className="space-y-2 relative">
              {topChampions.length === 0 ? (
                 <div className="text-center py-10 text-slate-600 text-xs tracking-widest font-black uppercase">SEM JOGOS NO FILTRO</div>
              ) : (
                topChampions.map((c: any) => {
                  const winrate = Math.round((c.wins / c.games) * 100);
                  const losses = c.games - c.wins;
                  
                  return (
                    <div key={c.name} className="relative group flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/50 hover:border-blue-500/30 hover:bg-slate-900 transition-all cursor-help">
                      <div className="flex items-center gap-3">
                        <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.name}.png`} className="w-7 h-7 rounded border border-slate-700 group-hover:border-blue-400/50 transition-colors grayscale-[30%] group-hover:grayscale-0" alt={c.name} />
                        <div className="text-left">
                          <p className="text-[10px] text-slate-200">{c.name}</p>
                          <p className="text-[8px] text-slate-500 font-mono">{c.games} MATCHES</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[11px] font-black ${winrate >= 60 ? 'text-blue-400' : winrate < 50 ? 'text-red-400' : 'text-slate-300'}`}>{winrate}%</p>
                        <p className="text-[7px] text-slate-500 font-mono">WINRATE</p>
                      </div>

                      {/* POPOVER */}
                      <div className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 w-52 bg-[#0a0f18] border border-slate-700 rounded-2xl p-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[300]">
                        <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-[#0a0f18] border-l border-b border-slate-700 rotate-45"></div>

                        <div className="relative z-10">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                            <p className="text-[12px] text-white uppercase">{c.name}</p>
                            <p className="text-[10px] font-mono"><span className="text-blue-400">{c.wins}W</span> - <span className="text-red-400">{losses}L</span></p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                            <div><p className="text-slate-500 mb-0.5 text-[8px]">LANE</p><p className={getScoreColorText(c.ml)}>{Math.round(c.ml)}</p></div>
                            <div><p className="text-slate-500 mb-0.5 text-[8px]">IMPACTO</p><p className={getScoreColorText(c.mi)}>{Math.round(c.mi)}</p></div>
                            <div><p className="text-slate-500 mb-0.5 text-[8px]">CONVERSÃO</p><p className={getScoreColorText(c.mc)}>{Math.round(c.mc)}</p></div>
                            <div><p className="text-slate-500 mb-0.5 text-[8px]">VISÃO</p><p className={getScoreColorText(c.mv)}>{Math.round(c.mv)}</p></div>
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center">
                             <p className="text-slate-500 text-[8px]">NOTA MÉDIA GERAL</p>
                             <p className={`text-[12px] font-black ${getScoreColorText(c.avg)}`}>{Math.round(c.avg)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-9 space-y-8">
          
          {filteredMatches.length === 0 ? (
             <div className="bg-slate-900/40 border border-slate-800 rounded-[40px] p-20 flex flex-col items-center justify-center text-center shadow-inner h-full min-h-[600px]">
               <span className="text-6xl mb-6 grayscale opacity-20">🗄️</span>
               <h3 className="text-3xl text-slate-500 font-black italic">SEM DADOS TÁTICOS DISPONÍVEIS</h3>
               <p className="text-[10px] text-slate-600 mt-3 uppercase tracking-widest max-w-md">O filtro selecionado não retornou nenhuma partida. Altere a timeline ou o adversário no painel de controle acima.</p>
             </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <ChartWrapper title="Eficiência de Recursos (GPM x DPM)">
                  <ResponsiveContainer width="100%" height={240}>
                    <ScatterChart margin={{ top: 20, right: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                      <XAxis type="number" dataKey="x" stroke="#475569" fontSize={10} domain={['dataMin - 30', 'dataMax + 30']} />
                      <YAxis type="number" dataKey="y" stroke="#475569" fontSize={10} domain={['dataMin - 50', 'dataMax + 50']} />
                      <ZAxis type="number" dataKey="z" range={[400, 4500]} domain={['dataMin', 'dataMax']} />
                      <Tooltip content={<CustomCommonTooltip teams={teams} />} />
                      <Scatter data={bubbleData} dataKey="z">
                        {bubbleData.map((e, i) => (<Cell key={i} fill={e.is_win ? '#3b82f6' : '#ef4444'} fillOpacity={0.6} stroke="#06090f" strokeWidth={1} />))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartWrapper>

                <ChartWrapper title="Histórico de Notas (Performance)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={filteredMatches.slice(-12)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                      <YAxis domain={[40, 100]} stroke="#475569" fontSize={10}/>
                      <Tooltip content={<CustomCommonTooltip teams={teams} />}/>
                      <Legend iconType="circle" wrapperStyle={{fontSize: '9px', paddingTop: '10px'}}/>
                      <Line type="monotone" dataKey="lane_rating" name="Lane" stroke="#c084fc" strokeWidth={3} dot={{r:3}}/>
                      <Line type="monotone" dataKey="impact_rating" name="Impact" stroke="#60a5fa" strokeWidth={3} dot={{r:3}}/>
                      <Line type="monotone" dataKey="conversion_rating" name="Conv." stroke="#34d399" strokeWidth={3} dot={{r:3}}/>
                      <Line type="monotone" dataKey="vision_rating" name="Visão" stroke="#fbbf24" strokeWidth={3} dot={{r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </ChartWrapper>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ChartWrapper title="Win Chance by Gold Diff @ 12"><ResponsiveContainer width="100%" height={240}><AreaChart data={goldChanceCurve}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/><XAxis dataKey="val" stroke="#475569" fontSize={10} tickFormatter={(v)=>`${v>0?'+':''}${v}`}/><YAxis unit="%" stroke="#475569" fontSize={10}/><Tooltip content={<CustomProbabilityTooltip />}/><Area type="linear" dataKey="chance" stroke="#fbbf24" strokeWidth={3} strokeDasharray="5 5" fill="#fbbf24" fillOpacity={0.05} connectNulls/></AreaChart></ResponsiveContainer></ChartWrapper>
                <ChartWrapper title="Win Chance by XP Diff @ 12"><ResponsiveContainer width="100%" height={240}><AreaChart data={xpChanceCurve}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/><XAxis dataKey="val" stroke="#475569" fontSize={10} tickFormatter={(v)=>`${v>0?'+':''}${v}`}/><YAxis unit="%" stroke="#475569" fontSize={10}/><Tooltip content={<CustomProbabilityTooltip />}/><Area type="linear" dataKey="chance" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" fill="#3b82f6" fillOpacity={0.05} connectNulls/></AreaChart></ResponsiveContainer></ChartWrapper>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ChartWrapper title="Distribuição Gold Diff @ 12 (BoxPlot)"><ResponsiveContainer width="100%" height={240}><ComposedChart data={goldBoxPlotData} margin={{ top: 20, right: 30, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/><XAxis dataKey="name" stroke="#475569" fontSize={10}/><YAxis stroke="#475569" fontSize={10}/><Tooltip content={<CustomBoxPlotTooltip />}/><Bar dataKey="q1" stackId="a" fill="transparent" /><Bar dataKey="q3_diff" stackId="a" fillOpacity={0.3}>{goldBoxPlotData.map((e, i) => (<Cell key={i} fill={e.color} stroke={e.color} strokeWidth={2} />))}</Bar></ComposedChart></ResponsiveContainer></ChartWrapper>
                <ChartWrapper title="Distribuição XP Diff @ 12 (BoxPlot)"><ResponsiveContainer width="100%" height={240}><ComposedChart data={xpBoxPlotData} margin={{ top: 20, right: 30, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/><XAxis dataKey="name" stroke="#475569" fontSize={10}/><YAxis stroke="#475569" fontSize={10}/><Tooltip content={<CustomBoxPlotTooltip />}/><Bar dataKey="q1" stackId="a" fill="transparent" /><Bar dataKey="q3_diff" stackId="a" fillOpacity={0.3}>{xpBoxPlotData.map((e, i) => (<Cell key={i} fill={e.color} stroke={e.color} strokeWidth={2} />))}</Bar></ComposedChart></ResponsiveContainer></ChartWrapper>
              </div>

              <div className="bg-slate-900/10 border border-slate-800/40 rounded-[48px] p-8 shadow-inner">
                <h3 className="text-blue-500 text-[10px] tracking-[0.5em] mb-10 text-center font-black italic uppercase">Matriz Relacional de Performance</h3>
                <div className="grid grid-cols-2 gap-8">
                  <RelationalChart title="Mortes@12 vs Mortes Totais" data={filteredMatches} teams={teams} x="deaths_at_12" y="deaths" xN="M@12" yN="Total" />
                  <RelationalChart title="KP% vs Visão por Minuto" data={filteredMatches} teams={teams} x="kp_val" y="vspm" xN="KP%" yN="VPM" />
                  <RelationalChart title="Mortes@12 vs XP Diff@12" data={filteredMatches} teams={teams} x="deaths_at_12" y="xp_diff_at_12" xN="M@12" yN="XP Diff" />
                  <RelationalChart title="KP% vs XP Diff@12" data={filteredMatches} teams={teams} x="kp_val" y="xp_diff_at_12" xN="KP%" yN="XP Diff" />
                  <RelationalChart title="Farm@12 vs XP Diff@12" data={filteredMatches} teams={teams} x="cs_at_12" y="xp_diff_at_12" xN="CS@12" yN="XP Diff" />
                  <RelationalChart title="Mortes vs Kill Participation" data={filteredMatches} teams={teams} x="deaths" y="kp_val" xN="Mortes" yN="KP%" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

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

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="TIMELINE" value={value} onChange={onChange} color="emerald" options={[
    { id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, 
    { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }
  ]} />
}

function RelationalChart({ title, data, teams, x, y, xN, yN }: any) {
  const stats = useMemo(() => calculateRegression(data, x, y), [data, x, y]);
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 relative group transition-all hover:border-blue-500/30">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{title}</p>
        <div className="bg-blue-600/20 border border-blue-500/40 px-3 py-1 rounded shadow-lg">
          <p className="text-[11px] text-blue-400 font-mono font-black italic">R² = {stats.r2.toFixed(2)}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" dataKey={x} stroke="#475569" fontSize={8} domain={['auto', 'auto']} />
          <YAxis type="number" dataKey={y} stroke="#475569" fontSize={8} domain={['auto', 'auto']} />
          <Tooltip content={<CustomCommonTooltip teams={teams} />} />
          <Line data={stats.points} type="linear" dataKey={y} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
          <Scatter data={data} name="Partidas">{data.map((e: any, i: number) => (<Cell key={i} fill={e.is_win ? '#3b82f6' : '#ef4444'} fillOpacity={0.4} />))}</Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomCommonTooltip({ active, payload, teams, showMetrics }: any) {
  if (active && payload && payload.length) {
    const data = payload.find((p: any) => p.payload?.champion)?.payload || payload[0].payload;
    if (!data || !data.champion) return null;
    const opponentTeam = teams.find((t: any) => t.acronym.toLowerCase() === (data.opponent_acronym || '').toLowerCase());
    return (
      <div className="bg-slate-950 border border-slate-700 p-4 rounded-2xl shadow-2xl font-mono text-[10px] z-[500]">
        <div className="flex items-center gap-3 mb-3 border-b border-slate-800 pb-2">
          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${data.champion}.png`} className="w-10 h-10 rounded-lg shadow-lg" alt={data.champion} />
          <div className="flex-1 leading-none">
            <p className="text-[11px] text-white font-black uppercase mb-1">{data.champion}</p>
            <div className="flex items-center gap-1.5">
               {opponentTeam?.logo_url && <img src={opponentTeam.logo_url} className="w-3.5 h-3.5 object-contain" alt="" />}
               <p className="text-slate-500 uppercase font-black">VS {data.opponent_acronym} • {data.side}</p>
            </div>
          </div>
        </div>
        {payload.map((p: any) => (<p key={p.dataKey || p.name} style={{color: p.color}}>{p.name === 'z' ? 'EFF' : (p.name || p.dataKey).toUpperCase()}: {p.name === 'z' ? Number(p.value).toFixed(1) + '%' : Math.round(p.value)}</p>))}
        {!showMetrics && <p className={`mt-2 font-black border-t border-slate-800 pt-1 ${data.is_win ? 'text-blue-400' : 'text-red-400'}`}>RESULTADO: {data.is_win ? 'VITÓRIA' : 'DERROTA'}</p>}
      </div>
    );
  }
  return null;
}

function GuideSection({ title, text }: any) { return ( <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl"><h3 className="text-blue-400 font-black italic uppercase mb-2">// {title}</h3><p className="text-slate-400 text-[11px] leading-relaxed tracking-wider uppercase">{text}</p></div> ); }

function StatBadge({ label, val }: any) { 
  const c = getScoreColor(val); 
  const textColorClass = c.split(' ').find(cls => cls.startsWith('text-')) || 'text-slate-400';
  const bgColorClass = c.split(' ').find(cls => cls.startsWith('bg-')) || 'bg-slate-800';
  
  return ( 
    <div className="bg-[#06090f] p-4 flex flex-col items-center justify-center relative overflow-hidden group">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${bgColorClass}`}></div>
      
      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 relative z-10">{label}</p>
      <p className={`text-2xl font-black relative z-10 ${textColorClass}`}>{Math.round(val || 0)}</p>
    </div> 
  ); 
}

function ChartWrapper({ title, children }: any) { return ( <div className="bg-slate-900/20 border border-slate-800 rounded-[40px] p-8 h-[320px] flex flex-col shadow-xl overflow-hidden"><h3 className="text-[10px] text-slate-500 mb-6 text-center font-black uppercase tracking-widest">{title}</h3><div className="flex-1 min-h-[240px]">{children}</div></div> ); }
function CustomBoxPlotTooltip({ active, payload }: any) { if (active && payload && payload.length) { const data = payload[0].payload; return ( <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl font-mono text-[10px]"><p className="border-b border-slate-800 pb-2 mb-2 font-black italic uppercase" style={{ color: data.color }}>{data.name}</p><p>MÁX: {Math.round(data.max)}</p><p>Q3: {Math.round(data.q3)}</p><p className="text-blue-400">MED: {Math.round(data.median)}</p><p>Q1: {Math.round(data.q1)}</p><p>MÍN: {Math.round(data.min)}</p><p className="pt-2 opacity-50 uppercase text-[8px]">N: {data.count} JOGOS</p></div> ); } return null; }
function CustomProbabilityTooltip({ active, payload }: any) { if (active && payload && payload.length) { const data = payload[0].payload; if (data.chance === null) return null; return ( <div className="bg-slate-950 border border-slate-700 p-4 rounded-2xl shadow-2xl"><p className="text-[8px] text-slate-500 uppercase font-black mb-1">Métrica: {data.val > 0 ? '+' : ''}{data.val} {data.type}</p><p className={`text-[18px] font-black italic ${data.chance >= 60 ? 'text-emerald-400' : 'text-yellow-400'}`}>{data.chance}% CHANCE</p><p className="text-[9px] text-slate-400 mt-2 font-black uppercase opacity-60">{data.wins} / {data.total} VITÓRIAS</p></div> ); } return null; }