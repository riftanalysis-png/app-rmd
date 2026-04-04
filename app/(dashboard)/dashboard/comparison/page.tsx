"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from 'recharts';

// --- CONFIGURAÇÕES GERAIS E CONSTANTES ---
const DDRAGON_VERSION = '16.1.1'; 
const MAP_OFFSET = 3.5; 
const MAP_SCALE = 93;   
const GAME_MAX = 15000; 
const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];

const OBJECTIVE_LABELS: { [key: string]: string } = {
  'dragon1': 'Dragão 1', 'horde': 'Vastilarvas', 'dragon2': 'Dragão 2', 'riftherald': 'Arauto',
  'dragon3': 'Dragão 3', 'dragon4': 'Dragão 4', 'BARON_NASHOR': 'Barão Nashor', 'dragon5': 'Ancião/D5'
};

const BASE_ICON_URL = "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons";
const BASE_ANNOUNCE_URL = "https://raw.communitydragon.org/latest/game/assets/ux/announcements";

const OBJECTIVE_ASSETS: { [key: string]: { icon: string, hover: string } } = {
  'dragon1': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon2': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon3': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon4': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon5': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/elder_circle.png` },
  'horde': { icon: `${BASE_ICON_URL}/grub.png`, hover: `${BASE_ANNOUNCE_URL}/sru_voidgrub_circle.png` },
  'riftherald': { icon: `${BASE_ICON_URL}/riftherald.png`, hover: `${BASE_ANNOUNCE_URL}/sruriftherald_circle.png` },
  'BARON_NASHOR': { icon: `${BASE_ICON_URL}/baron.png`, hover: `${BASE_ANNOUNCE_URL}/baron_circle.png` },
};

const ORDERED_OBJECTIVES = ['dragon1', 'horde', 'dragon2', 'riftherald', 'dragon3', 'dragon4', 'BARON_NASHOR', 'dragon5'];

// --- FUNÇÕES UTILITÁRIAS ---
function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777') return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function formatTime(decimal: number | null) {
  if (isNaN(Number(decimal)) || decimal === null) return "00:00";
  const mins = Math.floor(decimal);
  const secs = Math.round((decimal - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  return <img src={`${basePath}/${iconName}`} alt={normalizedRole} className={`${size} object-contain brightness-200`} />;
}

// === MOTOR MATEMÁTICO: CÁLCULO DE MEDIANA ===
const getMedian = (arr: number[]) => {
    if (!arr || arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// === CONFIGURAÇÃO MESTRE DOS RANKINGS ===
const metricsConfig = [
    { key: 'lane_rating', label: 'LANE RATING', icon: '📊', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'impact_rating', label: 'IMPACT RATING', icon: '☄️', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'conversion_rating', label: 'CONV RATING', icon: '🔄', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'vision_rating', label: 'VISION RATING', icon: '📡', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'kda', label: 'KDA', icon: '✨', format: (v: number) => v.toFixed(2), sortDesc: true },
    { key: 'kills', label: 'KILLS', icon: '🔪', format: (v: number) => v.toFixed(1), sortDesc: true },
    { key: 'deaths', label: 'DEATHS (MAIS MORRE)', icon: '💀', format: (v: number) => v.toFixed(1), sortDesc: true }, 
    { key: 'assists', label: 'ASSISTS', icon: '🤝', format: (v: number) => v.toFixed(1), sortDesc: true },
    { key: 'deaths_at_12', label: 'DEATHS @12', icon: '🩸', format: (v: number) => v.toFixed(1), sortDesc: true },
    { key: 'cs_12', label: 'CS @12', icon: '🌾', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'xp_12', label: 'XP @12', icon: '🧠', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'gold_12', label: 'GOLD @12', icon: '💰', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'gold_diff_at_12', label: 'GOLD DIFF @12', icon: '⚖️', format: (v: number) => (v > 0 ? '+' : '') + v.toFixed(0), sortDesc: true },
    { key: 'xp_diff_at_12', label: 'XP DIFF @12', icon: '🧬', format: (v: number) => (v > 0 ? '+' : '') + v.toFixed(0), sortDesc: true },
    { key: 'cs_diff_at_12', label: 'CS DIFF @12', icon: '✂️', format: (v: number) => (v > 0 ? '+' : '') + v.toFixed(1), sortDesc: true },
    { key: 'vspm', label: 'VISION SCORE/MIN (VSPM)', icon: '👁️', format: (v: number) => v.toFixed(2), sortDesc: true },
    { key: 'vpm_at_12', label: 'WARDS/MIN @12', icon: '🔦', format: (v: number) => v.toFixed(2), sortDesc: true },
    { key: 'dpm', label: 'DAMAGE/MIN (DPM)', icon: '⚔️', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'gpm', label: 'GOLD/MIN (GPM)', icon: '🪙', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'gold_efficiency', label: 'GOLD EFFICIENCY %', icon: '📈', format: (v: number) => v.toFixed(1) + '%', sortDesc: true },
    { key: 'dmg_gold_ratio', label: 'DMG/GOLD RATIO', icon: '💸', format: (v: number) => v.toFixed(2), sortDesc: true },
    { key: 'kp', label: 'KILL PARTICIPATION %', icon: '🎯', format: (v: number) => v.toFixed(1) + '%', sortDesc: true },
    { key: 'fpm', label: 'CS/MIN', icon: '🚜', format: (v: number) => v.toFixed(1), sortDesc: true },
    { key: 'dmg_buildings', label: 'DMG TO BUILDINGS', icon: '🗼', format: (v: number) => (v/1000).toFixed(1) + 'k', sortDesc: true },
    { key: 'dmg_objectives', label: 'DMG TO OBJECTIVES', icon: '🐉', format: (v: number) => (v/1000).toFixed(1) + 'k', sortDesc: true },
    { key: 'plates', label: 'TURRET PLATES', icon: '🛡️', format: (v: number) => v.toFixed(1), sortDesc: true },
    { key: 'dmg_percent', label: 'TEAM DMG % SHARE', icon: '🔥', format: (v: number) => v.toFixed(1) + '%', sortDesc: true },
    { key: 'taken_percent', label: 'TEAM DMG TAKEN %', icon: '🥩', format: (v: number) => v.toFixed(1) + '%', sortDesc: true },
    { key: 'cc_score', label: 'CC SCORE', icon: '❄️', format: (v: number) => v.toFixed(0), sortDesc: true },
    { key: 'gold_share', label: 'TEAM GOLD SHARE %', icon: '👑', format: (v: number) => v.toFixed(1) + '%', sortDesc: true },
    { key: 'lane_efficiency', label: 'LANE EFFICIENCY', icon: '🧪', format: (v: number) => v.toFixed(2), sortDesc: true },
];

export default function ComparisonHub() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- TABS DA PÁGINA ---
  const [activeTab, setActiveTab] = useState<'TEAMS' | 'HARD_DATA'>('TEAMS');
  const [hardDataMode, setHardDataMode] = useState<'GLOBAL' | 'COMPARISON'>('GLOBAL');
  
  // Estado para o ranking do Wall of Supremacy
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>(metricsConfig[0].key);

  // --- ESTADOS GLOBAIS DE FILTRO ---
  const [globalTournament, setGlobalTournament] = useState("CIRCUITO_DESAFIANTE");
  const [globalSplit, setGlobalSplit] = useState("SPLIT 1");

  // --- ESTADOS DE COMPARAÇÃO ---
  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");

  // --- ESTADOS DE VISÃO ---
  const [heatmapSide, setHeatmapSide] = useState<string>("Blue");
  const [heatmapObjective, setHeatmapObjective] = useState<string>("dragon1");

  // --- DADOS BRUTOS BLINDADOS ---
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [globalStatsData, setGlobalStatsData] = useState<any[]>([]);
  const [playerStatsData, setPlayerStatsData] = useState<any[]>([]);
  const [objectiveData, setObjectiveData] = useState<any[]>([]);
  const [wardsData, setWardsData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('*').order('acronym');
      if (data && data.length >= 2) {
        setTeams(data);
        setTeamA(data[0].acronym);
        setTeamB(data[1].acronym);
      }
      setLoading(false);
    }
    fetchTeams();
  }, []);

  useEffect(() => {
    async function fetchComparisonData() {
      if (!teamA || !teamB) return;

      let matchesQuery = supabase.from('matches').select('id');
      if (globalTournament !== 'ALL') matchesQuery = matchesQuery.eq('game_type', globalTournament);
      if (globalSplit !== 'ALL') matchesQuery = matchesQuery.eq('split', globalSplit);

      let perfQuery = supabase.from('hub_players_performance').select('*').in('team_acronym', [teamA, teamB]);
      let objQuery = supabase.from('hub_players_objectives').select('*').in('team_acronym', [teamA, teamB]);
      let wardsQuery = supabase.from('hub_players_vision').select('*').in('team_acronym', [teamA, teamB]);
      let statsQuery = supabase.from('player_stats_detailed').select('*');

      if (globalTournament !== 'ALL') {
        perfQuery = perfQuery.eq('game_type', globalTournament);
        objQuery = objQuery.eq('game_type', globalTournament);
        wardsQuery = wardsQuery.eq('game_type', globalTournament);
      }
      if (globalSplit !== 'ALL') {
        perfQuery = perfQuery.eq('split', globalSplit);
        objQuery = objQuery.eq('split', globalSplit);
        wardsQuery = wardsQuery.eq('split', globalSplit);
      }

      const [matchesRes, perfRes, objRes, wardsRes, statsRes] = await Promise.all([matchesQuery, perfQuery, objQuery, wardsQuery, statsQuery]);
      
      if (perfRes.data) setPerformanceData(perfRes.data);
      if (objRes.data) setObjectiveData(objRes.data);
      if (wardsRes.data) setWardsData(wardsRes.data);

      if (statsRes.data && matchesRes.data) {
          const validGlobalMatchIds = new Set(matchesRes.data.map(m => m.id));
          const validGlobalStats = statsRes.data.filter(s => validGlobalMatchIds.has(s.match_id));
          setGlobalStatsData(validGlobalStats);
          setPlayerStatsData(validGlobalStats.filter(s => s.team_acronym === teamA || s.team_acronym === teamB));
      }
    }
    fetchComparisonData();
  }, [teamA, teamB, globalTournament, globalSplit]);

  const getTeamLogo = (acronym: string) => teams.find(t => t.acronym === acronym)?.logo_url || `https://ui-avatars.com/api/?name=${acronym}&background=1e293b&color=3b82f6&bold=true`;
  const getTeamColorClass = (acronym: string) => {
      if (acronym === teamA) return 'text-blue-400';
      if (acronym === teamB) return 'text-red-400';
      return 'text-white';
  };

  // ============================================================================
  // LÓGICA DA ABA 1: TEAM COMPARISON 
  // ============================================================================
  const { statsA, statsB } = useMemo(() => {
    const calcStats = (teamAcronym: string) => {
      const tStats = playerStatsData.filter(p => p.team_acronym === teamAcronym);
      const matchIds = Array.from(new Set(tStats.map(p => p.match_id)));
      const totalGames = matchIds.length;
      
      if (totalGames === 0) return { wr: 0, lane: 0, impact: 0, conv: 0, vision: 0, total: 0 };
      let wins = 0;
      matchIds.forEach(mId => {
         const p = tStats.find(x => x.match_id === mId);
         if (p && p.win === true) wins++;
      });
      return { 
        wr: Math.round((wins / totalGames) * 100), 
        lane: Math.round(tStats.reduce((acc, curr) => acc + (curr.lane_rating || 0), 0) / tStats.length), 
        impact: Math.round(tStats.reduce((acc, curr) => acc + (curr.impact_rating || 0), 0) / tStats.length), 
        conv: Math.round(tStats.reduce((acc, curr) => acc + (curr.conversion_rating || 0), 0) / tStats.length), 
        vision: Math.round(tStats.reduce((acc, curr) => acc + (curr.vision_rating || 0), 0) / tStats.length),
        total: totalGames
      };
    };
    return { statsA: calcStats(teamA), statsB: calcStats(teamB) };
  }, [playerStatsData, teamA, teamB]);

  const radarData = useMemo(() => [
    { subject: 'LANE DOM.', [teamA]: statsA.lane, [teamB]: statsB.lane },
    { subject: 'IMPACTO', [teamA]: statsA.impact, [teamB]: statsB.impact },
    { subject: 'CONVERSÃO', [teamA]: statsA.conv, [teamB]: statsB.conv },
    { subject: 'VISÃO', [teamA]: statsA.vision, [teamB]: statsB.vision },
  ], [statsA, statsB, teamA, teamB]);

  const championPoolDepth = useMemo(() => {
     const analyzePool = (teamAcronym: string) => {
         const tStats = playerStatsData.filter(p => p.team_acronym === teamAcronym);
         const players: Record<string, { role: string, champs: Set<string>, games: number }> = {};
         tStats.forEach(curr => {
             const name = curr.summoner_name;
             if(!players[name]) players[name] = { role: normalizeRole(curr.lane), champs: new Set(), games: 0 };
             players[name].champs.add(curr.champion);
             players[name].games++;
         });
         const roster = Object.keys(players).map(name => ({
             name, role: players[name].role, games: players[name].games, uniqueChamps: players[name].champs.size, flexibility: players[name].champs.size / players[name].games
         })).filter(p => p.games > 2);
         if(roster.length === 0) return { puddle: null, ocean: null };
         const puddle = roster.reduce((a, b) => a.flexibility < b.flexibility ? a : b);
         const ocean = roster.reduce((a, b) => a.flexibility > b.flexibility ? a : b);
         return { puddle, ocean };
     };
     return { A: analyzePool(teamA), B: analyzePool(teamB) };
  }, [playerStatsData, teamA, teamB]);

  const midJungleAxis = useMemo(() => {
      const getAxis = (teamAcronym: string) => {
          const tStats = playerStatsData.filter(p => p.team_acronym === teamAcronym);
          const totalGames = Array.from(new Set(tStats.map(p => p.match_id))).length || 1;
          let combinedGd12 = 0; let combinedKp = 0; let combinedDmg = 0;
          tStats.forEach(curr => {
              const role = normalizeRole(curr.lane);
              if(role === 'MID' || role === 'JNG') { combinedGd12 += (curr.gold_diff_at_12 || 0); combinedDmg += (curr.damage_percent || curr.dmg_percent || 0); }
          });
          const jgMidGames = tStats.filter(c => normalizeRole(c.lane) === 'JNG' || normalizeRole(c.lane) === 'MID');
          if(jgMidGames.length > 0) combinedKp = jgMidGames.reduce((acc, curr) => acc + (curr.kp || 0), 0) / jgMidGames.length;
          return { gd12: Math.round(combinedGd12 / totalGames), kp: Math.round(combinedKp), dmgPct: parseFloat((combinedDmg / totalGames).toFixed(1)) };
      };
      return { A: getAxis(teamA), B: getAxis(teamB) };
  }, [playerStatsData, teamA, teamB]);

  const pacingClock = useMemo(() => {
      const getPacing = (teamAcronym: string) => {
          const tStats = playerStatsData.filter(p => p.team_acronym === teamAcronym);
          const matchMap: Record<string, { durationMin: number, win: boolean }> = {};
          tStats.forEach(curr => {
              if(!matchMap[curr.match_id] && curr.gpm > 0) {
                  const duration = curr.total_gold / curr.gpm;
                  matchMap[curr.match_id] = { durationMin: duration, win: curr.win === true };
              }
          });
          const games = Object.values(matchMap);
          const earlyGames = games.filter(g => g.durationMin < 28);
          const midGames = games.filter(g => g.durationMin >= 28 && g.durationMin < 35);
          const lateGames = games.filter(g => g.durationMin >= 35);
          const calcWr = (bucket: any[]) => bucket.length > 0 ? Math.round((bucket.filter(g => g.win).length / bucket.length) * 100) : 0;
          return { earlyWr: calcWr(earlyGames), midWr: calcWr(midGames), lateWr: calcWr(lateGames), avgDuration: games.length > 0 ? Math.round(games.reduce((acc, curr) => acc + curr.durationMin, 0) / games.length) : 0 };
      };
      return { A: getPacing(teamA), B: getPacing(teamB) };
  }, [playerStatsData, teamA, teamB]);

  const objWindows = useMemo(() => {
    const groupObj = (teamAcronym: string) => {
      const grouped = new Map();
      objectiveData.filter(o => o.team_acronym === teamAcronym && o.side === heatmapSide).forEach(curr => {
        const key = `${curr.objective_type}_${curr.side}`;
        if (!grouped.has(key)) grouped.set(key, { ...curr, count: Number(curr.total_occurrences) || 1 });
        else {
          const acc = grouped.get(key);
          acc.min_minute = Math.min(acc.min_minute, curr.min_minute);
          acc.max_minute = Math.max(acc.max_minute, curr.max_minute);
          const currentCount = Number(curr.total_occurrences) || 1;
          acc.avg_minute = ((acc.avg_minute * acc.count) + (curr.avg_minute * currentCount)) / (acc.count + currentCount);
          acc.count += currentCount;
        }
      });
      return grouped;
    };
    const mapA = groupObj(teamA); const mapB = groupObj(teamB);
    return ORDERED_OBJECTIVES.map(objKey => {
      const a = mapA.get(`${objKey}_${heatmapSide}`); const b = mapB.get(`${objKey}_${heatmapSide}`);
      if (!a && !b) return null;
      return {
        key: objKey, name: OBJECTIVE_LABELS[objKey], icon: OBJECTIVE_ASSETS[objKey]?.icon, hoverImg: OBJECTIVE_ASSETS[objKey]?.hover,
        teamA_window: a ? [a.min_minute, a.max_minute] : null, teamA_avg: a ? a.avg_minute : null,
        teamB_window: b ? [b.min_minute, b.max_minute] : null, teamB_avg: b ? b.avg_minute : null,
      };
    }).filter(Boolean);
  }, [objectiveData, teamA, teamB, heatmapSide]);

  const { wardsA, wardsB } = useMemo(() => {
    const getActiveWards = (teamAcronym: string) => {
      const processedObj = objWindows.find(o => o?.key.toLowerCase() === heatmapObjective.toLowerCase());
      if (!processedObj) return [];
      const teamWindow = teamAcronym === teamA ? processedObj.teamA_window : processedObj.teamB_window;
      if (!teamWindow) return [];
      return wardsData.filter(w => w.team_acronym === teamAcronym && w.side === heatmapSide && w.minute >= teamWindow[0] && w.minute <= teamWindow[1]);
    };
    return { wardsA: getActiveWards(teamA), wardsB: getActiveWards(teamB) };
  }, [wardsData, teamA, teamB, heatmapSide, heatmapObjective, objWindows]);


  // ============================================================================
  // LÓGICA DA ABA 2: HARD DATA & ARCHETYPES (Medianas Extensas)
  // ============================================================================
  const hardData = useMemo(() => {
     const dataSource = hardDataMode === 'GLOBAL' ? globalStatsData : playerStatsData;
     if(dataSource.length === 0) return { players: [], ranks: {}, extremes: {} };

     const pMap: Record<string, any> = {};
     
     dataSource.forEach(curr => {
         const name = curr.summoner_name;
         if(!pMap[name]) {
            pMap[name] = { 
               name, team: curr.team_acronym, role: normalizeRole(curr.lane), games: 0,
               metrics: {} 
            };
            metricsConfig.forEach(m => pMap[name].metrics[m.key] = []);
         }
         
         pMap[name].games++;
         
         metricsConfig.forEach(m => {
             let val = curr[m.key];
             if (m.key === 'dmg_percent' && val === undefined) val = curr['damage_percent'];
             if (m.key === 'taken_percent' && val === undefined) val = curr['dmg_taken_percent'];
             if (val !== undefined && val !== null) {
                 pMap[name].metrics[m.key].push(Number(val));
             }
         });
     });

     let players = Object.values(pMap).filter(p => p.games > 1).map(p => {
         const medians: any = {};
         metricsConfig.forEach(m => {
             medians[m.key] = getMedian(p.metrics[m.key]);
         });

         let arc = "OPERÁRIO PADRÃO";
         let color = "text-slate-400";
         let icon = "⚙️";

         if (medians.gold_diff_at_12 > 300 && medians.cs_diff_at_12 > 5) { arc = "LANE TERRORIST"; color = "text-red-500"; icon = "👹"; }
         else if (medians.dmg_buildings > 4000 && medians.kp < 55) { arc = "SPLITPUSHER ISOLADO"; color = "text-amber-500"; icon = "🪓"; }
         else if (medians.gold_share > 26 && medians.dmg_percent > 28) { arc = "BLACKHOLE / HYPERCARRY"; color = "text-purple-500"; icon = "🌌"; }
         else if (medians.deaths_at_12 > 1.2 && medians.kp > 65) { arc = "KAMIKAZE / ENGAGER"; color = "text-orange-500"; icon = "💣"; }
         else if (medians.vspm > 2.0 && medians.vpm_at_12 > 0.8) { arc = "TACTICIAN (MIND GAMES)"; color = "text-emerald-500"; icon = "👁️"; }
         else if (medians.fpm > 8.5 && medians.kp < 55) { arc = "AFK FARMER"; color = "text-yellow-400"; icon = "🌾"; }
         else if (medians.cc_score > 30 && medians.kp > 70 && medians.gold_share < 18) { arc = "CÃO DE GUARDA (GLUE)"; color = "text-blue-400"; icon = "🛡️"; }
         else if (medians.deaths < 2 && medians.taken_percent > 25) { arc = "UNKILLABLE DEMON"; color = "text-cyan-400"; icon = "🧟"; }
         else if (medians.dmg_gold_ratio > 1.3 && medians.kills > 4) { arc = "EFFICIENT ASSASSIN"; color = "text-fuchsia-500"; icon = "🥷"; }
         else if (medians.dmg_objectives > 15000) { arc = "OBJECTIVE SECURER"; color = "text-rose-500"; icon = "🐉"; }

         return {
             name: p.name,
             team: p.team,
             role: p.role,
             games: p.games,
             ...medians,
             archetype: arc,
             arcColor: color,
             arcIcon: icon
         };
     });

     const ranks: Record<string, any[]> = {};
     metricsConfig.forEach(m => {
         const sorted = [...players].sort((a, b) => {
             return m.sortDesc ? b[m.key] - a[m.key] : a[m.key] - b[m.key];
         });
         // Agora guardamos TODOS OS JOGADORES do ranking
         ranks[m.key] = sorted; 
     });

     // Extremes remapeados para usar apenas os top 3 da lista cheia
     const extremes = {
         highestDpm: ranks['dpm']?.slice(0, 3) || [],
         highestDeaths: ranks['deaths']?.slice(0, 3) || [],
         highestCsm: ranks['fpm']?.slice(0, 3) || [],
         highestVspm: ranks['vspm']?.slice(0, 3) || [],
         bestEarly: ranks['gold_diff_at_12']?.slice(0, 3) || [],
     };

     return { players: players.sort((a,b) => b.dpm - a.dpm), ranks, extremes };
  }, [globalStatsData, playerStatsData, hardDataMode]);

  // Constante e Estado derivado do Dropdown de Ranking Único
  const currentRankingMetric = useMemo(() => metricsConfig.find(m => m.key === selectedMetricKey) || metricsConfig[0], [selectedMetricKey]);
  const currentRankingList = useMemo(() => hardData.ranks[currentRankingMetric.key] || [], [hardData, currentRankingMetric]);

  if (loading) return <div className="flex items-center justify-center h-[80vh] text-blue-500 font-black italic animate-pulse text-xs tracking-widest uppercase">// INITIALIZING_PROTOCOL_...</div>;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 font-black uppercase italic tracking-tighter pb-20">
      
      {/* --- CABEÇALHO E FILTROS --- */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-white/5 pb-8 relative z-[200]">
        <div className="border-l-4 border-fuchsia-500 pl-4">
          <h1 className="text-4xl text-white leading-none">HEAD-TO-HEAD <span className="text-fuchsia-500">HUB</span></h1>
          <p className="text-[9px] text-slate-500 tracking-[0.4em] mt-2 font-black">MACRO NARRATIVE & TEAM IDENTITY</p>
        </div>
        
        {/* TABS DE NAVEGAÇÃO DA PÁGINA */}
        <div className="flex bg-black p-1.5 rounded-2xl border border-white/10 shadow-2xl">
           <button onClick={() => setActiveTab('TEAMS')} className={`px-8 py-3 rounded-xl text-[10px] transition-all ${activeTab === 'TEAMS' ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(232,121,249,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>TEAM MATRIX</button>
           <button onClick={() => setActiveTab('HARD_DATA')} className={`px-8 py-3 rounded-xl text-[10px] transition-all ${activeTab === 'HARD_DATA' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>HARD DATA & ARCHETYPES</button>
        </div>

        <div className="flex gap-6 items-end bg-transparent">
           <TournamentSelector value={globalTournament} onChange={setGlobalTournament} />
           <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
        </div>
      </header>

      {/* --- SELETOR DE TIMES GLOBAIS (O RINGUE) --- */}
      <div className={`bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-visible flex flex-col md:flex-row items-center justify-between gap-8 mt-8 transition-all ${activeTab === 'HARD_DATA' && hardDataMode === 'GLOBAL' ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"></div>
        <div className="flex-1 flex flex-col items-center relative z-10 w-full">
            <img src={getTeamLogo(teamA)} className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] mb-4 object-cover" alt="" />
            <select value={teamA} onChange={e => setTeamA(e.target.value)} className="bg-black/80 border border-blue-500/30 text-blue-400 text-2xl text-center font-black italic rounded-xl px-6 py-3 outline-none focus:border-blue-500 w-full max-w-[250px] appearance-none shadow-xl cursor-pointer">
                {teams.map(t => <option key={`A-${t.acronym}`} value={t.acronym}>{t.acronym}</option>)}
            </select>
            <span className="text-[10px] text-slate-500 tracking-[0.3em] mt-3">LADO AZUL DA ANÁLISE</span>
        </div>
        <div className="shrink-0 flex flex-col items-center justify-center relative z-10">
            <div className="w-16 h-16 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <span className="text-3xl text-white font-black italic">VS</span>
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-white/20 to-transparent mt-2"></div>
        </div>
        <div className="flex-1 flex flex-col items-center relative z-10 w-full">
            <img src={getTeamLogo(teamB)} className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] mb-4 object-cover" alt="" />
            <select value={teamB} onChange={e => setTeamB(e.target.value)} className="bg-black/80 border border-red-500/30 text-red-400 text-2xl text-center font-black italic rounded-xl px-6 py-3 outline-none focus:border-red-500 w-full max-w-[250px] appearance-none shadow-xl cursor-pointer">
                {teams.map(t => <option key={`B-${t.acronym}`} value={t.acronym}>{t.acronym}</option>)}
            </select>
            <span className="text-[10px] text-slate-500 tracking-[0.3em] mt-3">LADO VERMELHO DA ANÁLISE</span>
        </div>
      </div>

      {/* =========================================================================================
          VIEW 1: TEAM MATRIX 
          ========================================================================================= */}
      {activeTab === 'TEAMS' && (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8 animate-in fade-in zoom-in duration-500">
          
          <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative flex flex-col min-h-[450px] overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-30 transition-all"></div>
             <div className="mb-8 shrink-0">
                <h3 className="text-xl text-white italic">Win Condition Clock</h3>
                <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">EM QUAL FASE DO JOGO O TIME É MAIS LETAL E QUANDO ELES SE PERDEM?</p>
             </div>

             <div className="flex-1 w-full flex flex-col justify-around relative z-10">
                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center px-2">
                      <span className="text-[9px] text-slate-500 tracking-widest">SUFOCAMENTO (<span className="opacity-50">28 MIN</span>)</span>
                   </div>
                   <div className="flex items-center gap-4 w-full">
                      <div className="w-12 text-right"><span className="text-xl font-black text-blue-400">{pacingClock.A.earlyWr}%</span></div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative">
                         <div className="h-full bg-blue-500" style={{ width: `${pacingClock.A.earlyWr}%` }} />
                      </div>
                      <div className="w-6 text-center text-[8px] text-slate-600">VS</div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative flex-row-reverse">
                         <div className="h-full bg-red-500" style={{ width: `${pacingClock.B.earlyWr}%` }} />
                      </div>
                      <div className="w-12 text-left"><span className="text-xl font-black text-red-400">{pacingClock.B.earlyWr}%</span></div>
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center px-2">
                      <span className="text-[9px] text-slate-500 tracking-widest">MACRO & TEAMFIGHT (<span className="opacity-50">28 A 35 MIN</span>)</span>
                   </div>
                   <div className="flex items-center gap-4 w-full">
                      <div className="w-12 text-right"><span className="text-xl font-black text-blue-400">{pacingClock.A.midWr}%</span></div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative">
                         <div className="h-full bg-blue-500" style={{ width: `${pacingClock.A.midWr}%` }} />
                      </div>
                      <div className="w-6 text-center text-[8px] text-slate-600">VS</div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative flex-row-reverse">
                         <div className="h-full bg-red-500" style={{ width: `${pacingClock.B.midWr}%` }} />
                      </div>
                      <div className="w-12 text-left"><span className="text-xl font-black text-red-400">{pacingClock.B.midWr}%</span></div>
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center px-2">
                      <span className="text-[9px] text-slate-500 tracking-widest">LATE GAME SCALING (<span className="opacity-50">35+ MIN</span>)</span>
                   </div>
                   <div className="flex items-center gap-4 w-full">
                      <div className="w-12 text-right"><span className="text-xl font-black text-blue-400">{pacingClock.A.lateWr}%</span></div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative">
                         <div className="h-full bg-blue-500" style={{ width: `${pacingClock.A.lateWr}%` }} />
                      </div>
                      <div className="w-6 text-center text-[8px] text-slate-600">VS</div>
                      <div className="flex-1 h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5 relative flex-row-reverse">
                         <div className="h-full bg-red-500" style={{ width: `${pacingClock.B.lateWr}%` }} />
                      </div>
                      <div className="w-12 text-left"><span className="text-xl font-black text-red-400">{pacingClock.B.lateWr}%</span></div>
                   </div>
                </div>
                
                <div className="flex justify-between items-center bg-black/40 border border-white/5 p-4 rounded-2xl mt-2">
                   <div className="flex flex-col"><span className="text-[8px] text-slate-500">MÉDIA GLOBAL DE TEMPO</span><span className="text-blue-400 font-mono text-xl">{pacingClock.A.avgDuration} MIN</span></div>
                   <div className="flex flex-col items-end"><span className="text-[8px] text-slate-500">MÉDIA GLOBAL DE TEMPO</span><span className="text-red-400 font-mono text-xl">{pacingClock.B.avgDuration} MIN</span></div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-5 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative flex flex-col min-h-[450px] overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600 opacity-20 group-hover:opacity-100 transition-all"></div>
            <div className="flex items-center justify-between mb-8 shrink-0">
               <div>
                  <h3 className="text-xl text-white italic">Mid-Jungle Central Axis</h3>
                  <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">A GUERRA PELO CONTROLE DO RIO (2V2)</p>
               </div>
            </div>
            
            <div className="flex-1 w-full flex flex-col justify-around relative z-10 bg-black/40 border border-white/5 rounded-[32px] p-6">
               <div className="flex flex-col gap-3 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                     <div className="flex -space-x-3">
                        {getRoleIcon('MID', 'w-8 h-8 bg-[#121212] rounded-full border border-blue-500/30 p-1')}
                        {getRoleIcon('JNG', 'w-8 h-8 bg-[#121212] rounded-full border border-blue-500/30 p-1')}
                     </div>
                     <span className="text-blue-400 text-lg font-black italic">{teamA} CORE</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">GD@12 COMBINADO</span>
                        <span className={`text-lg font-black ${midJungleAxis.A.gd12 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{midJungleAxis.A.gd12 > 0 ? '+' : ''}{midJungleAxis.A.gd12}</span>
                     </div>
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">MÉDIA DE KP%</span>
                        <span className="text-lg font-black text-white">{midJungleAxis.A.kp}%</span>
                     </div>
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">% DANO DO EIXO</span>
                        <span className="text-lg font-black text-white">{midJungleAxis.A.dmgPct}%</span>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col gap-3 pt-6">
                  <div className="flex items-center justify-end gap-3">
                     <span className="text-red-400 text-lg font-black italic">{teamB} CORE</span>
                     <div className="flex -space-x-3">
                        {getRoleIcon('MID', 'w-8 h-8 bg-[#121212] rounded-full border border-red-500/30 p-1')}
                        {getRoleIcon('JNG', 'w-8 h-8 bg-[#121212] rounded-full border border-red-500/30 p-1')}
                     </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">GD@12 COMBINADO</span>
                        <span className={`text-lg font-black ${midJungleAxis.B.gd12 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{midJungleAxis.B.gd12 > 0 ? '+' : ''}{midJungleAxis.B.gd12}</span>
                     </div>
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">MÉDIA DE KP%</span>
                        <span className="text-lg font-black text-white">{midJungleAxis.B.kp}%</span>
                     </div>
                     <div className="bg-[#121212] border border-white/5 rounded-xl p-2 flex flex-col">
                        <span className="text-[8px] text-slate-500">% DANO DO EIXO</span>
                        <span className="text-lg font-black text-white">{midJungleAxis.B.dmgPct}%</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8 animate-in fade-in zoom-in duration-700">
          <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative flex flex-col min-h-[450px] overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-fuchsia-700 opacity-20 group-hover:opacity-100 transition-all"></div>
             <div className="mb-8 shrink-0">
                <h3 className="text-xl text-white italic">Champion Pool Vulnerability</h3>
                <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">THE DRAFT CHOKEHOLD: QUEM É FÁCIL DE PREVER?</p>
             </div>

             <div className="flex-1 grid grid-cols-2 gap-8 relative z-10">
                <div className="flex flex-col gap-6">
                   <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                      <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                      <span className="text-blue-400 font-black italic">{teamA} SCOUTING</span>
                   </div>
                   <div className="bg-black/40 border border-fuchsia-500/20 p-4 rounded-[24px] shadow-[inset_0_0_20px_rgba(232,121,249,0.05)]">
                      <span className="text-[8px] text-fuchsia-400 tracking-widest mb-2 block uppercase">⚠️ BAN TARGET (Most Predictable)</span>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#121212] rounded-xl border border-white/10 flex items-center justify-center">{getRoleIcon(championPoolDepth.A.puddle?.role || 'MID', 'w-5 h-5')}</div>
                            <div className="flex flex-col"><span className="text-sm font-black text-white italic leading-none">{championPoolDepth.A.puddle?.name || 'N/A'}</span><span className="text-[9px] text-slate-500 mt-1">{championPoolDepth.A.puddle?.games || 0} JOGOS</span></div>
                         </div>
                         <div className="text-right">
                            <span className="text-2xl font-black text-fuchsia-500 leading-none">{championPoolDepth.A.puddle?.uniqueChamps || 0}</span>
                            <span className="block text-[7px] text-slate-500 mt-1">PICKS ÚNICOS</span>
                         </div>
                      </div>
                   </div>
                   <div className="bg-black/40 border border-emerald-500/20 p-4 rounded-[24px]">
                      <span className="text-[8px] text-emerald-400 tracking-widest mb-2 block uppercase">🌊 DRAFT FLEXIBILITY (Hardest to Ban)</span>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#121212] rounded-xl border border-white/10 flex items-center justify-center">{getRoleIcon(championPoolDepth.A.ocean?.role || 'MID', 'w-5 h-5')}</div>
                            <div className="flex flex-col"><span className="text-sm font-black text-white italic leading-none">{championPoolDepth.A.ocean?.name || 'N/A'}</span><span className="text-[9px] text-slate-500 mt-1">{championPoolDepth.A.ocean?.games || 0} JOGOS</span></div>
                         </div>
                         <div className="text-right">
                            <span className="text-2xl font-black text-emerald-500 leading-none">{championPoolDepth.A.ocean?.uniqueChamps || 0}</span>
                            <span className="block text-[7px] text-slate-500 mt-1">PICKS ÚNICOS</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col gap-6">
                   <div className="flex items-center gap-3 border-b border-white/5 pb-2 flex-row-reverse text-right">
                      <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                      <span className="text-red-400 font-black italic">{teamB} SCOUTING</span>
                   </div>
                   <div className="bg-black/40 border border-fuchsia-500/20 p-4 rounded-[24px] shadow-[inset_0_0_20px_rgba(232,121,249,0.05)]">
                      <span className="text-[8px] text-fuchsia-400 tracking-widest mb-2 block uppercase text-right">⚠️ BAN TARGET (Most Predictable)</span>
                      <div className="flex items-center justify-between flex-row-reverse text-right">
                         <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="w-10 h-10 bg-[#121212] rounded-xl border border-white/10 flex items-center justify-center">{getRoleIcon(championPoolDepth.B.puddle?.role || 'MID', 'w-5 h-5')}</div>
                            <div className="flex flex-col items-end"><span className="text-sm font-black text-white italic leading-none">{championPoolDepth.B.puddle?.name || 'N/A'}</span><span className="text-[9px] text-slate-500 mt-1">{championPoolDepth.B.puddle?.games || 0} JOGOS</span></div>
                         </div>
                         <div className="text-left">
                            <span className="text-2xl font-black text-fuchsia-500 leading-none">{championPoolDepth.B.puddle?.uniqueChamps || 0}</span>
                            <span className="block text-[7px] text-slate-500 mt-1">PICKS ÚNICOS</span>
                         </div>
                      </div>
                   </div>
                   <div className="bg-black/40 border border-emerald-500/20 p-4 rounded-[24px]">
                      <span className="text-[8px] text-emerald-400 tracking-widest mb-2 block uppercase text-right">🌊 DRAFT FLEXIBILITY (Hardest to Ban)</span>
                      <div className="flex items-center justify-between flex-row-reverse text-right">
                         <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="w-10 h-10 bg-[#121212] rounded-xl border border-white/10 flex items-center justify-center">{getRoleIcon(championPoolDepth.B.ocean?.role || 'MID', 'w-5 h-5')}</div>
                            <div className="flex flex-col items-end"><span className="text-sm font-black text-white italic leading-none">{championPoolDepth.B.ocean?.name || 'N/A'}</span><span className="text-[9px] text-slate-500 mt-1">{championPoolDepth.B.ocean?.games || 0} JOGOS</span></div>
                         </div>
                         <div className="text-left">
                            <span className="text-2xl font-black text-emerald-500 leading-none">{championPoolDepth.B.ocean?.uniqueChamps || 0}</span>
                            <span className="block text-[7px] text-slate-500 mt-1">PICKS ÚNICOS</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-5 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative flex flex-col min-h-[450px] overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-red-500 opacity-20 group-hover:opacity-100 transition-all"></div>
            <div className="flex items-center justify-between mb-2 shrink-0">
               <div>
                  <h3 className="text-xl text-white italic">Playstyle Matrix</h3>
                  <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">SOBREPOSIÇÃO DE CARACTERÍSTICAS GLOBAIS</p>
               </div>
            </div>
            <div className="flex-1 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={teamA} dataKey={teamA} stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.4} />
                  <Radar name={teamB} dataKey={teamB} stroke="#ef4444" strokeWidth={3} fill="#ef4444" fillOpacity={0.4} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1e293b', fontSize: '10px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch mt-8 animate-in fade-in zoom-in duration-1000">
          <div className="xl:col-span-12 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-visible flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-8 relative z-10 shrink-0">
                <div>
                   <h3 className="text-xl text-white italic">Objective Execution Timings</h3>
                   <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">JANELAS DE TEMPO (MIN -&gt; MÁX) NO {heatmapSide.toUpperCase()} SIDE</p>
                </div>
                <SideSelector value={heatmapSide} onChange={setHeatmapSide} />
             </div>
             <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={objWindows} margin={{ bottom: 40, left: -20 }}>
                     <defs>
                       <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={1} /><stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.8} /></linearGradient>
                       <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={1} /><stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.8} /></linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} vertical={true} opacity={0.3} />
                     <XAxis dataKey="key" tick={<ObjectiveAxisTick />} interval={0} height={60} axisLine={false} />
                     <YAxis domain={[0, 45]} stroke="#475569" fontSize={10} fontStyle="italic" fontWeight="black" tickFormatter={(v) => `${v}m`} />
                     <Tooltip content={<ComparisonObjectiveTooltip teamA={teamA} teamB={teamB} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} wrapperStyle={{ zIndex: 9999 }} />
                     <Bar dataKey="teamA_window" radius={[8, 8, 8, 8]} barSize={16} fill="url(#barBlue)" />
                     <Bar dataKey="teamB_window" radius={[8, 8, 8, 8]} barSize={16} fill="url(#barRed)" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="xl:col-span-12 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-visible group flex flex-col items-center">
             <div className="w-full flex justify-between items-center mb-10 relative z-50">
                <div>
                  <h3 className="text-xl text-white italic">Tactical Vision Radar</h3>
                  <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">MAPA DE CALOR: {teamA} VS {teamB}</p>
                </div>
                <ObjectiveSelector value={heatmapObjective} onChange={setHeatmapObjective} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-[1000px]">
                <div className="flex flex-col items-center">
                   <div className="flex items-center gap-3 mb-6 bg-black/40 px-6 py-2 rounded-2xl border border-white/5">
                      <img src={getTeamLogo(teamA)} className="w-6 h-6 object-contain" alt="" />
                      <span className="text-blue-400 text-lg font-black italic">{teamA}</span>
                   </div>
                   <WardMap wards={wardsA} mapColor="blue" />
                </div>
                <div className="flex flex-col items-center">
                   <div className="flex items-center gap-3 mb-6 bg-black/40 px-6 py-2 rounded-2xl border border-white/5">
                      <img src={getTeamLogo(teamB)} className="w-6 h-6 object-contain" alt="" />
                      <span className="text-red-400 text-lg font-black italic">{teamB}</span>
                   </div>
                   <WardMap wards={wardsB} mapColor="red" />
                </div>
             </div>
          </div>
        </div>
      </>
      )}


      {/* =========================================================================================
          VIEW 2: HARD DATA E ARQUÉTIPOS INÉDITOS 
          ========================================================================================= */}
      {activeTab === 'HARD_DATA' && (
      <div className="space-y-8 animate-in fade-in zoom-in duration-500">
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-4 gap-4 px-4">
            <div>
               <h2 className="text-3xl text-white italic">Operative Database & Rankings</h2>
               <p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">DADOS CALCULADOS BASEADOS NA MEDIANA ABSOLUTA DO JOGADOR NO FILTRO APLICADO</p>
            </div>
            
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10">
               <button onClick={() => setHardDataMode('GLOBAL')} className={`px-6 py-2.5 rounded-xl text-[9px] transition-all ${hardDataMode === 'GLOBAL' ? 'bg-white text-black font-black' : 'text-slate-500 hover:text-white'}`}>TODA A LIGA</button>
               <button onClick={() => setHardDataMode('COMPARISON')} className={`px-6 py-2.5 rounded-xl text-[9px] transition-all ${hardDataMode === 'COMPARISON' ? 'bg-white text-black font-black' : 'text-slate-500 hover:text-white'}`}>APENAS {teamA} VS {teamB}</button>
            </div>
         </div>

         {/* --- OPERATIVE ARCHETYPES POR COLUNAS (O KANBAN) --- */}
         <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-visible mt-8">
            <h3 className="text-2xl text-white italic mb-2">Tactical Archetypes</h3>
            <p className="text-[9px] text-slate-500 tracking-[0.3em] mb-8 border-b border-white/5 pb-4">A IDENTIDADE TÁTICA ATRIBUÍDA PELA INTELIGÊNCIA ARTIFICIAL</p>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
               {ROLES_ORDER.map(role => {
                  const rolePlayers = hardData.players.filter(p => p.role === role);
                  return (
                     <div key={role} className="flex flex-col bg-black/20 border border-white/5 rounded-[32px] p-4">
                        <div className="text-center border-b border-white/5 pb-3 mb-4">
                           {getRoleIcon(role, 'w-6 h-6 mx-auto mb-2')}
                           <span className="text-white font-black italic">{role}</span>
                           <span className="block text-[8px] text-slate-500 mt-1">{rolePlayers.length} OPERATIVOS</span>
                        </div>
                        
                        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 max-h-[520px]">
                           {rolePlayers.length === 0 && <span className="text-[10px] text-slate-500 text-center py-10">Nenhum dado</span>}
                           {rolePlayers.map(p => (
                              <div key={`${p.team}-${p.name}`} className="bg-[#121212] border border-white/5 p-4 rounded-3xl hover:border-white/20 transition-all flex flex-col relative overflow-hidden group/arc shrink-0 shadow-lg">
                                 <div className="absolute top-0 right-0 p-3 opacity-5 text-5xl group-hover/arc:scale-110 transition-all pointer-events-none">{p.arcIcon}</div>
                                 
                                 <div className="flex items-center gap-3 mb-3 relative z-10">
                                    <div className="flex flex-col">
                                       <span className={`text-base font-black italic leading-none truncate max-w-[130px] ${getTeamColorClass(p.team)}`}>{p.name}</span>
                                       <span className="text-[8px] text-slate-500 mt-1">{p.team} • {p.games} JOGOS</span>
                                    </div>
                                 </div>

                                 <div className="flex flex-col justify-center mb-4 relative z-10">
                                    <span className={`text-[9px] tracking-widest font-black uppercase ${p.arcColor}`}>{p.arcIcon} {p.archetype}</span>
                                 </div>

                                 <div className="grid grid-cols-2 gap-x-2 gap-y-2 border-t border-white/5 pt-3 relative z-10">
                                    <div className="flex justify-between items-center"><span className="text-[7px] text-slate-500">DPM</span><span className="text-white text-[10px] font-mono">{p.dpm?.toFixed(0) || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[7px] text-slate-500">KP%</span><span className="text-white text-[10px] font-mono">{p.kp?.toFixed(1) || 0}%</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[7px] text-slate-500">GD@12</span><span className="text-white text-[10px] font-mono">{(p.gd12 > 0 ? '+' : '')}{p.gd12?.toFixed(0) || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[7px] text-slate-500">MORTES</span><span className="text-white text-[10px] font-mono">{p.deaths?.toFixed(1) || 0}</span></div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* --- WALL OF FAME UNIFICADO E INTERATIVO --- */}
         <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-visible">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-white/5 pb-8 gap-6">
               <div className="text-center md:text-left">
                  <h3 className="text-3xl text-white italic">The Wall of Supremacy</h3>
                  <p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">RANKING COMPLETO DO SERVIDOR POR CATEGORIA TÁTICA (MEDIANA)</p>
               </div>
               
               <div className="relative">
                  <select 
                     value={selectedMetricKey} 
                     onChange={(e) => setSelectedMetricKey(e.target.value)}
                     className="bg-black border border-white/10 text-white font-black italic uppercase rounded-2xl px-8 py-4 outline-none focus:border-blue-500 appearance-none min-w-[300px] shadow-xl cursor-pointer"
                  >
                     {metricsConfig.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                     ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
               </div>
            </div>
            
            {/* RENDERIZAÇÃO DO RANKING ÚNICO SELECIONADO COM SCROLL INFINITO */}
            <div className="max-w-4xl mx-auto flex flex-col gap-4 overflow-y-auto custom-scrollbar max-h-[600px] pr-4">
               {currentRankingList.length === 0 && <div className="text-center text-slate-500 py-10 tracking-widest text-sm">DADOS INSUFICIENTES.</div>}
               
               {currentRankingList.map((p, i) => {
                  const val = p[currentRankingMetric.key];
                  if (val === undefined || isNaN(val)) return null;

                  const isTop1 = i === 0;

                  return (
                     <div key={`${p.team}-${p.name}-${i}`} className={`flex items-center justify-between p-4 md:p-6 rounded-[24px] border transition-all shrink-0 ${isTop1 ? 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/10'}`}>
                        <div className="flex items-center gap-6">
                           <span className={`text-2xl md:text-4xl font-black italic w-8 text-center ${isTop1 ? 'text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'text-slate-700'}`}>#{i+1}</span>
                           <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                              <div className="w-12 h-12 bg-[#121212] rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                                 {getRoleIcon(p.role, 'w-6 h-6')}
                              </div>
                              <div>
                                 <span className={`text-xl md:text-2xl font-black italic leading-none ${getTeamColorClass(p.team)}`}>{p.name}</span>
                                 <span className="block text-[10px] text-slate-500 tracking-widest mt-1">{p.team} • {p.games} JOGOS</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <span className={`text-3xl md:text-4xl font-mono font-black ${isTop1 ? 'text-amber-400' : 'text-white'}`}>{currentRankingMetric.format(val)}</span>
                           <span className="block text-[8px] text-slate-500 tracking-widest uppercase mt-1 opacity-70">{currentRankingMetric.label}</span>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

      </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTES MANTIDOS ---
function WardMap({ wards, mapColor }: { wards: any[], mapColor: 'blue' | 'red' }) {
  const isBlue = mapColor === 'blue';
  return (
    <div className="relative w-full aspect-square bg-black rounded-[40px] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,1)]">
      <img src="https://pbs.twimg.com/media/G7GGWYIXgAEx4SP?format=jpg&name=medium" className={`absolute inset-0 w-full h-full object-cover opacity-50 grayscale ${isBlue ? 'contrast-125 mix-blend-screen' : 'contrast-125'}`} alt="" />
      <div className={`absolute inset-0 ${isBlue ? 'bg-blue-500/10' : 'bg-red-500/10'} pointer-events-none mix-blend-overlay`} />
      <div className="absolute inset-0 z-21 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      <div className="absolute inset-0 z-25 pointer-events-none">
        {wards.map((w: any) => {
          const posX = MAP_OFFSET + ((w.ward_x || 0) / GAME_MAX) * MAP_SCALE;
          const posY = MAP_OFFSET + ((w.ward_y || 0) / GAME_MAX) * MAP_SCALE;
          const isControl = w.type?.toLowerCase().includes('control');
          const sensorColor = isControl ? '#ef4444' : '#eab308';
          return (
            <div key={`sensor-${w.id}`} className="absolute w-3 h-3 transform -translate-x-1/2 translate-y-1/2 group/ward pointer-events-auto" style={{ left: `${posX}%`, bottom: `${posY}%` }}>
              <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: sensorColor }} />
              <div className="relative w-full h-full rounded-full border border-white shadow-lg cursor-help" style={{ backgroundColor: sensorColor, boxShadow: `0 0 10px ${sensorColor}` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg text-[9px] text-white opacity-0 group-hover/ward:opacity-100 transition-all whitespace-nowrap z-[9999] backdrop-blur-md shadow-2xl">
                 <span className="text-slate-500 font-mono">T+</span> {formatTime(w.minute)} | {isControl ? 'CONTROL' : 'STEALTH'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ComparisonObjectiveTooltip = ({ active, payload, teamA, teamB }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl shadow-2xl backdrop-blur-xl z-[9999] font-black italic uppercase min-w-[250px]">
        <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-3">
          <img src={data.hoverImg} className="w-10 h-10 object-contain" alt="" />
          <div><p className="text-white text-xs font-black italic leading-none">{data.name}</p><span className="text-[7px] text-slate-500 tracking-widest mt-1 uppercase font-black">TIMING COMPARISON</span></div>
        </div>
        <div className="space-y-4">
           {data.teamA_window && (
             <div className="border-l-2 border-blue-500 pl-3">
               <span className="text-[9px] text-blue-400">{teamA}</span>
               <div className="flex justify-between items-center"><span className="text-[8px] text-slate-500">MÉDIA TÁTICA</span><span className="text-white font-mono text-[10px]">{formatTime(data.teamA_avg)}</span></div>
               <div className="flex justify-between items-center"><span className="text-[8px] text-slate-500">JANELA (MIN - MÁX)</span><span className="text-slate-300 font-mono text-[9px]">{formatTime(data.teamA_window[0])} ~ {formatTime(data.teamA_window[1])}</span></div>
             </div>
           )}
           {data.teamB_window && (
             <div className="border-l-2 border-red-500 pl-3">
               <span className="text-[9px] text-red-400">{teamB}</span>
               <div className="flex justify-between items-center"><span className="text-[8px] text-slate-500">MÉDIA TÁTICA</span><span className="text-white font-mono text-[10px]">{formatTime(data.teamB_avg)}</span></div>
               <div className="flex justify-between items-center"><span className="text-[8px] text-slate-500">JANELA (MIN - MÁX)</span><span className="text-slate-300 font-mono text-[9px]">{formatTime(data.teamB_window[0])} ~ {formatTime(data.teamB_window[1])}</span></div>
             </div>
           )}
        </div>
      </div>
    );
  }
  return null;
};

const ObjectiveAxisTick = ({ x, y, payload }: any) => {
  const assets = OBJECTIVE_ASSETS[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      {assets && <image href={assets.icon} x={-10} y={10} width="20" height="20" style={{ filter: 'drop-shadow(0_0_5px_rgba(255,255,255,0.1))' }} />}
    </g>
  );
};

function TournamentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const options = [
    { id: 'ALL', label: 'TODOS OS CAMPEONATOS' },
    { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
    { id: 'CBLOL', label: 'CBLOL' },
    { id: 'SCRIM', label: 'SCRIMS' }
  ];
  const currentLabel = options.find(o => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[7px] text-slate-500 tracking-[0.2em] uppercase mb-1.5 ml-2 font-black">Campeonato</label>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-[#121212] border border-white/5 px-5 py-3.5 rounded-[16px] flex items-center justify-between gap-4 min-w-[240px] hover:border-fuchsia-500/40 transition-all shadow-lg text-[10px] text-white font-black italic uppercase group">
        <span className="flex-1 text-left text-fuchsia-400 group-hover:drop-shadow-[0_0_5px_rgba(232,121,249,0.5)] transition-all">{currentLabel}</span>
        <span className={`text-[8px] text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] backdrop-blur-xl">
          {options.map(opt => (
            <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }} className={`w-full flex items-center px-5 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === opt.id ? 'bg-fuchsia-500/10' : ''}`}>
              <span className={`text-[10px] font-black italic uppercase ${value === opt.id ? 'text-fuchsia-400' : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const options = [
    { id: 'ALL', label: 'ANO INTEIRO' },
    { id: 'SPLIT 1', label: 'SPLIT 1' },
    { id: 'SPLIT 2', label: 'SPLIT 2' }
  ];
  const currentLabel = options.find(o => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[7px] text-slate-500 tracking-[0.2em] uppercase mb-1.5 ml-2 font-black">Timeline</label>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-[#121212] border border-white/5 px-5 py-3.5 rounded-[16px] flex items-center justify-between gap-4 min-w-[140px] hover:border-emerald-500/40 transition-all shadow-lg text-[10px] text-white font-black italic uppercase group">
        <span className="flex-1 text-left text-emerald-400 group-hover:drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] transition-all">{currentLabel}</span>
        <span className={`text-[8px] text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] backdrop-blur-xl">
          {options.map(opt => (
            <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }} className={`w-full flex items-center px-5 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === opt.id ? 'bg-emerald-500/10' : ''}`}>
              <span className={`text-[10px] font-black italic uppercase ${value === opt.id ? 'text-emerald-400' : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SideSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div className="relative z-[9000]" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-black/40 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3 min-w-[120px] hover:border-white/20 transition-all shadow-lg text-[10px] text-white font-black italic uppercase">
        <div className={`w-1.5 h-3 rounded-full ${value === 'Blue' ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
        <span className="flex-1 text-left">{value} Side</span>
        <span className="text-[8px] opacity-40">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[9999] min-w-[140px] backdrop-blur-xl">
          {['Blue', 'Red'].map(side => (
            <button key={side} onClick={() => { onChange(side); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === side ? 'bg-white/5' : ''}`}>
              <div className={`w-1.5 h-3 rounded-full ${side === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <span className={`text-[10px] font-black italic uppercase ${value === side ? 'text-white' : 'text-slate-500'}`}>{side} Side</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div className="relative z-[9000]" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-black/40 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3 min-w-[170px] hover:border-white/20 transition-all shadow-lg text-[10px] text-white font-black italic uppercase">
        <img src={OBJECTIVE_ASSETS[value]?.icon} className="w-4 h-4 object-contain" alt="" />
        <span className="flex-1 text-left">{OBJECTIVE_LABELS[value]}</span>
        <span className="text-[8px] opacity-40">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[9999] min-w-[180px] backdrop-blur-xl">
          {ORDERED_OBJECTIVES.map(objKey => (
            <button key={objKey} onClick={() => { onChange(objKey); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === objKey ? 'bg-white/5' : ''}`}>
              <img src={OBJECTIVE_ASSETS[objKey]?.icon} className="w-4 h-4 object-contain" alt="" />
              <span className={`text-[10px] font-black italic uppercase ${value === objKey ? 'text-blue-400' : 'text-slate-400'}`}>{OBJECTIVE_LABELS[objKey]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}