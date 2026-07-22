"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';

// --- CONFIGURAÇÕES GERAIS ---
const DDRAGON_VERSION = '16.1.1'; 
const ROLES_ORDER = ['top', 'jng', 'mid', 'adc', 'support'];
const MAP_OFFSET = 3.5; 
const MAP_SCALE = 93;   
const GAME_MAX = 15000; 
const DEFAULT_AVATAR = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";

const SEQUENCE_LABELS: { [key: number]: string } = {
  1: 'bb1', 2: 'rb1', 3: 'bb2', 4: 'rb2', 5: 'bb3', 6: 'rb3',
  7: 'b1', 8: 'r1', 9: 'r2', 10: 'b2', 11: 'b3', 12: 'r3',
  13: 'rb4', 14: 'bb4', 15: 'rb5', 16: 'bb5',
  17: 'r4', 18: 'b4', 19: 'b5', 20: 'r5'
};

const OBJECTIVE_LABELS: { [key: string]: string } = {
  'lvl1': '🔥 LEVEL 1 (0-1:00)',
  'dragon1': 'Dragão 1', 'horde': 'Vastilarvas', 'dragon2': 'Dragão 2', 'riftherald': 'Arauto',
  'dragon3': 'Dragão 3', 'dragon4': 'Dragão 4', 'BARON_NASHOR': 'Barão Nashor', 'dragon5': 'Ancião/D5'
};

const BASE_ICON_URL = "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons";
const BASE_ANNOUNCE_URL = "https://raw.communitydragon.org/latest/game/assets/ux/announcements";

const OBJECTIVE_ASSETS: { [key: string]: { icon: string, hover: string } } = {
  'lvl1': { icon: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/3340.png`, hover: '' },
  'dragon1': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon2': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon3': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon4': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon5': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/elder_circle.png` },
  'horde': { icon: `${BASE_ICON_URL}/grub.png`, hover: `${BASE_ANNOUNCE_URL}/sru_voidgrub_circle.png` },
  'riftherald': { icon: `${BASE_ICON_URL}/riftherald.png`, hover: `${BASE_ANNOUNCE_URL}/sruriftherald_circle.png` },
  'BARON_NASHOR': { icon: `${BASE_ICON_URL}/baron.png`, hover: `${BASE_ANNOUNCE_URL}/baron_circle.png` },
};

const ORDERED_OBJECTIVES = ['lvl1', 'dragon1', 'horde', 'dragon2', 'riftherald', 'dragon3', 'dragon4', 'BARON_NASHOR', 'dragon5'];

// --- CLASSIFICADOR DE CAMPEONATOS (TRADUTOR UI -> BANCO) ---
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

