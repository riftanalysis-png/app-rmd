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

// --- CORES TIER 2 (FLAT DESIGN + GLOW) ---
function getScoreColor(score: any) {
  const s = Number(score);
  if (!s || s === 0) return "text-zinc-600";
  if (s >= 90) return "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"; 
  if (s >= 80) return "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]";     
  if (s >= 70) return "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"; 
  if (s >= 60) return "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]";  
  return "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]";                                 
}

function getScoreColorText(score: any) {
  const s = Number(score);
  if (!s || s === 0) return "text-zinc-600";
  if (s >= 90) return "text-purple-400"; 
  if (s >= 80) return "text-blue-400";     
  if (s >= 70) return "text-emerald-400"; 
  if (s >= 60) return "text-amber-400";  
  return "text-red-400";
}

function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777') return DEFAULT_AVATAR;
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sanitized}_0.jpg`;
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
  
  const [player, setPlayer] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [rosterList, setRosterList] = useState<any[]>([]); 
  const [allMatchesRaw, setAllMatchesRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<any>(null);
  
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(["CIRCUITO_DESAFIANTE"]);
  const [globalSplit, setGlobalSplit] = useState("ALL");
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');
  const [opponentFilter, setOpponentFilter] = useState<string>('ALL');

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

  const filteredMatches = useMemo(() => {
    return allMatchesRaw.filter(m => {
      if (!globalTournaments.includes('ALL')) {
        if (!globalTournaments.includes(m.game_type?.toUpperCase())) return false;
      }
      if (globalSplit !== 'ALL' && m.split?.toUpperCase() !== globalSplit.toUpperCase()) return false;
      if (sideFilter !== 'ALL' && m.side?.toUpperCase() !== sideFilter) return false;
      if (opponentFilter !== 'ALL' && m.opponent_acronym?.toUpperCase() !== opponentFilter.toUpperCase()) return false;
      return true;
    });
  }, [allMatchesRaw, globalTournaments, globalSplit, sideFilter, opponentFilter]);

  const availableOpponents = useMemo(() => {
    const opps = new Set(filteredMatches.map(m => m.opponent_acronym?.toUpperCase()));
    opps.delete('MIX'); 
    opps.delete(undefined);
    return Array.from(opps).sort() as string[];
  }, [filteredMatches]);

  const displayedTeams = useMemo(() => {
    if (!teams.length || !rosterList.length) return teams;
    const validTourneys = Array.from(new Set(allMatchesRaw.map(m => m.game_type).filter(g => g && g !== 'UNKNOWN')));
    const activeInTourney = new Set(
       rosterList
         .filter(r => validTourneys.includes(r.game_type?.toUpperCase() || r.game_type))
         .map(r => r.team_acronym?.toUpperCase())
    );
    return teams.filter(t => activeInTourney.has(t.acronym?.toUpperCase()) || t.acronym?.toUpperCase() === player?.team_acronym?.toUpperCase());
  }, [teams, rosterList, allMatchesRaw, player]);

  const bubbleData = useMemo(() => filteredMatches.map(m => ({ 
    x: Math.round(Number(m.gpm) || 0), 
    y: Math.round(Number(m.dpm) || 0), 
    z: m.eff_val, 
    is_win: m.is_win, 
    champion: m.champion, 
    opponent_acronym: m.opponent_acronym, 
    side: m.side 
  })), [filteredMatches]);
  
  const goldBoxPlotData = useMemo(() => {
    const wins = filteredMatches.filter(m => m.is_win).map(m => Number(m.gold_diff_at_12) || 0); const losses = filteredMatches.filter(m => !m.is_win).map(m => Number(m.gold_diff_at_12) || 0);
    return [{ name: 'VITÓRIAS', ...calculateBoxPlotStats(wins), color: '#3b82f6' }, { name: 'DERROTAS', ...calculateBoxPlotStats(losses), color: '#ef4444' }];
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

  // Main Champion Banner Logic
  const mainChampName = topChampions.length > 0 ? topChampions[0].name : null;
  const mainChampSplash = mainChampName ? getChampionSplashUrl(mainChampName) : null;

  if (loading && !player) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">Sincronizando Operativo...</p>
    </div>
  );
  if (!loading && !player) return <div className="p-20 text-red-500 font-black text-center uppercase tracking-widest">Operativo não encontrado no banco de dados.</div>;

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-8 space-y-12 font-sans pb-20 overflow-visible">
      
      {/* HEADER */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800 pb-8 relative z-[250]">
        <div className="flex items-center gap-6">
           <Link href="/dashboard/players" className="w-12 h-12 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 hover:scale-105 transition-all duration-300 group shadow-md">
             <span className="text-xl text-zinc-500 group-hover:text-white transition-colors">←</span>
           </Link>
           <div className="animate-fade-in-right">
             <h1 className="text-4xl font-black text-white uppercase tracking-tight">OPERATIVE <span className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">INTEL</span></h1>
             <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-2 uppercase">DOSSIER TÁTICO INDIVIDUAL</p>
           </div>
        </div>

        <div className="flex gap-4 items-end bg-transparent animate-fade-in-down">
           <TournamentMultiSelector value={globalTournaments} onChange={setGlobalTournaments} />
           <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
        </div>
      </header>

      {/* BARRA DE TIMES E MICRO-ANÁLISE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-[200] overflow-visible">
        
        <div className="flex flex-wrap justify-start gap-2 bg-zinc-900/80 p-1.5 rounded-lg border border-zinc-800/80 max-w-full overflow-x-auto custom-scrollbar flex-1 backdrop-blur-sm" ref={dropdownRef}>
            {displayedTeams.map((t: any) => {
              const teamRoster = sortPlayersByRole(allPlayers.filter((p:any) => p.team_acronym === t.acronym));
              const isSelected = t.acronym === player.team_acronym || activeDropdown === t.acronym;
              
              return (
                <div key={t.acronym} className="relative">
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === t.acronym ? null : t.acronym)} 
                    className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${isSelected ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                  >
                    <img src={t.logo_url} className={`w-4 h-4 object-contain transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`} alt={t.acronym} />
                    {t.acronym}
                  </button>
                  
                  {activeDropdown === t.acronym && (
                    <div className="absolute top-full left-0 mt-2 bg-zinc-900/95 border border-zinc-700/50 rounded-lg shadow-2xl min-w-[180px] overflow-hidden z-[9999] backdrop-blur-md animate-fade-in-down origin-top">
                      {teamRoster.map((tm:any) => (
                        <button key={tm.puuid} onClick={() => { router.push(`/dashboard/players/${tm.puuid}`); setActiveDropdown(null); }} className={`w-full flex items-center gap-3 px-4 py-3 text-[10px] hover:bg-zinc-800 border-b border-zinc-800/50 last:border-0 transition-all duration-200 ${tm.puuid === player.puuid ? 'bg-zinc-800 text-blue-400 font-black pl-5' : 'text-zinc-300 font-bold uppercase'}`}>
                          <span className="opacity-80">{getRoleIcon(tm.primary_role, "w-4 h-4")}</span>
                          {tm.nickname}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {displayedTeams.length === 0 && (
               <p className="text-[10px] text-zinc-500 font-bold py-2 uppercase tracking-widest px-4">SEM TIMES DISPONÍVEIS</p>
            )}
        </div>

        <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto justify-end">
           <div className="flex items-center gap-2">
              <CockpitDropdown 
                 label="ADVERSÁRIO" 
                 value={opponentFilter} 
                 onChange={setOpponentFilter} 
                 options={[{ id: 'ALL', label: 'TODOS OS TIMES' }, ...availableOpponents.map(opp => ({ id: opp, label: opp }))]} 
               />
           </div>

           <div className="flex bg-zinc-900/80 p-1.5 rounded-lg border border-zinc-800/80 backdrop-blur-sm">
             <button onClick={() => setSideFilter('ALL')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 ${sideFilter === 'ALL' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>BOTH</button>
             <button onClick={() => setSideFilter('BLUE')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 flex items-center gap-1.5 ${sideFilter === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}><div className="w-1.5 h-1.5 rounded-full bg-current"></div> BLUE</button>
             <button onClick={() => setSideFilter('RED')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 flex items-center gap-1.5 ${sideFilter === 'RED' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}><div className="w-1.5 h-1.5 rounded-full bg-current"></div> RED</button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* COLUNA ESQUERDA (PERFIL E CHAMPIONS) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 z-[150] sticky top-6 h-fit">
          
          {/* CARTINHA DO OPERATIVO COM SPLASH ART ANIMADA */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl relative overflow-hidden shadow-xl flex flex-col items-center group transition-all duration-500 hover:border-zinc-700 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            
            {/* Background Splash Art Dynamica */}
            {mainChampSplash && (
              <div className="absolute inset-0 z-0 transition-all duration-700 opacity-20 group-hover:opacity-40 group-hover:scale-105">
                <img src={mainChampSplash} className="w-full h-full object-cover object-[center_30%]" alt="" />
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-[#18181b]/80 to-[#18181b]" />
              </div>
            )}

            <div className="relative z-10 w-full p-8 flex flex-col items-center">
              <p className="absolute top-6 left-6 text-[8px] text-zinc-400 font-bold tracking-widest uppercase bg-zinc-950/60 px-2 py-1 rounded backdrop-blur-sm border border-zinc-800/50">ID: {(player.puuid || "00").substring(0,8)}</p>
              <div className="absolute top-6 right-6 bg-zinc-950/60 backdrop-blur-sm px-2.5 py-1.5 rounded border border-zinc-800/50">
                 <p className="text-[8px] text-zinc-300 font-bold uppercase tracking-widest"><span className="text-blue-400">{filteredMatches.length}</span> GAMES</p>
              </div>

              <div className="relative mt-10 mb-6 group-hover:-translate-y-2 transition-transform duration-500">
                <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-700"></div>
                <div className="relative w-36 h-36 rounded-2xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl overflow-visible">
                  <img src={player.photo_url || DEFAULT_AVATAR} alt={player.nickname} className="w-full h-full object-cover rounded-xl grayscale-[30%] group-hover:grayscale-0 transition-all duration-500" />
                  <div className="absolute -bottom-4 -right-4 bg-zinc-950 border border-zinc-700 p-2.5 rounded-xl shadow-xl z-20 group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-300">
                    {getRoleIcon(player.primary_role, "w-6 h-6")}
                  </div>
                </div>
              </div>
                
              <h2 className="text-3xl font-black mt-2 text-white uppercase tracking-tight drop-shadow-md">{player.nickname}</h2>
              <div className="flex items-center gap-2 mt-3 mb-4">
                 <p className="text-blue-400 text-[10px] tracking-widest uppercase font-bold bg-blue-900/20 px-2.5 py-1 rounded border border-blue-900/30 backdrop-blur-sm">{player.team_acronym}</p>
                 <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-bold bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-700/50 backdrop-blur-sm">{player.primary_role}</p>
              </div>

              {/* OVERALL EM DESTAQUE */}
              {filteredMatches.length > 0 && (
                <div className="w-full pt-6 flex flex-col items-center mt-2 group-hover:scale-105 transition-transform duration-500">
                   <p className="text-[9px] text-zinc-400 font-bold tracking-[0.2em] uppercase mb-1">RATING TÁTICO</p>
                   <p className={`text-5xl font-black transition-colors duration-500 ${getScoreColor(playerStatsFiltered.avg)}`}>{Math.round(playerStatsFiltered.avg)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl overflow-hidden shadow-sm transition-all duration-500 hover:border-zinc-700 hover:shadow-lg hover:-translate-y-1">
            <div className="bg-zinc-900/80 py-4 px-6 border-b border-zinc-800 flex justify-between items-center backdrop-blur-sm">
              <p className="text-[9px] text-zinc-400 tracking-widest font-bold uppercase">Estatísticas (Filtro)</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-zinc-800">
              <StatBadge label="LANE" val={playerStatsFiltered.lane} />
              <StatBadge label="IMPACTO" val={playerStatsFiltered.impact} />
              <StatBadge label="CONV" val={playerStatsFiltered.conv} />
              <StatBadge label="VISION" val={playerStatsFiltered.vision} />
            </div>
          </div>

          {/* Módulo 3: Champion Pool (Cards Interativos) */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 shadow-sm transition-all duration-500 hover:border-zinc-700">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-5 border-b border-zinc-800 pb-3 flex items-center gap-2">
              Operativos Utilizados
            </p>
            
            <div className="space-y-3">
              {topChampions.length === 0 ? (
                 <div className="text-center py-6 text-zinc-600 text-[10px] tracking-widest font-bold uppercase">SEM JOGOS NO FILTRO</div>
              ) : (
                topChampions.map((c: any) => {
                  const winrate = Math.round((c.wins / c.games) * 100);
                  const losses = c.games - c.wins;
                  const champSplash = getChampionSplashUrl(c.name);
                  
                  return (
                    <div key={c.name} className="relative group flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all duration-300 cursor-help overflow-hidden hover:-translate-y-0.5 hover:shadow-md">
                      
                      {/* Fundo do Card (Splash Art + Gradiente) */}
                      <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                         <img src={champSplash} className="w-full h-full object-cover object-[center_20%]" alt="" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent z-0" />

                      <div className="relative z-10 flex items-center gap-3">
                        <img src={getChampionImageUrl(c.name)} className="w-9 h-9 rounded-lg border border-zinc-700 group-hover:border-zinc-400 transition-colors shadow-sm" alt={c.name} />
                        <div className="text-left">
                          <p className="text-[12px] font-black text-white uppercase drop-shadow-md">{c.name}</p>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{c.games} GAMES</p>
                        </div>
                      </div>
                      <div className="relative z-10 text-right">
                        <p className={`text-[13px] font-black drop-shadow-md ${winrate >= 60 ? 'text-blue-400' : winrate < 50 ? 'text-red-400' : 'text-zinc-200'}`}>{winrate}%</p>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">WR</p>
                      </div>

                      {/* POPOVER ANIMADO */}
                      <div className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 w-52 bg-zinc-950/95 backdrop-blur-md border border-zinc-700/50 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[300] origin-left scale-95 group-hover:scale-100">
                        <div className="relative z-10">
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4">
                            <p className="text-[11px] font-black text-white uppercase tracking-widest">{c.name}</p>
                            <p className="text-[10px] font-black bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"><span className="text-blue-500">{c.wins}W</span> <span className="text-zinc-600 px-0.5">-</span> <span className="text-red-500">{losses}L</span></p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-[9px] font-bold">
                            <div><p className="text-zinc-500 mb-1 text-[8px] uppercase tracking-widest">LANE</p><p className={`text-sm font-black ${getScoreColorText(c.ml)}`}>{Math.round(c.ml)}</p></div>
                            <div><p className="text-zinc-500 mb-1 text-[8px] uppercase tracking-widest">IMPACTO</p><p className={`text-sm font-black ${getScoreColorText(c.mi)}`}>{Math.round(c.mi)}</p></div>
                            <div><p className="text-zinc-500 mb-1 text-[8px] uppercase tracking-widest">CONV.</p><p className={`text-sm font-black ${getScoreColorText(c.mc)}`}>{Math.round(c.mc)}</p></div>
                            <div><p className="text-zinc-500 mb-1 text-[8px] uppercase tracking-widest">VISÃO</p><p className={`text-sm font-black ${getScoreColorText(c.mv)}`}>{Math.round(c.mv)}</p></div>
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                             <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-widest">RATING TÁTICO</p>
                             <p className={`text-[14px] font-black ${getScoreColorText(c.avg)}`}>{Math.round(c.avg)}</p>
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

        {/* COLUNA DIREITA: GRÁFICOS (HOVERS E ANIMAÇÕES) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {filteredMatches.length === 0 ? (
             <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center shadow-sm min-h-[600px] h-full animate-fade-in">
               <h3 className="text-2xl text-zinc-500 font-black uppercase tracking-tight">SEM DADOS DISPONÍVEIS</h3>
               <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest font-bold max-w-md">O filtro selecionado não retornou nenhuma partida. Altere a timeline ou o adversário no painel de controle acima.</p>
             </div>
          ) : (
            <div className="animate-fade-in-up">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartWrapper title="Eficiência de Recursos (GPM x DPM)">
                  <ResponsiveContainer width="100%" height={240}>
                    <ScatterChart margin={{ top: 20, right: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                      <XAxis type="number" dataKey="x" stroke="#71717a" fontSize={10} domain={['dataMin - 30', 'dataMax + 30']} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v).toString()} />
                      <YAxis type="number" dataKey="y" stroke="#71717a" fontSize={10} domain={['dataMin - 50', 'dataMax + 50']} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v).toString()} />
                      <ZAxis type="number" dataKey="z" range={[400, 4500]} domain={['dataMin', 'dataMax']} />
                      <Tooltip content={<CustomCommonTooltip teams={teams} />} cursor={{strokeDasharray: '3 3', stroke: '#3f3f46'}}/>
                      <Scatter data={bubbleData} dataKey="z" animationDuration={1000}>
                        {bubbleData.map((e, i) => (<Cell key={i} fill={e.is_win ? '#3b82f6' : '#ef4444'} fillOpacity={0.8} className="hover:opacity-100 transition-opacity cursor-crosshair" />))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartWrapper>

                <ChartWrapper title="Histórico de Notas (Performance)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={filteredMatches.slice(-12)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                      <YAxis domain={[40, 100]} stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/>
                      <Tooltip content={<CustomCommonTooltip teams={teams} />} cursor={{strokeDasharray: '3 3', stroke: '#3f3f46'}}/>
                      <Legend iconType="circle" wrapperStyle={{fontSize: '9px', paddingTop: '10px', fontWeight: 'bold'}}/>
                      <Line type="monotone" dataKey="lane_rating" name="Lane" stroke="#c084fc" strokeWidth={2} dot={{r:3, strokeWidth: 2, fill: '#18181b'}} activeDot={{r: 5, strokeWidth: 0}} animationDuration={1500}/>
                      <Line type="monotone" dataKey="impact_rating" name="Impacto" stroke="#60a5fa" strokeWidth={2} dot={{r:3, strokeWidth: 2, fill: '#18181b'}} activeDot={{r: 5, strokeWidth: 0}} animationDuration={1500}/>
                      <Line type="monotone" dataKey="conversion_rating" name="Conv." stroke="#34d399" strokeWidth={2} dot={{r:3, strokeWidth: 2, fill: '#18181b'}} activeDot={{r: 5, strokeWidth: 0}} animationDuration={1500}/>
                      <Line type="monotone" dataKey="vision_rating" name="Visão" stroke="#fbbf24" strokeWidth={2} dot={{r:3, strokeWidth: 2, fill: '#18181b'}} activeDot={{r: 5, strokeWidth: 0}} animationDuration={1500}/>
                    </LineChart>
                  </ResponsiveContainer>
                </ChartWrapper>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartWrapper title="Win Chance by Gold Diff @ 12"><ResponsiveContainer width="100%" height={240}><AreaChart data={goldChanceCurve}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/><XAxis dataKey="val" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v)=>`${v>0?'+':''}${v}`}/><YAxis unit="%" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><Tooltip content={<CustomProbabilityTooltip />}/><Area type="linear" dataKey="chance" stroke="#fbbf24" strokeWidth={2} fill="#fbbf24" fillOpacity={0.1} connectNulls animationDuration={1200}/></AreaChart></ResponsiveContainer></ChartWrapper>
                <ChartWrapper title="Win Chance by XP Diff @ 12"><ResponsiveContainer width="100%" height={240}><AreaChart data={xpChanceCurve}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/><XAxis dataKey="val" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v)=>`${v>0?'+':''}${v}`}/><YAxis unit="%" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><Tooltip content={<CustomProbabilityTooltip />}/><Area type="linear" dataKey="chance" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.1} connectNulls animationDuration={1200}/></AreaChart></ResponsiveContainer></ChartWrapper>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartWrapper title="Distribuição Gold Diff @ 12 (BoxPlot)"><ResponsiveContainer width="100%" height={240}><ComposedChart data={goldBoxPlotData} margin={{ top: 20, right: 30, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/><XAxis dataKey="name" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><Tooltip content={<CustomBoxPlotTooltip />} cursor={{fill: '#27272a', opacity: 0.4}}/><Bar dataKey="q1" stackId="a" fill="transparent" /><Bar dataKey="q3_diff" stackId="a" fillOpacity={0.8} radius={4} animationDuration={1000}>{goldBoxPlotData.map((e, i) => (<Cell key={i} fill={e.color} className="hover:opacity-100 transition-opacity cursor-pointer" />))}</Bar></ComposedChart></ResponsiveContainer></ChartWrapper>
                <ChartWrapper title="Distribuição XP Diff @ 12 (BoxPlot)"><ResponsiveContainer width="100%" height={240}><ComposedChart data={xpBoxPlotData} margin={{ top: 20, right: 30, left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/><XAxis dataKey="name" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}/><Tooltip content={<CustomBoxPlotTooltip />} cursor={{fill: '#27272a', opacity: 0.4}}/><Bar dataKey="q1" stackId="a" fill="transparent" /><Bar dataKey="q3_diff" stackId="a" fillOpacity={0.8} radius={4} animationDuration={1000}>{xpBoxPlotData.map((e, i) => (<Cell key={i} fill={e.color} className="hover:opacity-100 transition-opacity cursor-pointer" />))}</Bar></ComposedChart></ResponsiveContainer></ChartWrapper>
              </div>

              <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm transition-all duration-500 hover:border-zinc-700">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
                   <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                     <div className="w-1.5 h-5 bg-blue-500 rounded-sm" /> 
                     Matriz Relacional de Performance
                   </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <RelationalChart title="Mortes@12 vs Mortes Totais" data={filteredMatches} teams={teams} x="deaths_at_12" y="deaths" xN="M@12" yN="Total" />
                  <RelationalChart title="KP% vs Visão por Minuto" data={filteredMatches} teams={teams} x="kp_val" y="vspm" xN="KP%" yN="VPM" />
                  <RelationalChart title="Mortes@12 vs XP Diff@12" data={filteredMatches} teams={teams} x="deaths_at_12" y="xp_diff_at_12" xN="M@12" yN="XP Diff" />
                  <RelationalChart title="KP% vs XP Diff@12" data={filteredMatches} teams={teams} x="kp_val" y="xp_diff_at_12" xN="KP%" yN="XP Diff" />
                  <RelationalChart title="Farm@12 vs XP Diff@12" data={filteredMatches} teams={teams} x="cs_at_12" y="xp_diff_at_12" xN="CS@12" yN="XP Diff" />
                  <RelationalChart title="Mortes vs Kill Participation" data={filteredMatches} teams={teams} x="deaths" y="kp_val" xN="Mortes" yN="KP%" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES (FLAT DESIGN INTERATIVO) ---

function TournamentMultiSelector({ value, onChange }: { value: string[], onChange: (val: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const options = [
    { id: 'ALL', label: 'TODOS OS CAMPEONATOS' },
    { id: 'AMERICAS_CUP', label: 'AMERICAS CUP' },
    { id: 'CBLOL', label: 'CBLOL' },
    { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
    { id: 'EMEA_MASTERS', label: 'EMEA MASTERS' },
    { id: 'FIRST_STAND', label: 'FIRST STAND' },
    { id: 'LCK', label: 'LCK' },
    { id: 'LCS', label: 'LCS' },
    { id: 'LEC', label: 'LEC' },
    { id: 'LPL', label: 'LPL' },
    { id: 'MSI', label: 'MSI' },
    { id: 'MUNDIAL', label: 'MUNDIAL' },
    { id: 'SCRIM', label: 'SCRIMS' } 
  ];

  const toggleOption = (id: string) => {
    if (id === 'ALL') {
      onChange(['ALL']);
      return;
    }
    
    let newValues = value.filter(v => v !== 'ALL');
    if (newValues.includes(id)) {
      newValues = newValues.filter(v => v !== id);
      if (newValues.length === 0) newValues = ['ALL'];
    } else {
      newValues.push(id);
    }
    onChange(newValues);
  };

  const currentLabel = value.includes('ALL') 
    ? 'TODOS OS CAMPEONATOS' 
    : value.length === 1 
      ? options.find(o => o.id === value[0])?.label 
      : `${value.length} CAMPEONATOS`;

  return (
    <div className="relative flex flex-col" ref={ref}>
      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">CAMPEONATO</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[160px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase shadow-sm"
      >
        <span className="flex-1 text-left">{currentLabel}</span>
        <span className={`text-[8px] text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[200px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar animate-fade-in-down origin-top">
          {options.map((opt) => {
            const isSelected = value.includes(opt.id);
            return (
              <button 
                key={opt.id} 
                onClick={() => toggleOption(opt.id)} 
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${isSelected ? 'bg-zinc-800/80 text-white' : 'text-zinc-400'}`}
              >
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                   {isSelected && <span className="text-white text-[9px] font-black">✓</span>}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
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
      {label && <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">{label}</label>}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-md flex items-center justify-between gap-4 min-w-[160px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase shadow-sm"
      >
        <span className="flex-1 text-left">{currentLabel}</span>
        <span className={`text-[8px] text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[160px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar animate-fade-in-down origin-top">
          {options.map((opt:any) => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === opt.id ? 'bg-zinc-800/80 text-white font-black' : 'text-zinc-400 font-bold'}`}
            >
              <span className="text-[10px] uppercase tracking-wide">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return <CockpitDropdown label="TIMELINE" value={value} onChange={onChange} options={[
    { id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, 
    { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }
  ]} />
}

function RelationalChart({ title, data, teams, x, y, xN, yN }: any) {
  const stats = useMemo(() => calculateRegression(data, x, y), [data, x, y]);
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 relative group transition-all duration-300 hover:border-zinc-600 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{title}</p>
        <div className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded shadow-sm group-hover:border-blue-900/50 transition-colors">
          <p className="text-[9px] text-blue-500 font-black">R² = {stats.r2.toFixed(2)}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
          <XAxis type="number" dataKey={x} stroke="#71717a" fontSize={9} domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v).toString()} />
          <YAxis type="number" dataKey={y} stroke="#71717a" fontSize={9} domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v).toString()} />
          <Tooltip content={<CustomCommonTooltip teams={teams} />} cursor={{strokeDasharray: '3 3', stroke: '#3f3f46'}}/>
          <Line data={stats.points} type="linear" dataKey={y} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
          <Scatter data={data} name="Partidas" animationDuration={800}>{data.map((e: any, i: number) => (<Cell key={i} fill={e.is_win ? '#3b82f6' : '#ef4444'} fillOpacity={0.8} className="hover:opacity-100 transition-opacity cursor-crosshair" />))}</Scatter>
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
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700/50 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[500] min-w-[170px] animate-fade-in-up">
        <div className="flex items-center gap-3 mb-3 border-b border-zinc-800 pb-3">
          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${data.champion}.png`} className="w-10 h-10 rounded-lg shadow-sm border border-zinc-700" alt={data.champion} />
          <div className="flex-1 leading-tight">
            <p className="text-[11px] text-white font-black uppercase">{data.champion}</p>
            <div className="flex items-center gap-1.5 mt-1 bg-zinc-900 px-1.5 py-0.5 rounded w-fit">
               {opponentTeam?.logo_url && <img src={opponentTeam.logo_url} className="w-3.5 h-3.5 object-contain" alt="" />}
               <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest">VS {data.opponent_acronym} • {data.side}</p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5 font-bold text-[9px] uppercase tracking-widest text-zinc-400">
          {payload.map((p: any) => (<div key={p.dataKey || p.name} className="flex justify-between items-center"><span style={{color: p.color}}>{p.name === 'z' ? 'EFF' : (p.name || p.dataKey)}</span><span className="text-white font-black">{p.name === 'z' ? Number(p.value).toFixed(1) + '%' : Math.round(p.value)}</span></div>))}
        </div>
        {!showMetrics && <p className={`mt-3 font-black text-[10px] uppercase tracking-widest border-t border-zinc-800 pt-2 text-center ${data.is_win ? 'text-blue-500' : 'text-red-500'}`}>RESULTADO: {data.is_win ? 'VITÓRIA' : 'DERROTA'}</p>}
      </div>
    );
  }
  return null;
}

function StatBadge({ label, val }: any) { 
  const c = getScoreColor(val); 
  return ( 
    <div className="bg-[#18181b] p-5 flex flex-col items-center justify-center transition-colors group">
      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 group-hover:text-zinc-400 transition-colors">{label}</p>
      <p className={`text-3xl font-black transition-transform duration-300 group-hover:scale-110 ${c}`}>{Math.round(val || 0)}</p>
    </div> 
  ); 
}

function ChartWrapper({ title, children }: any) { return ( <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 h-[320px] flex flex-col shadow-sm transition-all duration-300 hover:border-zinc-700 hover:shadow-lg"><h3 className="text-[10px] text-zinc-400 mb-6 font-bold uppercase tracking-widest">{title}</h3><div className="flex-1 min-h-[240px]">{children}</div></div> ); }

function CustomBoxPlotTooltip({ active, payload }: any) { 
  if (active && payload && payload.length) { 
    const data = payload[0].payload; 
    return ( 
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700/50 p-4 rounded-2xl shadow-2xl font-bold text-[9px] uppercase tracking-widest min-w-[140px] animate-fade-in-up">
        <p className="border-b border-zinc-800 pb-2 mb-3 font-black text-[11px]" style={{ color: data.color }}>{data.name}</p>
        <div className="space-y-1.5 text-zinc-400">
          <div className="flex justify-between"><span>MÁX</span><span className="text-white">{Math.round(data.max)}</span></div>
          <div className="flex justify-between"><span>Q3</span><span className="text-white">{Math.round(data.q3)}</span></div>
          <div className="flex justify-between text-blue-500 font-black"><span>MED</span><span>{Math.round(data.median)}</span></div>
          <div className="flex justify-between"><span>Q1</span><span className="text-white">{Math.round(data.q1)}</span></div>
          <div className="flex justify-between"><span>MÍN</span><span className="text-white">{Math.round(data.min)}</span></div>
        </div>
        <p className="pt-3 mt-3 border-t border-zinc-800 text-zinc-500 text-[8px] text-center bg-zinc-900 rounded py-1">GAMES: {data.count}</p>
      </div> 
    ); 
  } 
  return null; 
}

function CustomProbabilityTooltip({ active, payload }: any) { 
  if (active && payload && payload.length) { 
    const data = payload[0].payload; 
    if (data.chance === null) return null; 
    return ( 
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700/50 p-5 rounded-2xl shadow-2xl min-w-[160px] animate-fade-in-up">
        <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1 border-b border-zinc-800 pb-3 flex items-center justify-between">
          <span>Métrica</span>
          <span className="text-white bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{data.val > 0 ? '+' : ''}{data.val} {data.type}</span>
        </p>
        <p className={`text-2xl font-black mt-3 text-center drop-shadow-md ${data.chance >= 60 ? 'text-blue-500' : data.chance < 50 ? 'text-red-400' : 'text-zinc-300'}`}>{data.chance}%</p>
        <p className="text-[8px] text-zinc-500 mt-2 font-bold uppercase tracking-widest text-center">CHANCE DE VITÓRIA</p>
        <div className="mt-3 pt-2 border-t border-zinc-800">
           <p className="text-[9px] text-zinc-400 font-bold uppercase text-center"><span className="text-white">{data.wins}</span> EM <span className="text-white">{data.total}</span> CENÁRIOS</p>
        </div>
      </div> 
    ); 
  } 
  return null; 
}