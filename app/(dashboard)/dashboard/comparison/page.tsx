"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Swords, Shield, Crosshair, Target, Clock, Zap, 
  Activity, TrendingUp, TrendingDown, Scale, BarChart2, User, Ban, Flame,
  ChevronDown, ListFilter, X, Eye, Coins, Trophy
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, Cell, ComposedChart
} from 'recharts';

const DDRAGON_VERSION = '14.5.1'; 
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

function getChampionCenteredUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${sanitized}_0.jpg`;
}

function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
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

const MathSafe = (val: any) => (isNaN(Number(val)) ? 0 : Number(val));

const checkSideMatch = (dataSide: string | null, filterSide: string) => {
   if (filterSide === 'ALL') return true;
   const s = String(dataSide).toUpperCase();
   if (filterSide === 'BLUE' && (s.includes('BLUE') || s === '100')) return true;
   if (filterSide === 'RED' && (s.includes('RED') || s === '200')) return true;
   return false;
};

// TRADUTOR UI -> BANCO
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

export default function ScoutingReportPage() {
  const [viewMode, setViewMode] = useState<'TEAMS' | 'PLAYERS'>('TEAMS');
  
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Globais Integrados
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(['ALL']);
  const [globalSplit, setGlobalSplit] = useState("ALL");
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mapas de Inteligência de Filtragem
  const [validSplitsMap, setValidSplitsMap] = useState<Record<string, string[]>>({});
  const [scopeToRawMap, setScopeToRawMap] = useState<Record<string, string[]>>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Entidades, Lados e Confronto Direto
  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [playerA, setPlayerA] = useState<string>("");
  const [playerB, setPlayerB] = useState<string>("");
  const [sideA, setSideA] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');
  const [sideB, setSideB] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');
  const [h2hOnly, setH2hOnly] = useState<boolean>(false);

  // Chart Toggles
  const [timelineMetric, setTimelineMetric] = useState<'GOLD' | 'XP' | 'CS'>('GOLD');

  // Dados Brutos
  const [corePlayerStats, setCorePlayerStats] = useState<any[]>([]);
  const [timelinePlayerStats, setTimelinePlayerStats] = useState<any[]>([]);
  const [teamStatsData, setTeamStatsData] = useState<any[]>([]);
  const [draftsData, setDraftsData] = useState<any[]>([]);

  // 1. Carrega Mapas de Torneios
  useEffect(() => {
    async function loadSplitsMap() {
      const { data } = await supabase.from('bff_matches_history').select('game_type, split').limit(50000);
      if (data) {
        const map: Record<string, Set<string>> = {};
        const scopeMap: Record<string, Set<string>> = {};
        data.forEach((d: any) => {
          if (d.game_type && d.split) {
            const scope = normalizeTournamentScope(d.game_type);
            if (!map[scope]) map[scope] = new Set();
            map[scope].add(d.split.trim().toUpperCase());
            if (!scopeMap[scope]) scopeMap[scope] = new Set();
            scopeMap[scope].add(d.game_type);
          }
        });
        const finalMap: Record<string, string[]> = {};
        for (const k in map) finalMap[k] = Array.from(map[k]);
        setValidSplitsMap(finalMap);
        const finalScopeMap: Record<string, string[]> = {};
        for (const k in scopeMap) finalScopeMap[k] = Array.from(scopeMap[k]);
        setScopeToRawMap(finalScopeMap);
      }
      setIsMapLoaded(true);
    }
    loadSplitsMap();
  }, []);

  const dynamicAvailableSplits = useMemo(() => {
    const splits = new Set<string>();
    if (globalTournaments.includes('ALL')) {
      Object.values(validSplitsMap).forEach(arr => arr.forEach(s => splits.add(s)));
    } else {
      globalTournaments.forEach(t => {
        if (validSplitsMap[t]) validSplitsMap[t].forEach(s => splits.add(s));
      });
    }
    const order = ['CUP', 'SPLIT 1', 'SPLIT 2', 'SPLIT 3', 'EVENTO GLOBAL', 'OFF-SEASON'];
    return Array.from(splits).sort((a, b) => {
      const indexA = order.indexOf(a); const indexB = order.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1; if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [globalTournaments, validSplitsMap]);

  useEffect(() => {
    if (globalSplit !== 'ALL' && globalSplit !== 'CUSTOM' && dynamicAvailableSplits.length > 0 && !dynamicAvailableSplits.includes(globalSplit)) {
      setGlobalSplit('ALL');
    }
  }, [dynamicAvailableSplits, globalSplit]);

  const getRawGameTypes = () => {
    if (globalTournaments.includes('ALL')) return [];
    const raws = new Set<string>();
    globalTournaments.forEach(t => { if (scopeToRawMap[t]) scopeToRawMap[t].forEach(r => raws.add(r)); });
    return Array.from(raws);
  };

  useEffect(() => {
    async function fetchDictionaries() {
      const [{ data: tData }, { data: pData }] = await Promise.all([
         supabase.from('bff_matches_teams').select('*').order('acronym'),
         supabase.from('bff_admin_players').select('*').order('nickname')
      ]);
      if (tData) setAllTeams(tData);
      if (pData) setAllPlayers(pData);
    }
    fetchDictionaries();
  }, []);

  // 2. Busca Principal no BD
  useEffect(() => {
    async function fetchScoutingData() {
      if (!isMapLoaded) return;
      setLoading(true);
      
      const rawTypes = getRawGameTypes();
      let matchesQuery = supabase.from('bff_matches_history').select('match_id, game_start_time, game_type, split');
      
      if (startDate) matchesQuery = matchesQuery.gte('game_start_time', `${startDate} 00:00:00`);
      if (endDate) matchesQuery = matchesQuery.lte('game_start_time', `${endDate} 23:59:59`);
      if (globalSplit !== 'ALL' && globalSplit !== 'CUSTOM') matchesQuery = matchesQuery.ilike('split', globalSplit);
      if (rawTypes.length > 0) matchesQuery = matchesQuery.in('game_type', rawTypes);

      const { data: matchesRes } = await matchesQuery;
      if (!matchesRes || matchesRes.length === 0) { 
         setLoading(false); setCorePlayerStats([]); setTimelinePlayerStats([]); setTeamStatsData([]); setDraftsData([]); return; 
      }

      const validMatches = matchesRes.filter((m: any) => {
         if (globalTournaments.includes('ALL')) return true;
         const normalized = normalizeTournamentScope(m.game_type);
         return globalTournaments.includes(normalized);
      });

      const matchIds = validMatches.map(m => m.match_id);

      // Times base
      if (allTeams.length >= 2 && (!teamA || !teamB)) { 
         const rmd = allTeams.find(t => t.acronym === 'RMD');
         const sld = allTeams.find(t => t.acronym === 'SLD' || String(t.name).toUpperCase().includes('SOLID'));
         setTeamA(rmd ? rmd.acronym : allTeams[0].acronym); 
         setTeamB(sld ? sld.acronym : allTeams[1].acronym); 
      }
      
      if (allPlayers.length >= 2 && (!playerA || !playerB)) { 
         setPlayerA(allPlayers[0].nickname); 
         setPlayerB(allPlayers[1].nickname); 
      }

      const targetTeams = [teamA, teamB].filter(Boolean);

      if (matchIds.length === 0) {
         setLoading(false); setCorePlayerStats([]); setTimelinePlayerStats([]); setTeamStatsData([]); setDraftsData([]); return; 
      }

      const [coreRes, timelineRes, tStatsRes, draftsRes] = await Promise.all([
         supabase.from('core_player_stats').select('*').in('match_id', matchIds).limit(15000),
         supabase.from('player_stats').select('match_id, puuid, player_name, team_tag, side, cs_6, cs_12, cs_18, cs_24, xp_6, xp_12, xp_18, xp_24, gold_6, gold_12, gold_18, gold_24').in('match_id', matchIds).limit(15000),
         viewMode === 'TEAMS' ? supabase.from('bff_dashboard_team_stats').select('*').in('team_acronym', targetTeams).in('match_id', matchIds).limit(5000) : Promise.resolve({ data: [] }),
         viewMode === 'TEAMS' ? supabase.from('match_drafts').select('match_id, team_name, action_type, champion').in('match_id', matchIds).limit(5000) : Promise.resolve({ data: [] })
      ]);

      setCorePlayerStats(coreRes.data || []);
      setTimelinePlayerStats(timelineRes.data || []);
      setTeamStatsData(tStatsRes.data || []);
      setDraftsData(draftsRes.data || []);
      setLoading(false);
    }
    
    if (allTeams.length > 0) fetchScoutingData();
  }, [allTeams, allPlayers, globalTournaments, globalSplit, startDate, endDate, viewMode, teamA, teamB, playerA, playerB, isMapLoaded]);

  const getTeamLogo = (acronym: string) => allTeams.find(t => t.acronym === acronym)?.logo_url || `https://ui-avatars.com/api/?name=${acronym}&background=18181b&color=3b82f6&bold=true`;
  const getPlayerPhoto = (nickname: string) => allPlayers.find(p => p.nickname === nickname)?.photo_url || `https://ui-avatars.com/api/?name=${nickname}&background=18181b&color=3b82f6&bold=true`;

  // ==========================================
  // --- ORDER OF MEMOS (TOPOLOGICAL SORT) ---
  // ==========================================

  const entityStats = useMemo(() => {
     let statsA = corePlayerStats.filter(p => viewMode === 'TEAMS' ? p.team_tag === teamA : p.player_name === playerA);
     let statsB = corePlayerStats.filter(p => viewMode === 'TEAMS' ? p.team_tag === teamB : p.player_name === playerB);

     if (h2hOnly) {
         const matchesA = new Set(statsA.map(s => s.match_id));
         const matchesB = new Set(statsB.map(s => s.match_id));
         const commonMatches = new Set([...matchesA].filter(x => matchesB.has(x)));
         statsA = statsA.filter(s => commonMatches.has(s.match_id));
         statsB = statsB.filter(s => commonMatches.has(s.match_id));
     }

     const finalMatchIdsA = new Set(statsA.map(s => s.match_id));
     const finalMatchIdsB = new Set(statsB.map(s => s.match_id));

     let finalStatsA = statsA.filter(p => checkSideMatch(p.side, sideA));
     let finalStatsB = statsB.filter(p => checkSideMatch(p.side, sideB));

     let timelineA = timelinePlayerStats.filter(p => finalMatchIdsA.has(p.match_id) && (viewMode === 'TEAMS' ? p.team_tag === teamA : p.player_name === playerA) && checkSideMatch(p.side, sideA));
     let timelineB = timelinePlayerStats.filter(p => finalMatchIdsB.has(p.match_id) && (viewMode === 'TEAMS' ? p.team_tag === teamB : p.player_name === playerB) && checkSideMatch(p.side, sideB));

     let tStatsA = teamStatsData.filter(t => finalMatchIdsA.has(t.match_id) && t.team_acronym === teamA && checkSideMatch(t.side, sideA));
     let tStatsB = teamStatsData.filter(t => finalMatchIdsB.has(t.match_id) && t.team_acronym === teamB && checkSideMatch(t.side, sideB));

     return { statsA: finalStatsA, statsB: finalStatsB, timelineA, timelineB, tStatsA, tStatsB };
  }, [corePlayerStats, timelinePlayerStats, teamStatsData, viewMode, teamA, teamB, playerA, playerB, sideA, sideB, h2hOnly]);

  const earlyStats = useMemo(() => {
      const { statsA, statsB } = entityStats;

      const calcEarly = (entityStatsArr: any[], entityName: string) => {
          let totalGD = 0, totalXPD = 0, totalCSD = 0, totalK12 = 0, totalD12 = 0, totalA12 = 0, count = 0;
          const matchIds = [...new Set(entityStatsArr.map(s => s.match_id))];

          matchIds.forEach(mId => {
              const matchPlayers = corePlayerStats.filter(p => p.match_id === mId);

              if (viewMode === 'TEAMS') {
                  const myTeam = matchPlayers.filter(p => p.team_tag === entityName);
                  const enemyTeam = matchPlayers.filter(p => p.team_tag !== entityName);

                  if (myTeam.length > 0 && enemyTeam.length > 0) {
                      totalGD += myTeam.reduce((a,p)=>a+MathSafe(p.gold_12),0) - enemyTeam.reduce((a,p)=>a+MathSafe(p.gold_12),0);
                      totalXPD += myTeam.reduce((a,p)=>a+MathSafe(p.xp_12),0) - enemyTeam.reduce((a,p)=>a+MathSafe(p.xp_12),0);
                      totalCSD += myTeam.reduce((a,p)=>a+MathSafe(p.cs_12),0) - enemyTeam.reduce((a,p)=>a+MathSafe(p.cs_12),0);
                      totalK12 += myTeam.reduce((a,p)=>a+MathSafe(p.kills_at_12),0);
                      totalD12 += myTeam.reduce((a,p)=>a+MathSafe(p.deaths_at_12),0);
                      totalA12 += myTeam.reduce((a,p)=>a+MathSafe(p.assists_at_12),0);
                      count++;
                  }
              } else {
                  const me = matchPlayers.find(p => p.player_name === entityName);
                  if (me) {
                      const enemy = matchPlayers.find(p => p.team_tag !== me.team_tag && normalizeRole(p.lane, p.role) === normalizeRole(me.lane, me.role));
                      if (enemy) {
                          totalGD += MathSafe(me.gold_12) - MathSafe(enemy.gold_12);
                          totalXPD += MathSafe(me.xp_12) - MathSafe(enemy.xp_12);
                          totalCSD += MathSafe(me.cs_12) - MathSafe(enemy.cs_12);
                          totalK12 += MathSafe(me.kills_at_12);
                          totalD12 += MathSafe(me.deaths_at_12);
                          totalA12 += MathSafe(me.assists_at_12);
                          count++;
                      }
                  }
              }
          });

          const gd12 = count ? totalGD / count : 0;
          const xpd12 = count ? totalXPD / count : 0;
          const csd12 = count ? totalCSD / count : 0;
          const kpa12 = count ? (totalK12 + totalA12) / count : 0;
          const deaths12 = count ? totalD12 / count : 0;

          let pressure = 50 + (gd12 / 50) + (xpd12 / 50) + (csd12 * 1.2);
          if (viewMode === 'TEAMS') pressure = 50 + (gd12 / 250) + (xpd12 / 250) + (csd12 * 0.25);
          pressure = Math.max(0, Math.min(100, pressure));

          return { gd12, xpd12, csd12, kpa12, deaths12, pressure };
      };

      return { A: calcEarly(statsA, viewMode === 'TEAMS' ? teamA : playerA), B: calcEarly(statsB, viewMode === 'TEAMS' ? teamB : playerB) };
  }, [entityStats, corePlayerStats, viewMode, teamA, playerA, teamB, playerB]);

  const radarData = useMemo(() => {
     const { statsA, statsB } = entityStats;
     const calcAvgs = (arr: any[]) => {
        if (!arr.length) return { lan: 0, imp: 0, con: 0, vis: 0, ovr: 0 };
        const sums = arr.reduce((acc, p) => {
           acc.lan += MathSafe(p.lane_rating); acc.imp += MathSafe(p.impact_rating);
           acc.con += MathSafe(p.conversion_rating); acc.vis += MathSafe(p.vision_rating);
           acc.ovr += MathSafe(p.perf_score || ((p.lane_rating+p.impact_rating+p.conversion_rating+p.vision_rating)/4));
           return acc;
        }, { lan: 0, imp: 0, con: 0, vis: 0, ovr: 0 });
        const len = arr.length;
        return { lan: sums.lan/len, imp: sums.imp/len, con: sums.con/len, vis: sums.vis/len, ovr: sums.ovr/len };
     };
     const avgA = calcAvgs(statsA); const avgB = calcAvgs(statsB);
     return [
        { subject: 'Lane', A: Number(avgA.lan.toFixed(1)), B: Number(avgB.lan.toFixed(1)) },
        { subject: 'Impacto', A: Number(avgA.imp.toFixed(1)), B: Number(avgB.imp.toFixed(1)) },
        { subject: 'Conversão', A: Number(avgA.con.toFixed(1)), B: Number(avgB.con.toFixed(1)) },
        { subject: 'Visão', A: Number(avgA.vis.toFixed(1)), B: Number(avgB.vis.toFixed(1)) },
        { subject: 'Overall', A: Number(avgA.ovr.toFixed(1)), B: Number(avgB.ovr.toFixed(1)) }
     ];
  }, [entityStats]);

  const timelineData = useMemo(() => {
     const { timelineA, timelineB } = entityStats;
     const calcTime = (arr: any[], metric: string) => {
        if (!arr.length) return { '6m': 0, '12m': 0, '18m': 0, '24m': 0 };
        let sum6 = 0, sum12 = 0, sum18 = 0, sum24 = 0; let count6 = 0, count12 = 0, count18 = 0, count24 = 0;
        arr.forEach(p => {
           if (p[`${metric}_6`] != null) { sum6 += p[`${metric}_6`]; count6++; }
           if (p[`${metric}_12`] != null) { sum12 += p[`${metric}_12`]; count12++; }
           if (p[`${metric}_18`] != null) { sum18 += p[`${metric}_18`]; count18++; }
           if (p[`${metric}_24`] != null) { sum24 += p[`${metric}_24`]; count24++; }
        });
        return { '6m': count6 ? sum6 / count6 : 0, '12m': count12 ? sum12 / count12 : 0, '18m': count18 ? sum18 / count18 : 0, '24m': count24 ? sum24 / count24 : 0 };
     };
     const multiplier = viewMode === 'TEAMS' ? 5 : 1; 
     const m = timelineMetric.toLowerCase();
     const tA = calcTime(timelineA, m); const tB = calcTime(timelineB, m);
     return [
        { time: '6m', A: Math.round(tA['6m'] * multiplier), B: Math.round(tB['6m'] * multiplier) },
        { time: '12m', A: Math.round(tA['12m'] * multiplier), B: Math.round(tB['12m'] * multiplier) },
        { time: '18m', A: Math.round(tA['18m'] * multiplier), B: Math.round(tB['18m'] * multiplier) },
        { time: '24m', A: Math.round(tA['24m'] * multiplier), B: Math.round(tB['24m'] * multiplier) }
     ];
  }, [entityStats, timelineMetric, viewMode]);

  const tapeStats = useMemo(() => {
     const { statsA, statsB, tStatsA, tStatsB } = entityStats;

     if (viewMode === 'TEAMS') {
        const calcNativo = (pStats: any[], tStats: any[]) => {
           const matches = new Map();
           pStats.forEach(p => { if (!matches.has(p.match_id)) matches.set(p.match_id, []); matches.get(p.match_id).push(p); });
           
           let wins = 0, fbCount = 0, ftCount = 0, totalDuration = 0, totalKills = 0;
           matches.forEach((players) => {
              if (players[0]?.win) wins++;
              if (players.some((p: any) => p.fb_kill)) fbCount++;
              if (players.some((p: any) => p.ft_kill)) ftCount++;
              totalDuration += MathSafe(players[0]?.game_duration);
              totalKills += players.reduce((acc: number, p: any) => acc + MathSafe(p.kills), 0);
           });

           const games = matches.size || 1;
           const totalDPM = pStats.reduce((acc, p) => acc + MathSafe(p.dpm), 0);
           const totalVSPM = pStats.reduce((acc, p) => acc + MathSafe(p.vspm), 0);
           const totalGPM = pStats.reduce((acc, p) => acc + MathSafe(p.gpm), 0);
           const goldEff = totalGPM > 0 ? (totalDPM / totalGPM) * 100 : 0;
           
           const avgGD12 = tStats.reduce((acc, t) => acc + MathSafe(t.gold_diff_at_12), 0) / (tStats.length || 1);

           return { 
              games, winRate: (wins / games) * 100, fbRate: (fbCount / games) * 100, ftRate: (ftCount / games) * 100,
              dpm: totalDPM / games, vspm: totalVSPM / games, goldEff: goldEff, gd12: avgGD12,
              avgDuration: (totalDuration / games) / 60, ckpm: totalDuration > 0 ? totalKills / (totalDuration / 60) : 0,
              kda: 0, kp: 0 
           };
        };
        return { A: calcNativo(statsA, tStatsA), B: calcNativo(statsB, tStatsB) };
     } else {
        const calcPlayer = (pStats: any[]) => {
           const games = pStats.length || 1;
           const wins = pStats.filter(p => p.win).length;
           const k = pStats.reduce((a,c) => a + MathSafe(c.kills), 0);
           const d = pStats.reduce((a,c) => a + MathSafe(c.deaths), 0);
           const a = pStats.reduce((a,c) => a + MathSafe(c.assists), 0);
           
           const totalDPM = pStats.reduce((acc, p) => acc + MathSafe(p.dpm), 0);
           const totalGPM = pStats.reduce((acc, p) => acc + MathSafe(p.gpm), 0);
           const goldEff = totalGPM > 0 ? (totalDPM / totalGPM) * 100 : 0;

           return { 
              games, winRate: (wins / games) * 100, kda: d === 0 ? (k+a) : (k+a)/d,
              dpm: totalDPM / games, 
              vspm: pStats.reduce((a,c) => a + MathSafe(c.vspm), 0) / games, 
              kp: (pStats.reduce((a,c) => a + MathSafe(c.kp), 0) / games) * 100,
              goldEff: goldEff,
              gd12: 0, fbRate: 0, ftRate: 0, avgDuration: 0, ckpm: 0 
           };
        };
        return { A: calcPlayer(statsA), B: calcPlayer(statsB) };
     }
  }, [entityStats, viewMode]);

  const resilienceIntel = useMemo(() => {
     if (viewMode !== 'TEAMS') return null;
     const { statsA, statsB, tStatsA, tStatsB } = entityStats;
     const calcResilience = (tStats: any[], pStats: any[]) => {
        const matchWins = new Set(pStats.filter(p => p.win).map(p => p.match_id));
        let aheadGames = 0, throws = 0;
        let behindGames = 0, comebacks = 0;
        
        tStats.forEach(t => {
           const gd12 = MathSafe(t.gold_diff_at_12);
           const won = matchWins.has(t.match_id);
           if (gd12 > 0) { aheadGames++; if (!won) throws++; }
           if (gd12 < 0) { behindGames++; if (won) comebacks++; }
        });
        return { throwRate: aheadGames > 0 ? (throws / aheadGames) * 100 : 0, comebackRate: behindGames > 0 ? (comebacks / behindGames) * 100 : 0 };
     };
     return { A: calcResilience(tStatsA, statsA), B: calcResilience(tStatsB, statsB) };
  }, [entityStats, viewMode]);

  const winProbability = useMemo(() => {
      if (viewMode !== 'TEAMS' || !tapeStats || !earlyStats || !resilienceIntel) return null;

      const calcPower = (tape: any, early: any, resilience: any) => {
          if (!tape.games) return 100;
          let power = 1000;
          power += (tape.winRate - 50) * 10;
          power += (early.pressure - 50) * 8;
          power += ((tape.ftRate || 0) - 50) * 4;
          power += ((tape.fbRate || 0) - 50) * 3;
          if (resilience) {
              power += (resilience.comebackRate * 3) - (resilience.throwRate * 3);
          }
          power += ((tape.goldEff || 130) - 130) * 5;
          return Math.max(100, power);
      };

      const powerA = calcPower(tapeStats.A, earlyStats.A, resilienceIntel.A);
      const powerB = calcPower(tapeStats.B, earlyStats.B, resilienceIntel.B);

      const totalPower = powerA + powerB;
      if (totalPower === 0 || isNaN(totalPower)) return { A: 50, B: 50 };

      let probA = (powerA / totalPower) * 100;
      let probB = (powerB / totalPower) * 100;

      const minChance = 15;
      if (probA < minChance) { probA = minChance; probB = 100 - minChance; }
      if (probB < minChance) { probB = minChance; probA = 100 - minChance; }

      return { A: probA, B: probB };
  }, [viewMode, tapeStats, earlyStats, resilienceIntel]);

  const resourceDistribution = useMemo(() => {
     if (viewMode !== 'TEAMS') return null;
     const calcRoleAvg = (stats: any[]) => {
        const roles = ROLES_ORDER.map(role => {
           const pRole = stats.filter(p => normalizeRole(p.lane, p.role) === role);
           const count = pRole.length || 1;
           const avgGold = pRole.reduce((a, p) => a + MathSafe(p.gold_share_percent), 0) / count;
           const avgDmg = pRole.reduce((a, p) => a + MathSafe(p.dmg_percent), 0) / count;
           
           const playerCounts = pRole.reduce((acc: any, p) => {
              const id = p.puuid || p.player_name || 'unknown';
              if (!acc[id]) acc[id] = { name: p.player_name, photo: p.photo_url, count: 0 };
              acc[id].count++;
              return acc;
           }, {});
           const mainPlayer = Object.values(playerCounts).sort((a: any, b: any) => b.count - a.count)[0] as any;
           
           return { 
              role, 
              gold: avgGold * 100, 
              dmg: avgDmg * 100,
              playerName: mainPlayer?.name || 'Vários',
              playerPhoto: mainPlayer?.photo || `https://ui-avatars.com/api/?name=${mainPlayer?.name || 'V'}&background=18181b&color=3b82f6`
           };
        });
        return roles;
     };
     return { A: calcRoleAvg(entityStats.statsA), B: calcRoleAvg(entityStats.statsB) };
  }, [entityStats, viewMode]);

  const draftIntel = useMemo(() => {
     if (viewMode !== 'TEAMS') return null;
     const { statsA, statsB } = entityStats;
     const poolA: Record<string, number> = {}; const poolB: Record<string, number> = {};

     statsA.forEach(p => { if (p.champion) poolA[p.champion] = (poolA[p.champion] || 0) + 1; });
     statsB.forEach(p => { if (p.champion) poolB[p.champion] = (poolB[p.champion] || 0) + 1; });

     const getBestPlayer = (champ: string, stats: any[]) => {
        const pStats = stats.filter(p => p.champion === champ);
        if (!pStats.length) return '';
        const counts = pStats.reduce((acc, p) => { acc[p.player_name] = (acc[p.player_name] || 0) + 1; return acc; }, {} as Record<string, number>);
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
     };

     const contested: any[] = []; const uniqueA: any[] = []; const uniqueB: any[] = [];
     new Set([...Object.keys(poolA), ...Object.keys(poolB)]).forEach(champ => {
        const pA = poolA[champ] || 0; const pB = poolB[champ] || 0;
        const masterA = pA > 0 ? getBestPlayer(champ, statsA) : '';
        const masterB = pB > 0 ? getBestPlayer(champ, statsB) : '';

        if (pA >= 1 && pB >= 1) contested.push({ champ, picksA: pA, picksB: pB, total: pA + pB, masterA, masterB });
        else if (pA >= 2 && pB === 0) uniqueA.push({ champ, picks: pA, masterA });
        else if (pB >= 2 && pA === 0) uniqueB.push({ champ, picks: pB, masterB });
     });

     const calcBans = (teamAcronym: string, stats: any[]) => {
        const teamObj = allTeams.find(t => t.acronym === teamAcronym);
        const matchIds = new Set(stats.map(p => p.match_id));
        const teamBans = draftsData.filter(d => 
           matchIds.has(d.match_id) && 
           String(d.action_type).toLowerCase().includes('ban') &&
           (teamObj && String(d.team_name).toLowerCase() === String(teamObj.name).toLowerCase())
        );
        const counts = teamBans.reduce((acc, d) => { if(d.champion) acc[d.champion] = (acc[d.champion]||0) + 1; return acc; }, {} as Record<string, number>);
        return Object.entries(counts).map(([c, picks]) => ({ champ: c, picks: Number(picks) })).sort((a,b) => b.picks - a.picks).slice(0, 5);
     };

     return { 
        contested: contested.sort((a, b) => b.total - a.total).slice(0, 8), 
        targetA: uniqueA.sort((a, b) => b.picks - a.picks).slice(0, 6), 
        targetB: uniqueB.sort((a, b) => b.picks - a.picks).slice(0, 6),
        bansA: calcBans(teamA, statsA),
        bansB: calcBans(teamB, statsB)
     };
  }, [entityStats, viewMode, draftsData, allTeams, teamA, teamB]);

  const playerPools = useMemo(() => {
     if (viewMode !== 'PLAYERS') return null;
     const { statsA, statsB } = entityStats;
     const getPool = (arr: any[]) => {
        const counts = arr.reduce((acc, p) => { if(p.champion) acc[p.champion] = (acc[p.champion] || 0) + 1; return acc; }, {} as Record<string, number>);
        return Object.entries(counts).map(([c, picks]) => ({ champ: c, picks: Number(picks) })).sort((a, b) => b.picks - a.picks).slice(0, 6);
     };
     return { A: getPool(statsA), B: getPool(statsB) };
  }, [entityStats, viewMode]);

  const playerAdvStats = useMemo(() => {
     if (viewMode !== 'PLAYERS') return null;
     const { statsA, statsB } = entityStats;

     const calcP = (arr: any[]) => {
         const len = arr.length || 1;
         const k = arr.reduce((a,c) => a + MathSafe(c.kills), 0) / len;
         const d = arr.reduce((a,c) => a + MathSafe(c.deaths), 0) / len;
         const as = arr.reduce((a,c) => a + MathSafe(c.assists), 0) / len;
         const dmg = (arr.reduce((a,c) => a + MathSafe(c.dmg_percent), 0) / len) * 100;
         const gold = (arr.reduce((a,c) => a + MathSafe(c.gold_share_percent), 0) / len) * 100;
         const taken = (arr.reduce((a,c) => a + MathSafe(c.dmg_taken_percent), 0) / len) * 100;
         const kp = (arr.reduce((a,c) => a + MathSafe(c.kp), 0) / len) * 100;
         
         const dpm = arr.reduce((a,c) => a + MathSafe(c.dpm), 0) / len;
         const gpm = arr.reduce((a,c) => a + MathSafe(c.gpm), 0) / len;
         const vspm = arr.reduce((a,c) => a + MathSafe(c.vspm), 0) / len;
         const goldEff = gpm > 0 ? (dpm/gpm)*100 : 0;

         const fbCount = arr.filter(p => p.fb_kill || p.fb_assist).length;
         const fbRate = (fbCount / len) * 100;

         return { k, d, as, dmg, gold, taken, kp, dpm, gpm, vspm, goldEff, fbRate };
     };

     const advA = calcP(statsA);
     const advB = calcP(statsB);

     const combatData = [
         { name: playerA || 'A', Kills: advA.k, Assists: advA.as, Deaths: advA.d },
         { name: playerB || 'B', Kills: advB.k, Assists: advB.as, Deaths: advB.d }
     ];

     const resourceData = [
         { metric: 'Dano Causado (%)', A: advA.dmg, B: advB.dmg },
         { metric: 'Ouro Recebido (%)', A: advA.gold, B: advB.gold },
         { metric: 'Dano Sofrido (%)', A: advA.taken, B: advB.taken },
         { metric: 'Partic. Abates (%)', A: advA.kp, B: advB.kp },
         { metric: 'First Blood (%)', A: advA.fbRate, B: advB.fbRate },
     ];

     const econData = [
         { metric: 'DPM', A: advA.dpm, B: advB.dpm },
         { metric: 'GPM', A: advA.gpm, B: advB.gpm },
     ];

     const utilityData = [
         { metric: 'Visão (VSPM)', A: advA.vspm, B: advB.vspm },
         { metric: 'Gold Eff (%)', A: advA.goldEff, B: advB.goldEff },
     ];

     return { combatData, resourceData, econData, utilityData };
  }, [entityStats, viewMode, playerA, playerB]);

  // Extração Inteligente dos Dados do Jogador para as Cartas (Trading Cards)
  const playerCardData = useMemo(() => {
      if (viewMode !== 'PLAYERS') return null;

      const getCardInfo = (statsArray: any[], name: string, pools: any[], teamTag: string) => {
          if (!statsArray || statsArray.length === 0) return null;
          const firstStat = statsArray[0] || {};
          const role = normalizeRole(firstStat.lane, firstStat.role);
          const topChamps = pools ? pools.slice(0, 3) : [];

          const games = statsArray.length;
          const wins = statsArray.filter(s => s.win).length;
          const winRate = games > 0 ? (wins / games) * 100 : 0;

          const k = statsArray.reduce((acc, c) => acc + MathSafe(c.kills), 0);
          const d = statsArray.reduce((acc, c) => acc + MathSafe(c.deaths), 0);
          const a = statsArray.reduce((acc, c) => acc + MathSafe(c.assists), 0);
          const kda = d === 0 ? (k + a) : (k + a) / d;

          // Validação Exclusiva de MVP (Foil Effect)
          const teamPlayersStats = corePlayerStats.filter(p => p.team_tag === teamTag);
          const playerScores: Record<string, { sum: number, count: number }> = {};
          teamPlayersStats.forEach(p => {
             if (!playerScores[p.player_name]) playerScores[p.player_name] = { sum: 0, count: 0 };
             const score = p.perf_score || ((MathSafe(p.lane_rating) + MathSafe(p.impact_rating) + MathSafe(p.conversion_rating) + MathSafe(p.vision_rating)) / 4);
             playerScores[p.player_name].sum += score;
             playerScores[p.player_name].count += 1;
          });
          
          let isMVP = false;
          if (playerScores[name] && playerScores[name].count > 0) {
             const myAvg = playerScores[name].sum / playerScores[name].count;
             let isHighest = true;
             for (const pName in playerScores) {
                 const other = playerScores[pName];
                 if (other.count > 0) {
                     const otherAvg = other.sum / other.count;
                     if (otherAvg > myAvg && pName !== name) {
                         isHighest = false; break;
                     }
                 }
             }
             isMVP = isHighest;
          }

          return { name, teamTag, role, topChamps, kda, winRate, games_played: games, isMVP };
      };

      return {
          A: getCardInfo(entityStats.statsA, playerA, playerPools?.A || [], teamA),
          B: getCardInfo(entityStats.statsB, playerB, playerPools?.B || [], teamB)
      };
  }, [viewMode, entityStats, playerA, playerB, playerPools, corePlayerStats, teamA, teamB]);


  // --- COMPONENTES AUXILIARES ---

  // O componente da Carta Estilo Super Trunfo
  const PlayerTradingCard = ({ playerInfo, photoUrl, color, allTeams }: any) => {
     if (!playerInfo) return (
         <div className="w-[190px] aspect-[3/4] bg-zinc-900 border border-zinc-800 rounded-[24px] flex items-center justify-center">
             <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Sem Registros</span>
         </div>
     );

     const isBlue = color === 'blue';
     const shadowColor = isBlue ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)';
     const glowClass = isBlue ? 'group-hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]' : 'group-hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]';
     const borderClass = isBlue ? 'border-blue-500/30' : 'border-red-500/30';
     const nameColor = isBlue ? 'text-blue-400' : 'text-red-400';
     const teamObj = allTeams.find((t: any) => t.acronym === playerInfo.teamTag);
     const mainChampion = playerInfo.topChamps?.[0]?.champ || null;
     
     // NOVA ROTA PARA IMAGEM (Usando o Centered para focar no campeão)
     const centeredSplash = getChampionCenteredUrl(mainChampion);
     const isMVP = playerInfo.isMVP;

     return (
        <div className={`w-[190px] aspect-[3/4] bg-zinc-950 border transition-all duration-500 flex flex-col relative shadow-md clip-card group hover:-translate-y-2 ${borderClass} ${glowClass}`} style={{ boxShadow: `0 10px 30px -10px ${shadowColor}` }}>
           {/* Camada 1: Splash Art Background */}
           {mainChampion && (
              <div className="absolute inset-0 z-0 opacity-80 transition-transform duration-700 group-hover:scale-105 pointer-events-none">
                 <img src={centeredSplash} className="w-full h-full object-cover object-center grayscale-[20%]" alt="" />
              </div>
           )}

           {/* Camada 2: Gradiente APENAS NA BASE para ancorar os textos */}
           <div className="absolute inset-0 z-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent opacity-90 pointer-events-none" />

           {/* Camada 3: O Foil Stealth com Pausa (SÓ PARA O MVP) */}
           {isMVP && (
              <div className="absolute inset-0 z-10 pointer-events-none foil-stealth-royal opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
           )}

           {/* Selo MVP */}
           {isMVP && (
              <div className={`absolute top-2.5 left-3 z-30 ${isBlue ? 'bg-blue-500 text-blue-950' : 'bg-red-500 text-red-950'} text-[7px] font-black px-1.5 py-0.5 rounded shadow-lg tracking-widest uppercase`}>
                 TEAM MVP
              </div>
           )}

           {/* KDA Mini Badge */}
           <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <div className="bg-zinc-950/80 px-2 py-1 rounded-md border border-zinc-800 flex flex-col items-center backdrop-blur-md">
                 <span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">KDA</span>
                 <span className="text-[10px] font-black text-white">{playerInfo.kda.toFixed(2)}</span>
              </div>
           </div>

           {/* Camada 4: Conteúdo da Carta */}
           <div className="relative z-20 p-3 flex flex-col h-full pointer-events-none">
              
              <div className="flex justify-between items-start mb-2">
                 <div className={`relative p-0.5 rounded-lg transition-transform duration-300 mt-5 ${isBlue ? 'bg-blue-600' : 'bg-red-600'}`}>
                    <div className="w-10 h-10 bg-zinc-900 rounded-md overflow-hidden flex items-center justify-center shadow-inner">
                       {photoUrl ? (
                          <img src={photoUrl} alt={playerInfo.name} className="w-full h-full object-cover filter contrast-110" />
                       ) : (
                          <span className="text-xs font-black text-zinc-600">{playerInfo.name?.substring(0, 2).toUpperCase()}</span>
                       )}
                    </div>
                    <div className="absolute -bottom-1.5 -right-1.5 bg-zinc-950 p-1 rounded border border-zinc-800 shadow-md">
                       {getRoleIcon(String(playerInfo.role), "w-2.5 h-2.5")}
                    </div>
                 </div>
              </div>

              <div className="mt-auto flex flex-col">
                 <div className="flex items-center gap-1.5 mb-1">
                    {teamObj?.logo_url && <img src={teamObj.logo_url} alt="" className="w-3.5 h-3.5 object-contain opacity-90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />}
                    <span className="text-[7px] font-bold text-white tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,1)] bg-black/40 px-1 py-0.5 rounded">{playerInfo.games_played} MATCHES</span>
                 </div>

                 <h3 className={`text-xl font-black tracking-tight uppercase truncate drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none ${nameColor}`}>
                    {playerInfo.name}
                 </h3>

                 <div className="flex justify-between items-end border-t border-zinc-800/60 pt-2 mt-2">
                    <div className="flex gap-1">
                       {playerInfo.topChamps.map((c: any, i: number) => (
                          <img key={i} src={getChampionImageUrl(c.champ)} className="w-6 h-6 rounded-full border border-zinc-700 shadow-sm object-cover" title={`${c.champ} (${c.picks} picks)`} alt={c.champ} />
                       ))}
                       {playerInfo.topChamps.length === 0 && <span className="text-[8px] text-zinc-600 italic font-bold">Sem picks</span>}
                    </div>
                    <div className="text-right flex flex-col items-end">
                       <span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-0.5"><Trophy size={6}/> WIN RATE</span>
                       <span className="text-xs font-black text-white drop-shadow-md">{Math.round(playerInfo.winRate)}%</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
     );
  };

  const TugOfWarBar = ({ label, valA, valB, format = (v: number) => v.toFixed(1), reverseColors = false, icon: Icon }: any) => {
     const numA = Number(valA) || 0; const numB = Number(valB) || 0;
     const total = Math.abs(numA) + Math.abs(numB) || 1;
     let pctA = (Math.abs(numA) / total) * 100; let pctB = (Math.abs(numB) / total) * 100;
     if (pctA < 5 && numA !== 0) { pctA = 5; pctB = 95; } if (pctB < 5 && numB !== 0) { pctB = 5; pctA = 95; }
     if (numA === 0 && numB === 0) { pctA = 50; pctB = 50; }
     const isAWinning = reverseColors ? numA <= numB : numA >= numB;
     const isBWinning = reverseColors ? numB <= numA : numB >= numA;

     const colorA = isAWinning ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-zinc-800';
     const colorB = isBWinning ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-zinc-800';

     return (
        <div className="flex flex-col gap-1.5 w-full group">
           <div className="flex justify-between items-end px-0.5">
              <span className={`text-[13px] font-black transition-colors drop-shadow-md ${isAWinning ? 'text-white' : 'text-zinc-500'}`}>{format(numA)}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                 {Icon && <Icon size={11} className="opacity-50" />} {label}
              </span>
              <span className={`text-[13px] font-black transition-colors drop-shadow-md ${isBWinning ? 'text-white' : 'text-zinc-500'}`}>{format(numB)}</span>
           </div>
           <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 relative shadow-inner">
              <div className={`absolute left-0 top-0 h-full ${colorA} transition-all duration-1000 ease-out`} style={{ width: `${pctA}%` }}></div>
              <div className={`absolute right-0 top-0 h-full ${colorB} transition-all duration-1000 ease-out`} style={{ width: `${pctB}%` }}></div>
           </div>
        </div>
     );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-950/95 border border-zinc-700 p-3 rounded-xl shadow-2xl backdrop-blur-md z-[999999] relative">
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1.5 text-center">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1.5 last:mb-0">
               <div className="w-2 h-2 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
               <span className="text-[10px] font-bold text-white uppercase tracking-widest">{entry.name}:</span>
               <span className="text-[10px] font-black drop-shadow-md" style={{ color: entry.color }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomCombatTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-950/95 border border-zinc-700 p-3 rounded-xl shadow-2xl backdrop-blur-md z-[999999] relative">
          <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1.5 text-center">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-4 mb-1.5 last:mb-0">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
                 <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{entry.name}:</span>
               </div>
               <span className="text-[11px] font-black drop-shadow-md" style={{ color: entry.color }}>{Number(entry.value).toFixed(1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomComparativeBarTooltip = ({ active, payload, label, playerA, playerB }: any) => {
    if (active && payload && payload.length >= 2) {
      const isALeading = payload[0].value >= payload[1].value;
      return (
        <div className="bg-zinc-950/95 border border-zinc-700 p-3 rounded-xl shadow-2xl backdrop-blur-md z-[999999] relative min-w-[160px]">
          <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1.5 text-center">{label}</p>
          
          <div className="flex justify-between items-center gap-4 mb-1.5">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: '#3b82f6', boxShadow: `0 0 8px rgba(59,130,246,0.5)` }}></div>
               <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{playerA || 'A'}:</span>
             </div>
             <span className={`text-[11px] font-black drop-shadow-md ${isALeading ? 'text-blue-400' : 'text-zinc-300'}`}>{Number(payload[0].value).toFixed(1)}</span>
          </div>

          <div className="flex justify-between items-center gap-4 mb-0">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: '#ef4444', boxShadow: `0 0 8px rgba(239,68,68,0.5)` }}></div>
               <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{playerB || 'B'}:</span>
             </div>
             <span className={`text-[11px] font-black drop-shadow-md ${!isALeading ? 'text-red-400' : 'text-zinc-300'}`}>{Number(payload[1].value).toFixed(1)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading && (!corePlayerStats.length || !allTeams.length)) return (
     <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-4">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-bold tracking-[0.2em] text-[10px] uppercase animate-pulse">Processando Inteligência Tática...</p>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-20 relative">
      
      {/* INJEÇÃO CSS GLOBAL */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .hover-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        .recharts-tooltip-wrapper { z-index: 999999 !important; outline: none; }
        
        .foil-stealth-royal {
          background-image: 
            linear-gradient(110deg, transparent 0%, transparent 35%, rgba(255, 255, 255, 0.01) 40%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0.01) 60%, transparent 65%, transparent 100%),
            linear-gradient(to right, rgba(255, 245, 220, 0.015), rgba(255, 255, 255, 0.03), rgba(255, 245, 220, 0.015));
          background-size: 250% 100%, 100% 100%;
          animation: premium-sweep 14s linear infinite; 
          mix-blend-mode: color-dodge;
        }
        .foil-stealth-royal::after {
          content: ""; position: absolute; inset: 0;
          background-image: 
            linear-gradient(45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015)),
            linear-gradient(-45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015));
          background-size: 4px 4px; mix-blend-mode: overlay; pointer-events: none; opacity: 0.7; 
        }
        @keyframes premium-sweep {
          0%   { background-position: 200% 0, 0% 0; }
          100% { background-position: -100% 0, 0% 0; }
        }

        /* Shape Assimétrico para Cartinhas (HUD) */
        .clip-card { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%); }
      `}} />

      {/* HEADER STICKY (Z-INDEX SUPER ALTO PARA DROPDOWNS) */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800/80 pb-4 pt-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-[99999] rounded-b-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] px-4 md:px-8">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
             {viewMode === 'TEAMS' ? <Shield className="text-blue-500" size={28} /> : <User className="text-purple-500" size={28} />}
             {viewMode === 'TEAMS' ? 'TEAM' : 'PLAYER'} <span className="text-zinc-600">COMPARISON</span>
          </h1>
          <div className="flex bg-zinc-900/60 p-1 rounded-lg w-fit border border-zinc-800/80 shadow-inner mt-3">
             <button onClick={() => setViewMode('TEAMS')} className={`px-5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'TEAMS' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Compare Teams</button>
             <button onClick={() => setViewMode('PLAYERS')} className={`px-5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'PLAYERS' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Compare Players</button>
          </div>
        </div>

        <div className="flex gap-4 items-end bg-transparent flex-wrap xl:flex-nowrap justify-start xl:justify-end">
           <div className="flex flex-col">
              <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">PERÍODO PERSONALIZADO</label>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors rounded-lg px-3 py-2 h-[34px] shadow-sm relative">
                 <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setGlobalSplit('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                 <span className="text-zinc-600 text-[10px] font-black uppercase">ATÉ</span>
                 <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setGlobalSplit('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                 {(startDate || endDate) && (
                    <button onClick={() => { setStartDate(''); setEndDate(''); setGlobalSplit('ALL'); }} className="ml-1 text-red-500 hover:text-red-400 transition-colors bg-red-500/10 p-0.5 rounded border border-red-500/20">
                       <X size={12} />
                    </button>
                 )}
              </div>
           </div>
           <TournamentMultiSelector value={globalTournaments} onChange={setGlobalTournaments} />
           <SplitSelector value={globalSplit} onChange={setGlobalSplit} availableSplits={dynamicAvailableSplits} />
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">

         {/* ARENA HERO (Z-INDEX 50 PARA DROPDOWNS SOBREPOR GRID) */}
         <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 lg:p-12 shadow-2xl relative z-[50] group flex flex-col md:flex-row items-center justify-between gap-8 hover-lift" style={{ opacity: 0, animationDelay: '0.1s' }}>
           <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none">
              {/* Removido o foil-stealth-royal daqui para não poluir o fundo */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
              <div className={`absolute -top-32 -left-32 ${viewMode==='TEAMS'?'bg-blue-600/10':'bg-purple-600/10'} w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none`}></div>
              <div className={`absolute -bottom-32 -right-32 bg-red-600/10 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none`}></div>
           </div>
           
           {/* LADO A */}
           <div className="flex-1 flex flex-col items-center relative w-full">
               {viewMode === 'TEAMS' ? (
                  <img src={getTeamLogo(teamA)} className="w-32 h-32 md:w-40 md:h-40 mb-6 object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-transform hover:scale-110 duration-500" alt="A" />
               ) : (
                  <div className="mb-6"><PlayerTradingCard playerInfo={playerCardData?.A} photoUrl={getPlayerPhoto(playerA)} color="blue" allTeams={allTeams} /></div>
               )}
               <PremiumEntitySelector value={viewMode === 'TEAMS' ? teamA : playerA} onChange={viewMode === 'TEAMS' ? setTeamA : setPlayerA} options={viewMode === 'TEAMS' ? allTeams : allPlayers} type={viewMode} align="left" color="blue" />
               <div className="mt-4"><SideFilter value={sideA} onChange={setSideA} /></div>
           </div>
           
           {/* MEIO (VS) & WIN PROBABILITY PREDITIVE ALGORITHM */}
           <div className="shrink-0 flex flex-col items-center justify-center relative px-8 w-full max-w-[280px]">
               <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] transform rotate-12 group-hover:rotate-0 transition-transform duration-500"><Swords size={28} className="text-zinc-500" /></div>
               
               <div className="mt-4 text-center flex flex-col gap-2 items-center w-full">
                 <span className="text-[10px] font-black text-white bg-zinc-900/80 border border-zinc-800 px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-inner">{tapeStats.A.games}J vs {tapeStats.B.games}J</span>
                 <button onClick={() => setH2hOnly(!h2hOnly)} className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded flex items-center gap-1.5 transition-all shadow-sm ${h2hOnly ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/50 shadow-[0_0_10px_rgba(217,70,239,0.3)]' : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                    <Target size={10} /> Confronto Direto
                 </button>
               </div>

               {/* PREDITIVE ALGORITHM BAR (TEAMS ONLY) */}
               {viewMode === 'TEAMS' && winProbability && (
                  <div className="mt-6 flex flex-col items-center w-full gap-1.5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center justify-center gap-1 w-full text-center">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Predição de Vitória (IA)</span>
                      <InfoTooltip text="Modelo Heurístico que avalia e pondera os seguintes pilares: 1. Win Rate de Temporada; 2. Pressão do Early Game; 3. Controle de Objetivos Iniciais; 4. Resiliência (Viradas e Entregas); 5. Eficiência de Ouro." />
                    </div>
                    <div className="flex items-center justify-between w-full text-[12px] font-black mt-1 px-1">
                       <span className="text-blue-400 drop-shadow-md">{winProbability.A.toFixed(1)}%</span>
                       <span className="text-red-400 drop-shadow-md">{winProbability.B.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full flex overflow-hidden border border-zinc-800 shadow-inner">
                       <div className="h-full bg-blue-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${winProbability.A}%` }}></div>
                       <div className="h-full bg-red-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(239,68,68,0.8)]" style={{ width: `${winProbability.B}%` }}></div>
                    </div>
                  </div>
               )}
           </div>
           
           {/* LADO B */}
           <div className="flex-1 flex flex-col items-center relative w-full">
               {viewMode === 'TEAMS' ? (
                  <img src={getTeamLogo(teamB)} className="w-32 h-32 md:w-40 md:h-40 mb-6 object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-transform hover:scale-110 duration-500" alt="B" />
               ) : (
                  <div className="mb-6"><PlayerTradingCard playerInfo={playerCardData?.B} photoUrl={getPlayerPhoto(playerB)} color="red" allTeams={allTeams} /></div>
               )}
               <PremiumEntitySelector value={viewMode === 'TEAMS' ? teamB : playerB} onChange={viewMode === 'TEAMS' ? setTeamB : setPlayerB} options={viewMode === 'TEAMS' ? allTeams : allPlayers} type={viewMode} align="right" color="red" />
               <div className="mt-4"><SideFilter value={sideB} onChange={setSideB} /></div>
           </div>
         </div>

         {/* GRID DE KPIs (Z-INDEX 40) */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative z-[40]">
           
           {/* COLUNA ESQUERDA (MACRO & PACING) */}
           <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Tale of the Tape */}
              <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group hover-lift flex-1" style={{ opacity: 0, animationDelay: '0.2s' }}>
                 <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                 </div>
                 <div className="mb-6 flex items-center gap-3 border-b border-zinc-800/60 pb-4 relative z-10">
                   <BarChart2 size={18} className="text-emerald-500" />
                   <div>
                     <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none flex items-center">
                        Tale of the Tape
                     </h3>
                     <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Métricas Globais Diretas</p>
                   </div>
                 </div>
                 <div className="flex flex-col gap-5 relative z-10">
                   <TugOfWarBar label="Win Rate %" valA={tapeStats.A.winRate} valB={tapeStats.B.winRate} format={(v:any) => `${Math.round(v)}%`} icon={TrendingUp} />
                   
                   {viewMode === 'TEAMS' ? (
                      <>
                        <TugOfWarBar label="First Blood %" valA={tapeStats.A.fbRate} valB={tapeStats.B.fbRate} format={(v:any) => `${Math.round(v)}%`} icon={Target} />
                        <TugOfWarBar label="First Tower %" valA={tapeStats.A.ftRate} valB={tapeStats.B.ftRate} format={(v:any) => `${Math.round(v)}%`} />
                        <TugOfWarBar label="Gold Eff (DPM/GPM)" valA={tapeStats.A.goldEff} valB={tapeStats.B.goldEff} format={(v:any) => v.toFixed(2)} />
                        <TugOfWarBar label="DPM Médio" valA={tapeStats.A.dpm} valB={tapeStats.B.dpm} format={(v:any) => Math.round(v)} />
                        <TugOfWarBar label="VSPM Médio" valA={tapeStats.A.vspm} valB={tapeStats.B.vspm} format={(v:any) => v.toFixed(2)} />
                      </>
                   ) : (
                      <>
                        <TugOfWarBar label="KDA Ratio" valA={tapeStats.A.kda} valB={tapeStats.B.kda} format={(v:any) => v.toFixed(2)} icon={Swords} />
                        <TugOfWarBar label="Kill Part. %" valA={tapeStats.A.kp} valB={tapeStats.B.kp} format={(v:any) => `${Math.round(v)}%`} icon={Target} />
                        <TugOfWarBar label="Gold Eff (DPM/GPM)" valA={tapeStats.A.goldEff} valB={tapeStats.B.goldEff} format={(v:any) => v.toFixed(2)} />
                        <TugOfWarBar label="DPM Médio" valA={tapeStats.A.dpm} valB={tapeStats.B.dpm} format={(v:any) => Math.round(v)} />
                        <TugOfWarBar label="VSPM Médio" valA={tapeStats.A.vspm} valB={tapeStats.B.vspm} format={(v:any) => v.toFixed(2)} />
                      </>
                   )}
                 </div>
              </div>

              {/* Laning Phase e Pressão */}
              <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group hover-lift flex-1" style={{ opacity: 0, animationDelay: '0.25s' }}>
                 <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                 </div>
                 <div className="mb-6 flex items-center gap-3 border-b border-zinc-800/60 pb-4 relative z-10">
                   <Zap size={18} className="text-amber-500" />
                   <div>
                     <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none flex items-center">
                        Pressão de Rota (Early) 
                        <InfoTooltip text="Mede o domínio nos primeiros 12 minutos. O Índice de Pressão pondera Ouro, XP e CS para dar uma nota de 0 a 100." />
                     </h3>
                     <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Diferenciais Absolutos @ 12</p>
                   </div>
                 </div>
                 <div className="flex flex-col gap-4 relative z-10">
                   <TugOfWarBar label="Gold Diff @12" valA={earlyStats.A.gd12} valB={earlyStats.B.gd12} format={(v:any) => (v>0?'+':'')+Math.round(v)} />
                   <TugOfWarBar label="XP Diff @12" valA={earlyStats.A.xpd12} valB={earlyStats.B.xpd12} format={(v:any) => (v>0?'+':'')+Math.round(v)} />
                   <TugOfWarBar label="CS Diff @12" valA={earlyStats.A.csd12} valB={earlyStats.B.csd12} format={(v:any) => (v>0?'+':'')+Math.round(v)} />
                   <TugOfWarBar label="Abates/Assist @12" valA={earlyStats.A.kpa12} valB={earlyStats.B.kpa12} format={(v:any) => v.toFixed(1)} />
                   <TugOfWarBar label="Mortes @12" valA={earlyStats.A.deaths12} valB={earlyStats.B.deaths12} format={(v:any) => v.toFixed(1)} reverseColors={true} />
                   
                   <div className="mt-1 pt-4 border-t border-zinc-800/50">
                      <TugOfWarBar label="ÍNDICE DE PRESSÃO (0-100)" valA={earlyStats.A.pressure} valB={earlyStats.B.pressure} format={(v:any) => Math.round(v)} icon={Target} />
                   </div>
                 </div>
              </div>

              {/* Resiliência / Champion Pool (TEAMS ONLY) */}
              <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group hover-lift" style={{ opacity: 0, animationDelay: '0.3s' }}>
                 <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                 </div>
                 {viewMode === 'TEAMS' && resilienceIntel ? (
                    <div className="relative z-10">
                       <div className="mb-6 flex items-center gap-3 border-b border-zinc-800/60 pb-4">
                         <Activity size={18} className="text-emerald-500" />
                         <div>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none flex items-center">
                              Resiliência (Pós-12m)
                              <InfoTooltip text="Throw Rate: % de jogos em que o time estava à frente no Ouro aos 12m mas perdeu. Comeback: % de jogos atrás no Ouro aos 12m mas que venceu." />
                           </h3>
                           <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Taxas Reais vs Resultado</p>
                         </div>
                       </div>
                       <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 shadow-inner">
                             <div className="text-center">
                                <span className="text-2xl font-black text-blue-400 block drop-shadow-md">{Math.round(resilienceIntel.A.throwRate)}%</span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Throw Rate</span>
                             </div>
                             <TrendingDown className="text-zinc-700" size={20} />
                             <div className="text-center">
                                <span className="text-2xl font-black text-red-400 block drop-shadow-md">{Math.round(resilienceIntel.B.throwRate)}%</span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Throw Rate</span>
                             </div>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 shadow-inner">
                             <div className="text-center">
                                <span className="text-2xl font-black text-blue-400 block drop-shadow-md">{Math.round(resilienceIntel.A.comebackRate)}%</span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Comeback</span>
                             </div>
                             <TrendingUp className="text-zinc-700" size={20} />
                             <div className="text-center">
                                <span className="text-2xl font-black text-red-400 block drop-shadow-md">{Math.round(resilienceIntel.B.comebackRate)}%</span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Comeback</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 ) : playerPools && (
                    <div className="relative z-10">
                       <div className="mb-4 flex items-center gap-3 border-b border-zinc-800/60 pb-4">
                         <Crosshair size={18} className="text-fuchsia-500" />
                         <div>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">Champion Pool</h3>
                           <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Top 6 Picks Expandido</p>
                         </div>
                       </div>
                       <div className="flex gap-4">
                          <div className="flex-1 flex flex-wrap gap-2 justify-start">
                             {playerPools.A.map(c => (
                                <div key={c.champ} className="relative group/pick cursor-help transition-transform hover:scale-110 hover:z-[100]">
                                   <img src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-blue-500/30 object-cover shadow-sm" alt={c.champ} />
                                   <span className="absolute -bottom-1 -right-1 bg-zinc-950 border border-blue-500/50 text-[8px] font-black text-blue-400 px-1.5 rounded-sm z-10">{c.picks}</span>
                                </div>
                             ))}
                          </div>
                          <div className="w-px bg-zinc-800"></div>
                          <div className="flex-1 flex flex-wrap gap-2 justify-end">
                             {playerPools.B.map(c => (
                                <div key={c.champ} className="relative group/pick cursor-help transition-transform hover:scale-110 hover:z-[100]">
                                   <img src={getChampionImageUrl(c.champ)} className="w-10 h-10 rounded-lg border border-red-500/30 object-cover shadow-sm" alt={c.champ} />
                                   <span className="absolute -bottom-1 -right-1 bg-zinc-950 border border-red-500/50 text-[8px] font-black text-red-400 px-1.5 rounded-sm z-10">{c.picks}</span>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>

           {/* COLUNA CENTRAL E DIREITA (GRÁFICOS & DRAFT WAR ROOM) */}
           <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* LINHA DE GRÁFICOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
                 <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift" style={{ opacity: 0, animationDelay: '0.35s' }}>
                    <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                       <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                    </div>
                    <div className="flex items-center justify-between mb-2 relative z-10 border-b border-zinc-800/60 pb-3">
                       <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Target size={14} className="text-purple-500" /> Ratings de Performance</h3>
                       </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 relative z-10 -ml-4">
                       <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                             <PolarGrid stroke="#27272a" />
                             <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} tickFormatter={(val) => String(val).toUpperCase()} />
                             <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                             <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} />
                             
                             <Radar name={viewMode === 'TEAMS' ? teamA : playerA} dataKey="A" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.2} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(59,130,246,0.6))' }} />
                             <Radar name={viewMode === 'TEAMS' ? teamB : playerB} dataKey="B" stroke="#ef4444" strokeWidth={3} fill="#ef4444" fillOpacity={0.2} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#ef4444', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(239,68,68,0.6))' }} />
                             <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '10px' }} iconType="circle" />
                          </RadarChart>
                       </ResponsiveContainer>
                    </div>
                 </div>

                 <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift" style={{ opacity: 0, animationDelay: '0.4s' }}>
                    <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                       <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                    </div>
                    <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3 relative z-10">
                       <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Clock size={14} className="text-amber-500" /> Timeline Escalar</h3>
                       </div>
                       <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden relative z-50 shadow-inner p-0.5">
                          {['GOLD', 'XP', 'CS'].map(m => (
                             <button key={m} onClick={() => setTimelineMetric(m as any)} className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-colors rounded ${timelineMetric === m ? 'bg-amber-600/20 text-amber-500 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>{m}</button>
                          ))}
                       </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 relative z-10 -ml-4">
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                             <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                             <XAxis dataKey="time" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} tickLine={false} axisLine={false} />
                             <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} width={40} />
                             <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} />
                             <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '10px' }} iconType="circle" />
                             
                             <Line type="monotone" name={viewMode === 'TEAMS' ? teamA : playerA} dataKey="A" stroke="#3b82f6" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(59,130,246,0.5))' }} />
                             <Line type="monotone" name={viewMode === 'TEAMS' ? teamB : playerB} dataKey="B" stroke="#ef4444" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#ef4444', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(239,68,68,0.5))' }} />
                          </LineChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
              </div>

              {/* BOX NOVO: IDENTIDADE / DISTRIBUIÇÃO DE RECURSOS (TEAMS ONLY) */}
              {viewMode === 'TEAMS' && resourceDistribution && (
                 <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group hover-lift" style={{ opacity: 0, animationDelay: '0.45s' }}>
                    <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                       <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                    </div>
                    <div className="mb-6 flex items-center justify-between border-b border-zinc-800/60 pb-4 relative z-10">
                       <div className="flex items-center gap-3">
                         <Flame size={18} className="text-orange-500" />
                         <div>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none flex items-center">
                              Distribuição de Recursos
                              <InfoTooltip text="Compara a porcentagem de Ouro recebida por cada jogador em relação à porcentagem de Dano que ele causa. Identifica quem são os 'Carregadores Low Econ' e os 'Sumidouros de Ouro' de cada equipe." />
                           </h3>
                           <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Onde o time aloca o Ouro vs Produção de Dano (%)</p>
                         </div>
                       </div>
                    </div>
                    <div className="grid grid-cols-5 gap-4 relative z-10">
                       {resourceDistribution.A.map((roleA, idx) => {
                          const roleB = resourceDistribution.B[idx];
                          return (
                             <div key={roleA.role} className="flex flex-col items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 shadow-inner">
                                <div className="flex justify-between items-center w-full mb-4">
                                   <div className="flex flex-col items-center gap-1 w-[30%]">
                                      <img src={roleA.playerPhoto} className="w-7 h-7 rounded-full border border-blue-500/50 object-cover shadow-sm" alt={roleA.playerName} />
                                      <span className="text-[6px] font-black text-blue-400 truncate w-full text-center tracking-widest uppercase">{roleA.playerName}</span>
                                   </div>
                                   <div className="w-8 h-8 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 shadow-sm shrink-0 flex items-center justify-center relative z-10">
                                      {getRoleIcon(roleA.role, 'w-full h-full')}
                                   </div>
                                   <div className="flex flex-col items-center gap-1 w-[30%]">
                                      <img src={roleB.playerPhoto} className="w-7 h-7 rounded-full border border-red-500/50 object-cover shadow-sm" alt={roleB.playerName} />
                                      <span className="text-[6px] font-black text-red-400 truncate w-full text-center tracking-widest uppercase">{roleB.playerName}</span>
                                   </div>
                                </div>
                                <div className="w-full flex flex-col gap-4">
                                   <div className="flex flex-col gap-1.5 w-full">
                                      <span className="text-[8px] font-black text-yellow-500 uppercase tracking-widest text-center border-b border-zinc-800/50 pb-1">Gold %</span>
                                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold mt-1">
                                         <span className="text-blue-400 w-6 text-right drop-shadow-md">{roleA.gold.toFixed(1)}</span>
                                         <div className="flex-1 h-1.5 bg-zinc-800 rounded-full flex overflow-hidden shadow-inner">
                                            <div className="h-full bg-blue-500" style={{width: `${(roleA.gold/(roleA.gold+roleB.gold))*100}%`}}></div>
                                            <div className="h-full bg-red-500" style={{width: `${(roleB.gold/(roleA.gold+roleB.gold))*100}%`}}></div>
                                         </div>
                                         <span className="text-red-400 w-6 text-left drop-shadow-md">{roleB.gold.toFixed(1)}</span>
                                      </div>
                                   </div>
                                   <div className="flex flex-col gap-1.5 w-full mt-1">
                                      <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest text-center border-b border-zinc-800/50 pb-1">Dmg %</span>
                                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold mt-1">
                                         <span className="text-blue-400 w-6 text-right drop-shadow-md">{roleA.dmg.toFixed(1)}</span>
                                         <div className="flex-1 h-1.5 bg-zinc-800 rounded-full flex overflow-hidden shadow-inner">
                                            <div className="h-full bg-blue-500" style={{width: `${(roleA.dmg/(roleA.dmg+roleB.dmg))*100}%`}}></div>
                                            <div className="h-full bg-red-500" style={{width: `${(roleB.dmg/(roleA.dmg+roleB.dmg))*100}%`}}></div>
                                         </div>
                                         <span className="text-red-400 w-6 text-left drop-shadow-md">{roleB.dmg.toFixed(1)}</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )
                       })}
                    </div>
                 </div>
              )}

              {/* DRAFT WAR ROOM (TEAMS ONLY) */}
              {viewMode === 'TEAMS' && draftIntel && (
                 <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group hover-lift" style={{ opacity: 0, animationDelay: '0.5s' }}>
                    <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                       <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                    </div>
                    <div className="mb-6 flex items-center justify-between border-b border-zinc-800/60 pb-4 relative z-10">
                       <div className="flex items-center gap-3">
                         <Crosshair size={18} className="text-fuchsia-500" />
                         <div>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">Draft War Room</h3>
                           <p className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1 uppercase">Prioridades, Exclusividades e Assinaturas</p>
                         </div>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 relative z-10">
                       <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex flex-col shadow-inner">
                          <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-[0.2em] mb-4 text-center">Contestados</span>
                          <div className="flex flex-col gap-2">
                             {draftIntel.contested.length > 0 ? draftIntel.contested.slice(0, 4).map(c => (
                                <ChampHorizontalBadge key={c.champ} champ={c.champ} teamA={teamA} teamB={teamB} picksA={c.picksA} picksB={c.picksB} masterA={c.masterA} masterB={c.masterB} type="contested" />
                             )) : <EmptyState text="NENHUM EM COMUM" />}
                          </div>
                       </div>
                       <div className="bg-blue-950/10 border border-blue-900/20 rounded-2xl p-4 flex flex-col shadow-inner">
                          <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 text-center">Exclusivos {teamA}</span>
                          <div className="flex flex-col gap-2">
                             {draftIntel.targetA.length > 0 ? draftIntel.targetA.slice(0, 4).map(c => (
                                <ChampHorizontalBadge key={c.champ} champ={c.champ} teamA={teamA} teamB={teamB} picksA={c.picks} picksB={0} masterA={c.masterA} type="targetA" />
                             )) : <EmptyState text="NENHUMA EXCLUSIVIDADE" />}
                          </div>
                       </div>
                       <div className="bg-red-950/10 border border-red-900/20 rounded-2xl p-4 flex flex-col shadow-inner">
                          <span className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] mb-4 text-center">Exclusivos {teamB}</span>
                          <div className="flex flex-col gap-2">
                             {draftIntel.targetB.length > 0 ? draftIntel.targetB.slice(0, 4).map(c => (
                                <ChampHorizontalBadge key={c.champ} champ={c.champ} teamA={teamA} teamB={teamB} picksA={0} picksB={c.picks} masterB={c.masterB} type="targetB" />
                             )) : <EmptyState text="NENHUMA EXCLUSIVIDADE" />}
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-zinc-800/60 relative z-10">
                       <div className="flex flex-col items-center bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/50">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-3"><Ban size={10}/> Top Bans ({teamA})</span>
                          <div className="flex gap-2 justify-center flex-wrap">
                             {draftIntel.bansA.length > 0 ? draftIntel.bansA.map(b => (
                                <div key={b.champ} className="relative group cursor-help transition-transform hover:scale-110 hover:z-[100]">
                                   <img src={getChampionImageUrl(b.champ)} className="w-8 h-8 rounded border border-blue-500/30 grayscale hover:grayscale-0 transition-all object-cover shadow-sm" alt={b.champ} />
                                   <span className="absolute -top-1.5 -right-1.5 bg-zinc-950 border border-zinc-700 text-[7px] font-black text-zinc-300 px-1 rounded-sm z-10">{b.picks}</span>
                                </div>
                             )) : <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic py-1">Sem registros de Ban</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/50">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-3"><Ban size={10}/> Top Bans ({teamB})</span>
                          <div className="flex gap-2 justify-center flex-wrap">
                             {draftIntel.bansB.length > 0 ? draftIntel.bansB.map(b => (
                                <div key={b.champ} className="relative group cursor-help transition-transform hover:scale-110 hover:z-[100]">
                                   <img src={getChampionImageUrl(b.champ)} className="w-8 h-8 rounded border border-red-500/30 grayscale hover:grayscale-0 transition-all object-cover shadow-sm" alt={b.champ} />
                                   <span className="absolute -top-1.5 -right-1.5 bg-zinc-950 border border-zinc-700 text-[7px] font-black text-zinc-300 px-1 rounded-sm z-10">{b.picks}</span>
                                </div>
                             )) : <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic py-1">Sem registros de Ban</span>}
                          </div>
                       </div>
                    </div>
                 </div>
              )}

              {/* PLAYERS ONLY: ADVANCED METRICS (4 Charts Grid) */}
              {viewMode === 'PLAYERS' && playerAdvStats && (
                 <div className="flex flex-col gap-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0 relative z-10">
                        
                        {/* 1. COMBAT PROFILE (STACKED BAR) - CORES FIXADAS */}
                        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift h-[320px]" style={{ opacity: 0, animationDelay: '0.45s' }}>
                           <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                           </div>
                           <div className="flex items-center justify-between mb-4 relative z-10 border-b border-zinc-800/60 pb-3">
                              <div>
                                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                 <Swords size={14} className="text-blue-500" /> Perfil de Combate
                                 <InfoTooltip text="Avalia a relação de Risco vs Recompensa. Kills (Azul) + Assists (Verde) vs a média de Mortes (Linha Vermelha)." />
                                 </h3>
                              </div>
                           </div>
                           <div className="flex-1 w-full min-h-0 relative z-10 -ml-4 mt-2">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={playerAdvStats.combatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                   <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                   <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                   <YAxis yAxisId="left" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                   <YAxis yAxisId="right" orientation="right" hide domain={[0, 'dataMax + 2']} />
                                   <RechartsTooltip content={<CustomCombatTooltip />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                   
                                   {/* FIX: Cores fixadas pela Métrica (Não pelo jogador) para a Legenda funcionar perfeitamente */}
                                   <Bar yAxisId="left" dataKey="Kills" name="Kills" stackId="a" maxBarSize={55} radius={[0, 0, 4, 4] as any} fill="#3b82f6" />
                                   <Bar yAxisId="left" dataKey="Assists" name="Assists" stackId="a" maxBarSize={55} radius={[4, 4, 0, 0] as any} fill="#10b981" />
                                   <Line yAxisId="right" type="monotone" dataKey="Deaths" name="Deaths" stroke="#ef4444" strokeWidth={3} dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} />
                                </ComposedChart>
                              </ResponsiveContainer>
                           </div>
                           {/* Custom Legend at bottom */}
                           <div className="flex justify-center gap-6 mt-3 mb-1 shrink-0 relative z-10">
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">KILLS</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">ASSISTS</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">DEATHS</span>
                              </div>
                           </div>
                        </div>

                        {/* 2. RESOURCE FOOTPRINT (HORIZONTAL BAR) */}
                        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift h-[320px]" style={{ opacity: 0, animationDelay: '0.5s' }}>
                           <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                           </div>
                           <div className="flex items-center justify-between mb-4 relative z-10 border-b border-zinc-800/60 pb-3">
                              <div>
                                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                 <Scale size={14} className="text-amber-500" /> Resource Footprint
                                 <InfoTooltip text="Compara a parcela de responsabilidade e recursos que cada jogador absorve dentro de sua respectiva equipe." />
                                 </h3>
                              </div>
                           </div>
                           <div className="flex-1 w-full min-h-0 relative z-10 -ml-2">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={playerAdvStats.resourceData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                   <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.5} />
                                   <XAxis type="number" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                                   <YAxis dataKey="metric" type="category" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: '900' }} axisLine={false} tickLine={false} width={85} />
                                   <RechartsTooltip content={<CustomComparativeBarTooltip playerA={playerA} playerB={playerB} />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                   <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '10px' }} iconType="circle" />
                                   
                                   <Bar dataKey="A" name={playerA || 'A'} fill="#3b82f6" radius={[0, 4, 4, 0] as any} barSize={10} />
                                   <Bar dataKey="B" name={playerB || 'B'} fill="#ef4444" radius={[0, 4, 4, 0] as any} barSize={10} />
                                </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0 relative z-10">
                        {/* 3. DPM vs GPM (SPLIT VERTICAL BARS) */}
                        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift h-[320px]" style={{ opacity: 0, animationDelay: '0.55s' }}>
                           <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                           </div>
                           <div className="flex items-center justify-between mb-2 relative z-10 border-b border-zinc-800/60 pb-3">
                              <div>
                                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                 <Coins size={14} className="text-yellow-500" /> Motor Econômico
                                 <InfoTooltip text="DPM e GPM separados. Mostra o Dano por Minuto causado justificado pelo Ouro por Minuto farmado." />
                                 </h3>
                              </div>
                           </div>
                           
                           <div className="flex-1 w-full min-h-0 relative z-10 flex mt-2">
                              <div className="w-1/2 h-full -ml-4">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[playerAdvStats.econData[0]]} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                       <XAxis dataKey="metric" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                       <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={40} />
                                       <RechartsTooltip content={<CustomComparativeBarTooltip playerA={playerA} playerB={playerB} />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                       <Bar dataKey="A" name={playerA || 'A'} fill="#3b82f6" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                       <Bar dataKey="B" name={playerB || 'B'} fill="#ef4444" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                    </BarChart>
                                 </ResponsiveContainer>
                              </div>
                              <div className="w-1/2 h-full -ml-4">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[playerAdvStats.econData[1]]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                       <XAxis dataKey="metric" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                       <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={40} />
                                       <RechartsTooltip content={<CustomComparativeBarTooltip playerA={playerA} playerB={playerB} />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                       <Bar dataKey="A" name={playerA || 'A'} fill="#3b82f6" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                       <Bar dataKey="B" name={playerB || 'B'} fill="#ef4444" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                    </BarChart>
                                 </ResponsiveContainer>
                              </div>
                           </div>
                           
                           {/* Manual Legend */}
                           <div className="flex justify-center gap-6 mt-3 mb-1 shrink-0 relative z-10">
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{playerA || 'A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{playerB || 'B'}</span>
                              </div>
                           </div>
                        </div>

                        {/* 4. VISÃO E UTILIDADE (SPLIT VERTICAL BARS) */}
                        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative z-10 hover:z-[100] group flex flex-col hover-lift h-[320px]" style={{ opacity: 0, animationDelay: '0.6s' }}>
                           <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
                           </div>
                           <div className="flex items-center justify-between mb-2 relative z-10 border-b border-zinc-800/60 pb-3">
                              <div>
                                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                 <Eye size={14} className="text-fuchsia-500" /> Utilidade e Controle
                                 <InfoTooltip text="Visão e Eficiência isoladas em suas próprias escalas. VSPM avalia mapas. Gold Eff calcula Dano devolvido para cada moeda ganha." />
                                 </h3>
                              </div>
                           </div>
                           
                           <div className="flex-1 w-full min-h-0 relative z-10 flex mt-2">
                              <div className="w-1/2 h-full -ml-4">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[playerAdvStats.utilityData[0]]} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                       <XAxis dataKey="metric" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                       <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={40} />
                                       <RechartsTooltip content={<CustomComparativeBarTooltip playerA={playerA} playerB={playerB} />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                       <Bar dataKey="A" name={playerA || 'A'} fill="#3b82f6" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                       <Bar dataKey="B" name={playerB || 'B'} fill="#ef4444" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                    </BarChart>
                                 </ResponsiveContainer>
                              </div>
                              <div className="w-1/2 h-full -ml-4">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[playerAdvStats.utilityData[1]]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                       <XAxis dataKey="metric" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                       <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={40} />
                                       <RechartsTooltip content={<CustomComparativeBarTooltip playerA={playerA} playerB={playerB} />} wrapperStyle={{ zIndex: 999999, outline: 'none' }} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                                       <Bar dataKey="A" name={playerA || 'A'} fill="#3b82f6" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                       <Bar dataKey="B" name={playerB || 'B'} fill="#ef4444" radius={[4, 4, 0, 0] as any} maxBarSize={35} />
                                    </BarChart>
                                 </ResponsiveContainer>
                              </div>
                           </div>
                           
                           {/* Manual Legend */}
                           <div className="flex justify-center gap-6 mt-3 mb-1 shrink-0 relative z-10">
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{playerA || 'A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{playerB || 'B'}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                 </div>
              )}

           </div>
         </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES UI ---

function InfoTooltip({ text }: { text: string }) {
   return (
      <div className="relative group/info cursor-help inline-flex items-center justify-center ml-2">
         <div className="w-3.5 h-3.5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[8px] font-black hover:bg-blue-500 hover:text-white transition-colors">?</div>
         <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[9px] font-bold p-2.5 rounded-lg shadow-xl w-48 text-center opacity-0 pointer-events-none group-hover/info:opacity-100 transition-all z-[999999] leading-relaxed tracking-wide">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700"></div>
         </div>
      </div>
   );
}

function SideFilter({ value, onChange }: { value: 'ALL' | 'BLUE' | 'RED', onChange: (val: 'ALL' | 'BLUE' | 'RED') => void }) {
   return (
      <div className="flex bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded-lg overflow-hidden shadow-inner relative z-50">
         <button onClick={() => onChange('BLUE')} className={`px-4 py-1.5 text-[9px] font-black uppercase transition-all ${value === 'BLUE' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>Blue</button>
         <button onClick={() => onChange('ALL')} className={`px-4 py-1.5 text-[9px] font-black uppercase border-x border-zinc-800 transition-all ${value === 'ALL' ? 'bg-zinc-800/80 text-white' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'}`}>Ambos</button>
         <button onClick={() => onChange('RED')} className={`px-4 py-1.5 text-[9px] font-black uppercase transition-all ${value === 'RED' ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>Red</button>
      </div>
   )
}

function ChampHorizontalBadge({ champ, teamA, teamB, picksA, picksB, masterA, masterB, type }: any) {
   const isContested = type === 'contested';
   const borderColor = isContested ? 'border-fuchsia-900/40 bg-fuchsia-900/10 hover:border-fuchsia-500/50' : type === 'targetA' ? 'border-blue-900/40 bg-blue-900/10 hover:border-blue-500/50' : 'border-red-900/40 bg-red-900/10 hover:border-red-500/50';
   const textColor = isContested ? 'text-fuchsia-400' : type === 'targetA' ? 'text-blue-400' : 'text-red-400';

   const centeredSplash = getChampionCenteredUrl(champ);

   return (
      <div className={`relative group/pick cursor-help h-[46px] rounded-lg border flex items-center shadow-sm transition-all hover:-translate-y-0.5 hover:z-[100] ${borderColor}`}>
         <div className="absolute inset-0 w-full h-full overflow-hidden rounded-lg pointer-events-none">
            <img src={centeredSplash} className="w-full h-full object-cover object-[center_20%] opacity-40 transition-transform duration-500 group-hover/pick:scale-110 group-hover/pick:opacity-80" alt={champ} />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/70 to-transparent" />
         </div>
         <div className={`absolute top-0 bottom-0 left-0 w-1 z-20 ${isContested ? 'bg-fuchsia-500' : type === 'targetA' ? 'bg-blue-500' : 'bg-red-500'}`} />
         
         <div className="relative z-20 flex w-full items-center justify-between px-3">
            <span className="text-[11px] font-black text-white uppercase tracking-tight drop-shadow-md">{champ}</span>
            <div className="flex gap-2">
               {isContested ? (
                  <>
                     <span className="text-[9px] font-black text-blue-400 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-blue-900/50 backdrop-blur-sm shadow-sm">{picksA}P</span>
                     <span className="text-[9px] font-black text-red-400 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-red-900/50 backdrop-blur-sm shadow-sm">{picksB}P</span>
                  </>
               ) : (
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded border backdrop-blur-sm shadow-sm ${type === 'targetA' ? 'text-blue-400 bg-zinc-950/80 border-blue-900/50' : 'text-red-400 bg-zinc-950/80 border-red-900/50'}`}>
                     {type === 'targetA' ? picksA : picksB} PICKS
                  </span>
               )}
            </div>
         </div>

         <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-950/95 backdrop-blur border border-zinc-700 shadow-2xl rounded-xl p-3 text-[10px] opacity-0 group-hover/pick:opacity-100 pointer-events-none z-[999999] whitespace-nowrap min-w-[150px]">
            <span className={`font-black uppercase tracking-widest block border-b border-zinc-800 pb-1.5 mb-1.5 text-center ${textColor}`}>{champ} Mastery</span>
            {isContested ? (
               <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4 font-bold">
                     <span className="text-blue-400 flex flex-col">{teamA} <span className="text-[7px] text-zinc-400 font-black tracking-widest">{masterA || 'N/A'}</span></span>
                     <span className="text-white bg-zinc-900 px-1.5 py-0.5 border border-zinc-700 rounded text-[9px]">{picksA}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 font-bold">
                     <span className="text-red-400 flex flex-col">{teamB} <span className="text-[7px] text-zinc-400 font-black tracking-widest">{masterB || 'N/A'}</span></span>
                     <span className="text-white bg-zinc-900 px-1.5 py-0.5 border border-zinc-700 rounded text-[9px]">{picksB}</span>
                  </div>
               </div>
            ) : (
               <div className="flex items-center justify-between gap-4 font-bold">
                  <span className={`flex flex-col ${type === 'targetA' ? 'text-blue-400' : 'text-red-400'}`}>
                     {type === 'targetA' ? teamA : teamB} 
                     <span className="text-[7px] text-zinc-400 font-black tracking-widest">{type === 'targetA' ? (masterA || 'N/A') : (masterB || 'N/A')}</span>
                  </span>
                  <span className="text-white bg-zinc-900 px-1.5 py-0.5 border border-zinc-700 rounded text-[9px]">{type === 'targetA' ? picksA : picksB}</span>
               </div>
            )}
         </div>
      </div>
   )
}

function EmptyState({ text }: { text: string }) {
   return <div className="w-full text-center py-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl border-dashed"><span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase">{text}</span></div>;
}

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
    <div className="relative flex flex-col z-[99999]" ref={ref}>
      {label && <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">{label}</label>}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[140px] transition-colors text-[10px] font-black uppercase tracking-widest shadow-sm h-[34px] ${isHighlighted ? 'border-amber-500/50 text-amber-500 hover:border-amber-400' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
      >
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? (isHighlighted ? 'rotate-180 text-amber-500' : 'rotate-180 text-blue-500') : 'text-zinc-500'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 min-w-[160px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-[999999] max-h-[300px] overflow-y-auto custom-scrollbar animate-[fadeInUp_0.2s_ease-out_forwards] origin-top">
          {options.map((opt:any) => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === opt.id ? (isHighlighted ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-600/10 text-blue-400') : 'text-zinc-400'}`}
            >
              <span className="text-[9px] font-black uppercase tracking-widest">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PremiumEntitySelector({ value, onChange, options, type, align = "center", color = "blue" }: { value: string, onChange: (val: string) => void, options: any[], type: 'TEAMS'|'PLAYERS', align?: "left"|"center"|"right", color?: "blue"|"red" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => { 
     const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; 
     document.addEventListener("mousedown", click); 
     return () => document.removeEventListener("mousedown", click); 
  }, []);

  const getLabel = (opt: any) => type === 'TEAMS' ? opt.acronym : opt.nickname;
  const getImg = (opt: any) => type === 'TEAMS' ? opt.logo_url : opt.photo_url;
  const filteredOptions = options.filter(opt => getLabel(opt).toLowerCase().includes(search.toLowerCase()));
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const hoverBorder = color === "blue" ? "hover:border-blue-500/50 text-blue-400" : "hover:border-red-500/50 text-red-400";

  return (
    <div className="relative flex flex-col z-[99999] w-full max-w-[280px] group/selector" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className={`bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl flex items-center justify-between gap-4 transition-all shadow-sm cursor-pointer hover:-translate-y-0.5 ${hoverBorder}`}>
         <span className={`flex-1 text-xl font-black uppercase tracking-tight truncate ${alignClass}`}>{value || 'SELECIONE'}</span>
         <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] animate-[fadeInUp_0.2s_ease-out_forwards] origin-top z-[999999]">
          <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm">
             <input type="text" placeholder={`BUSCAR ${type === 'TEAMS' ? 'TIME' : 'JOGADOR'}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl outline-none focus:border-blue-500 transition-colors shadow-inner" autoFocus />
          </div>
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-2">
             {filteredOptions.length > 0 ? filteredOptions.map((opt: any) => {
                const label = getLabel(opt);
                return (
                <button key={opt.id || label} onClick={() => { onChange(label); setIsOpen(false); setSearch(""); }} className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 rounded-xl transition-all ${value === label ? 'bg-zinc-800/80' : ''}`}>
                   <img src={getImg(opt) || `https://ui-avatars.com/api/?name=${label}&background=18181b&color=3b82f6&bold=true`} alt={label} className={`w-6 h-6 object-cover drop-shadow-md bg-zinc-950 p-0.5 border border-zinc-800 ${type === 'TEAMS' ? 'rounded-lg' : 'rounded-full'}`} />
                   <span className={`text-[11px] font-black uppercase tracking-wide truncate ${value === label ? 'text-white' : 'text-zinc-400'}`}>{label}</span>
                </button>
             ) }) : <div className="text-center text-[9px] font-bold tracking-widest text-zinc-600 py-6 uppercase">Não encontrado</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentMultiSelector({ value, onChange }: { value: string[], onChange: (val: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

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
        { id: 'LEC CUP', label: 'LEC CUP' },
        { id: 'SCRIM', label: 'SCRIMS' }
      ]
    }
  ];

  const toggleOption = (id: string) => {
    if (id === 'ALL') { onChange(['ALL']); return; }
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
      ? TOURNAMENT_GROUPS.flatMap(g => g.options).find(o => o.id === value[0])?.label 
      : `${value.length} SEL.`;

  return (
    <div className="relative flex flex-col z-[99999]" ref={ref}>
      <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">ESCOPO DE LIGA</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[200px] transition-colors text-[10px] font-black uppercase tracking-widest shadow-sm h-[34px] ${value.includes('ALL') ? 'border-zinc-800 text-zinc-300 hover:border-zinc-600' : 'border-blue-500/50 text-blue-400 hover:border-blue-400'}`}
      >
        <ListFilter size={12} className={value.includes('ALL') ? 'text-zinc-500' : 'text-blue-500'} />
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180 text-blue-500' : 'text-zinc-500'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[260px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-[999999] max-h-[400px] flex flex-col animate-[fadeInUp_0.2s_ease-out_forwards]">
          <button 
            onClick={() => { onChange(['ALL']); setIsOpen(false); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-zinc-800 shrink-0 ${value.includes('ALL') ? 'bg-blue-600/10 text-blue-400' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
          >
             <div className={`w-3 h-3 rounded flex items-center justify-center border ${value.includes('ALL') ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                {value.includes('ALL') && <span className="text-white text-[8px] font-black">✓</span>}
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest">TODAS AS LIGAS</span>
          </button>

          <div className="overflow-y-auto custom-scrollbar">
            {TOURNAMENT_GROUPS.map((group, gIndex) => (
              <div key={group.label} className={gIndex > 0 ? "border-t border-zinc-800/50" : ""}>
                <div className="px-4 py-2 bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
                   <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{group.label}</span>
                </div>
                {group.options.map((opt) => {
                  const isSelected = value.includes(opt.id);
                  return (
                    <button 
                      key={opt.id} 
                      onClick={() => toggleOption(opt.id)} 
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors ${isSelected ? 'bg-zinc-800/50 text-white' : 'text-zinc-400'}`}
                    >
                      <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                         {isSelected && <span className="text-white text-[8px] font-black">✓</span>}
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest">{opt.label}</span>
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
  const isHighlighted = value !== 'ALL' && value !== 'CUSTOM';
  
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