function formatTime(decimal: number) {
  if (isNaN(decimal) || decimal === null) return "00:00";
  const mins = Math.floor(decimal);
  const secs = Math.round((decimal - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeRole(lane: string | null): string {
  if (!lane) return 'unknown'; 
  const l = String(lane).toLowerCase().trim();
  if (l.includes('top')) return 'top';
  if (l.includes('jungle') || l.includes('jng') || l === 'jg' || l.includes('jug')) return 'jng';
  if (l.includes('mid')) return 'mid';
  if (l.includes('bot') || l.includes('adc')) return 'adc';
  if (l.includes('sup') || l.includes('utility')) return 'support';
  return 'unknown'; 
}

function normalizeChampName(name: string | null): string {
  if (!name) return 'unknown';
  let n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'wukong') return 'monkeyking';
  if (n === 'renataglasc') return 'renata';
  if (n.includes('nunu')) return 'nunu';
  return n;
}

function sortPlayersByRole(playersArray: any[]) {
  return [...playersArray].sort((a, b) => {
    const roleA = normalizeRole(a.primary_role);
    const roleB = normalizeRole(b.primary_role);
    return ROLES_ORDER.indexOf(roleA) - ROLES_ORDER.indexOf(roleB);
  });
}

function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777') return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

function getChampionCenteredUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  // Puxa o diretório "centered" que contém os recortes horizontais oficiais
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

function getScoreColor(score: number | null) {
  if (!score) return "text-zinc-600";
  if (score >= 90) return "text-purple-500"; 
  if (score >= 80) return "text-blue-500";     
  if (score >= 70) return "text-emerald-500"; 
  if (score >= 60) return "text-amber-500";  
  return "text-red-500";                                  
}

function getRoleIcon(role: string, size: string = "w-5 h-5") {
  const basePath = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions";
  let iconName = "";
  const normalizedRole = normalizeRole(role); 
  switch (normalizedRole) {
    case 'top': iconName = "icon-position-top.png"; break;
    case 'jng': iconName = "icon-position-jungle.png"; break;
    case 'mid': iconName = "icon-position-middle.png"; break;
    case 'adc': iconName = "icon-position-bottom.png"; break; 
    case 'support': iconName = "icon-position-utility.png"; break;
    default: return <span className="text-[12px] font-black text-zinc-600">?</span>;
  }
  return <img src={`${basePath}/${iconName}`} alt={normalizedRole} className={`${size} object-contain brightness-200 opacity-80`} />;
}

// --- COMPONENTE PRINCIPAL ---

export default function PlayersHubPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("TODOS");
  const [isAdmin, setIsAdmin] = useState(false);

  const [recentStarters, setRecentStarters] = useState<string[]>([]);
  
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(["CIRCUITO DESAFIANTE"]);
  const [globalSplit, setGlobalSplit] = useState("ALL");
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [validSplitsMap, setValidSplitsMap] = useState<Record<string, string[]>>({});
  const [scopeToRawMap, setScopeToRawMap] = useState<Record<string, string[]>>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const [leaderboardTab, setLeaderboardTab] = useState<string>("GLOBAL");

  const [teamChartData, setTeamChartData] = useState<any[]>([]);
  const [teamObjectiveWindows, setTeamObjectiveWindows] = useState<any[]>([]);
  const [teamWards, setTeamWards] = useState<any[]>([]);
  const [draftStats, setDraftStats] = useState<any[]>([]);
  const [globalBans, setGlobalBans] = useState<Record<string, number>>({});
  const [draftViewMode, setDraftViewMode] = useState<'champion' | 'role'>('champion');

  const [heatmapSide, setHeatmapSide] = useState<string>("Blue");
  const [heatmapObjective, setHeatmapObjective] = useState<string>("lvl1");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ puuid: '', nickname: '', photo_url: '', primary_role: '' });
  
  const [teamsList, setTeamsList] = useState<any[]>([]); 
  const [statsDetailed, setStatsDetailed] = useState<any[]>([]);

  useEffect(() => { checkUserRole(); }, []);
  
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

  useEffect(() => { 
    if(isMapLoaded) fetchInitialData(); 
  }, [globalTournaments, globalSplit, startDate, endDate, isMapLoaded]);
  
  useEffect(() => { 
    if (filterTeam !== "TODOS" && isMapLoaded) { 
      fetchPerformanceData(filterTeam); 
      fetchAnalysisData(filterTeam); 
    } 
  }, [filterTeam, globalTournaments, globalSplit, startDate, endDate, isMapLoaded]);

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
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [globalTournaments, validSplitsMap]);

  useEffect(() => {
    if (globalSplit !== 'ALL' && dynamicAvailableSplits.length > 0 && !dynamicAvailableSplits.includes(globalSplit)) {
      setGlobalSplit('ALL');
    }
  }, [dynamicAvailableSplits, globalSplit]);

  async function checkUserRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === 'scartiezin@gmail.com') setIsAdmin(true);
  }

  // --- FUNÇÃO DE SUPORTE: TRADUZ O FILTRO DO UI PARA O BANCO DE DADOS ---
  const getRawGameTypes = () => {
    if (globalTournaments.includes('ALL')) return [];
    const raws = new Set<string>();
    globalTournaments.forEach(t => {
      if (scopeToRawMap[t]) scopeToRawMap[t].forEach(r => raws.add(r));
    });
    return Array.from(raws);
  };

  async function fetchInitialData() {
    setLoading(true);
    
    const rawTypes = getRawGameTypes();

    let query = supabase.from('bff_hub_players_roster').select('*');
    // Aumentamos o limite para garantir uma amostragem global de bans real
    let banQuery = supabase.from('bff_matches_bans').select('*').limit(2000); 
    let matchCountQuery = supabase.from('bff_matches_history').select('match_id', { count: 'exact', head: true });

    // 1. Aplica o filtro de Split diretamente no Supabase
    if (globalSplit !== 'ALL') {
      query = query.ilike('split', globalSplit); 
      banQuery = banQuery.ilike('split', globalSplit); 
      matchCountQuery = matchCountQuery.ilike('split', globalSplit);
    }

    // 2. Aplica o filtro de Data (Recorte Temporal)
    if (startDate) {
      banQuery = banQuery.gte('game_start_time', `${startDate} 00:00:00`);
      matchCountQuery = matchCountQuery.gte('game_start_time', `${startDate} 00:00:00`);
    }
    if (endDate) {
      banQuery = banQuery.lte('game_start_time', `${endDate} 23:59:59`);
      matchCountQuery = matchCountQuery.lte('game_start_time', `${endDate} 23:59:59`);
    }

    // 3. Aplica o filtro de Escopo de Liga (Torneios)
    if (rawTypes.length > 0) {
      query = query.in('game_type', rawTypes);
      banQuery = banQuery.in('game_type', rawTypes);
      matchCountQuery = matchCountQuery.in('game_type', rawTypes);
    }

    const [pRes, tRes, bansRes, matchCountRes, playersTableRes] = await Promise.all([
      query,
      supabase.from('bff_matches_teams').select('*').order('acronym'),
      banQuery,
      matchCountQuery,
      supabase.from('players').select('puuid, photo_url') 
    ]);

    const t = tRes.data || [];
    const pRaw = pRes.data || [];
    
    // O JS filter continua aqui por segurança redobrada
    const p = pRaw.filter((curr: any) => {
      if (globalTournaments.includes('ALL')) return true;
      const normalized = normalizeTournamentScope(curr.game_type);
      return globalTournaments.includes(normalized);
    });
    
    const photoMap: Record<string, string> = {};
    if (playersTableRes.data) {
      playersTableRes.data.forEach((pl: any) => {
         if (pl.photo_url) photoMap[pl.puuid] = pl.photo_url;
      });
    }

    const uniqueTeamsMap = new Map();
    t.forEach((team: any) => {
      const upperAcr = String(team.acronym || '').toUpperCase().trim();
      if (!upperAcr) return;
      if (!uniqueTeamsMap.has(upperAcr)) {
        uniqueTeamsMap.set(upperAcr, { ...team, acronym: upperAcr });
      } else if (team.logo_url && !uniqueTeamsMap.get(upperAcr).logo_url) {
        uniqueTeamsMap.set(upperAcr, { ...team, acronym: upperAcr });
      }
    });
    const allUniqueTeams = Array.from(uniqueTeamsMap.values());

    const groupedPlayersMap = new Map();
    p.forEach((curr: any) => {
      const safeAcr = String(curr.team_acronym || '').toUpperCase().trim();
      if (!groupedPlayersMap.has(curr.puuid)) {
        groupedPlayersMap.set(curr.puuid, { 
          ...curr, 
          team_acronym: safeAcr, 
          count: 1,
          photo_url: photoMap[curr.puuid] || null 
        });
      } else {
        const acc = groupedPlayersMap.get(curr.puuid);
        const totalGames = acc.games_played + curr.games_played;
        if (totalGames > 0) {
          acc.median_lane = ((acc.median_lane * acc.games_played) + (curr.median_lane * curr.games_played)) / totalGames;
          acc.median_impact = ((acc.median_impact * acc.games_played) + (curr.median_impact * curr.games_played)) / totalGames;
          acc.median_conversion = ((acc.median_conversion * acc.games_played) + (curr.median_conversion * curr.games_played)) / totalGames;
          acc.median_vision = ((acc.median_vision * acc.games_played) + (curr.median_vision * curr.games_played)) / totalGames;
        }
        acc.games_played = totalGames;
        acc.count += 1;
      }
    });

    const aggregatedPlayers = Array.from(groupedPlayersMap.values());

    let maxMvpScore = -1;
    let mvpPuuid = null;
    aggregatedPlayers.forEach((player: any) => {
      player.mvp_score = (player.median_lane + player.median_impact + player.median_conversion + player.median_vision) / 4;
      if (player.mvp_score > maxMvpScore && player.games_played > 0) {
        maxMvpScore = player.mvp_score;
        mvpPuuid = player.puuid;
      }
    });
    aggregatedPlayers.forEach((player: any) => player.is_mvp = player.puuid === mvpPuuid);

    setPlayers(aggregatedPlayers);

    const activeTeamTags = new Set(aggregatedPlayers.map(pl => pl.team_acronym));
    const filteredTeams = allUniqueTeams.filter((team: any) => activeTeamTags.has(team.acronym));
    
    setTeams(filteredTeams);
    setTeamsList(allUniqueTeams);

    setFilterTeam(prev => {
      if (prev !== "TODOS" && !activeTeamTags.has(prev)) return "TODOS";
      return prev;
    });

    if (bansRes.data) {
       const validBans = bansRes.data.filter((curr: any) => {
          if (globalTournaments.includes('ALL')) return true;
          return globalTournaments.includes(normalizeTournamentScope(curr.game_type));
       });

       const totalMatches = matchCountRes.count || 1;
       const banMap: Record<string, number> = {};
       validBans.forEach((b: any) => {
          const rate = (Number(b.total_bans) / totalMatches) * 100;
          banMap[normalizeChampName(b.champion)] = Number(rate.toFixed(1));
       });
       setGlobalBans(banMap);
    }

    const { data: sDetailed } = await supabase.from('core_player_stats').select('puuid, champion, team_tag, lane, role').limit(50000);
    if (sDetailed) setStatsDetailed(sDetailed);

    setLoading(false);
  }

  async function fetchPerformanceData(team: string) {
    let query = supabase.from('bff_hub_performance').select('*').ilike('team_acronym', team).order('game_start_time', { ascending: true }).limit(5000);
    const rawTypes = getRawGameTypes();

    if (globalSplit !== 'ALL') query = query.ilike('split', globalSplit); 
    if (startDate) query = query.gte('game_start_time', `${startDate} 00:00:00`);
    if (endDate) query = query.lte('game_start_time', `${endDate} 23:59:59`);
    if (rawTypes.length > 0) query = query.in('game_type', rawTypes);

    const { data } = await query;
    if (data) {
      const validData = data.filter((curr: any) => {
        if (globalTournaments.includes('ALL')) return true;
        const normalized = normalizeTournamentScope(curr.game_type);
        return globalTournaments.includes(normalized);
      });

      const matchIds = validData.map((m: any) => m.match_id);
      if (matchIds.length > 0) {
        const { data: champData } = await supabase
          .from('core_player_stats')
          .select('match_id, team_tag, champion')
          .in('match_id', matchIds);
          
        if (champData) {
          validData.forEach((match: any) => {
             match.team_picks = champData
                .filter((c: any) => c.match_id === match.match_id && String(c.team_tag).toUpperCase() === String(team).toUpperCase())
                .map((c: any) => c.champion);
             
             match.opp_picks = champData
                .filter((c: any) => c.match_id === match.match_id && String(c.team_tag).toUpperCase() !== String(team).toUpperCase())
                .map((c: any) => c.champion);
          });
        }
      }

      setTeamChartData(validData);

      const last5Matches = validData.slice(-5).map((m: any) => m.match_id);
      
      if (last5Matches.length > 0) {
        const { data: recentStats } = await supabase
          .from('core_player_stats')
          .select('puuid')
          .in('match_id', last5Matches)
          .ilike('team_tag', team);

        if (recentStats) {
          const counts: Record<string, number> = {};
          recentStats.forEach((r: any) => {
            if (r.puuid) counts[r.puuid] = (counts[r.puuid] || 0) + 1;
          });

          const top5Puuids = Object.entries(counts)
            .sort((a, b) => b[1] - a[1]) 
            .slice(0, 5) 
            .map(entry => entry[0]);
            
          setRecentStarters(top5Puuids);
        } else {
          setRecentStarters([]);
        }
      } else {
        setRecentStarters([]);
      }
    }
  }

  async function fetchAnalysisData(team: string) {
    // 1. Limpamos os estados imediatamente! Isso garante que a tela dê um 
    // "refresh visual" quando você mudar o filtro, provando que funcionou.
    setDraftStats([]);
    setTeamObjectiveWindows([]);
    setTeamWards([]);

    // 2. Buscamos a base do time sem filtros complexos de SQL para evitar crash
    let objQuery = supabase.from('bff_hub_objectives').select('*').ilike('team_acronym', team).limit(15000);
    let draftQuery = supabase.from('bff_hub_draft').select('*').ilike('team_acronym', team).limit(15000);

    const [obj, draft] = await Promise.all([objQuery, draftQuery]);
    
    // --- PROCESSAMENTO DE OBJETIVOS ---
    if (obj.data) {
      const validObjs = obj.data.filter((curr: any) => {
        // Filtro de Torneio (Escopo de Liga)
        if (!globalTournaments.includes('ALL') && !globalTournaments.includes(normalizeTournamentScope(curr.game_type))) return false;
        // Filtro de Split
        if (globalSplit !== 'ALL' && curr.split && String(curr.split).toUpperCase() !== globalSplit.toUpperCase()) return false;
        // Filtro de Data In-Memory
        if (startDate && curr.game_start_time && new Date(curr.game_start_time) < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && curr.game_start_time && new Date(curr.game_start_time) > new Date(`${endDate}T23:59:59`)) return false;
        return true;
      });

      const groupedObjMap = new Map();
      validObjs.forEach((curr: any) => {
        const normSide = String(curr.side || '').toLowerCase() === '100' ? 'blue' : String(curr.side || '').toLowerCase() === '200' ? 'red' : String(curr.side || '').toLowerCase();
        const key = `${String(curr.objective_type).toLowerCase()}_${normSide}`;
        
        if (!groupedObjMap.has(key)) {
          groupedObjMap.set(key, { ...curr, count: 1, side: normSide });
        } else {
          const acc = groupedObjMap.get(key);
          acc.min_minute = Math.min(acc.min_minute, Number(curr.min_minute) || Infinity);
          acc.max_minute = Math.max(acc.max_minute, Number(curr.max_minute) || 0);
          acc.avg_minute = ((acc.avg_minute * acc.count) + (Number(curr.avg_minute) || 0)) / (acc.count + 1);
          acc.count += 1;
        }
      });
      setTeamObjectiveWindows(Array.from(groupedObjMap.values()));
    }

    // --- PROCESSAMENTO DE DRAFTS ---
    if (draft.data) {
      const validDrafts = draft.data.filter((curr: any) => {
        // Mesma lógica de filtragem à prova de falhas para os Drafts
        if (!globalTournaments.includes('ALL') && !globalTournaments.includes(normalizeTournamentScope(curr.game_type))) return false;
        if (globalSplit !== 'ALL' && curr.split && String(curr.split).toUpperCase() !== globalSplit.toUpperCase()) return false;
        if (startDate && curr.game_start_time && new Date(curr.game_start_time) < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && curr.game_start_time && new Date(curr.game_start_time) > new Date(`${endDate}T23:59:59`)) return false;
        return true;
      });

      const groupedDraftMap = new Map();
      validDrafts.forEach((curr: any) => {
        const safeType = String(curr.type || '').toUpperCase().trim();
        const key = `${curr.sequence}_${curr.champion}_${safeType}`;
        
        if (!groupedDraftMap.has(key)) {
          groupedDraftMap.set(key, { ...curr, type: safeType });
        } else {
          const acc = groupedDraftMap.get(key);
          const cTotal = Number(curr.total_count) || 1; 
          const aTotal = Number(acc.total_count) || 0;
          const total = aTotal + cTotal;
          
          if (total > 0) {
            acc.win_rate = ((Number(acc.win_rate || 0) * aTotal) + (Number(curr.win_rate || 0) * cTotal)) / total;
            if(curr.avg_lane) acc.avg_lane = ((Number(acc.avg_lane || 0) * aTotal) + (Number(curr.avg_lane || 0) * cTotal)) / total;
            if(curr.avg_impact) acc.avg_impact = ((Number(acc.avg_impact || 0) * aTotal) + (Number(curr.avg_impact || 0) * cTotal)) / total;
            if(curr.avg_conv) acc.avg_conv = ((Number(acc.avg_conv || 0) * aTotal) + (Number(curr.avg_conv || 0) * cTotal)) / total;
            if(curr.avg_vision) acc.avg_vision = ((Number(acc.avg_vision || 0) * aTotal) + (Number(curr.avg_vision || 0) * cTotal)) / total;
          }
          acc.total_count = total;
        }
      });
      setDraftStats(Array.from(groupedDraftMap.values()));
    }
    
    // --- PROCESSAMENTO DE VISÃO (WARDS) ---
    let allWards: any[] = [];
    let fetchMore = true;
    let from = 0;
    const step = 1000;

    while (fetchMore) {
      const { data: wardsChunk, error } = await supabase
        .from('bff_hub_vision')
        .select('*')
        .ilike('team_acronym', team)
        .range(from, from + step - 1);

      if (error || !wardsChunk || wardsChunk.length === 0) {
        fetchMore = false;
      } else {
        const validWards = wardsChunk.filter((curr: any) => {
          if (!globalTournaments.includes('ALL') && !globalTournaments.includes(normalizeTournamentScope(curr.game_type))) return false;
          if (globalSplit !== 'ALL' && curr.split && String(curr.split).toUpperCase() !== globalSplit.toUpperCase()) return false;
          if (startDate && curr.game_start_time && new Date(curr.game_start_time) < new Date(`${startDate}T00:00:00`)) return false;
          if (endDate && curr.game_start_time && new Date(curr.game_start_time) > new Date(`${endDate}T23:59:59`)) return false;
          return true;
        });

        allWards = [...allWards, ...validWards];
        from += step;
        
        if (wardsChunk.length < step) {
          fetchMore = false;
        }
      }
    }
    setTeamWards(allWards);
  }

  const sideStatsData = useMemo(() => {
    if (filterTeam === "TODOS" || teamChartData.length === 0) return null;
    const stats = { blue: { g: 0, w: 0, l: 0, i: 0, c: 0, v: 0 }, red: { g: 0, w: 0, l: 0, i: 0, c: 0, v: 0 } };
    teamChartData.forEach(m => {
      const target = String(m.side || '').toUpperCase() === 'BLUE' ? stats.blue : stats.red;
      target.g++; if (m.win_status === 'W') target.w++;
      target.l += (m.avg_lane || 0); target.i += (m.avg_impact || 0); target.c += (m.avg_conversion || 0); target.v += (m.avg_vision || 0);
    });
    return [
      { name: 'Blue', value: stats.blue.g, wr: stats.blue.g > 0 ? Math.round((stats.blue.w / stats.blue.g) * 100) : 0, fill: '#3b82f6', ratings: { lane: stats.blue.l / stats.blue.g, impact: stats.blue.i / stats.blue.g, conv: stats.blue.c / stats.blue.g, vision: stats.blue.v / stats.blue.g } },
      { name: 'Red', value: stats.red.g, wr: stats.red.g > 0 ? Math.round((stats.red.w / stats.red.g) * 100) : 0, fill: '#ef4444', ratings: { lane: stats.red.l / stats.red.g, impact: stats.red.i / stats.red.g, conv: stats.red.c / stats.red.g, vision: stats.red.v / stats.red.g } }
    ].filter(s => s.value > 0);
  }, [teamChartData, filterTeam]);

  const activeWards = useMemo(() => {
    const targetSide = String(heatmapSide).toLowerCase(); 
    const targetObj = String(heatmapObjective).toLowerCase();
    
    let wardsToDisplay = teamWards.filter(w => {
       const wSide = String(w.side || '').toLowerCase() === '100' ? 'blue' : String(w.side || '').toLowerCase() === '200' ? 'red' : String(w.side || '').toLowerCase();
       return wSide === targetSide;
    });

    if (targetObj === 'lvl1') {
       return wardsToDisplay.filter(w => Number(w.minute) >= 0 && Number(w.minute) <= 1);
    }

    const window = teamObjectiveWindows.find(o => String(o.side).toLowerCase() === targetSide && String(o.objective_type).toLowerCase() === targetObj);
    
    if (window) {
       const wMin = Number(window.min_minute) || 0;
       const wMax = Number(window.max_minute) || 0;
       wardsToDisplay = wardsToDisplay.filter(w => Number(w.minute) >= (wMin - 2) && Number(w.minute) <= (wMax + 1));
    } else {
       let min = 0, max = 15;
       if (targetObj === 'dragon1' || targetObj === 'horde') { min = 4; max = 9; }
       else if (targetObj === 'dragon2' || targetObj === 'riftherald') { min = 9; max = 16; }
       else if (targetObj === 'dragon3') { min = 15; max = 22; }
       else if (targetObj === 'dragon4') { min = 21; max = 28; }
       else if (targetObj === 'baron_nashor') { min = 20; max = 35; }
       else if (targetObj === 'dragon5') { min = 28; max = 45; }
       
       wardsToDisplay = wardsToDisplay.filter(w => Number(w.minute) >= min && Number(w.minute) <= max);
    }
    return wardsToDisplay;
  }, [teamWards, heatmapSide, heatmapObjective, teamObjectiveWindows]);

  const mostPickedOverall = useMemo(() => {
    const counts = draftStats.reduce((acc: any, curr) => {
      if (String(curr.type || '').toUpperCase() === 'PICK') { 
        if (!acc[curr.champion]) acc[curr.champion] = { name: curr.champion, count: 0, wins: 0 };
        const count = Number(curr.total_count) || 1;
        acc[curr.champion].count += count;
        acc[curr.champion].wins += (count * ((Number(curr.win_rate) || 0) / 100));
      }
      return acc;
    }, {});
    return Object.values(counts).sort((a: any, b: any) => b.count - a.count).slice(0, 5);
  }, [draftStats]);

  const draftAssignments = useMemo(() => {
    const assignments: { [key: number]: any } = {};
    
    for (let seq = 1; seq <= 20; seq++) {
      const isBan = [1,2,3,4,5,6,13,14,15,16].includes(seq);
      const expectedType = isBan ? 'BAN' : 'PICK';
      
      const records = draftStats.filter(d => Number(d.sequence) === seq && String(d.type || '').toUpperCase() === expectedType);
      
      if (records.length > 0) {
        if (draftViewMode === 'role' && !isBan) {
          const roleMap: any = {};
          records.forEach(r => {
             let rawRole = r.role || r.lane;
             if (!rawRole) {
                const champStats = statsDetailed.find((s: any) => 
                   normalizeChampName(s.champion) === normalizeChampName(r.champion) && 
                   String(s.team_tag).toUpperCase() === filterTeam.toUpperCase()
                );
                if (champStats) rawRole = champStats.role || champStats.lane;
             }
             
             const rKey = normalizeRole(rawRole); 
             if (rKey === 'unknown') return; 

             if(!roleMap[rKey]) roleMap[rKey] = { name: rKey, count: 0, wrSum: 0, laneSum:0, impSum:0, convSum:0, visSum:0 };
             const rCount = Number(r.total_count) || 1;
             roleMap[rKey].count += rCount;
             roleMap[rKey].wrSum += ((Number(r.win_rate) || 0) * rCount);
             roleMap[rKey].laneSum += ((Number(r.avg_lane) || 0) * rCount);
             roleMap[rKey].impSum += ((Number(r.avg_impact) || 0) * rCount);
             roleMap[rKey].convSum += ((Number(r.avg_conv) || 0) * rCount);
             roleMap[rKey].visSum += ((Number(r.avg_vision) || 0) * rCount);
          });
          
          const sorted = Object.values(roleMap).sort((a: any, b: any) => b.count - a.count);
          if (sorted.length > 0) {
             const top = sorted[0] as any;
             assignments[seq] = { 
               name: top.name, 
               wr: top.count > 0 ? top.wrSum / top.count : 0, 
               count: top.count, 
               image: null, 
               splash: null,
               ratings: top.count > 0 ? { lane: top.laneSum/top.count, impact: top.impSum/top.count, conv: top.convSum/top.count, vision: top.visSum/top.count } : null 
             };
          }
        } else {
          const champMap: any = {};
          records.forEach(r => {
             const cKey = r.champion;
             if(!champMap[cKey]) champMap[cKey] = { name: cKey, count: 0, wrSum: 0, laneSum:0, impSum:0, convSum:0, visSum:0 };
             const rCount = Number(r.total_count) || 1;
             champMap[cKey].count += rCount;
             champMap[cKey].wrSum += ((Number(r.win_rate) || 0) * rCount);
             champMap[cKey].laneSum += ((Number(r.avg_lane) || 0) * rCount);
             champMap[cKey].impSum += ((Number(r.avg_impact) || 0) * rCount);
             champMap[cKey].convSum += ((Number(r.avg_conv) || 0) * rCount);
             champMap[cKey].visSum += ((Number(r.avg_vision) || 0) * rCount);
          });
          const top = Object.values(champMap).sort((a: any, b: any) => b.count - a.count)[0] as any;
          if (top) {
            assignments[seq] = { 
              name: top.name, 
              wr: top.count > 0 ? top.wrSum / top.count : 0, 
              count: top.count, 
              image: getChampionImageUrl(top.name), 
              splash: getChampionSplashUrl(top.name),
              ratings: top.count > 0 ? { lane: top.laneSum/top.count, impact: top.impSum/top.count, conv: top.convSum/top.count, vision: top.visSum/top.count } : null 
            };
          }
        }
      }
    }
    return assignments;
  }, [draftStats, draftViewMode, statsDetailed, filterTeam]);

  const boxPlotData = useMemo(() => ORDERED_OBJECTIVES.filter(k => k !== 'lvl1').map(objKey => {
    const targetSide = String(heatmapSide).toLowerCase();
    const s = teamObjectiveWindows.find(o => 
       String(o.objective_type || '').toLowerCase() === String(objKey).toLowerCase() && 
       String(o.side || '').toLowerCase() === targetSide
    );
    const assets = OBJECTIVE_ASSETS[objKey];
    
    return { 
        name: OBJECTIVE_LABELS[objKey], 
        key: objKey, 
        ...(s ? { window: [Number(s.min_minute), Number(s.max_minute)], avg: Number(s.avg_minute) } : {}),
        icon: assets?.icon, 
        hoverImg: assets?.hover 
    };
  }).filter(Boolean), [teamObjectiveWindows, heatmapSide]);

  const leaderboardPlayers = useMemo(() => {
    let targetPlayers = [...players];
    if (leaderboardTab !== 'GLOBAL') {
      targetPlayers = targetPlayers.filter(p => normalizeRole(p.primary_role) === leaderboardTab.toLowerCase());
    }
    return targetPlayers.sort((a, b) => (b.mvp_score || 0) - (a.mvp_score || 0));
  }, [players, leaderboardTab]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSaving(true);
    
    try {
      await supabase.from('players').upsert({ 
        puuid: editForm.puuid,
        nickname: editForm.nickname, 
        photo_url: editForm.photo_url, 
        primary_role: editForm.primary_role 
      });

      setIsEditModalOpen(false); 
      fetchInitialData();
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeletePlayer = async (puuid: string) => {
    if (!confirm("Remover as personalizações deste jogador? (Isso restaurará a foto e nome originais da API)")) return;
    
    await supabase.from('players').delete().eq('puuid', puuid); 
    setIsEditModalOpen(false); 
    await fetchInitialData();
  };

  if (loading && players.length === 0) return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-4">
      <div className="w-10 h-10 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">Estabelecendo Conexão Tática...</p>
    </div>
  );

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-8 space-y-12 font-sans pb-20 overflow-visible relative">
      
      {/* Sticky Header com Backdrop Blur e Filtros Adicionados */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800 pb-4 pt-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-[999] rounded-b-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] px-2 -mx-2">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight">SCOUTING <span className="text-blue-500">HUB</span></h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-2 uppercase">DATABASE: {players.length} ACTIVE OPERATIVES</p>
        </div>

        <div className="flex gap-4 items-end bg-transparent flex-wrap xl:flex-nowrap justify-start xl:justify-end">
           <div className="flex flex-col">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">PERÍODO PERSONALIZADO</label>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 h-[34px] transition-colors hover:border-zinc-600 shadow-sm">
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                 <span className="text-zinc-600 text-[10px] font-black uppercase">ATÉ</span>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
              </div>
           </div>
           <TournamentMultiSelector value={globalTournaments} onChange={setGlobalTournaments} />
           <SplitSelector value={globalSplit} onChange={setGlobalSplit} availableSplits={dynamicAvailableSplits} />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-[100] overflow-visible mt-8">
        <div className="flex flex-wrap justify-start gap-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800 max-w-full overflow-x-auto custom-scrollbar flex-1">
          <button onClick={() => setFilterTeam("TODOS")} className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterTeam === "TODOS" ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>TODOS</button>
          {teams.map(t => (
            <button key={t.acronym} onClick={() => setFilterTeam(t.acronym)} className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${filterTeam === t.acronym ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 object-contain" />}{t.acronym}
            </button>
          ))}
        </div>

        {filterTeam !== "TODOS" && sideStatsData && (
          <div className="flex items-center gap-6 bg-[#18181b] border border-zinc-800 p-4 rounded-xl shadow-sm transition-all overflow-visible shrink-0">
              <div className="w-14 h-14 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sideStatsData} innerRadius={18} outerRadius={26} paddingAngle={5} dataKey="value" stroke="none">
                      {sideStatsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[8px] text-zinc-300 font-bold">{teamChartData.length}G</div>
              </div>
              <div className="flex flex-col gap-1.5">
                {sideStatsData.map(side => (
                  <div key={side.name} className="flex items-center gap-2">
                    <div className={`w-1 h-3 rounded-full ${side.name === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-black ${side.wr >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{side.wr}% WR</span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">{side.value} JOGOS</span>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}
      </div>

      {filterTeam === "TODOS" ? (
        <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b border-zinc-800 pb-6 shrink-0">
            <div>
              <h2 className="text-xl text-white font-black uppercase tracking-tight flex items-center gap-3">
                <span className="text-yellow-400">🏆</span> POWER RANKINGS
              </h2>
              <p className="text-[10px] text-zinc-500 tracking-widest font-bold mt-1 uppercase">Algoritmo de Eficiência Tática</p>
            </div>

            <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800 overflow-x-auto max-w-full custom-scrollbar">
              <button 
                onClick={() => setLeaderboardTab('GLOBAL')} 
                className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${leaderboardTab === 'GLOBAL' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ★ GLOBAL
              </button>
              {ROLES_ORDER.map(role => (
                <button 
                  key={role} 
                  onClick={() => setLeaderboardTab(role.toUpperCase())} 
                  className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${leaderboardTab === role.toUpperCase() ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <span className="opacity-70">{getRoleIcon(role, "w-3 h-3")}</span> {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {leaderboardPlayers.length === 0 ? (
              <div className="text-center py-20 text-zinc-600 text-xs tracking-widest font-bold uppercase">Nenhum operativo encontrado no filtro.</div>
            ) : (
              leaderboardPlayers.map((p, index) => {
                const isTop1 = index === 0;
                const team = teamsList.find((t: any) => t.acronym.toUpperCase() === p.team_acronym.toUpperCase());
                const roleIcon = getRoleIcon(String(p.primary_role), "w-3 h-3");
                
                return (
                  <Link 
                    key={p.puuid} 
                    href={`/dashboard/players/${p.puuid}`} 
                    className={`flex flex-col md:flex-row items-center p-4 rounded-xl border transition-colors group relative overflow-hidden ${isTop1 ? 'bg-yellow-400/10 border-yellow-400/30 hover:border-yellow-400/60' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}
                  >
                    {isTop1 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400" />}
                    
                    <div className="flex w-full md:w-auto items-center justify-between md:justify-start mb-4 md:mb-0">
                      <span className={`text-2xl font-black w-12 text-center ${isTop1 ? 'text-yellow-400 drop-shadow-md' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}`}>
                        #{index + 1}
                      </span>
                      
                      <div className="flex items-center gap-4 flex-1 md:w-[220px] ml-2">
                        <img src={p.photo_url || DEFAULT_AVATAR} className={`w-12 h-12 object-cover rounded-lg border-2 ${isTop1 ? 'border-yellow-400/50' : 'border-zinc-800'}`} alt="" />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-base font-black uppercase tracking-tight truncate ${isTop1 ? 'text-yellow-400' : 'text-zinc-300 group-hover:text-white transition-colors'}`}>{p.nickname}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {team?.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3 object-contain" />}
                            <span className="text-[9px] font-bold text-zinc-500 uppercase">{p.team_acronym}</span>
                            <span className="text-zinc-700">|</span>
                            {leaderboardTab === 'GLOBAL' && <span className="opacity-70">{roleIcon}</span>}
                            <span className="text-[9px] font-bold text-zinc-600">{p.games_played}G</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 w-full max-w-[500px] ml-auto mr-8 hidden md:grid grid-cols-4 gap-4 items-center">
                      <ProgressBar label="LANE" value={p.median_lane} />
                      <ProgressBar label="IMPACTO" value={p.median_impact} />
                      <ProgressBar label="CONV." value={p.median_conversion} />
                      <ProgressBar label="VISÃO" value={p.median_vision} />
                    </div>

                    <div className="flex flex-col items-end justify-center w-full md:w-20 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-zinc-800">
                      <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isTop1 ? 'text-yellow-400/70' : 'text-zinc-500'}`}>RATING</span>
                      <span className={`text-2xl font-black leading-none ${isTop1 ? 'text-yellow-400 drop-shadow-md' : getScoreColor(p.mvp_score)}`}>
                        {Math.round(p.mvp_score || 0)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* GRÁFICO PERFORMANCE ANALYTICS COM ESTÉTICA DE TERMINAL TÁTICO (SLIM & CLEAN) */}
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-5 h-[320px] shadow-2xl relative flex flex-col group">
            
            {/* Camadas de Fundo Isoladas (o overflow-hidden fica só aqui, para não cortar o Tooltip!) */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_70%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
            </div>

            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
               <div className="flex flex-col">
                 <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                   <div className="w-1.5 h-4 bg-blue-500 rounded-sm shadow-[0_0_10px_rgba(59,130,246,0.6)]" /> 
                   Performance Analytics
                 </h3>
                 <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 ml-3.5">
                   Rastreamento de Eficiência Contínua
                 </span>
               </div>
            </div>
            
            {/* Container Livre: Removemos o overflow-x-auto, sem scrollbars nativas! */}
            <div className="flex-1 min-h-0 relative z-10 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   {/* Margin ajustada para garantir espaço no topo e laterais */}
                   <LineChart data={teamChartData} margin={{ top: 20, right: 30, left: -25, bottom: 20 }}>
                     
                     <CartesianGrid stroke="#3f3f46" vertical={false} opacity={0.2} />
                     
                     {/* Padding Left e Right para os dados não grudarem nas quinas do card */}
                     <XAxis 
                       dataKey="match_id" 
                       tick={(p) => <CustomXAxisTick {...p} teamChartData={teamChartData} teamsList={teamsList} />} 
                       interval={0} 
                       stroke="#27272a" 
                       axisLine={false} 
                       tickLine={false} 
                       padding={{ left: 30, right: 30 }} 
                     />
                     
                     <YAxis domain={[40, 100]} tick={{ fill: '#71717a', fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                     
                     {/* Wrapper do Tooltip com zIndex infinito para sempre sobrepor as outras Divs */}
                     <Tooltip 
                       content={<CustomChartTooltip teamsList={teamsList} />} 
                       wrapperStyle={{ zIndex: 999999 }} 
                       cursor={{ stroke: '#52525b', strokeWidth: 2, strokeDasharray: '4 4' }} 
                     />
                     
                     <Legend 
                        verticalAlign="top" 
                        align="right" 
                        iconType="circle" 
                        wrapperStyle={{ top: -35, fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em' }} 
                     />
                     
                     <Line type="monotone" dataKey="avg_lane" name="LANE" stroke="#a855f7" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#a855f7', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(168,85,247,0.5))' }} />
                     <Line type="monotone" dataKey="avg_impact" name="IMPACTO" stroke="#3b82f6" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(59,130,246,0.5))' }} />
                     <Line type="monotone" dataKey="avg_conversion" name="CONV." stroke="#10b981" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#10b981', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(16,185,129,0.5))' }} />
                     <Line type="monotone" dataKey="avg_vision" name="VISÃO" stroke="#f59e0b" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: '#fff', stroke: '#f59e0b', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 4px 6px rgba(245,158,11,0.5))' }} />
                   </LineChart>
                 </ResponsiveContainer>
            </div>
          </div>

          <section className="pt-2">
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3">
              <div className="w-1.5 h-5 bg-blue-500 rounded-sm" /> 
              Tactical Operations Unit
            </h2>

            {(() => {
              const teamPlayers = sortPlayersByRole(players.filter(p => p.team_acronym === filterTeam));
              const maxTeamScore = Math.max(...teamPlayers.map(p => p.mvp_score || 0));
              
              let starters = [];
              let subs = [];

              if (recentStarters.length > 0) {
                 starters = teamPlayers.filter(p => recentStarters.includes(p.puuid));
                 subs = teamPlayers.filter(p => !recentStarters.includes(p.puuid));
              } else {
                 const maxTeamGames = Math.max(...teamPlayers.map(p => p.games_played || 0));
                 starters = teamPlayers.filter(p => p.games_played >= Math.max(3, maxTeamGames * 0.3));
                 subs = teamPlayers.filter(p => p.games_played < Math.max(3, maxTeamGames * 0.3));
              }

              // Função para descobrir o campeão mais jogado do operativo
              const getMostPlayedChamp = (puuid: string) => {
                 if (!statsDetailed || statsDetailed.length === 0) return null;
                 const pGames = statsDetailed.filter(s => s.puuid === puuid);
                 if (pGames.length === 0) return null;
                 const counts: Record<string, number> = {};
                 pGames.forEach(g => { if (g.champion) counts[g.champion] = (counts[g.champion] || 0) + 1; });
                 const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                 return sorted.length > 0 ? sorted[0][0] : null;
              };

              return (
                <div className="space-y-8">
                  {/* GRID DOS TITULARES */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {starters.map(p => (
                      <PlayerCard 
                        key={p.puuid} 
                        player={p} 
                        teams={teamsList} 
                        isAdmin={isAdmin} 
                        isTeamMVP={p.mvp_score === maxTeamScore && maxTeamScore > 0}
                        mainChampion={getMostPlayedChamp(p.puuid)}
                        onEdit={() => { setEditForm({ ...p }); setIsEditModalOpen(true); }} 
                      />
                    ))}
                  </div>

                  {/* GRID DOS ACADEMY / CALL-UPS */}
                  {subs.length > 0 && (
                    <div className="mt-8 bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50">
                      <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                        <span className="w-6 h-[2px] bg-zinc-700"></span> 
                        Substitutos & Academy Call-ups
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 opacity-80 hover:opacity-100 transition-opacity">
                        {subs.map(p => (
                          <PlayerCard 
                            key={p.puuid} 
                            player={p} 
                            teams={teamsList} 
                            isAdmin={isAdmin} 
                            isTeamMVP={false}
                            mainChampion={getMostPlayedChamp(p.puuid)}
                            onEdit={() => { setEditForm({ ...p }); setIsEditModalOpen(true); }} 
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
            {/* VISION RADAR */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 flex flex-col items-center relative shadow-sm">
              <div className="w-full flex justify-between mb-6 items-center border-b border-zinc-800 pb-4">
                <span className="text-white text-lg font-black uppercase tracking-tight">Tactical Vision Radar</span>
                <div className="flex gap-2">
                  <SideSelector value={heatmapSide} onChange={setHeatmapSide} />
                  <ObjectiveSelector value={heatmapObjective} onChange={setHeatmapObjective} />
                </div>
              </div>
              <div className="relative w-full max-w-[400px] aspect-square bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                <img src="https://pbs.twimg.com/media/G7GGWYIXgAEx4SP?format=jpg&name=medium" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                <div className="absolute inset-0 z-20 opacity-[0.1]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                <div className="absolute inset-0 z-30 pointer-events-none">
                  {activeWards.map((w, index) => {
                    const rawX = Number(w.ward_x ?? w.player_x ?? 0);
                    const rawY = Number(w.ward_y ?? w.player_y ?? 0);
                    const posX = MAP_OFFSET + (rawX / GAME_MAX) * MAP_SCALE;
                    const posY = MAP_OFFSET + (rawY / GAME_MAX) * MAP_SCALE;
                    
                    const isControl = String(w.type || w.ward_type || '').toLowerCase().includes('control');
                    const sensorColor = isControl ? '#ef4444' : '#eab308';
                    const wardLabel = isControl ? 'CONTROL' : 'STEALTH';
                    
                    const playerName = w.player_name || 'Desconhecido';

                    return (
                      <div 
                        key={`sensor-${w.id || index}`} 
                        className="absolute w-6 h-6 transform -translate-x-1/2 translate-y-1/2 group/ward pointer-events-auto hover:z-[9999] flex items-center justify-center cursor-crosshair" 
                        style={{ left: `${posX}%`, bottom: `${posY}%` }}
                      >
                        <div className="absolute inset-0 rounded-full bg-transparent" />
                        
                        <div className="absolute w-2.5 h-2.5 rounded-full animate-ping opacity-50" style={{ backgroundColor: sensorColor }} />
                        <div className="relative w-2.5 h-2.5 rounded-full border-[1.5px] border-zinc-950 shadow-[0_0_4px_rgba(0,0,0,1)]" style={{ backgroundColor: sensorColor }} />
                        
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-zinc-950/95 backdrop-blur-md border border-zinc-700 rounded-lg text-white opacity-0 group-hover/ward:opacity-100 transition-all duration-200 pointer-events-none shadow-2xl flex flex-col min-w-[140px] overflow-hidden scale-90 group-hover/ward:scale-100 origin-bottom">
                           
                           <div className="bg-zinc-900 px-2.5 py-1.5 border-b border-zinc-800 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)]" style={{ backgroundColor: sensorColor }} />
                             <span className="text-[10px] font-black uppercase tracking-tight truncate flex-1 text-left">{playerName}</span>
                           </div>
                           
                           <div className="px-2.5 py-1.5 flex justify-between items-center gap-3">
                             <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{wardLabel}</span>
                             <span className="text-[9px] font-mono font-black text-blue-400">T+ {formatTime(Number(w.minute) || 0)}</span>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {activeWards.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <span className="bg-zinc-900/90 text-zinc-500 text-[9px] font-bold px-3 py-1.5 rounded uppercase tracking-widest border border-zinc-800 shadow-md">
                      Nenhuma visão nesta janela
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* OBJECTIVE BOX PLOT */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 flex flex-col shadow-sm">
               <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6 border-b border-zinc-800 pb-4">Objective Execution Strategy</h3>
               <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={boxPlotData} margin={{ bottom: 30, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} vertical={true} />
                      <XAxis dataKey="key" tick={<ObjectiveAxisTick />} interval={0} height={40} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 45]} stroke="#71717a" fontSize={10} fontStyle="bold" tickFormatter={(v) => `${v}m`} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomObjectiveTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} wrapperStyle={{ zIndex: 9999 }} />
                      <Bar dataKey="window" radius={[4, 4, 4, 4]} barSize={20} fill={String(heatmapSide).toLowerCase() === 'blue' ? "#3b82f6" : "#ef4444"} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>

          <section className="bg-[#18181b] border border-zinc-800 rounded-2xl p-8 shadow-sm relative">
            <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
               <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Draft Strategy Pattern</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Análise de Prioridade e Flex</p>
               </div>
               <div className="flex bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                 <button onClick={() => setDraftViewMode('champion')} className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors ${draftViewMode === 'champion' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>CHAMPS</button>
                 <button onClick={() => setDraftViewMode('role')} className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors ${draftViewMode === 'role' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>ROLES</button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* BLUE SIDE */}
              <div className="lg:col-span-4 space-y-6">
                <div className="flex items-center gap-3 text-blue-500 text-sm font-black uppercase tracking-widest"><div className="w-2 h-4 bg-blue-500 rounded-sm" /> BLUE SIDE</div>
                <div className="flex gap-2">
                  {[1, 3, 5, 14, 16].map(seq => <DraftBanThumbnail key={seq} label={SEQUENCE_LABELS[seq]} data={draftAssignments[seq]} globalBans={globalBans} />)}
                </div>
                <div className="space-y-3">
                  {[7, 10, 11, 18, 19].map((seq, idx) => <DraftPickCard key={seq} label={`B${idx + 1}`} data={draftAssignments[seq]} side="blue" mode={draftViewMode} />)}
                </div>
              </div>

              {/* CENTER (CORE CHAMPION POOL) */}
              <div className="lg:col-span-4 flex flex-col">
                <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-5 h-full flex flex-col shadow-sm relative overflow-hidden">
                  
                  {/* Glow de Fundo Sutil para dar profundidade ao centro da tela */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/10 blur-[60px] pointer-events-none" />

                  <h4 className="text-[10px] text-center mb-5 text-zinc-400 font-bold uppercase tracking-widest flex items-center justify-center gap-3 relative z-10">
                    <span className="w-4 h-[1px] bg-zinc-700"></span>
                    Core Champion Pool
                    <span className="w-4 h-[1px] bg-zinc-700"></span>
                  </h4>

                  <div className="flex-1 flex flex-col gap-3 relative z-10">
                    {mostPickedOverall.length > 0 ? (
                      <>
                        {/* SIGNATURE PICK (Top 1) */}
                        {(() => {
                          const topChamp: any = mostPickedOverall[0]; // <-- Só adicionar o ': any' aqui!
                          const wr = topChamp.count > 0 ? (topChamp.wins / topChamp.count) * 100 : 0;
                          const splash = getChampionSplashUrl(topChamp.name);
                          
                          return (
                            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 group cursor-default mb-2 shadow-md">
                              <div className="absolute inset-0 z-0">
                                <img src={splash} className="w-full h-full object-cover object-[center_20%] opacity-40 group-hover:opacity-60 transition-opacity duration-500 grayscale-[30%]" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                              </div>
                              
                              <div className="relative z-10 p-4 pt-12 flex flex-col items-center text-center">
                                <div className="absolute top-3 left-3 bg-blue-600/20 border border-blue-500/50 text-blue-400 text-[7px] px-2 py-0.5 rounded font-black uppercase tracking-widest backdrop-blur-sm shadow-lg">
                                  Signature Pick
                                </div>
                                
                                <h5 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                  {topChamp.name}
                                </h5>
                                
                                <div className="flex items-center gap-3 mt-1.5 bg-zinc-950/60 px-3 py-1 rounded-full border border-zinc-800/80 backdrop-blur-md shadow-inner">
                                  <span className={`text-[11px] font-black ${wr >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {wr.toFixed(1)}% WR
                                  </span>
                                  <span className="text-zinc-600 text-[10px]">|</span>
                                  <span className="text-[9px] font-bold text-zinc-300 tracking-widest uppercase">
                                    {topChamp.count} Matches
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* RUNNER UPS (Top 2-5) - Mini Progress Bars */}
                        <div className="flex flex-col gap-2 mt-auto">
                          {mostPickedOverall.slice(1).map((c: any, index: number) => {
                            const wr = c.count > 0 ? (c.wins / c.count) * 100 : 0;
                            return (
                              <div key={c.name} className="flex items-center gap-3 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/50 hover:bg-zinc-800 transition-colors">
                                <div className="relative">
                                  <img src={getChampionImageUrl(c.name)} className="w-9 h-9 rounded-lg border border-zinc-700 object-cover shadow-sm" alt="" />
                                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-center text-[7px] font-black text-zinc-500 shadow-md">
                                    #{index + 2}
                                  </div>
                                </div>
                                
                                <div className="flex-1 flex flex-col justify-center py-0.5 pr-2">
                                  <div className="flex justify-between items-end mb-1.5">
                                    <span className="text-[10px] font-black text-zinc-200 uppercase tracking-tight leading-none">
                                      {c.name}
                                    </span>
                                    <div className="flex items-center gap-2 leading-none">
                                      <span className="text-[8px] text-zinc-500 font-bold">{c.count}G</span>
                                      <span className={`text-[9px] font-black ${wr >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {wr.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Progress Bar (Leitura Rápida de Dados) */}
                                  <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                      className={`h-full transition-all duration-1000 ${wr >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                      style={{ width: `${Math.min(100, Math.max(0, wr))}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 opacity-50">
                         <span className="text-4xl mb-2">📊</span>
                         <span className="text-[9px] font-bold uppercase tracking-widest">Sem dados de Draft</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RED SIDE */}
              <div className="lg:col-span-4 space-y-6">
                <div className="flex items-center justify-end gap-3 text-red-500 text-sm font-black uppercase tracking-widest">RED SIDE <div className="w-2 h-4 bg-red-500 rounded-sm" /></div>
                <div className="flex gap-2 justify-end">
                  {[2, 4, 6, 13, 15].map(seq => <DraftBanThumbnail key={seq} label={SEQUENCE_LABELS[seq]} data={draftAssignments[seq]} globalBans={globalBans} />)}
                </div>
                <div className="space-y-3">
                  {[8, 9, 12, 17, 20].map((seq, idx) => <DraftPickCard key={seq} label={`R${idx + 1}`} data={draftAssignments[seq]} side="red" mode={draftViewMode} />)}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <form onSubmit={handleSaveChanges} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase tracking-tight border-b border-zinc-800 pb-3">Edit Operative</h2>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Nickname</label>
              <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-colors" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Photo URL</label>
              <input type="url" className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-colors" value={editForm.photo_url || ''} onChange={e => setEditForm({...editForm, photo_url: e.target.value})} placeholder="https://..." />
            </div>

            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <button type="button" onClick={() => handleDeletePlayer(editForm.puuid)} className="px-5 py-3 bg-red-500/10 text-red-500 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">Reset</button>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-3 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors border border-zinc-800 ml-auto">Cancel</button>
              <button type="submit" disabled={saving} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTES DE ESTILO (FLAT DESIGN) ---

function ProgressBar({ label, value }: { label: string, value: number }) {
  const numValue = Math.round(value || 0);
  let colorClass = "bg-zinc-600";
  
  if (numValue >= 90) colorClass = "bg-purple-500";
  else if (numValue >= 80) colorClass = "bg-blue-500";
  else if (numValue >= 70) colorClass = "bg-emerald-500";
  else if (numValue >= 60) colorClass = "bg-amber-500";
  else if (numValue > 0) colorClass = "bg-red-500";

  return (
    <div className="flex flex-col w-full group/bar">
      <div className="flex justify-between items-end mb-1 px-0.5">
        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black text-white">{numValue}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-sm overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, numValue))}%` }} />
      </div>
    </div>
  );
}

function PlayerCard({ player, teams, isAdmin, onEdit, isTeamMVP, mainChampion }: any) {
  const team = teams.find((t: any) => t.acronym.toUpperCase() === player.team_acronym.toUpperCase());
  const isGlobalMVP = player.is_mvp;
  const splashUrl = getChampionSplashUrl(mainChampion);
  
  let borderColor = 'border-zinc-800 hover:border-zinc-500';
  let nameColor = 'text-white';
  let foilClass = '';
  let badgeLabel = '';
  let badgeColor = '';
  
  if (isGlobalMVP) {
    borderColor = 'border-yellow-500/30 hover:border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.05)]';
    nameColor = 'text-yellow-400';
    foilClass = 'foil-stealth-royal';
    badgeLabel = 'SEASON MVP';
    badgeColor = 'bg-yellow-400 text-yellow-950';
  } else if (isTeamMVP) {
    borderColor = 'border-emerald-500/30 hover:border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]';
    nameColor = 'text-emerald-500';
    foilClass = 'foil-stealth-royal';
    badgeLabel = 'TEAM STAR';
    badgeColor = 'bg-emerald-500 text-emerald-950';
  }

  return (
    <div className="relative group h-[220px]">
      {/* Estilos CSS Injetados: Foil Ultra-Sutil com Pausa Orgânica e Microtextura Premium */}
      <style>{`
        /*
          CONCEITO PREMIUM: 
          - Luz mais larga e difusa (imitando um reflexo real em metal escovado/vidro).
          - A "pausa" agora é orgânica: feita por um grande espaço transparente no gradiente, 
            evitando que a animação dê um tranco ao reiniciar o loop.
        */
        .foil-stealth-royal {
          background-image: 
            /* Faixa de luz Champagne/Platina, larga e com bordas muito suaves */
            linear-gradient(
              110deg,
              transparent 0%,
              transparent 35%, /* Grande espaço vazio para criar a pausa natural */
              rgba(255, 255, 255, 0.01) 40%,
              rgba(255, 255, 255, 0.07) 50%, /* Ponto de maior brilho */
              rgba(255, 255, 255, 0.01) 60%,
              transparent 65%,
              transparent 100%
            ),
            /* Base ambiente com um levíssimo tom metálico quente */
            linear-gradient(
              to right, 
              rgba(255, 245, 220, 0.015), 
              rgba(255, 255, 255, 0.03), 
              rgba(255, 245, 220, 0.015)
            );
          background-size: 250% 100%, 100% 100%;
          /* Tempo estendido para 14s e movimento linear para uma passagem hipnótica e sem trancos */
          animation: premium-sweep 14s linear infinite; 
          mix-blend-mode: color-dodge;
        }

        /* Microtextura (Efeito Matte / Fibra de Carbono sutil) */
        .foil-stealth-royal::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015)),
            linear-gradient(-45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015));
          background-size: 4px 4px; /* Diminuído de 60px para 4px para um toque tátil caro */
          mix-blend-mode: overlay;
          pointer-events: none;
          opacity: 0.7; 
        }

        /* Loop contínuo e perfeito da direita para a esquerda */
        @keyframes premium-sweep {
          0%   { background-position: 200% 0, 0% 0; }
          100% { background-position: -100% 0, 0% 0; }
        }

        /* Shape Assimétrico (HUD) */
        .clip-card { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%); }
      `}</style>
      
      {isAdmin && <button onClick={(e) => { e.preventDefault(); onEdit(); }} className="absolute -top-2 -right-2 z-50 bg-blue-600 hover:bg-blue-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs shadow-md">✏️</button>}
      
      {badgeLabel && (
        <div className={`absolute -top-2.5 left-4 z-40 ${badgeColor} text-[8px] font-black px-2.5 py-1 rounded shadow-lg tracking-widest`}>
          {badgeLabel}
        </div>
      )}

      <Link href={`/dashboard/players/${player.puuid}`} className={`bg-zinc-950 border transition-all duration-300 flex flex-col block h-full relative shadow-md clip-card group-hover:-translate-y-1 ${borderColor}`}>
        
        {/* Camada 1: Splash Art Background */}
        {mainChampion && (
          <div className="absolute inset-0 z-0 opacity-80 transition-transform duration-700 group-hover:scale-105">
            <img src={splashUrl} className="w-full h-full object-cover object-[center_20%]" alt="" />
          </div>
        )}
        
        {/* Camada 2: Gradiente APENAS NA BASE para ancorar os textos */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent opacity-90" />
        
        {/* Camada 3: O Foil Stealth com Pausa */}
        {(isGlobalMVP || isTeamMVP) && (
          <div className={`absolute inset-0 z-10 pointer-events-none ${foilClass}`} />
        )}

        {/* Camada 4: Conteúdo da Carta */}
        <div className="relative z-20 p-4 flex flex-col h-full">
          
          <div className="flex justify-between items-start mb-3">
            <div className={`relative p-0.5 rounded-lg transition-transform duration-300 ${isGlobalMVP ? 'bg-yellow-400' : isTeamMVP ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
              <div className="w-11 h-11 bg-zinc-900 rounded-md overflow-hidden flex items-center justify-center shadow-inner">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-zinc-600">{player.nickname?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-zinc-950 p-1 rounded border border-zinc-800 shadow-md">
                {getRoleIcon(String(player.primary_role), "w-2.5 h-2.5")}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5 mt-1">
               {team?.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4 object-contain opacity-90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />}
               <span className="text-[8px] font-bold text-white tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,1)] bg-black/40 px-1.5 rounded">{player.games_played} MATCHES</span>
            </div>
          </div>

          <h3 className={`text-[17px] font-black tracking-tight uppercase truncate drop-shadow-[0_2px_4px_rgba(0,0,0,1)] mt-auto ${nameColor}`}>
            {player.nickname}
          </h3>
          
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <StatBadge label="LANE" value={player.median_lane} />
            <StatBadge label="IMPACT" value={player.median_impact} />
            <StatBadge label="CONV" value={player.median_conversion} />
            <StatBadge label="VISION" value={player.median_vision} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function StatBadge({ label, value }: { label: string, value: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded bg-zinc-950/70 backdrop-blur-md border border-zinc-800/50 transition-colors shadow-inner">
      <span className="text-[7px] font-bold text-zinc-400 tracking-widest uppercase mb-0.5">{label}</span>
      <span className={`text-[11px] font-black drop-shadow-md ${getScoreColor(value)}`}>{value ? Math.round(value) : '-'}</span>
    </div>
  );
}

function DraftBanThumbnail({ label, data, globalBans }: any) {
  const banRate = data && globalBans ? globalBans[normalizeChampName(data.name)] : 0;
  return (
    <div className="text-center group relative flex-1">
       <p className="text-[8px] font-bold text-zinc-500 uppercase mb-1">{label}</p>
       <div className="w-full aspect-square bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden flex items-center justify-center transition-colors group-hover:border-zinc-500 shadow-sm relative">
          {data ? (
             <img src={data.image} className="absolute inset-0 w-full h-full grayscale opacity-60 object-cover group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" alt="" />
          ) : (
             <div className="w-full h-full bg-transparent" />
          )}
       </div>
       
       {data && (
         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-950 border border-zinc-800 text-white text-[9px] p-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-[9999] shadow-2xl flex flex-col items-center gap-1 transition-all duration-200">
            <span className="font-black uppercase tracking-widest text-zinc-200">{data.name}</span>
            <span className="font-mono text-red-500 font-bold">{banRate || 0}% BAN RATE GERAL</span>
            <span className="text-[7px] text-zinc-500 uppercase tracking-widest font-bold border-t border-zinc-800 pt-1 mt-0.5">{data.count} bans neste slot</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[4px] border-x-transparent border-t-[4px] border-t-zinc-800"></div>
         </div>
       )}
    </div>
  );
}

function DraftPickCard({ label, data, side, mode }: any) {
  const isBlue = side === 'blue';
  
  // Chamamos a nova URL com o recorte horizontal perfeito da Riot
  const centeredSplash = data ? getChampionCenteredUrl(data.name) : '';
  
  return (
    <div className="group relative">
      <div className={`h-16 rounded-xl border transition-all flex items-center relative overflow-hidden shadow-sm ${isBlue ? 'border-blue-900/30 bg-blue-900/10 hover:border-blue-500/50' : 'border-red-900/30 bg-red-900/10 hover:border-red-500/50 flex-row-reverse'}`}>
        
        {data && mode === 'champion' && (
           <div className={`absolute inset-0 w-full h-full ${!isBlue ? '-scale-x-100' : ''}`}>
             {/* A MÁGICA ACONTECE AQUI: 
                 Substituímos 'object-center' por 'object-[center_20%]' 
                 Isso faz a imagem focar no rosto (topo) em vez do peitoral (meio) */}
             <img src={centeredSplash} className="w-full h-full object-cover object-[center_20%] opacity-80 transition-transform duration-500 group-hover:scale-110" alt="" />
           </div>
        )}
        
        <div className={`absolute inset-0 bg-gradient-to-r ${isBlue ? 'from-zinc-950 via-zinc-900/60 to-transparent' : 'from-transparent via-zinc-900/60 to-zinc-950'}`} />

        <div className={`absolute top-0 bottom-0 w-1.5 z-20 ${isBlue ? 'left-0 bg-blue-500' : 'right-0 bg-red-500'}`} />
        
        <div className={`relative z-20 flex w-full items-center justify-between px-4 ${!isBlue && 'flex-row-reverse'}`}>
           <div className={`flex items-center gap-4 ${!isBlue && 'flex-row-reverse'}`}>
              <span className={`text-[10px] font-black uppercase ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>{label}</span>
              {data ? (
                <>
                  {mode === 'role' && (
                    <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-md">
                      {getRoleIcon(data.name, "w-4 h-4")}
                    </div>
                  )}
                  <div className={`flex flex-col ${!isBlue && 'items-end'}`}>
                    <span className="text-sm font-black text-white uppercase tracking-tight">{data.name}</span>
                    <div className={`flex items-center gap-2 text-[9px] font-bold ${!isBlue && 'flex-row-reverse'}`}>
                      <span className={data.wr >= 50 ? 'text-emerald-500' : 'text-red-500'}>{data.wr ? data.wr.toFixed(0) : 0}% WR</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400 uppercase">{data.count} JOGOS</span>
                    </div>
                  </div>
                </>
              ) : <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest ml-2">Empty</span>}
           </div>
        </div>
      </div>
      
      {data && data.ratings && (
        <div className={`absolute z-[9999] top-1/2 -translate-y-1/2 ${isBlue ? 'left-[102%]' : 'right-[102%]'} opacity-0 group-hover:opacity-100 transition-all pointer-events-none duration-200`}>
          <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl min-w-[140px]">
             <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest border-b border-zinc-800 pb-1.5 mb-2 text-center">Performance Avg</p>
             <div className="space-y-1.5 uppercase">
                <RatingLine label="LANE" value={data.ratings.lane} />
                <RatingLine label="IMPACT" value={data.ratings.impact} />
                <RatingLine label="CONV" value={data.ratings.conv} />
                <RatingLine label="VISION" value={data.ratings.vision} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingLine({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[8px] text-zinc-500 font-bold tracking-widest">{label}</span>
      <span className={`text-[10px] font-black ${getScoreColor(value)}`}>{value ? value.toFixed(1) : '0.0'}</span>
    </div>
  );
}

// --- DROPDOWNS CUSTOMIZADOS ---

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
      ? TOURNAMENT_GROUPS.flatMap(g => g.options).find(o => o.id === value[0])?.label 
      : `${value.length} CAMPEONATOS SEL.`;

  return (
    <div className="relative flex flex-col" ref={ref}>
      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block ml-1">ESCOPO DE LIGA</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[220px] transition-colors text-[10px] font-bold uppercase shadow-sm h-[34px] ${value.includes('ALL') ? 'border-zinc-800 text-zinc-300 hover:border-zinc-600' : 'border-blue-500/50 text-blue-400 hover:border-blue-400'}`}
      >
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <span className={`text-[8px] transition-transform ${isOpen ? 'rotate-180 text-blue-500' : 'text-zinc-500'}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-[260px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[400px] flex flex-col">
          
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
                <div className="px-4 py-2 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
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
                      <span className="text-[10px] font-bold uppercase">{opt.label}</span>
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
        className={`bg-zinc-900 border px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[140px] transition-colors text-[10px] font-bold uppercase shadow-sm h-[34px] ${isHighlighted ? 'border-amber-500/50 text-amber-500 hover:border-amber-400' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
      >
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <span className={`text-[8px] transition-transform ${isOpen ? (isHighlighted ? 'rotate-180 text-amber-500' : 'rotate-180 text-blue-500') : 'text-zinc-500'}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 min-w-[160px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar">
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

function ObjectiveSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-2 min-w-[140px] hover:border-zinc-600 transition-colors shadow-sm text-[9px] text-zinc-300 font-bold uppercase">
        <img src={OBJECTIVE_ASSETS[value]?.icon} className="w-3.5 h-3.5 object-contain" alt="" />
        <span className="flex-1 text-left">{OBJECTIVE_LABELS[value]}</span>
        <span className="text-[8px] text-zinc-500">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden shadow-xl z-[9999] min-w-[140px]">
          {ORDERED_OBJECTIVES.map(objKey => (
            <button key={objKey} onClick={() => { onChange(objKey); setIsOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === objKey ? 'bg-zinc-800' : ''}`}>
              <img src={OBJECTIVE_ASSETS[objKey]?.icon} className="w-3.5 h-3.5 object-contain" alt="" />
              <span className={`text-[9px] font-bold uppercase ${value === objKey ? 'text-blue-400' : 'text-zinc-400'}`}>{OBJECTIVE_LABELS[objKey]}</span>
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
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-2 min-w-[100px] hover:border-zinc-600 transition-colors shadow-sm text-[9px] text-zinc-300 font-bold uppercase">
        <div className={`w-1.5 h-2.5 rounded-sm ${value === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
        <span className="flex-1 text-left">{value} Side</span>
        <span className="text-[8px] text-zinc-500">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden shadow-xl z-[9999] min-w-[100px]">
          {['Blue', 'Red'].map(side => (
            <button key={side} onClick={() => { onChange(side); setIsOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${value === side ? 'bg-zinc-800' : ''}`}>
              <div className={`w-1.5 h-2.5 rounded-sm ${side === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <span className={`text-[9px] font-bold uppercase ${value === side ? 'text-white' : 'text-zinc-400'}`}>{side} Side</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- GRÁFICOS (TOOLTIPS & TICKS FLAT) ---

const CustomXAxisTick = ({ x, y, payload, teamChartData, teamsList }: any) => {
  const match = teamChartData?.find((d: any) => d.match_id === payload.value);
  const opponentAcronym = String(match?.opponent_acronym || '').toUpperCase();
  const opponentTeamData = teamsList?.find((t: any) => t.acronym === opponentAcronym);
  const logoUrl = opponentTeamData?.logo_url || match?.opponent_logo;

  return (
    <g transform={`translate(${x},${y})`}>
      {logoUrl ? (
        <image 
          href={logoUrl} 
          x={-10} 
          y={8} 
          width="20" 
          height="20" 
          preserveAspectRatio="xMidYMid meet"
          // O drop-shadow com a cor branca cria o contorno/brilho no exato formato da logo
          style={{ filter: 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.6))' }}
        />
      ) : (
        <text x={0} y={18} textAnchor="middle" fill="#71717a" fontSize={8} fontWeight="bold">VS {opponentAcronym || '?'}</text>
      )}
    </g>
  );
};

const CustomChartTooltip = ({ active, payload, teamsList }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isWin = data.win_status === 'W';
    const resultColor = isWin ? 'text-blue-500' : 'text-red-500';
    const resultText = isWin ? 'VITÓRIA' : 'DERROTA';
    
    const opponentAcronym = String(data.opponent_acronym || '?').toUpperCase();
    const opponentTeamData = teamsList?.find((t: any) => t.acronym === opponentAcronym);
    const oppLogo = opponentTeamData?.logo_url || data.opponent_logo;

    // Formatação de Data e Hora
    const dateStr = data.game_start_time 
      ? new Date(data.game_start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')
      : 'Data Desconhecida';

    // Placar
    let placarStr = resultText;
    if (data.team_score !== undefined && data.opponent_score !== undefined) {
      placarStr = `${data.team_score} x ${data.opponent_score}`;
    }

    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700 p-3.5 rounded-xl shadow-2xl min-w-[240px] uppercase flex flex-col gap-3 z-[9999]">
        
        {/* Header: Split, Data e Resultado */}
        <div className="flex justify-between items-start border-b border-zinc-800 pb-2">
           <div className="flex flex-col">
              <span className="text-[8px] text-zinc-500 font-bold tracking-widest">{data.split || 'MATCH HISTORY'}</span>
              <span className="text-[10px] font-black text-zinc-300">{dateStr}</span>
           </div>
           <span className={`text-[11px] font-black tracking-widest ${resultColor}`}>{placarStr}</span>
        </div>

        {/* Confronto e Drafts */}
        <div className="flex flex-col gap-2.5 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/50">
           
           {/* Nossa Composição */}
           <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-blue-400">OUR COMP</span>
              <div className="flex gap-1">
                 {data.team_picks?.map((champ: string, i: number) => (
                    <img key={i} src={getChampionImageUrl(champ)} className="w-5 h-5 rounded-full border border-zinc-700 shadow-sm" alt={champ} />
                 ))}
                 {(!data.team_picks || data.team_picks.length === 0) && <span className="text-[8px] text-zinc-600">N/A</span>}
              </div>
           </div>
           
           {/* Composição Inimiga */}
           <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="bg-zinc-200 p-0.5 rounded shadow-sm">
                   {oppLogo && <img src={oppLogo} className="w-3.5 h-3.5 object-contain" alt="" />}
                </div>
                <span className="text-[9px] font-bold text-zinc-400">VS {opponentAcronym}</span>
              </div>
              <div className="flex gap-1">
                 {data.opp_picks?.map((champ: string, i: number) => (
                    <img key={i} src={getChampionImageUrl(champ)} className="w-5 h-5 rounded-full border border-zinc-800 grayscale opacity-70" alt={champ} />
                 ))}
                 {(!data.opp_picks || data.opp_picks.length === 0) && <span className="text-[8px] text-zinc-600">N/A</span>}
              </div>
           </div>
        </div>

        {/* Grid de Métricas (Bento Box) */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between items-center bg-zinc-900 px-2 py-1.5 rounded-md border border-zinc-800">
              <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.2)]" style={{ backgroundColor: p.color }} />
                 <span className="text-[8px] text-zinc-400 font-bold tracking-widest">{p.name}</span>
              </div>
              <span className="font-black text-[10px] text-white">{p.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl min-w-[140px] uppercase">
        <div className="flex items-center gap-2 mb-2 border-b border-zinc-800 pb-2">
           <div className={`w-1 h-3 rounded-sm ${data.name === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
           <span className="text-white text-[9px] font-bold">{data.name} PERFORMANCE</span>
        </div>
        <div className="space-y-1.5 font-bold">
           {Object.keys(data.ratings).map(key => (
             <div key={key} className="flex justify-between items-center text-[9px]">
               <span className="text-zinc-500">{key}</span>
               <span className={`${getScoreColor(data.ratings[key])}`}>{data.ratings[key].toFixed(1)}</span>
             </div>
           ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomObjectiveTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length && payload[0].payload.window) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg shadow-xl uppercase min-w-[180px]">
        <div className="flex items-center gap-3 mb-3 border-b border-zinc-800 pb-2">
          <img src={data.hoverImg} className="w-8 h-8 object-contain" alt="" />
          <div>
             <p className="text-white text-[10px] font-black">{data.name}</p>
             <span className="text-[7px] text-zinc-500 font-bold tracking-widest">TIMING DATA</span>
          </div>
        </div>
        <div className="space-y-2 font-bold">
           <div className="flex justify-between items-center"><span className="text-[8px] text-zinc-500">MÉDIA TÁTICA</span><span className="text-blue-400 text-[10px] font-black">{formatTime(data.avg)}</span></div>
           <div className="flex justify-between items-center"><span className="text-[8px] text-zinc-500">JANELA MÍNIMA</span><span className="text-white text-[10px] font-black">{formatTime(data.window[0])}</span></div>
           <div className="flex justify-between items-center"><span className="text-[8px] text-zinc-500">JANELA MÁXIMA</span><span className="text-white text-[10px] font-black">{formatTime(data.window[1])}</span></div>
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
      {assets && <image href={assets.icon} x={-8} y={5} width="16" height="16" />}
    </g>
  );
};