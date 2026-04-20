"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const DDRAGON_VERSION = '16.5.1'; 
const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
const DEFAULT_AVATAR = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";

// --- FUNÇÕES UTILITÁRIAS ---
function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777') return DEFAULT_AVATAR;
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function normalizeRole(lane: string | null): string {
  if (!lane) return 'MID';
  const l = lane.toUpperCase().trim();
  if (l.includes('TOP')) return 'TOP';
  if (l.includes('JUNGLE') || l.includes('JNG') || l === 'JG' || l.includes('JUG')) return 'JNG';
  if (l.includes('MID')) return 'MID';
  if (l.includes('BOT') || l.includes('ADC')) return 'ADC';
  if (l.includes('SUP') || l.includes('UTILITY')) return 'SUP';
  return 'SUP'; 
}

function getRoleIcon(role: string, size: string = "w-5 h-5") {
  const basePath = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions";
  let iconName = "";
  const normalizedRole = normalizeRole(role); 
  switch (normalizedRole) {
    case 'TOP': iconName = "icon-position-top.png"; break;
    case 'JNG': iconName = "icon-position-jungle.png"; break;
    case 'MID': iconName = "icon-position-middle.png"; break;
    case 'ADC': iconName = "icon-position-bottom.png"; break; 
    case 'SUP': iconName = "icon-position-utility.png"; break;
    default: return <span className="text-[10px]">👤</span>;
  }
  return <img src={`${basePath}/${iconName}`} alt={normalizedRole} className={`${size} object-contain brightness-200 opacity-80`} />;
}

const MathSafe = (val: any) => (isNaN(Number(val)) ? 0 : Number(val));

