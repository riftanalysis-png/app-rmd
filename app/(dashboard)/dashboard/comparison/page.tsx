"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const DDRAGON_VERSION = '16.5.1'; 
const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
const DEFAULT_AVATAR = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";

// --- FUNÇÕES UTILITÁRIAS ---
function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777' || championName === 'unknown') return DEFAULT_AVATAR;
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  if (sanitized.toLowerCase() === 'renataglasc') sanitized = 'Renata';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777' || championName === 'unknown') return '';
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  if (sanitized.toLowerCase() === 'renataglasc') sanitized = 'Renata';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sanitized}_0.jpg`;
}

function normalizeRole(lane: string | null, role: string | null = null): string {
  const l = String(lane || '').toUpperCase().trim();
  const r = String(role || '').toUpperCase().trim();
  
  if (l === 'BOTTOM' && r.includes('SUPPORT')) return 'SUP';
  if (l === 'BOTTOM' && r.includes('CARRY')) return 'ADC';
  
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
  switch (normalizeRole(role)) {
    case 'TOP': iconName = "icon-position-top.png"; break;
    case 'JNG': iconName = "icon-position-jungle.png"; break;
    case 'MID': iconName = "icon-position-middle.png"; break;
    case 'ADC': iconName = "icon-position-bottom.png"; break; 
    case 'SUP': iconName = "icon-position-utility.png"; break;
    default: return <span className="text-[10px]">👤</span>;
  }
  return <img src={`${basePath}/${iconName}`} alt={role} className={`${size} object-contain brightness-200 opacity-80`} />;
}

function getOverallColor(score: number | null | undefined) {
  const val = Number(score || 0);
  if (val === 0) return "text-zinc-600";
  if (val >= 9.0 || val >= 90) return "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"; 
  if (val >= 8.0 || val >= 80) return "text-white";                                                
  if (val >= 7.0 || val >= 70) return "text-zinc-300";                                             
  if (val >= 6.0 || val >= 60) return "text-zinc-500";                                             
  return "text-red-500/70";                                                                        
}

const MathSafe = (val: any) => (isNaN(Number(val)) ? 0 : Number(val));

export default function ScoutingReportPage() {
  const [viewMode, setViewMode] = useState<'H2H' | 'ISOLATED'>('H2H');
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [activeTeams, setActiveTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(['ALL']);
  const [globalSplit, setGlobalSplit] = useState("ALL");

  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [isolatedTeam, setIsolatedTeam] = useState<string>("");

  // Dados do DB (Mapeados para os schemas reais)
  const [playerStatsData, setPlayerStatsData] = useState<any[]>([]);
  const [teamStatsData, setTeamStatsData] = useState<any[]>([]);
  const [objectivesData, setObjectivesData] = useState<any[]>([]);
  const [visionData, setVisionData] = useState<any[]>([]);

  // 1. Carregar Times
  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('bff_matches_teams').select('*').order('acronym');
      if (data) setAllTeams(data);
    }
    fetchTeams();
  }, []);

  // 2. O Grande Fetcher Baseado em Filtros
  useEffect(() => {
    async function fetchScoutingData() {
      setLoading(true);
      
      let matchesQuery = supabase.from('bff_matches_history').select('match_id, game_type, split, blue_team_tag, red_team_tag');
      
      if (!globalTournaments.includes('ALL')) {
         matchesQuery = matchesQuery.in('game_type', globalTournaments);
      }
      if (globalSplit !== 'ALL') matchesQuery = matchesQuery.ilike('split', globalSplit);

      const { data: matchesRes } = await matchesQuery;
      
      if (!matchesRes || matchesRes.length === 0) { 
         setActiveTeams(allTeams); 
         setLoading(false); 
         setPlayerStatsData([]); setTeamStatsData([]); setObjectivesData([]); setVisionData([]);
         return; 
      }

      const matchIds = matchesRes.map(m => m.match_id);
      let validAcronyms = new Set<string>();
      matchesRes.forEach(m => {
          if (m.blue_team_tag) validAcronyms.add(m.blue_team_tag);
          if (m.red_team_tag) validAcronyms.add(m.red_team_tag);
      });

      const filteredTeams = allTeams.filter(t => validAcronyms.has(t.acronym));
      const finalTeamsList = filteredTeams.length > 0 ? filteredTeams : allTeams;
      setActiveTeams(finalTeamsList);

      if (finalTeamsList.length >= 2) {
         if (!validAcronyms.has(teamA)) setTeamA(finalTeamsList[0].acronym);
         if (!validAcronyms.has(teamB)) setTeamB(finalTeamsList[1].acronym);
         if (!validAcronyms.has(isolatedTeam)) setIsolatedTeam(finalTeamsList[0].acronym);
      }

      const targetTeams = viewMode === 'H2H' ? [teamA || finalTeamsList[0]?.acronym, teamB || finalTeamsList[1]?.acronym] : [isolatedTeam || finalTeamsList[0]?.acronym];
      
      // Busca respeitando as colunas exatas que você me mandou
      const [statsRes, tStatsRes, objRes, visRes] = await Promise.all([
         supabase.from('core_player_stats').select('*').in('team_tag', targetTeams).in('match_id', matchIds).limit(15000),
         supabase.from('bff_dashboard_team_stats').select('*').in('team_acronym', targetTeams).in('match_id', matchIds).limit(5000),
         supabase.from('bff_hub_objectives').select('*').in('team_acronym', targetTeams).limit(1000),
         supabase.from('bff_hub_vision').select('*').in('team_acronym', targetTeams).in('match_id', matchIds).limit(15000)
      ]);

      setPlayerStatsData(statsRes.data || []);
      setTeamStatsData(tStatsRes.data || []);
      setObjectivesData(objRes.data || []);
      setVisionData(visRes.data || []);
      setLoading(false);
    }
    
    if (allTeams.length > 0) fetchScoutingData();
  }, [allTeams, globalTournaments, globalSplit, viewMode, teamA, teamB, isolatedTeam]);

  const getTeamLogo = (acronym: string) => allTeams.find(t => t.acronym === acronym)?.logo_url || `https://ui-avatars.com/api/?name=${acronym}&background=18181b&color=3b82f6&bold=true`;

  // ============================================================================
  // PROCESSAMENTO DE DADOS: HEAD-TO-HEAD
  // ============================================================================
  const macroComparison = useMemo(() => {
    if (viewMode !== 'H2H') return null;
    const calcMacro = (acronym: string) => {
      const tStats = teamStatsData.filter(t => t.team_acronym === acronym);
      const pStats = playerStatsData.filter(p => p.team_tag === acronym);
      const games = tStats.length || 1;

      const wins = tStats.filter(t => String(t.result).toUpperCase() === 'WIN' || String(t.result).toUpperCase() === 'VICTORY').length;
      const totalGD12 = tStats.reduce((acc, curr) => acc + MathSafe(curr.gold_diff_at_12), 0);
      
      // Média de DPM e VSPM baseada nos jogadores (Soma do time / jogos)
      const totalDPM = pStats.reduce((acc, curr) => acc + MathSafe(curr.dpm), 0);
      const totalVSPM = pStats.reduce((acc, curr) => acc + MathSafe(curr.vspm), 0);
      
      // FB Rate (se algum jogador do time pegou FB kill ou assist)
      const matchIds = Array.from(new Set(tStats.map(t => t.match_id)));
      let fbGames = 0;
      matchIds.forEach(mId => {
         const gamePlayers = pStats.filter(p => p.match_id === mId);
         if (gamePlayers.some(p => p.fb_kill || p.fb_assist)) fbGames++;
      });

      return { winRate: (wins / games) * 100, gd12: totalGD12 / games, dpm: totalDPM / games, vspm: totalVSPM / games, fbRate: (fbGames / games) * 100, games };
    };
    return { A: calcMacro(teamA), B: calcMacro(teamB) };
  }, [teamStatsData, playerStatsData, teamA, teamB, viewMode]);

  const draftIntel = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const poolA: Record<string, number> = {}; const poolB: Record<string, number> = {};

     playerStatsData.forEach(p => {
        if (!p.champion) return;
        if (p.team_tag === teamA) poolA[p.champion] = (poolA[p.champion] || 0) + 1;
        if (p.team_tag === teamB) poolB[p.champion] = (poolB[p.champion] || 0) + 1;
     });

     const contested: any[] = []; const uniqueA: any[] = []; const uniqueB: any[] = [];
     const allChamps = new Set([...Object.keys(poolA), ...Object.keys(poolB)]);

     allChamps.forEach(champ => {
        const pA = poolA[champ] || 0; const pB = poolB[champ] || 0;
        if (pA >= 1 && pB >= 1) contested.push({ champ, picksA: pA, picksB: pB, total: pA + pB });
        else if (pA >= 2 && pB === 0) uniqueA.push({ champ, picks: pA });
        else if (pB >= 2 && pA === 0) uniqueB.push({ champ, picks: pB });
     });

     return { contested: contested.sort((a, b) => b.total - a.total).slice(0, 10), targetA: uniqueA.sort((a, b) => b.picks - a.picks).slice(0, 8), targetB: uniqueB.sort((a, b) => b.picks - a.picks).slice(0, 8) };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const laneMatchups = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const result: any[] = []; 
     let biggestMismatch = { role: '', diff: 0, winner: '' };

     ROLES_ORDER.forEach(role => {
        const playersA = playerStatsData.filter(p => normalizeRole(p.lane, p.role) === role && p.team_tag === teamA);
        const playersB = playerStatsData.filter(p => normalizeRole(p.lane, p.role) === role && p.team_tag === teamB);

        const getTitular = (arr: any[], enemyArr: any[]) => {
           if (arr.length === 0) return null;
           const counts = arr.reduce((acc: any, curr) => { acc[curr.player_name] = (acc[curr.player_name] || 0) + 1; return acc; }, {});
           const mainName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
           const pData = arr.filter(x => x.player_name === mainName);
           
           const champCounts = pData.reduce((acc: any, curr) => { acc[curr.champion] = (acc[curr.champion] || 0) + 1; return acc; }, {});
           const topChamps = Object.entries(champCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
           
           const avgRating = pData.reduce((acc, curr) => acc + MathSafe(curr.perf_score || ((curr.lane_rating + curr.impact_rating + curr.conversion_rating + curr.vision_rating)/4)), 0) / pData.length;
           
           // Cálculo de GD12 (Ouro do jogador - Ouro do inimigo na mesma lane e match)
           let totalGd12 = 0;
           pData.forEach(matchPlayer => {
              const enemy = enemyArr.find(e => e.match_id === matchPlayer.match_id && normalizeRole(e.lane, e.role) === role);
              if (enemy) totalGd12 += (MathSafe(matchPlayer.gold_12) - MathSafe(enemy.gold_12));
           });
           
           return { name: mainName, rating: avgRating, gd12: totalGd12 / pData.length, champs: topChamps, games: pData.length };
        };

        const tA = getTitular(playersA, playerStatsData.filter(p => p.team_tag !== teamA)); 
        const tB = getTitular(playersB, playerStatsData.filter(p => p.team_tag !== teamB));

        if (tA && tB) {
           const diff = Math.abs(tA.rating - tB.rating);
           if (diff > biggestMismatch.diff) biggestMismatch = { role, diff, winner: tA.rating > tB.rating ? teamA : teamB };
        }
        result.push({ role, playerA: tA, playerB: tB });
     });

     return { lanes: result, mismatch: biggestMismatch };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const pacingIntel = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const calcPacing = (acronym: string) => {
        const tStats = teamStatsData.filter(t => t.team_acronym === acronym);
        const pStats = playerStatsData.filter(p => p.team_tag === acronym);
        const games = tStats.length || 1;
        
        let totalKills = 0; let totalGameTimeMins = 0;
        
        const matchIds = Array.from(new Set(tStats.map(t => t.match_id)));
        matchIds.forEach(mId => {
           const gamePlayers = pStats.filter(p => p.match_id === mId);
           totalKills += gamePlayers.reduce((acc, curr) => acc + MathSafe(curr.kills) + MathSafe(curr.deaths), 0);
           totalGameTimeMins += MathSafe(gamePlayers[0]?.game_duration || 1800) / 60; 
        });
        
        return { avgTime: totalGameTimeMins / games, ckpm: totalKills / (totalGameTimeMins || 1) };
     };
     return { A: calcPacing(teamA), B: calcPacing(teamB) };
  }, [teamStatsData, playerStatsData, teamA, teamB, viewMode]);

  const efficiencyIntel = useMemo(() => {
     // Substitui o "Físico vs Mágico" por "Gold Share vs Damage Share" (Eficiência)
     if (viewMode !== 'H2H') return null;
     const calcEff = (acronym: string) => {
        const pStats = playerStatsData.filter(p => p.team_tag === acronym);
        const games = new Set(pStats.map(p => p.match_id)).size || 1;
        
        const roles = ['TOP', 'MID', 'ADC'];
        const eff: any = {};
        
        roles.forEach(r => {
           const rolePlayers = pStats.filter(p => normalizeRole(p.lane, p.role) === r);
           const avgDmgShare = rolePlayers.reduce((acc, curr) => acc + MathSafe(curr.dmg_percent), 0) / games;
           const avgGoldShare = rolePlayers.reduce((acc, curr) => acc + MathSafe(curr.gold_share_percent), 0) / games;
           eff[r] = { dmg: avgDmgShare * 100, gold: avgGoldShare * 100 };
        });
        return eff;
     };
     return { A: calcEff(teamA), B: calcEff(teamB) };
  }, [playerStatsData, teamA, teamB, viewMode]);

  const resilienceIntel = useMemo(() => {
     if (viewMode !== 'H2H') return null;
     const calcResilience = (acronym: string) => {
        const tStats = teamStatsData.filter(t => t.team_acronym === acronym);
        let aheadGames = 0; let aheadWins = 0;
        let behindGames = 0; let behindWins = 0;

        tStats.forEach(t => {
           const won = String(t.result).toUpperCase() === 'WIN' || String(t.result).toUpperCase() === 'VICTORY';
           const gd12 = MathSafe(t.gold_diff_at_12);
           
           if (gd12 > 0) { aheadGames++; if (won) aheadWins++; }
           if (gd12 < 0) { behindGames++; if (won) behindWins++; }
        });

        const throwRate = aheadGames > 0 ? ((aheadGames - aheadWins) / aheadGames) * 100 : 0;
        const comebackRate = behindGames > 0 ? (behindWins / behindGames) * 100 : 0;
        return { throwRate, comebackRate, aheadGames, behindGames };
     };
     return { A: calcResilience(teamA), B: calcResilience(teamB) };
  }, [teamStatsData, teamA, teamB, viewMode]);


  // ============================================================================
  // PROCESSAMENTO DE DADOS: ISOLATED (TEAM FOCUS)
  // ============================================================================
  const isolatedIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const tStats = teamStatsData.filter(t => t.team_acronym === isolatedTeam);
     const pStats = playerStatsData.filter(p => p.team_tag === isolatedTeam);
     if (tStats.length === 0) return null;

     const games = tStats.length;
     let wins = 0, blueGames = 0, blueWins = 0, redGames = 0, redWins = 0, fbGames = 0, teamTotalGD12 = 0;
     const rosterData: any = { TOP: {}, JNG: {}, MID: {}, ADC: {}, SUP: {} };

     tStats.forEach(t => {
        const won = String(t.result).toUpperCase() === 'WIN' || String(t.result).toUpperCase() === 'VICTORY';
        const side = String(t.side).toUpperCase();
        
        if (won) wins++;
        if (side === 'BLUE' || side === '100') { blueGames++; if (won) blueWins++; }
        if (side === 'RED' || side === '200') { redGames++; if (won) redWins++; }
        teamTotalGD12 += MathSafe(t.gold_diff_at_12);

        // Processa os jogadores desta partida específica
        const matchPlayers = pStats.filter(p => p.match_id === t.match_id);
        if (matchPlayers.some(p => p.fb_kill || p.fb_assist)) fbGames++;

        matchPlayers.forEach(p => {
           const r = normalizeRole(p.lane, p.role);
           const pName = p.player_name || 'UNKNOWN';
           if (rosterData[r]) {
              if (!rosterData[r][pName]) rosterData[r][pName] = { games: 0, wins: 0, champs: {} };
              rosterData[r][pName].games++;
              if (won) rosterData[r][pName].wins++;
              
              const champName = p.champion || 'UNKNOWN';
              if (!rosterData[r][pName].champs[champName]) {
                 rosterData[r][pName].champs[champName] = { picks: 0, wins: 0, k: 0, d: 0, a: 0, dpm: 0, lan: 0, imp: 0, con: 0, vis: 0, ovr: 0 };
              }
              const cStats = rosterData[r][pName].champs[champName];
              cStats.picks++; if (won) cStats.wins++;
              cStats.k += MathSafe(p.kills); cStats.d += MathSafe(p.deaths); cStats.a += MathSafe(p.assists);
              cStats.dpm += MathSafe(p.dpm);
              cStats.lan += MathSafe(p.lane_rating);
              cStats.imp += MathSafe(p.impact_rating);
              cStats.con += MathSafe(p.conversion_rating);
              cStats.vis += MathSafe(p.vision_rating);
              cStats.ovr += MathSafe(p.perf_score || ((MathSafe(p.lane_rating)+MathSafe(p.impact_rating)+MathSafe(p.conversion_rating)+MathSafe(p.vision_rating))/4));
           }
        });
     });

     const starters = ROLES_ORDER.map(role => {
        const players = Object.entries(rosterData[role]);
        if (players.length === 0) return { role, name: 'Sem Dados', games: 0, winRate: 0, champs: [] };
        players.sort((a: any, b: any) => b[1].games - a[1].games);
        const starterName = players[0][0]; const starterData: any = players[0][1];
        
        const champs = Object.entries(starterData.champs).map(([cName, cStats]: any) => ({ 
           name: cName, picks: cStats.picks, winRate: (cStats.wins / cStats.picks) * 100, 
           kda: cStats.d === 0 ? (cStats.k + cStats.a) : (cStats.k + cStats.a) / cStats.d, 
           avgDpm: cStats.dpm / cStats.picks, avgLan: cStats.lan / cStats.picks, avgImp: cStats.imp / cStats.picks,
           avgCon: cStats.con / cStats.picks, avgVis: cStats.vis / cStats.picks, avgOvr: cStats.ovr / cStats.picks
        })).sort((a: any, b: any) => b.picks - a.picks).slice(0, 3); 
        
        return { role, name: starterName, games: starterData.games, winRate: (starterData.wins / starterData.games) * 100, champs };
     });

     return { games, winRate: (wins/games)*100, blueWR: blueGames ? (blueWins/blueGames)*100 : 0, redWR: redGames ? (redWins/redGames)*100 : 0, fbRate: (fbGames/games)*100, avgTeamGD12: teamTotalGD12 / games, starters, blueGames, redGames };
  }, [playerStatsData, teamStatsData, isolatedTeam, viewMode]);

  const objectivesIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const teamObjs = objectivesData.filter(o => o.team_acronym === isolatedTeam);
     
     let drakeMins = 0; let grubsMins = 0;
     const drakeObj = teamObjs.find(o => String(o.objective_type).includes('DRAGON'));
     if (drakeObj) drakeMins = MathSafe(drakeObj.avg_minute);
     
     const grubsObj = teamObjs.find(o => String(o.objective_type).includes('HORDE') || String(o.objective_type).includes('HERALD'));
     if (grubsObj) grubsMins = MathSafe(grubsObj.avg_minute);
     
     const formatTime = (mins: number) => { if (mins === 0) return "--:--"; const m = Math.floor(mins); const s = Math.round((mins - m) * 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
     return { avgDrakeStr: formatTime(drakeMins), avgGrubsStr: formatTime(grubsMins) };
  }, [objectivesData, isolatedTeam, viewMode]);

  const visionIntel = useMemo(() => {
     if (viewMode !== 'ISOLATED' || !isolatedTeam) return null;
     const earlyWards = visionData.filter(w => w.team_acronym === isolatedTeam && Number(w.minute) <= 5);
     const zones: any = {}; 
     earlyWards.forEach(w => { zones[w.type || 'UNKNOWN'] = (zones[w.type || 'UNKNOWN'] || 0) + 1; });
     
     const totalWards = earlyWards.length || 1;
     const topZones = Object.entries(zones).map(([zone, count]: any) => ({ zone, count, pct: (count / totalWards) * 100 })).sort((a, b) => b.count - a.count).slice(0, 3);
     return { topZones, totalWards: earlyWards.length };
  }, [visionData, isolatedTeam, viewMode]);


  // --- COMPONENTES AUXILIARES DA PÁGINA ---
  const TugOfWarBar = ({ label, valA, valB, format = (v: number) => v.toFixed(1), reverseColors = false }: any) => {
     const total = Math.abs(valA) + Math.abs(valB) || 1;
     let pctA = (Math.abs(valA) / total) * 100; let pctB = (Math.abs(valB) / total) * 100;
     if (pctA < 5) { pctA = 5; pctB = 95; } if (pctB < 5) { pctB = 5; pctA = 95; }
     
     const isAWinning = reverseColors ? valA < valB : valA >= valB;
     const isBWinning = reverseColors ? valB < valA : valB > valA;

     const colorA = isAWinning ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-zinc-700';
     const colorB = isBWinning ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-zinc-700';

     return (
        <div className="flex flex-col gap-2 w-full">
           <div className="flex justify-between items-end">
              <span className={`text-xl font-black ${isAWinning ? 'text-blue-500' : 'text-zinc-400'}`}>{format(valA)}</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
              <span className={`text-xl font-black ${isBWinning ? 'text-red-500' : 'text-zinc-400'}`}>{format(valB)}</span>
           </div>
           <div className="flex w-full h-2 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 gap-1">
              <div className={`h-full ${colorA} transition-all duration-1000`} style={{ width: `${pctA}%` }}></div>
              <div className={`h-full ${colorB} transition-all duration-1000`} style={{ width: `${pctB}%` }}></div>
           </div>
        </div>
     );
  };

  if (loading && activeTeams.length === 0) return <div className="flex items-center justify-center h-[80vh] text-zinc-500 font-bold text-[10px] tracking-widest uppercase animate-pulse">Cruzando Dados de Escotismo...</div>;

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-8 space-y-8 font-sans pb-20 overflow-visible">
      
      {/* CABEÇALHO */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800 pb-8 relative z-[200]">
        <div className="animate-fade-in-right flex flex-col gap-4">
          <div className="flex bg-zinc-900 p-1 rounded-xl w-fit border border-zinc-800 shadow-sm">
             <button onClick={() => setViewMode('H2H')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'H2H' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}>Head-to-Head</button>
             <button onClick={() => setViewMode('ISOLATED')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'ISOLATED' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}>Team Focus</button>
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
      {viewMode === 'H2H' && macroComparison && draftIntel && laneMatchups && pacingIntel && efficiencyIntel && resilienceIntel && (
        <div className="animate-fade-in-up">
           
           <div className={`relative bg-zinc-950 border border-zinc-800 rounded-3xl p-8 lg:p-12 shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mt-8`}>
            <div className={`absolute -top-24 -left-24 bg-blue-600/10 w-96 h-96 rounded-full blur-3xl pointer-events-none`}></div>
            <div className={`absolute -bottom-24 -right-24 bg-red-600/10 w-96 h-96 rounded-full blur-3xl pointer-events-none`}></div>

            <div className="flex-1 flex flex-col items-center relative z-10 w-full">
                <img src={getTeamLogo(teamA)} className="w-36 h-36 md:w-44 md:h-44 mb-8 object-contain drop-shadow-[0_0_25px_rgba(59,130,246,0.25)] transition-transform hover:scale-105 duration-500" alt="Team A" />
                <PremiumTeamSelector value={teamA} onChange={setTeamA} options={activeTeams} align="left" />
            </div>
            
            <div className="shrink-0 flex flex-col items-center justify-center relative z-10 px-8">
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xl text-zinc-400 font-black">VS</span>
                </div>
                <span className="text-[9px] font-bold text-zinc-500 tracking-widest mt-4 uppercase text-center block">{macroComparison.A.games} Jogos Analisados</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center relative z-10 w-full">
                <img src={getTeamLogo(teamB)} className="w-36 h-36 md:w-44 md:h-44 mb-8 object-contain drop-shadow-[0_0_25px_rgba(239,68,68,0.25)] transition-transform hover:scale-105 duration-500" alt="Team B" />
                <PremiumTeamSelector value={teamB} onChange={setTeamB} options={activeTeams} align="right" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
            <div className="lg:col-span-4 bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
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
            
            <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col overflow-visible">
                <div className="mb-8 border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Draft War Room</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Prioridades e Exclusividades de Seleção</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1">
                  
                  {/* Contestados */}
                  <div className="flex flex-col bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm relative">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-4 border-b border-zinc-800/50 pb-2 text-center">⚔️ CONTESTADOS</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.contested.length > 0 ? draftIntel.contested.map(c => (
                           <div key={c.champ} className="relative group/pick cursor-help">
                              <img src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-amber-500/30 group-hover/pick:border-amber-400 transition-colors" alt={c.champ} />
                              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-700 shadow-2xl rounded p-2 text-[10px] opacity-0 group-hover/pick:opacity-100 pointer-events-none z-[99999] whitespace-nowrap">
                                 <span className="font-black text-amber-400 block border-b border-zinc-800 pb-1 mb-1">{c.champ}</span>
                                 <span className="text-blue-400 font-bold block">{teamA}: {c.picksA} Picks</span>
                                 <span className="text-red-400 font-bold block">{teamB}: {c.picksB} Picks</span>
                              </div>
                           </div>
                        )) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUM EM COMUM</p>}
                      </div>
                  </div>

                  {/* Target A */}
                  <div className="flex flex-col bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm relative">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4 border-b border-zinc-800/50 pb-2 text-center">🚫 TARGET {teamA}</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.targetA.length > 0 ? draftIntel.targetA.map(c => (
                           <div key={c.champ} className="relative group/pick cursor-help">
                              <img src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-blue-500/30 group-hover/pick:border-blue-400 transition-colors" alt={c.champ} />
                              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-700 shadow-2xl rounded p-2 text-[10px] opacity-0 group-hover/pick:opacity-100 pointer-events-none z-[99999] whitespace-nowrap">
                                 <span className="font-black text-blue-400 block border-b border-zinc-800 pb-1 mb-1">{c.champ}</span>
                                 <span className="text-zinc-300 font-bold block">{teamA}: {c.picks} Picks</span>
                                 <span className="text-zinc-600 font-bold block">{teamB}: 0 Picks</span>
                              </div>
                           </div>
                        )) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUMA EXCLUSIVIDADE</p>}
                      </div>
                  </div>

                  {/* Target B */}
                  <div className="flex flex-col bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm relative">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4 border-b border-zinc-800/50 pb-2 text-center">🚫 TARGET {teamB}</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {draftIntel.targetB.length > 0 ? draftIntel.targetB.map(c => (
                           <div key={c.champ} className="relative group/pick cursor-help">
                              <img src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-red-500/30 group-hover/pick:border-red-400 transition-colors" alt={c.champ} />
                              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-700 shadow-2xl rounded p-2 text-[10px] opacity-0 group-hover/pick:opacity-100 pointer-events-none z-[99999] whitespace-nowrap">
                                 <span className="font-black text-red-400 block border-b border-zinc-800 pb-1 mb-1">{c.champ}</span>
                                 <span className="text-zinc-300 font-bold block">{teamB}: {c.picks} Picks</span>
                                 <span className="text-zinc-600 font-bold block">{teamA}: 0 Picks</span>
                              </div>
                           </div>
                        )) : <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase text-center w-full mt-4">NENHUMA EXCLUSIVIDADE</p>}
                      </div>
                  </div>

                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mt-8 animate-fade-in-up">
            
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                <div className="mb-6 border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Ritmo & Eficiência (Carries)</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Damage Share vs Gold Share</p>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-6">
                  <TugOfWarBar label="CKPM (Abates / Minuto)" valA={pacingIntel?.A.ckpm} valB={pacingIntel?.B.ckpm} format={(v:any) => v.toFixed(2)} />
                  <TugOfWarBar label="Duração Média (Min)" valA={pacingIntel?.A.avgTime} valB={pacingIntel?.B.avgTime} reverseColors={true} format={(v:any) => `${Math.floor(v)}:${Math.round((v % 1) * 60).toString().padStart(2, '0')}`} />
                  
                  <div className="mt-4 pt-6 border-t border-zinc-800/50 flex flex-col gap-4">
                     {['TOP', 'MID', 'ADC'].map(r => (
                        <div key={r} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4">
                           <div className="w-10 h-10 shrink-0 bg-zinc-950 rounded border border-zinc-700 flex items-center justify-center relative">
                              {getRoleIcon(r, 'w-5 h-5')}
                           </div>
                           <div className="flex-1 w-full text-center md:text-left">
                              <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-1">Eficiência {teamA}</span>
                              <div className="flex w-full h-1.5 bg-zinc-950 rounded-md overflow-hidden border border-zinc-800">
                                 <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{width: `${efficiencyIntel.A[r]?.dmg || 0}%`}}></div>
                                 <div className="h-full bg-zinc-500" style={{width: `${efficiencyIntel.A[r]?.gold || 0}%`}}></div>
                              </div>
                              <span className="text-[8px] text-zinc-500 font-bold block mt-1">{Math.round(efficiencyIntel.A[r]?.dmg || 0)}% Dano / {Math.round(efficiencyIntel.A[r]?.gold || 0)}% Ouro</span>
                           </div>
                           <div className="flex-1 w-full text-center md:text-right">
                              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest block mb-1">Eficiência {teamB}</span>
                              <div className="flex w-full h-1.5 bg-zinc-950 rounded-md overflow-hidden border border-zinc-800 flex-row-reverse">
                                 <div className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{width: `${efficiencyIntel.B[r]?.dmg || 0}%`}}></div>
                                 <div className="h-full bg-zinc-500" style={{width: `${efficiencyIntel.B[r]?.gold || 0}%`}}></div>
                              </div>
                              <span className="text-[8px] text-zinc-500 font-bold block mt-1">{Math.round(efficiencyIntel.B[r]?.dmg || 0)}% Dano / {Math.round(efficiencyIntel.B[r]?.gold || 0)}% Ouro</span>
                           </div>
                        </div>
                     ))}
                  </div>
                </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                <div className="mb-6 border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Resiliência Coletiva</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Desempenho com Vantagem e Desvantagem no Early</p>
                </div>
                
                <div className="flex flex-col gap-6 flex-1 justify-center">
                   
                   <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-6">
                         <div className="text-center">
                            <span className="text-3xl font-black text-blue-500 block">{Math.round(resilienceIntel.A.throwRate)}%</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Throw Rate {teamA}</span>
                         </div>
                         <div className="w-px h-12 bg-zinc-800"></div>
                         <div className="text-center">
                            <span className="text-3xl font-black text-red-500 block">{Math.round(resilienceIntel.B.throwRate)}%</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Throw Rate {teamB}</span>
                         </div>
                      </div>
                      <p className="text-[9px] text-zinc-400 text-center uppercase tracking-widest bg-zinc-950 p-2 rounded border border-zinc-800">Jogos que terminaram em Derrota após abrir vantagem aos 12 minutos.</p>
                   </div>

                   <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-6">
                         <div className="text-center">
                            <span className="text-3xl font-black text-blue-500 block">{Math.round(resilienceIntel.A.comebackRate)}%</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Comeback {teamA}</span>
                         </div>
                         <div className="w-px h-12 bg-zinc-800"></div>
                         <div className="text-center">
                            <span className="text-3xl font-black text-red-500 block">{Math.round(resilienceIntel.B.comebackRate)}%</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Comeback {teamB}</span>
                         </div>
                      </div>
                      <p className="text-[9px] text-zinc-400 text-center uppercase tracking-widest bg-zinc-950 p-2 rounded border border-zinc-800">Jogos que terminaram em Vitória após estar atrás aos 12 minutos.</p>
                   </div>

                </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm relative overflow-hidden animate-fade-in-up mt-8">
             <div className="mb-10 border-b border-zinc-800 pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Positional Matchups</h3>
                  <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">O Duelo de Titulares e Diferenciais de Rota</p>
                </div>
             </div>
             <div className="flex flex-col gap-4">
                <div className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_200px_1fr] gap-4 px-6 mb-2 text-[9px] font-bold text-zinc-500 tracking-widest uppercase text-center">
                   <span className="text-left text-blue-500">Titular {teamA}</span><span>Confronto Central</span><span className="text-right text-red-500">Titular {teamB}</span>
                </div>
                {laneMatchups.lanes.map(lane => (
                   <div key={lane.role} className={`group relative grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_200px_1fr] gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 items-center transition-all hover:border-zinc-600 overflow-hidden`}>
                      
                      <div className="absolute left-0 top-0 bottom-0 w-1/2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                         {lane.playerA?.champs[0] && (
                            <>
                              <img src={getChampionSplashUrl(lane.playerA.champs[0])} className="w-full h-full object-cover object-[center_20%]" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/50 to-zinc-950"></div>
                            </>
                         )}
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                         {lane.playerB?.champs[0] && (
                            <>
                              <img src={getChampionSplashUrl(lane.playerB.champs[0])} className="w-full h-full object-cover object-[center_20%]" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-l from-zinc-950 via-zinc-900/50 to-zinc-950"></div>
                            </>
                         )}
                      </div>

                      {/* TEAM A */}
                      <div className="flex items-center gap-4 relative z-10">
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-950 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
                            {getRoleIcon(lane.role, 'w-6 h-6')}
                         </div>
                         {lane.playerA ? (
                            <div className="flex flex-col gap-2 min-w-0">
                               <span className="text-sm md:text-lg font-black text-white uppercase truncate leading-none">{lane.playerA.name}</span>
                               <div className="flex gap-1.5">{lane.playerA.champs.map((c: string) => <img key={c} src={getChampionImageUrl(c)} className="w-6 h-6 rounded-md border border-zinc-700" alt="" />)}</div>
                            </div>
                         ) : <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sem Dados</span>}
                      </div>
                      
                      {/* CENTRO */}
                      <div className="flex flex-col items-center justify-center px-4 border-x border-zinc-800 gap-3 relative z-10 bg-zinc-900">
                         <span className="text-lg font-black text-white uppercase opacity-20 leading-none">{lane.role}</span>
                         {lane.playerA && lane.playerB && (
                            <div className="flex flex-col items-center gap-2 w-full">
                               
                               <div className="flex justify-between items-center w-full">
                                  <span className={`${getOverallColor(lane.playerA.rating)} font-black text-sm`}>{lane.playerA.rating.toFixed(1)}</span>
                                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest text-center">OVR</span>
                                  <span className={`${getOverallColor(lane.playerB.rating)} font-black text-sm`}>{lane.playerB.rating.toFixed(1)}</span>
                               </div>

                               <div className="flex items-center gap-2 w-full justify-center">
                                  <span className={`text-xs font-black w-8 text-right ${lane.playerA.gd12 >= lane.playerB.gd12 ? 'text-blue-500' : 'text-zinc-600'}`}>{Math.round(lane.playerA.gd12)}</span>
                                  <div className="flex-1 max-w-[60px] h-1.5 bg-zinc-950 rounded-full flex overflow-hidden border border-zinc-800">
                                     <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{width: `${Math.max(5, (Math.abs(lane.playerA.gd12) / (Math.abs(lane.playerA.gd12) + Math.abs(lane.playerB.gd12) || 1)) * 100)}%`}}></div>
                                     <div className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{width: `${Math.max(5, (Math.abs(lane.playerB.gd12) / (Math.abs(lane.playerA.gd12) + Math.abs(lane.playerB.gd12) || 1)) * 100)}%`}}></div>
                                  </div>
                                  <span className={`text-xs font-black w-8 text-left ${lane.playerB.gd12 > lane.playerA.gd12 ? 'text-red-500' : 'text-zinc-600'}`}>{Math.round(lane.playerB.gd12)}</span>
                               </div>
                            </div>
                         )}
                      </div>
                      
                      {/* TEAM B */}
                      <div className="flex items-center justify-end gap-4 flex-row-reverse text-right relative z-10">
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-950 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
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
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 flex flex-col xl:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
               <div className={`absolute -top-24 -left-24 bg-blue-600/10 w-96 h-96 rounded-full blur-3xl pointer-events-none`}></div>
               <div className="flex items-center gap-6 xl:w-1/3 border-b xl:border-b-0 xl:border-r border-zinc-800 pb-6 xl:pb-0 xl:pr-6 w-full relative z-10">
                  <img src={getTeamLogo(isolatedTeam)} className="w-28 h-28 drop-shadow-[0_0_25px_rgba(59,130,246,0.2)] object-contain" alt="Isolated Team" />
                  <div className="w-full">
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">AMOSTRAGEM: {isolatedIntel.games} JOGOS</span>
                     <PremiumTeamSelector value={isolatedTeam} onChange={setIsolatedTeam} options={activeTeams} align="left" />
                  </div>
               </div>
               <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full relative z-10">
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
                     <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">First Blood Rate</span>
                     <span className="text-3xl font-black text-white">{Math.round(isolatedIntel.fbRate)}%</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Macro & Gold</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Diferencial de Ouro em 12 Minutos</p>
                  </div>
                  
                  <div className="space-y-6 flex-1 flex flex-col justify-center items-center">
                     <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl text-center w-full">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">GD Médio @ 12 (Time Inteiro)</span>
                        <span className={`text-5xl font-black ${isolatedIntel.avgTeamGD12 > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                           {isolatedIntel.avgTeamGD12 > 0 ? '+' : ''}{Math.round(isolatedIntel.avgTeamGD12)}
                        </span>
                     </div>
                  </div>
               </div>

               <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Relógio Neutro</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Timings Médios de Objetivos (Base Hub)</p>
                  </div>
                  <div className="flex flex-col gap-4 flex-1 justify-center">
                     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                           <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">1º Dragão</span>
                           <span className="text-3xl font-black text-white">{objectivesIntel?.avgDrakeStr}</span>
                        </div>
                     </div>
                     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                           <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">Larvas / Arauto</span>
                           <span className="text-3xl font-black text-white">{objectivesIntel?.avgGrubsStr}</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Preferência de Wards</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Tipologia da Visão no Early Game (5 min)</p>
                  </div>
                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                     {visionIntel?.topZones.length ? visionIntel.topZones.map((zone: any) => (
                        <div key={zone.zone} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-800"></div>
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-all" style={{height: `${zone.pct}%`}}></div>
                           <div className="flex justify-between items-center pl-3">
                              <span className="text-[11px] font-black text-white uppercase tracking-wide">{zone.zone}</span>
                              <div className="text-right">
                                 <span className="text-sm font-black text-blue-400 block">{Math.round(zone.pct)}%</span>
                                 <span className="text-[9px] font-bold text-zinc-500 uppercase">{zone.count} Wards</span>
                              </div>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center text-[10px] text-zinc-600 font-bold uppercase py-8 bg-zinc-900 border border-zinc-800 rounded-xl">Sem histórico de wards</div>
                     )}
                  </div>
               </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-sm">
               <div className="mb-8 border-b border-zinc-800 pb-4 flex justify-between items-end">
                  <div>
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Roster Metrics & Champion Priority</h3>
                     <p className="text-[9px] font-bold text-zinc-500 tracking-widest mt-1 uppercase">Estatísticas Exatas por Jogador e Top Picks</p>
                  </div>
               </div>
               <div className="flex flex-col gap-6">
                  <div className="hidden md:grid grid-cols-[200px_1fr] gap-8 px-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                     <span className="text-left">Jogador Titular</span><span>Performance Detalhada por Campeão (Top 3)</span>
                  </div>
                  {isolatedIntel.starters.map((player: any) => (
                     <div key={player.role} className="group relative flex flex-col md:grid md:grid-cols-[200px_1fr] gap-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 transition-all hover:border-zinc-600 overflow-hidden">
                        
                        <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                           {player.champs[0] && (
                              <>
                                <img src={getChampionSplashUrl(player.champs[0].name)} className="w-full h-full object-cover object-[center_20%]" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/90 to-zinc-950"></div>
                              </>
                           )}
                        </div>

                        <div className="flex items-center md:items-start md:flex-col gap-4 md:border-r border-zinc-800 md:pr-4 relative z-10">
                           <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-950 rounded-xl border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm relative">
                              {getRoleIcon(player.role, 'w-6 h-6')}
                           </div>
                           <div>
                              <span className="text-lg font-black text-white uppercase block leading-none mb-1">{player.name}</span>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                 <span>{player.games} Jogos</span><span>•</span><span className={player.winRate >= 50 ? 'text-blue-400' : 'text-red-400'}>{Math.round(player.winRate)}% WR</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex-1 w-full overflow-x-auto custom-scrollbar relative z-10">
                           <div className="min-w-[800px] grid grid-cols-12 gap-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-2">
                              <span className="col-span-3">Campeão</span>
                              <span className="col-span-1 text-center">Win Rate</span>
                              <span className="col-span-1 text-center">KDA Médio</span>
                              <span className="col-span-2 text-center">DPM Médio</span>
                              <span className="col-span-5 text-right pr-4 flex justify-end gap-5">
                                 <span className="text-blue-500/70 w-6">LAN</span>
                                 <span className="text-emerald-500/70 w-6">IMP</span>
                                 <span className="text-amber-500/70 w-6">CON</span>
                                 <span className="text-purple-500/70 w-6">VIS</span>
                                 <span className="text-zinc-300 w-10">OVR</span>
                              </span>
                           </div>
                           <div className="space-y-3">
                              {player.champs.length > 0 ? player.champs.map((champ: any) => (
                                 <div key={champ.name} className="min-w-[800px] grid grid-cols-12 items-center gap-4 bg-zinc-950/80 rounded-lg p-2 border border-zinc-800/50 hover:border-zinc-600 transition-colors">
                                    <div className="col-span-3 flex items-center gap-3">
                                       <img src={getChampionImageUrl(champ.name)} className="w-8 h-8 rounded border border-zinc-700" alt="" />
                                       <span className="text-xs font-black text-white uppercase">{champ.picks}x</span>
                                    </div>
                                    <div className="col-span-1 text-center"><span className={`text-xs font-black ${champ.winRate >= 50 ? 'text-blue-500' : 'text-zinc-400'}`}>{Math.round(champ.winRate)}%</span></div>
                                    <div className="col-span-1 text-center"><span className="text-xs font-black text-zinc-300">{champ.kda.toFixed(2)}</span></div>
                                    <div className="col-span-2 text-center"><span className="text-xs font-black text-zinc-300">{Math.round(champ.avgDpm)}</span></div>
                                    <div className="col-span-5 text-right pr-4 flex justify-end gap-5 font-mono text-sm">
                                       <span className="text-blue-500 w-6 text-center">{champ.avgLan.toFixed(1)}</span>
                                       <span className="text-emerald-500 w-6 text-center">{champ.avgImp.toFixed(1)}</span>
                                       <span className="text-amber-500 w-6 text-center">{champ.avgCon.toFixed(1)}</span>
                                       <span className="text-purple-500 w-6 text-center">{champ.avgVis.toFixed(1)}</span>
                                       <span className={`${getOverallColor(champ.avgOvr)} w-10 text-center font-black`}>{champ.avgOvr.toFixed(1)}</span>
                                    </div>
                                 </div>
                              )) : <div className="text-center text-[10px] text-zinc-600 font-bold uppercase py-4">Sem dados para listar campeões</div>}
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

function PremiumTeamSelector({ value, onChange, options, align = "center" }: { value: string, onChange: (val: string) => void, options: any[], align?: "left"|"center"|"right" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => { 
     const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; 
     document.addEventListener("mousedown", click); 
     return () => document.removeEventListener("mousedown", click); 
  }, []);

  const filteredOptions = options.filter(t => t.acronym.toLowerCase().includes(search.toLowerCase()));
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";

  return (
    <div className="relative flex flex-col z-[9999] w-full max-w-[280px]" ref={ref}>
      <button 
         onClick={() => setIsOpen(!isOpen)} 
         className={`bg-zinc-950 border border-zinc-800 px-6 py-3 rounded-xl flex items-center justify-between gap-4 hover:border-zinc-600 transition-colors shadow-sm cursor-pointer group`}
      >
         <span className={`flex-1 text-2xl font-black uppercase tracking-tight text-white ${alignClass}`}>{value || 'SELECIONE'}</span>
         <span className={`text-[10px] text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl animate-fade-in-down origin-top">
          <div className="p-3 border-b border-zinc-800/50 bg-zinc-900">
             <input 
                type="text" 
                placeholder="BUSCAR TIME..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-bold uppercase px-4 py-2 rounded-lg outline-none focus:border-blue-500 transition-colors"
                autoFocus
             />
          </div>
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
             {filteredOptions.length > 0 ? filteredOptions.map(t => (
                <button 
                   key={t.id} 
                   onClick={() => { onChange(t.acronym); setIsOpen(false); setSearch(""); }} 
                   className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-800 rounded-xl transition-all ${value === t.acronym ? 'bg-zinc-800/80' : ''}`}
                >
                   <img src={t.logo_url || `https://ui-avatars.com/api/?name=${t.acronym}&background=18181b&color=3b82f6&bold=true`} alt={t.acronym} className="w-8 h-8 object-contain drop-shadow-md" />
                   <span className={`text-sm font-black uppercase tracking-wide ${value === t.acronym ? 'text-white' : 'text-zinc-400'}`}>{t.acronym}</span>
                </button>
             )) : <div className="text-center text-[10px] font-bold text-zinc-600 py-6 uppercase">Time não encontrado</div>}
          </div>
        </div>
      )}
    </div>
  );
}

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