export default function ScoutingReportPage() {
  const [viewMode, setViewMode] = useState<'H2H' | 'ISOLATED'>('H2H');
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS GLOBAIS DE FILTRO ---
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(['ALL']);
  const [globalSplit, setGlobalSplit] = useState("ALL");

  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [isolatedTeam, setIsolatedTeam] = useState<string>("");

  // --- DADOS BRUTOS ---
  const [playerStatsData, setPlayerStatsData] = useState<any[]>([]);
  const [objectivesData, setObjectivesData] = useState<any[]>([]);
  const [wardsData, setWardsData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('*').order('acronym');
      if (data && data.length >= 2) {
        setTeams(data);
        setTeamA(data[0].acronym);
        setTeamB(data[1].acronym);
        setIsolatedTeam(data[0].acronym);
      }
      setLoading(false);
    }
    fetchTeams();
  }, []);

  useEffect(() => {
    async function fetchComparisonData() {
      const targetTeams = viewMode === 'H2H' ? [teamA, teamB] : [isolatedTeam];
      if (targetTeams.some(t => !t)) return;
      
      setLoading(true);

      let matchesQuery = supabase.from('matches').select('id, game_type, split');
      if (!globalTournaments.includes('ALL')) matchesQuery = matchesQuery.in('game_type', globalTournaments);
      if (globalSplit !== 'ALL') matchesQuery = matchesQuery.eq('split', globalSplit);

      const { data: matchesRes } = await matchesQuery;
      if (!matchesRes || matchesRes.length === 0) { 
         setLoading(false); setPlayerStatsData([]); setObjectivesData([]); setWardsData([]); return; 
      }

      const matchIds = matchesRes.map(m => m.id);
      
      // Busca Paralela Otimizada (Stats, Objetivos e Visão)
      const [statsRes, objRes, wardsRes] = await Promise.all([
         supabase.from('player_stats_detailed').select('*').in('team_acronym', targetTeams).in('match_id', matchIds),
         supabase.from('match_objectives').select('*').in('team_acronym', targetTeams).in('match_id', matchIds),
         supabase.from('match_wards').select('minute, tactical_zone, type, player_name, match_id').in('match_id', matchIds)
      ]);

      setPlayerStatsData(statsRes.data || []);
      setObjectivesData(objRes.data || []);
      setWardsData(wardsRes.data || []);
      setLoading(false);
    }
    fetchComparisonData();
  }, [teamA, teamB, isolatedTeam, globalTournaments, globalSplit, viewMode]);

  const getTeamLogo = (acronym: string) => teams.find(t => t.acronym === acronym)?.logo_url || `https://ui-avatars.com/api/?name=${acronym}&background=18181b&color=3b82f6&bold=true`;

  // ============================================================================
  // LÓGICA: MODO HEAD-TO-HEAD
  // ============================================================================
  const macroComparison = useMemo(() => {
    if (viewMode !== 'H2H') return null;
    const calcMacro = (acronym: string) => {
      const tStats = playerStatsData.filter(p => p.team_acronym === acronym);
      const matchIds = Array.from(new Set(tStats.map(p => p.match_id)));
      const games = matchIds.length || 1;

      let wins = 0; let totalGD12 = 0; let totalDPM = 0; let totalVision = 0; let firstBloodAssist = 0;

      matchIds.forEach(mId => {
         const pList = tStats.filter(x => x.match_id === mId);
         if (pList.length > 0 && pList[0].win) wins++;
         totalGD12 += pList.reduce((acc, curr) => acc + MathSafe(curr.gold_diff_at_12), 0);
         totalDPM += pList.reduce((acc, curr) => acc + MathSafe(curr.dpm), 0);
         totalVision += pList.reduce((acc, curr) => acc + MathSafe(curr.vspm), 0);
         firstBloodAssist += pList.some(curr => curr.fb_kill || curr.fb_assist) ? 1 : 0;
      });

      return { winRate: (wins / games) * 100, gd12: totalGD12 / games, dpm: totalDPM / games, vspm: totalVision / games, fbRate: (firstBloodAssist / games) * 100, games };
    };
    return { A: calcMacro(teamA), B: calcMacro(teamB) };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const draftIntel = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const poolA: Record<string, number> = {}; const poolB: Record<string, number> = {};

     playerStatsData.forEach(p => {
        if (p.team_acronym === teamA) poolA[p.champion] = (poolA[p.champion] || 0) + 1;
        if (p.team_acronym === teamB) poolB[p.champion] = (poolB[p.champion] || 0) + 1;
     });

     const contested: any[] = []; const uniqueA: any[] = []; const uniqueB: any[] = [];
     const allChamps = new Set([...Object.keys(poolA), ...Object.keys(poolB)]);

     allChamps.forEach(champ => {
        const pA = poolA[champ] || 0; const pB = poolB[champ] || 0;
        if (pA >= 2 && pB >= 2) contested.push({ champ, picksA: pA, picksB: pB, total: pA + pB });
        else if (pA >= 3 && pB === 0) uniqueA.push({ champ, picks: pA });
        else if (pB >= 3 && pA === 0) uniqueB.push({ champ, picks: pB });
     });

     return { contested: contested.sort((a, b) => b.total - a.total).slice(0, 10), targetA: uniqueA.sort((a, b) => b.picks - a.picks).slice(0, 8), targetB: uniqueB.sort((a, b) => b.picks - a.picks).slice(0, 8) };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const laneMatchups = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const result: any[] = []; let biggestMismatch = { role: '', diff: 0, winner: '' };

     ROLES_ORDER.forEach(role => {
        const playersA = playerStatsData.filter(p => normalizeRole(p.lane) === role && p.team_acronym === teamA);
        const playersB = playerStatsData.filter(p => normalizeRole(p.lane) === role && p.team_acronym === teamB);

        const getTitular = (arr: any[]) => {
           if (arr.length === 0) return null;
           const counts = arr.reduce((acc: any, curr) => { acc[curr.summoner_name] = (acc[curr.summoner_name] || 0) + 1; return acc; }, {});
           const mainName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
           const pData = arr.filter(x => x.summoner_name === mainName);
           const champCounts = pData.reduce((acc: any, curr) => { acc[curr.champion] = (acc[curr.champion] || 0) + 1; return acc; }, {});
           const topChamps = Object.entries(champCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
           const avgRating = pData.reduce((acc, curr) => acc + ((curr.lane_rating + curr.impact_rating + curr.conversion_rating + curr.vision_rating)/4), 0) / pData.length;
           const avgGD12 = pData.reduce((acc, curr) => acc + MathSafe(curr.gold_diff_at_12), 0) / pData.length;
           return { name: mainName, rating: avgRating, gd12: avgGD12, champs: topChamps, games: pData.length };
        };

        const tA = getTitular(playersA); const tB = getTitular(playersB);

        if (tA && tB) {
           const diff = Math.abs(tA.rating - tB.rating);
           if (diff > biggestMismatch.diff) biggestMismatch = { role, diff, winner: tA.rating > tB.rating ? teamA : teamB };
        }
        result.push({ role, playerA: tA, playerB: tB });
     });

     return { lanes: result, mismatch: biggestMismatch };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const damageShare = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const calcShare = (acronym: string) => {
        const tStats = playerStatsData.filter(p => p.team_acronym === acronym);
        const matchIds = Array.from(new Set(tStats.map(p => p.match_id)));
        const shares: Record<string, number> = { TOP: 0, JNG: 0, MID: 0, ADC: 0, SUP: 0 };
        matchIds.forEach(mId => {
           const gamePlayers = tStats.filter(p => p.match_id === mId);
           const totalDPM = gamePlayers.reduce((acc, curr) => acc + MathSafe(curr.dpm), 0);
           if (totalDPM > 0) gamePlayers.forEach(p => { const role = normalizeRole(p.lane); if (shares[role] !== undefined) shares[role] += (MathSafe(p.dpm) / totalDPM) * 100; });
        });
        const games = matchIds.length || 1;
        Object.keys(shares).forEach(k => shares[k] = shares[k] / games);
        return shares;
     };
     return { A: calcShare(teamA), B: calcShare(teamB) };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const earlyGameIntel = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const calcEarly = (acronym: string) => {
        const tStats = playerStatsData.filter(p => p.team_acronym === acronym);
        const matchIds = Array.from(new Set(tStats.map(p => p.match_id)));
        const games = matchIds.length || 1;
        let totalPlates = 0; let totalXpDiff12 = 0; let totalCsDiff12 = 0; let firstTowerGames = 0;
        matchIds.forEach(mId => {
           const pList = tStats.filter(x => x.match_id === mId);
           totalPlates += pList.reduce((acc, curr) => acc + MathSafe(curr.plates), 0);
           totalXpDiff12 += pList.reduce((acc, curr) => acc + MathSafe(curr.xp_diff_at_12), 0);
           totalCsDiff12 += pList.reduce((acc, curr) => acc + MathSafe(curr.cs_diff_at_12), 0);
           if (pList.some(curr => curr.ft_kill || curr.ft_assist)) firstTowerGames++;
        });
        return { avgPlates: totalPlates / games, avgXpDiff: totalXpDiff12 / games, avgCsDiff: totalCsDiff12 / games, ftRate: (firstTowerGames / games) * 100 };
     };
     return { A: calcEarly(teamA), B: calcEarly(teamB) };
  }, [playerStatsData, teamA, teamB, viewMode]);


  // ============================================================================
  // LÓGICA: MODO RELATÓRIO ISOLADO (TEAM FOCUS)
  // ============================================================================
  const isolatedIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const tStats = playerStatsData.filter(p => p.team_acronym === isolatedTeam);
     if (tStats.length === 0) return null;

     const matchIds = Array.from(new Set(tStats.map(p => p.match_id)));
     const games = matchIds.length;
     let wins = 0, blueGames = 0, blueWins = 0, redGames = 0, redWins = 0, fbGames = 0, ftGames = 0, teamTotalGD12 = 0;
     const rosterData: any = { TOP: {}, JNG: {}, MID: {}, ADC: {}, SUP: {} };

     matchIds.forEach(mId => {
        const pList = tStats.filter(p => p.match_id === mId);
        if(pList.length === 0) return;
        const side = pList[0].side; const won = pList[0].win;

        if (won) wins++;
        if (side === 'Blue') { blueGames++; if (won) blueWins++; }
        if (side === 'Red' || side === 'red') { redGames++; if (won) redWins++; }
        if (pList.some(p => p.fb_kill || p.fb_assist)) fbGames++;
        if (pList.some(p => p.ft_kill || p.ft_assist)) ftGames++;

        let gameGD12 = 0;
        pList.forEach(p => {
           const r = normalizeRole(p.lane);
           gameGD12 += MathSafe(p.gold_diff_at_12);
           if (rosterData[r]) {
              if (!rosterData[r][p.summoner_name]) rosterData[r][p.summoner_name] = { games: 0, wins: 0, champs: {} };
              rosterData[r][p.summoner_name].games++;
              if (won) rosterData[r][p.summoner_name].wins++;
              const champName = p.champion;
              if (!rosterData[r][p.summoner_name].champs[champName]) rosterData[r][p.summoner_name].champs[champName] = { picks: 0, wins: 0, k: 0, d: 0, a: 0, gd12: 0, dpm: 0 };
              const cStats = rosterData[r][p.summoner_name].champs[champName];
              cStats.picks++; if (won) cStats.wins++;
              cStats.k += MathSafe(p.kills); cStats.d += MathSafe(p.deaths); cStats.a += MathSafe(p.assists);
              cStats.gd12 += MathSafe(p.gold_diff_at_12); cStats.dpm += MathSafe(p.dpm);
           }
        });
        teamTotalGD12 += (gameGD12 / 2); 
     });

     const starters = ROLES_ORDER.map(role => {
        const players = Object.entries(rosterData[role]);
        if (players.length === 0) return { role, name: 'Sem Dados', games: 0, winRate: 0, champs: [] };
        players.sort((a: any, b: any) => b[1].games - a[1].games);
        const starterName = players[0][0]; const starterData: any = players[0][1];
        const champs = Object.entries(starterData.champs).map(([cName, cStats]: any) => ({ name: cName, picks: cStats.picks, winRate: (cStats.wins / cStats.picks) * 100, kda: cStats.d === 0 ? (cStats.k + cStats.a) : (cStats.k + cStats.a) / cStats.d, avgGd12: cStats.gd12 / cStats.picks, avgDpm: cStats.dpm / cStats.picks })).sort((a, b) => b.picks - a.picks).slice(0, 3); 
        return { role, name: starterName, games: starterData.games, winRate: (starterData.wins / starterData.games) * 100, champs };
     });

     return { games, winRate: (wins/games)*100, blueWR: blueGames ? (blueWins/blueGames)*100 : 0, redWR: redGames ? (redWins/redGames)*100 : 0, fbRate: (fbGames/games)*100, ftRate: (ftGames/games)*100, avgTeamGD12: teamTotalGD12 / games, starters, blueGames, redGames };
  }, [playerStatsData, isolatedTeam, viewMode]);

  // MOTOR EXTRA 1: SINERGIA 2V2
  const synergyIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const combos: any = { MID_JNG: {}, ADC_SUP: {} };
     const matchIds = Array.from(new Set(playerStatsData.filter(p => p.team_acronym === isolatedTeam).map(p => p.match_id)));

     matchIds.forEach(mId => {
        const pList = playerStatsData.filter(p => p.match_id === mId && p.team_acronym === isolatedTeam);
        const won = pList.length > 0 ? pList[0].win : false;

        const mid = pList.find(p => normalizeRole(p.lane) === 'MID');
        const jng = pList.find(p => normalizeRole(p.lane) === 'JNG');
        if (mid && jng) {
           const key = `${mid.champion} + ${jng.champion}`;
           if (!combos.MID_JNG[key]) combos.MID_JNG[key] = { picks: 0, wins: 0, gd12: 0 };
           combos.MID_JNG[key].picks++; if (won) combos.MID_JNG[key].wins++;
           combos.MID_JNG[key].gd12 += (MathSafe(mid.gold_diff_at_12) + MathSafe(jng.gold_diff_at_12));
        }

        const adc = pList.find(p => normalizeRole(p.lane) === 'ADC');
        const sup = pList.find(p => normalizeRole(p.lane) === 'SUP');
        if (adc && sup) {
           const key = `${adc.champion} + ${sup.champion}`;
           if (!combos.ADC_SUP[key]) combos.ADC_SUP[key] = { picks: 0, wins: 0, gd12: 0 };
           combos.ADC_SUP[key].picks++; if (won) combos.ADC_SUP[key].wins++;
           combos.ADC_SUP[key].gd12 += (MathSafe(adc.gold_diff_at_12) + MathSafe(sup.gold_diff_at_12));
        }
     });

     const formatCombos = (obj: any) => Object.entries(obj).map(([key, val]: any) => ({ key, champs: key.split(' + '), picks: val.picks, winRate: (val.wins/val.picks)*100, avgGd12: val.gd12/val.picks })).sort((a, b) => b.picks - a.picks).slice(0, 3);
     return { midJng: formatCombos(combos.MID_JNG), adcSup: formatCombos(combos.ADC_SUP) };
  }, [playerStatsData, isolatedTeam, viewMode]);

  // MOTOR EXTRA 2: RELÓGIO NEUTRO (OBJETIVOS)
  const objectivesIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const teamObjs = objectivesData.filter(o => o.team_acronym === isolatedTeam);
     const matchIds = Array.from(new Set(playerStatsData.filter(p => p.team_acronym === isolatedTeam).map(p => p.match_id)));
     const games = matchIds.length || 1;

     let firstDrakeTotal = 0; let firstDrakeGames = 0;
     let firstGrubsTotal = 0; let firstGrubsGames = 0;

     matchIds.forEach(mId => {
        const gameObjs = teamObjs.filter(o => o.match_id === mId);
        const drakes = gameObjs.filter(o => o.objective_type === 'DRAGON').sort((a,b) => a.minuto - b.minuto);
        if (drakes.length > 0) { firstDrakeTotal += drakes[0].minuto; firstDrakeGames++; }
        
        // Pode estar como HORDE no DB (Grubs)
        const grubs = gameObjs.filter(o => o.objective_type === 'HORDE' || o.objective_type === 'HERALD').sort((a,b) => a.minuto - b.minuto);
        if (grubs.length > 0) { firstGrubsTotal += grubs[0].minuto; firstGrubsGames++; }
     });

     const formatTime = (mins: number) => {
        if (isNaN(mins) || mins === 0) return "--:--";
        const m = Math.floor(mins); const s = Math.round((mins - m) * 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
     };

     return {
        avgDrakeStr: firstDrakeGames ? formatTime(firstDrakeTotal / firstDrakeGames) : '--:--',
        drakeRate: (firstDrakeGames / games) * 100,
        avgGrubsStr: firstGrubsGames ? formatTime(firstGrubsTotal / firstGrubsGames) : '--:--',
        grubsRate: (firstGrubsGames / games) * 100,
     };
  }, [objectivesData, playerStatsData, isolatedTeam, viewMode]);

  // MOTOR EXTRA 3: RADAR DE VISÃO EARLY (< 5 MIN)
  const visionIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const teamPlayers = new Set(playerStatsData.filter(p => p.team_acronym === isolatedTeam).map(p => p.summoner_name));
     const earlyWards = wardsData.filter(w => Number(w.minute) <= 5 && teamPlayers.has(w.player_name) && w.tactical_zone);

     const zones: any = {};
     earlyWards.forEach(w => { zones[w.tactical_zone] = (zones[w.tactical_zone] || 0) + 1; });

     const totalWards = earlyWards.length || 1;
     const topZones = Object.entries(zones).map(([zone, count]: any) => ({ zone, count, pct: (count / totalWards) * 100 })).sort((a, b) => b.count - a.count).slice(0, 3);
     return { topZones, totalWards: earlyWards.length };
  }, [wardsData, playerStatsData, isolatedTeam, viewMode]);


  // --- COMPONENTES AUXILIARES DA PÁGINA ---
  const TugOfWarBar = ({ label, valA, valB, format = (v: number) => v.toFixed(1), reverseColors = false }: any) => {
     const total = Math.abs(valA) + Math.abs(valB) || 1;
     let pctA = (Math.abs(valA) / total) * 100; let pctB = (Math.abs(valB) / total) * 100;
     if (pctA < 5) { pctA = 5; pctB = 95; } if (pctB < 5) { pctB = 5; pctA = 95; }
     const colorA = reverseColors ? (valA < valB ? 'bg-blue-500' : 'bg-zinc-600') : (valA >= valB ? 'bg-blue-500' : 'bg-zinc-600');
     const colorB = reverseColors ? (valB <= valA ? 'bg-red-500' : 'bg-zinc-600') : (valB > valA ? 'bg-red-500' : 'bg-zinc-600');

     return (
        <div className="flex flex-col gap-2 w-full">
           <div className="flex justify-between items-end">
              <span className={`text-xl font-black ${valA >= valB && !reverseColors ? 'text-blue-500' : 'text-zinc-300'}`}>{format(valA)}</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
              <span className={`text-xl font-black ${valB > valA && !reverseColors ? 'text-red-500' : 'text-zinc-300'}`}>{format(valB)}</span>
           </div>
           <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 gap-1">
              <div className={`h-full ${colorA} transition-all duration-1000`} style={{ width: `${pctA}%` }}></div>
              <div className={`h-full ${colorB} transition-all duration-1000`} style={{ width: `${pctB}%` }}></div>
           </div>
        </div>
     );
  };

  if (loading) return <div className="flex items-center justify-center h-[80vh] text-zinc-500 font-bold text-[10px] tracking-widest uppercase animate-pulse">Cruzando Dados de Escotismo...</div>;

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-8 space-y-8 font-sans pb-20 overflow-visible">
      
      {/* CABEÇALHO */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800 pb-8 relative z-[200]">
        <div className="animate-fade-in-right flex flex-col gap-4">
          <div className="flex bg-zinc-900 p-1 rounded-xl w-fit border border-zinc-800 shadow-sm">
             <button onClick={() => setViewMode('H2H')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'H2H' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Head-to-Head</button>
             <button onClick={() => setViewMode('ISOLATED')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'ISOLATED' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Team Focus</button>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tight">{viewMode === 'H2H' ? 'HEAD-TO-HEAD' : 'TEAM FOCUS'} <span className="text-blue-500">SCOUTING</span></h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-2 uppercase">PREPARAÇÃO TÁTICA E CONDIÇÕES DE VITÓRIA</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-start xl:justify-end gap-6 flex-1">
          <div className="flex gap-4 items-center bg-transparent shrink-0">
             <TournamentMultiSelector value={globalTournaments} onChange={setGlobalTournaments} />
             <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
          </div>
        </div>
      </header>

      {/* MODO HEAD-TO-HEAD */}
      {viewMode === 'H2H' && macroComparison && draftIntel && laneMatchups && earlyGameIntel && damageShare && (
        <div className="animate-fade-in-up">
           <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 lg:p-12 shadow-sm relative flex flex-col md:flex-row items-center justify-between gap-8 mt-8">
            <div className="flex-1 flex flex-col items-center relative z-10 w-full group">
                <img src={getTeamLogo(teamA)} className="w-28 h-28 md:w-32 md:h-32 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 shadow-md mb-6 object-contain" alt="" />
                <select value={teamA} onChange={e => setTeamA(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-blue-500 text-2xl text-center font-black uppercase tracking-tight rounded-xl px-6 py-3 outline-none focus:border-blue-500 w-full max-w-[280px] appearance-none cursor-pointer">
                    {teams.map(t => <option key={`A-${t.acronym}`} value={t.acronym}>{t.acronym}</option>)}
                </select>
            </div>
            <div className="shrink-0 flex flex-col items-center justify-center relative z-10 px-8">
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xl text-zinc-400 font-black">VS</span>
                </div>
                <span className="text-[9px] font-bold text-zinc-500 tracking-widest mt-4 uppercase text-center block">{macroComparison.A.games} Jogos Analisados</span>
            </div>
            <div className="flex-1 flex flex-col items-center relative z-10 w-full group">
                <img src={getTeamLogo(teamB)} className="w-28 h-28 md:w-32 md:h-32 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 shadow-md mb-6 object-contain" alt="" />
                <select value={teamB} onChange={e => setTeamB(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-red-500 text-2xl text-center font-black uppercase tracking-tight rounded-xl px-6 py-3 outline-none focus:border-red-500 w-full max-w-[280px] appearance-none cursor-pointer">
                    {teams.map(t => <option key={`B-${t.acronym}`} value={t.acronym}>{t.acronym}</option>)}
                </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
            <div className="lg:col-span-4 bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                <div className="mb-8 border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Tale of the Tape</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Métricas Globais Diretas</p>
                </div>
                <div className="flex-1 flex flex-col justify-between gap-6">
                  <TugOfWarBar label="Win Rate %" valA={macroComparison.A.winRate} valB={macroComparison.B.winRate} format={(v:any) => `${Math.round(v)}%`} />
                  <TugOfWarBar label="First Blood %" valA={macroComparison.A.fbRate} valB={macroComparison.B.fbRate} format={(v:any) => `${Math.round(v)}%`} />
                  <TugOfWarBar label="Gold Diff @12" valA={macroComparison.A.gd12} valB={macroComparison.B.gd12} format={(v:any) => (v>0?'+':'')+Math.round(v)} />
                  <TugOfWarBar label="DPM" valA={macroComparison.A.dpm} valB={macroComparison.B.dpm} format={(v:any) => Math.round(v)} />
                  <TugOfWarBar label="VSPM" valA={macroComparison.A.vspm} valB={macroComparison.B.vspm} format={(v:any) => v.toFixed(2)} />
                </div>
            </div>
            <div className="lg:col-span-8 bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                <div className="mb-8 border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Draft War Room</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Prioridades e Exclusividades de Seleção</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1">
                  <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2 text-center">⚔️ CONTESTADOS</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.contested.length > 0 ? draftIntel.contested.map(c => <img key={c.champ} src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-amber-500/30" alt={c.champ} />) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUM EM COMUM</p>}
                      </div>
                  </div>
                  <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2 text-center">🚫 TARGET {teamA}</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.targetA.length > 0 ? draftIntel.targetA.map(c => <img key={c.champ} src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-blue-500/30" alt={c.champ} />) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUMA EXCLUSIVIDADE</p>}
                      </div>
                  </div>
                  <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2 text-center">🚫 TARGET {teamB}</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.targetB.length > 0 ? draftIntel.targetB.map(c => <img key={c.champ} src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-red-500/30" alt={c.champ} />) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUMA EXCLUSIVIDADE</p>}
                      </div>
                  </div>
                </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm relative overflow-hidden animate-fade-in-up mt-8">
             <div className="mb-10 border-b border-zinc-800 pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Positional Matchups</h3>
                  <p className="text-[10px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">O Duelo de Titulares e Diferenciais de Rota</p>
                </div>
             </div>
             <div className="flex flex-col gap-4">
                <div className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_200px_1fr] gap-4 px-6 mb-2 text-[9px] font-bold text-zinc-500 tracking-widest uppercase text-center">
                   <span className="text-left text-blue-500">Titular Azul</span><span>Confronto Central</span><span className="text-right text-red-500">Titular Vermelho</span>
                </div>
                {laneMatchups.lanes.map(lane => (
                   <div key={lane.role} className={`grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_200px_1fr] gap-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 md:p-6 items-center transition-all hover:border-zinc-600 shadow-sm`}>
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
                            {getRoleIcon(lane.role, 'w-6 h-6')}
                         </div>
                         {lane.playerA ? (
                            <div className="flex flex-col gap-2 min-w-0">
                               <span className="text-sm md:text-lg font-black text-white uppercase truncate leading-none">{lane.playerA.name}</span>
                               <div className="flex gap-1.5">{lane.playerA.champs.map((c: string) => <img key={c} src={getChampionImageUrl(c)} className="w-6 h-6 rounded-md border border-zinc-700" alt="" />)}</div>
                            </div>
                         ) : <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sem Dados</span>}
                      </div>
                      <div className="flex flex-col items-center justify-center px-4 border-x border-zinc-800 gap-3">
                         <span className="text-lg font-black text-white uppercase opacity-20">{lane.role}</span>
                         {lane.playerA && lane.playerB && (
                            <div className="flex flex-col items-center gap-1 w-full">
                               <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest text-center">Vantagem GD@12</span>
                               <div className="flex items-center gap-2 w-full justify-center">
                                  <span className={`text-xs font-black ${lane.playerA.gd12 >= lane.playerB.gd12 ? 'text-blue-500' : 'text-zinc-600'}`}>{Math.round(lane.playerA.gd12)}</span>
                                  <div className="flex-1 max-w-[60px] h-1.5 bg-zinc-900 rounded-full flex overflow-hidden">
                                     <div className="h-full bg-blue-500" style={{width: `${Math.max(5, (lane.playerA.gd12 / (lane.playerA.gd12 + lane.playerB.gd12 || 1)) * 100)}%`}}></div>
                                     <div className="h-full bg-red-500" style={{width: `${Math.max(5, (lane.playerB.gd12 / (lane.playerA.gd12 + lane.playerB.gd12 || 1)) * 100)}%`}}></div>
                                  </div>
                                  <span className={`text-xs font-black ${lane.playerB.gd12 > lane.playerA.gd12 ? 'text-red-500' : 'text-zinc-600'}`}>{Math.round(lane.playerB.gd12)}</span>
                               </div>
                            </div>
                         )}
                      </div>
                      <div className="flex items-center justify-end gap-4 flex-row-reverse text-right">
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
                            {getRoleIcon(lane.role, 'w-6 h-6')}
                         </div>
                         {lane.playerB ? (
                            <div className="flex flex-col items-end gap-2 min-w-0">
                               <span className="text-sm md:text-lg font-black text-white uppercase truncate leading-none">{lane.playerB.name}</span>
                               <div className="flex gap-1.5 flex-row-reverse">{lane.playerB.champs.map((c: string) => <img key={c} src={getChampionImageUrl(c)} className="w-6 h-6 rounded-md border border-zinc-700" alt="" />)}</div>
                            </div>
                         ) : <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sem Dados</span>}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* MODO TEAM FOCUS */}
      {viewMode === 'ISOLATED' && isolatedIntel && (
        <div className="animate-fade-in-up space-y-8 mt-8">
            <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 flex flex-col xl:flex-row items-center gap-8 shadow-sm">
               <div className="flex items-center gap-6 xl:w-1/3 border-b xl:border-b-0 xl:border-r border-zinc-800 pb-6 xl:pb-0 xl:pr-6 w-full">
                  <img src={getTeamLogo(isolatedTeam)} className="w-24 h-24 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 object-contain shadow-md" alt="" />
                  <div>
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">AMOSTRAGEM: {isolatedIntel.games} JOGOS</span>
                     <select value={isolatedTeam} onChange={e => setIsolatedTeam(e.target.value)} className="bg-transparent text-white text-4xl font-black uppercase tracking-tight outline-none cursor-pointer hover:bg-zinc-900 rounded-lg px-2 py-1 -ml-2 transition-colors appearance-none">
                        {teams.map(t => <option key={`ISO-${t.acronym}`} value={t.acronym} className="text-lg bg-zinc-950">{t.acronym}</option>)}
                     </select>
                  </div>
               </div>
               <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
                  <div className="flex flex-col items-start xl:items-center">
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Win Rate Geral</span>
                     <span className="text-3xl font-black text-white">{Math.round(isolatedIntel.winRate)}%</span>
                  </div>
                  <div className="flex flex-col items-start xl:items-center">
                     <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Blue Side WR</span>
                     <span className="text-3xl font-black text-white">{Math.round(isolatedIntel.blueWR)}% <span className="text-xs text-zinc-600">({isolatedIntel.blueGames}j)</span></span>
                  </div>
                  <div className="flex flex-col items-start xl:items-center">
                     <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Red Side WR</span>
                     <span className="text-3xl font-black text-white">{Math.round(isolatedIntel.redWR)}% <span className="text-xs text-zinc-600">({isolatedIntel.redGames}j)</span></span>
                  </div>
                  <div className="flex flex-col items-start xl:items-center">
                     <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">First Blood %</span>
                     <span className="text-3xl font-black text-white">{Math.round(isolatedIntel.fbRate)}%</span>
                  </div>
               </div>
            </div>

            {/* NOVOS CARTÕES: SINERGIA, OBJETIVOS E VISÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               {/* 1. Sinergia 2v2 */}
               <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Sinergia 2v2</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Combos e Vantagens Base</p>
                  </div>
                  <div className="space-y-6">
                     <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">MID & JUNGLE</span>
                        <div className="space-y-2">
                           {synergyIntel?.midJng.map((combo: any) => (
                              <div key={combo.key} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                                 <div className="flex gap-1">
                                    <img src={getChampionImageUrl(combo.champs[0])} className="w-7 h-7 rounded border border-zinc-700" alt=""/>
                                    <img src={getChampionImageUrl(combo.champs[1])} className="w-7 h-7 rounded border border-zinc-700" alt=""/>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-xs font-black text-white block">{Math.round(combo.winRate)}% WR</span>
                                    <span className="text-[9px] font-bold text-zinc-500">{combo.picks} Jogos</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">BOT LANE</span>
                        <div className="space-y-2">
                           {synergyIntel?.adcSup.map((combo: any) => (
                              <div key={combo.key} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                                 <div className="flex gap-1">
                                    <img src={getChampionImageUrl(combo.champs[0])} className="w-7 h-7 rounded border border-zinc-700" alt=""/>
                                    <img src={getChampionImageUrl(combo.champs[1])} className="w-7 h-7 rounded border border-zinc-700" alt=""/>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-xs font-black text-white block">{Math.round(combo.winRate)}% WR</span>
                                    <span className="text-[9px] font-bold text-zinc-500">{combo.picks} Jogos</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>

               {/* 2. Relógio Neutro */}
               <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Relógio Neutro</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Timings Médios de Objetivos</p>
                  </div>
                  <div className="flex flex-col gap-6 h-full justify-start mt-4">
                     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                           <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">1º Dragão</span>
                           <span className="text-3xl font-black text-white">{objectivesIntel?.avgDrakeStr}</span>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Taxa de Controle</span>
                           <span className="text-lg font-black text-zinc-300">{Math.round(objectivesIntel?.drakeRate || 0)}%</span>
                        </div>
                     </div>
                     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                           <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">Larvas / Arauto</span>
                           <span className="text-3xl font-black text-white">{objectivesIntel?.avgGrubsStr}</span>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Taxa de Controle</span>
                           <span className="text-lg font-black text-zinc-300">{Math.round(objectivesIntel?.grubsRate || 0)}%</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* 3. Radar Early Game */}
               <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Radar Early Game</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Zonas Mais Wardadas Até 5 Min</p>
                  </div>
                  <div className="space-y-4">
                     {visionIntel?.topZones.length ? visionIntel.topZones.map((zone: any, i: number) => (
                        <div key={zone.zone} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-700"></div>
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transition-all" style={{height: `${zone.pct}%`}}></div>
                           <div className="flex justify-between items-center pl-3">
                              <span className="text-[11px] font-black text-white uppercase tracking-wide">{zone.zone}</span>
                              <div className="text-right">
                                 <span className="text-sm font-black text-blue-400 block">{Math.round(zone.pct)}%</span>
                                 <span className="text-[9px] font-bold text-zinc-500 uppercase">{zone.count} Wards</span>
                              </div>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center text-[10px] text-zinc-600 font-bold uppercase py-8">Dados de Wards Indisponíveis</div>
                     )}
                  </div>
               </div>
            </div>

            <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-sm">
               <div className="mb-8 border-b border-zinc-800 pb-4 flex justify-between items-end">
                  <div>
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Roster Metrics & Champion Priority</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Estatísticas Exatas por Jogador e Top 3 Picks</p>
                  </div>
               </div>
               <div className="flex flex-col gap-6">
                  <div className="hidden md:grid grid-cols-[200px_1fr] gap-8 px-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                     <span className="text-left">Jogador Titular</span><span>Performance Detalhada por Campeão (Top 3)</span>
                  </div>
                  {isolatedIntel.starters.map((player: any) => (
                     <div key={player.role} className="flex flex-col md:grid md:grid-cols-[200px_1fr] gap-8 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 transition-all hover:border-zinc-600">
                        <div className="flex items-center md:items-start md:flex-col gap-4 md:border-r border-zinc-800 md:pr-4">
                           <div className="w-12 h-12 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
                              {getRoleIcon(player.role, 'w-6 h-6')}
                           </div>
                           <div>
                              <span className="text-lg font-black text-white uppercase block leading-none mb-1">{player.name}</span>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                 <span>{player.games} Jogos</span><span>•</span><span className={player.winRate >= 50 ? 'text-blue-400' : 'text-red-400'}>{Math.round(player.winRate)}% WR</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex-1 w-full overflow-x-auto custom-scrollbar">
                           <div className="min-w-[600px] grid grid-cols-5 gap-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-2">
                              <span className="col-span-1">Campeão</span><span className="text-center">Win Rate</span><span className="text-center">KDA Médio</span><span className="text-center">GD @ 12</span><span className="text-right pr-4">DPM Médio</span>
                           </div>
                           <div className="space-y-3">
                              {player.champs.length > 0 ? player.champs.map((champ: any) => (
                                 <div key={champ.name} className="grid grid-cols-5 items-center gap-4 bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50">
                                    <div className="col-span-1 flex items-center gap-3">
                                       <img src={getChampionImageUrl(champ.name)} className="w-8 h-8 rounded border border-zinc-700" alt="" />
                                       <span className="text-xs font-black text-white uppercase">{champ.picks}x</span>
                                    </div>
                                    <div className="text-center"><span className={`text-xs font-black ${champ.winRate >= 50 ? 'text-blue-500' : 'text-zinc-400'}`}>{Math.round(champ.winRate)}%</span></div>
                                    <div className="text-center"><span className="text-xs font-black text-zinc-300">{champ.kda.toFixed(2)}</span></div>
                                    <div className="text-center"><span className={`text-xs font-black ${champ.avgGd12 > 0 ? 'text-blue-500' : champ.avgGd12 < 0 ? 'text-red-500' : 'text-zinc-500'}`}>{champ.avgGd12 > 0 ? '+' : ''}{Math.round(champ.avgGd12)}</span></div>
                                    <div className="text-right pr-4"><span className="text-xs font-black text-zinc-300">{Math.round(champ.avgDpm)}</span></div>
                                 </div>
                              )) : <div className="text-center text-[10px] text-zinc-600 font-bold uppercase py-4">Sem dados suficientes para listar campeões</div>}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES (FLAT DESIGN & ZINC PALETTE) ---
function TournamentMultiSelector({ value, onChange }: { value: string[], onChange: (val: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; document.addEventListener("mousedown", click); return () => document.removeEventListener("mousedown", click); }, []);
  const options = [{ id: 'ALL', label: 'TODOS OS CAMPEONATOS' }, { id: 'AMERICAS_CUP', label: 'AMERICAS CUP' }, { id: 'CBLOL', label: 'CBLOL' }, { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' }, { id: 'EMEA_MASTERS', label: 'EMEA MASTERS' }, { id: 'FIRST_STAND', label: 'FIRST STAND' }, { id: 'LCK', label: 'LCK' }, { id: 'LCS', label: 'LCS' }, { id: 'LEC', label: 'LEC' }, { id: 'LPL', label: 'LPL' }, { id: 'MSI', label: 'MSI' }, { id: 'MUNDIAL', label: 'MUNDIAL' }, { id: 'SCRIM', label: 'SCRIMS' }];
  const toggleOption = (id: string) => { if (id === 'ALL') { onChange(['ALL']); return; } let newValues = value.filter(v => v !== 'ALL'); if (newValues.includes(id)) { newValues = newValues.filter(v => v !== id); if (newValues.length === 0) newValues = ['ALL']; } else { newValues.push(id); } onChange(newValues); };
  const currentLabel = value.includes('ALL') ? 'TODOS OS CAMPEONATOS' : value.length === 1 ? options.find(o => o.id === value[0])?.label : `${value.length} CAMPEONATOS`;
  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">CAMPEONATO</label>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg flex items-center justify-between gap-4 min-w-[160px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase shadow-sm"><span className="flex-1 text-left">{currentLabel}</span><span className={`text-[8px] text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span></button>
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[200px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-xl overflow-hidden shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar animate-fade-in-down origin-top">
          {options.map((opt) => { const isSelected = value.includes(opt.id); return (
              <button key={opt.id} onClick={() => toggleOption(opt.id)} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${isSelected ? 'bg-zinc-800/80 text-white' : 'text-zinc-400'}`}>
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>{isSelected && <span className="text-white text-[9px] font-black">✓</span>}</div>
                <span className="text-[10px] font-bold uppercase tracking-wide">{opt.label}</span>
              </button>
          )})}
        </div>
      )}
    </div>
  );
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; document.addEventListener("mousedown", click); return () => document.removeEventListener("mousedown", click); }, []);
  const options = [{ id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }];
  const currentLabel = options.find(o => o.id === value)?.label || value;
  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">TIMELINE</label>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg flex items-center justify-between gap-4 min-w-[140px] hover:border-zinc-600 transition-colors shadow-sm text-[10px] text-zinc-300 font-bold uppercase"><span className="flex-1 text-left">{currentLabel}</span><span className={`text-[8px] text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span></button>
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-xl overflow-hidden shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar animate-fade-in-down origin-top">
          {options.map(opt => <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }} className={`w-full flex items-center px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === opt.id ? 'bg-zinc-800/80 text-white font-black' : 'text-zinc-400 font-bold'}`}><span className={`text-[10px] uppercase tracking-wide`}>{opt.label}</span></button>)}
        </div>
      )}
    </div>
  );
}