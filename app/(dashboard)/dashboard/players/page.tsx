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
  'lvl1': '🔥 LEVEL 1 (0-1:59)',
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

// --- UTILITÁRIOS ---

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

const formatDate = (dateString: string) => { 
  if (!dateString) return ''; 
  const p = dateString.split('-'); 
  return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; 
};

const formatTimeStr = (timeString: string) => { 
  if (!timeString) return ''; 
  return timeString.substring(0, 5); 
};

function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const safeDate = String(dateString).trim().replace(' ', 'T');
  const time = new Date(safeDate.includes('T') && !safeDate.includes('Z') && !safeDate.includes('-') && !safeDate.includes('+') ? `${safeDate}Z` : safeDate).getTime();
  return isNaN(time) ? 0 : time;
}

// --- COMPONENTE PRINCIPAL ---

export default function PlayersHubPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("TODOS");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // ESTADOS GLOBAIS DE FILTRO E LEADERBOARD (AGORA ARRAY PARA MULTI-SELEÇÃO)
  const [globalTournaments, setGlobalTournaments] = useState<string[]>(["CIRCUITO_DESAFIANTE"]);
  const [globalSplit, setGlobalSplit] = useState("SPLIT 1");
  const [leaderboardTab, setLeaderboardTab] = useState<string>("GLOBAL");

  const [teamChartData, setTeamChartData] = useState<any[]>([]);
  const [teamObjectiveWindows, setTeamObjectiveWindows] = useState<any[]>([]);
  const [teamWards, setTeamWards] = useState<any[]>([]);
  const [draftStats, setDraftStats] = useState<any[]>([]);
  const [globalBans, setGlobalBans] = useState<Record<string, number>>({});
  const [draftViewMode, setDraftViewMode] = useState<'champion' | 'role'>('champion');

  // INICIA EM LVL 1
  const [heatmapSide, setHeatmapSide] = useState<string>("Blue");
  const [heatmapObjective, setHeatmapObjective] = useState<string>("lvl1");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ puuid: '', nickname: '', team_acronym: '', photo_url: '', primary_role: '' });
  
  const [missionsRaw, setMissionsRaw] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]); 
  const [statsDetailed, setStatsDetailed] = useState<any[]>([]);
  const [myTeamTag, setMyTeamTag] = useState('RMD');

  useEffect(() => { checkUserRole(); }, []);
  useEffect(() => { fetchInitialData(); }, [globalTournaments, globalSplit]);
  
  useEffect(() => { 
    if (filterTeam !== "TODOS") { 
      fetchPerformanceData(filterTeam); 
      fetchAnalysisData(filterTeam); 
    } 
  }, [filterTeam, globalTournaments, globalSplit]);

  async function checkUserRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === 'scartiezin@gmail.com') setIsAdmin(true);
  }

  async function fetchInitialData() {
    setLoading(true);
    
    const { data: configData } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
    if (configData && configData.my_team_tag) setMyTeamTag(configData.my_team_tag.toUpperCase());

    const { data: t } = await supabase.from('teams').select('*').order('acronym');
    
    let query = supabase.from('hub_players_roster').select('*');
    if (!globalTournaments.includes('ALL')) query = query.in('game_type', globalTournaments);
    if (globalSplit !== 'ALL') query = query.eq('split', globalSplit);

    const { data: p } = await query;
    
    let banQuery = supabase.from('view_champion_ban_stats').select('*').limit(200);
    if (!globalTournaments.includes('ALL')) banQuery = banQuery.in('game_type', globalTournaments);
    if (globalSplit !== 'ALL') banQuery = banQuery.eq('split', globalSplit);
    
    const [bansRes, matchCountRes] = await Promise.all([
      banQuery,
      supabase.from('matches').select('id', { count: 'exact', head: true })
    ]);

    if (t && p) {
      const groupedPlayersMap = new Map();
      p.forEach((curr: any) => {
        if (!groupedPlayersMap.has(curr.puuid)) {
          groupedPlayersMap.set(curr.puuid, { ...curr, count: 1 });
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
      const filteredTeams = t.filter(team => activeTeamTags.has(team.acronym));
      setTeams(filteredTeams);
      setTeamsList(t);

      setFilterTeam(prev => {
        if (prev !== "TODOS" && !activeTeamTags.has(prev)) return "TODOS";
        return prev;
      });
    }

    if (bansRes.data) {
       const totalMatches = matchCountRes.count || 1;
       const banMap: Record<string, number> = {};
       bansRes.data.forEach(b => {
          const rate = (Number(b.total_bans) / totalMatches) * 100;
          banMap[normalizeChampName(b.champion)] = Number(rate.toFixed(1));
       });
       setGlobalBans(banMap);
    }

    const { data: missionsData } = await supabase.from('missions').select('*');
    if (missionsData) setMissionsRaw(missionsData);

    const { data: sDetailed } = await supabase.from('player_stats_detailed').select('*').limit(20000);
    if (sDetailed) setStatsDetailed(sDetailed);

    setLoading(false);
  }

  async function fetchPerformanceData(team: string) {
    let query = supabase.from('hub_players_performance').select('*').eq('team_acronym', team).order('game_start_time', { ascending: true }).limit(5000);
    if (!globalTournaments.includes('ALL')) query = query.in('game_type', globalTournaments);
    if (globalSplit !== 'ALL') query = query.eq('split', globalSplit);

    const { data } = await query;
    if (data) setTeamChartData(data);
  }

  async function fetchAnalysisData(team: string) {
    let objQuery = supabase.from('hub_players_objectives').select('*').eq('team_acronym', team).limit(10000);
    let draftQuery = supabase.from('hub_players_draft').select('*').eq('team_acronym', team).limit(10000);

    if (!globalTournaments.includes('ALL')) {
      objQuery = objQuery.in('game_type', globalTournaments);
      draftQuery = draftQuery.in('game_type', globalTournaments);
    }
    if (globalSplit !== 'ALL') {
      objQuery = objQuery.eq('split', globalSplit);
      draftQuery = draftQuery.eq('split', globalSplit);
    }

    const [obj, draft] = await Promise.all([objQuery, draftQuery]);
    
    if (obj.data) {
      const groupedObjMap = new Map();
      obj.data.forEach((curr: any) => {
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

    if (draft.data) {
      const groupedDraftMap = new Map();
      draft.data.forEach((curr: any) => {
        const key = `${curr.sequence}_${curr.champion}_${curr.type}`;
        if (!groupedDraftMap.has(key)) {
          groupedDraftMap.set(key, { ...curr });
        } else {
          const acc = groupedDraftMap.get(key);
          const total = acc.total_count + curr.total_count;
          if (total > 0) {
            acc.win_rate = ((acc.win_rate * acc.total_count) + (curr.win_rate * curr.total_count)) / total;
            if(curr.avg_lane) acc.avg_lane = ((acc.avg_lane * acc.total_count) + (curr.avg_lane * curr.total_count)) / total;
            if(curr.avg_impact) acc.avg_impact = ((acc.avg_impact * acc.total_count) + (curr.avg_impact * curr.total_count)) / total;
            if(curr.avg_conv) acc.avg_conv = ((acc.avg_conv * acc.total_count) + (curr.avg_conv * curr.total_count)) / total;
            if(curr.avg_vision) acc.avg_vision = ((acc.avg_vision * acc.total_count) + (curr.avg_vision * curr.total_count)) / total;
          }
          acc.total_count = total;
        }
      });
      setDraftStats(Array.from(groupedDraftMap.values()));
    }
    
    // --- NOVO SISTEMA DE PAGINAÇÃO PARA AS WARDS ---
    let allWards: any[] = [];
    let fetchMore = true;
    let from = 0;
    const step = 1000;

    while (fetchMore) {
      let wardsQuery = supabase
        .from('hub_players_vision')
        .select('*')
        .eq('team_acronym', team)
        .range(from, from + step - 1);

      if (!globalTournaments.includes('ALL')) wardsQuery = wardsQuery.in('game_type', globalTournaments);
      if (globalSplit !== 'ALL') wardsQuery = wardsQuery.eq('split', globalSplit);

      const { data: wardsChunk, error } = await wardsQuery;

      if (error || !wardsChunk || wardsChunk.length === 0) {
        fetchMore = false;
      } else {
        allWards = [...allWards, ...wardsChunk];
        from += step;
        
        if (wardsChunk.length < step) {
          fetchMore = false;
        }
      }
    }

    setTeamWards(allWards);
  }

  // --- USEMEMOS BLINDADOS ---

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

  // MOTOR BLINDADO: TACTICAL VISION RADAR COM EARLY GAME E COORDENADAS SEGURAS
  const activeWards = useMemo(() => {
    const targetSide = String(heatmapSide).toLowerCase(); 
    const targetObj = String(heatmapObjective).toLowerCase();
    
    // Filtramos primeiro o Lado. Aceitando '100', '200', 'blue', 'red'.
    let wardsToDisplay = teamWards.filter(w => {
       const wSide = String(w.side || '').toLowerCase() === '100' ? 'blue' : String(w.side || '').toLowerCase() === '200' ? 'red' : String(w.side || '').toLowerCase();
       return wSide === targetSide;
    });

    // TRATAMENTO ATUALIZADO PARA O LEVEL 1 (Abaixo de 2 minutos para pegar 0:00 até 1:59)
    if (targetObj === 'lvl1') {
       return wardsToDisplay.filter(w => Number(w.minute) <= 1);
    }

    const window = teamObjectiveWindows.find(o => String(o.side).toLowerCase() === targetSide && String(o.objective_type).toLowerCase() === targetObj);

    if (window) {
       const wMin = Number(window.min_minute) || 0;
       const wMax = Number(window.max_minute) || 0;
       wardsToDisplay = wardsToDisplay.filter(w => Number(w.minute) >= (wMin - 2) && Number(w.minute) <= (wMax + 1));
    } else {
       // Se o time nunca fez esse obj, mapeia os wards com base no tempo do servidor Meta
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
      if (curr.type === 'PICK') {
        if (!acc[curr.champion]) acc[curr.champion] = { name: curr.champion, count: 0, wins: 0 };
        const count = curr.total_count || 0;
        acc[curr.champion].count += count;
        acc[curr.champion].wins += (count * ((curr.win_rate || 0) / 100));
      }
      return acc;
    }, {});
    return Object.values(counts).sort((a: any, b: any) => b.count - a.count).slice(0, 5);
  }, [draftStats]);

  const draftAssignments = useMemo(() => {
    const assignments: { [key: number]: any } = {};
    for (let seq = 1; seq <= 20; seq++) {
      const isBan = [1,2,3,4,5,6,13,14,15,16].includes(seq);
      const records = draftStats.filter(d => d.sequence === seq && d.type === (isBan ? 'BAN' : 'PICK'));
      
      if (records.length) {
        if (draftViewMode === 'role' && !isBan) {
          const roleMap: any = {};
          records.forEach(r => {
             let rawRole = r.role || r.lane;
             if (!rawRole) {
                const champStats = statsDetailed.find(s => 
                   normalizeChampName(s.champion) === normalizeChampName(r.champion) && 
                   String(s.team_acronym).toUpperCase() === myTeamTag
                );
                if (champStats) rawRole = champStats.lane || champStats.role || champStats.primary_role;
             }
             
             const rKey = normalizeRole(rawRole); 
             if (rKey === 'unknown') return; 

             if(!roleMap[rKey]) roleMap[rKey] = { name: rKey, count: 0, wrSum: 0, laneSum:0, impSum:0, convSum:0, visSum:0 };
             roleMap[rKey].count += r.total_count;
             roleMap[rKey].wrSum += ((r.win_rate || 0) * r.total_count);
             roleMap[rKey].laneSum += ((r.avg_lane || 0) * r.total_count);
             roleMap[rKey].impSum += ((r.avg_impact || 0) * r.total_count);
             roleMap[rKey].convSum += ((r.avg_conv || 0) * r.total_count);
             roleMap[rKey].visSum += ((r.avg_vision || 0) * r.total_count);
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
             champMap[cKey].count += r.total_count;
             champMap[cKey].wrSum += ((r.win_rate || 0) * r.total_count);
             champMap[cKey].laneSum += ((r.avg_lane || 0) * r.total_count);
             champMap[cKey].impSum += ((r.avg_impact || 0) * r.total_count);
             champMap[cKey].convSum += ((r.avg_conv || 0) * r.total_count);
             champMap[cKey].visSum += ((r.avg_vision || 0) * r.total_count);
          });
          const top = Object.values(champMap).sort((a: any, b: any) => b.count - a.count)[0] as any;
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
    return assignments;
  }, [draftStats, draftViewMode, statsDetailed, myTeamTag]);

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
    e.preventDefault(); setSaving(true);
    try {
      await supabase.from('players').update({ nickname: editForm.nickname, team_acronym: String(editForm.team_acronym || '').toUpperCase(), photo_url: editForm.photo_url, primary_role: editForm.primary_role }).eq('puuid', editForm.puuid);
      setIsEditModalOpen(false); fetchInitialData();
    } finally { setSaving(false); }
  };

  const handleDeletePlayer = async (puuid: string) => {
    if (!confirm("Confirmar exclusão definitiva?")) return;
    await supabase.from('players').delete().eq('puuid', puuid); 
    setIsEditModalOpen(false); await fetchInitialData();
  };

  if (loading && players.length === 0) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">Sincronizando Banco de Dados...</p>
    </div>
  );

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-8 space-y-12 font-sans pb-20 overflow-visible">
      
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-4 border-b border-zinc-800 pb-8 relative z-[200]">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight">SCOUTING <span className="text-blue-500">HUB</span></h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-2 uppercase">DATABASE: {players.length} ACTIVE OPERATIVES</p>
        </div>

        <div className="flex gap-4 items-end bg-transparent">
           <TournamentMultiSelector value={globalTournaments} onChange={setGlobalTournaments} />
           <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-[100] overflow-visible">
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
                <span className="text-amber-500">🏆</span> POWER RANKINGS
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
                const team = teams.find((t: any) => t.acronym === p.team_acronym);
                const roleIcon = getRoleIcon(String(p.primary_role), "w-3 h-3");
                
                return (
                  <Link 
                    key={p.puuid} 
                    href={`/dashboard/players/${p.puuid}`} 
                    className={`flex flex-col md:flex-row items-center p-4 rounded-xl border transition-colors group relative overflow-hidden ${isTop1 ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}
                  >
                    {isTop1 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />}
                    
                    <div className="flex w-full md:w-auto items-center justify-between md:justify-start mb-4 md:mb-0">
                      <span className={`text-2xl font-black w-12 text-center ${isTop1 ? 'text-amber-500' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}`}>
                        #{index + 1}
                      </span>
                      
                      <div className="flex items-center gap-4 flex-1 md:w-[220px] ml-2">
                        <img src={p.photo_url || DEFAULT_AVATAR} className={`w-12 h-12 object-cover rounded-lg border-2 ${isTop1 ? 'border-amber-500/50' : 'border-zinc-800'}`} alt="" />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-base font-black uppercase tracking-tight truncate ${isTop1 ? 'text-amber-500' : 'text-zinc-300 group-hover:text-white transition-colors'}`}>{p.nickname}</span>
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
                      <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isTop1 ? 'text-amber-500/70' : 'text-zinc-500'}`}>RATING</span>
                      <span className={`text-2xl font-black leading-none ${isTop1 ? 'text-amber-500' : getScoreColor(p.mvp_score)}`}>
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
          
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 h-[380px] shadow-sm relative flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
               <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                 <div className="w-1.5 h-5 bg-blue-500 rounded-sm" /> 
                 Performance Analytics Timeline
               </h3>
            </div>
            <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={teamChartData} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                   <XAxis dataKey="match_id" tick={(p) => <CustomXAxisTick {...p} teamChartData={teamChartData} />} interval={0} stroke="#27272a" axisLine={false} tickLine={false} />
                   <YAxis domain={[40, 100]} stroke="#71717a" fontSize={9} fontStyle="bold" axisLine={false} tickLine={false} />
                   <Tooltip content={<CustomChartTooltip />} wrapperStyle={{ zIndex: 9999 }} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '5 5' }} />
                   <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                   <Line type="monotone" dataKey="avg_lane" name="LANE" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#18181b', strokeWidth: 2, stroke: '#8b5cf6' }} activeDot={{ r: 5, fill: '#8b5cf6' }} />
                   <Line type="monotone" dataKey="avg_impact" name="IMPACTO" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#18181b', strokeWidth: 2, stroke: '#3b82f6' }} activeDot={{ r: 5, fill: '#3b82f6' }} />
                   <Line type="monotone" dataKey="avg_conversion" name="CONV." stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#18181b', strokeWidth: 2, stroke: '#10b981' }} activeDot={{ r: 5, fill: '#10b981' }} />
                   <Line type="monotone" dataKey="avg_vision" name="VISÃO" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#18181b', strokeWidth: 2, stroke: '#f59e0b' }} activeDot={{ r: 5, fill: '#f59e0b' }} />
                 </LineChart>
               </ResponsiveContainer>
            </div>
          </div>

          <section className="pt-2">
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3">
              <div className="w-1.5 h-5 bg-blue-500 rounded-sm" /> 
              Tactical Operations Unit
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {(() => {
                const teamPlayers = sortPlayersByRole(players.filter(p => p.team_acronym === filterTeam));
                const maxTeamScore = Math.max(...teamPlayers.map(p => p.mvp_score || 0));
                
                return teamPlayers.map(p => (
                  <PlayerCard 
                    key={p.puuid} 
                    player={p} 
                    teams={teams} 
                    isAdmin={isAdmin} 
                    isTeamMVP={p.mvp_score === maxTeamScore && maxTeamScore > 0}
                    onEdit={() => { setEditForm(p); setIsEditModalOpen(true); }} 
                  />
                ));
              })()}
            </div>
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
                    return (
                      <div key={`sensor-${w.id || index}`} className="absolute w-3 h-3 transform -translate-x-1/2 translate-y-1/2 group/ward pointer-events-auto" style={{ left: `${posX}%`, bottom: `${posY}%` }}>
                        <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: sensorColor }} />
                        <div className="relative w-full h-full rounded-full border-2 border-zinc-900 cursor-help" style={{ backgroundColor: sensorColor }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[9px] text-white opacity-0 group-hover/ward:opacity-100 transition-opacity whitespace-nowrap z-[9999] shadow-lg font-bold">
                           <span className="text-zinc-400 font-mono">T+</span> {formatTime(Number(w.minute) || 0)} | {isControl ? 'CONTROL' : 'STEALTH'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Empty State Fallback para Radar */}
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

              {/* CENTER (TOP PICKS) */}
              <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-fit self-center flex flex-col">
                <h4 className="text-[10px] text-center mb-6 text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-800 pb-3">Top Efficiency Pool</h4>
                <div className="space-y-4">
                  {mostPickedOverall.map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg border border-zinc-700 overflow-hidden shadow-sm">
                           <img src={getChampionImageUrl(c.name)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        </div>
                        <div><span className="text-xs font-black text-white uppercase">{c.name}</span><p className="text-[9px] font-bold text-zinc-500 uppercase">{c.count.toFixed(0)} JOGOS</p></div>
                      </div>
                      <span className={`text-xs font-black ${c.count > 0 && c.wins/c.count >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>{c.count > 0 ? ((c.wins/c.count)*100).toFixed(0) : 0}% WR</span>
                    </div>
                  ))}
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Team Tag</label>
              <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-colors uppercase" value={editForm.team_acronym} onChange={e => setEditForm({...editForm, team_acronym: e.target.value})} />
            </div>
            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <button type="button" onClick={() => handleDeletePlayer(editForm.puuid)} className="px-5 py-3 bg-red-500/10 text-red-500 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">Delete</button>
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

function PlayerCard({ player, teams, isAdmin, onEdit, isTeamMVP }: any) {
  const team = teams.find((t: any) => t.acronym === player.team_acronym);
  const isGlobalMVP = player.is_mvp;
  
  let cardBorder = 'border-zinc-800 hover:border-blue-500';
  let nameColor = 'text-white';
  
  if (isGlobalMVP) {
    cardBorder = 'border-amber-500/50 hover:border-amber-500';
    nameColor = 'text-amber-500';
  } else if (isTeamMVP) {
    cardBorder = 'border-emerald-500/50 hover:border-emerald-500';
    nameColor = 'text-emerald-500';
  }

  return (
    <div className="relative group h-full">
      {isAdmin && <button onClick={(e) => { e.preventDefault(); onEdit(); }} className="absolute -top-2 -right-2 z-50 bg-blue-600 hover:bg-blue-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs shadow-md">✏️</button>}
      
      {isGlobalMVP && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-amber-950 text-[8px] font-black px-3 py-0.5 rounded uppercase tracking-widest shadow-sm">
          SEASON MVP
        </div>
      )}
      {!isGlobalMVP && isTeamMVP && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-emerald-950 text-[8px] font-black px-3 py-0.5 rounded uppercase tracking-widest shadow-sm">
          TEAM STAR
        </div>
      )}

      <Link href={`/dashboard/players/${player.puuid}`} className={`bg-[#18181b] border transition-colors flex flex-col items-center block h-full p-5 rounded-2xl relative overflow-hidden shadow-sm ${cardBorder}`}>
        
        <div className="relative mb-4 mt-2">
          <div className={`p-0.5 rounded-xl transition-all duration-300 group-hover:scale-105 ${isGlobalMVP ? 'bg-amber-500' : isTeamMVP ? 'bg-emerald-500' : 'bg-transparent'}`}>
            <div className="relative w-16 h-16 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 flex items-center justify-center">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.nickname} className="w-full h-full object-cover relative z-10" />
              ) : (
                <span className="text-xl font-black text-zinc-700 relative z-10">{player.nickname?.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 z-20">
            {getRoleIcon(String(player.primary_role), "w-3 h-3")}
          </div>
        </div>

        <h3 className={`text-base font-black text-center truncate w-full mb-1 tracking-tight uppercase ${nameColor}`}>
          {player.nickname}
        </h3>
        
        <div className="flex items-center gap-2 mb-6 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
          {team?.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3 object-contain" />}
          <p className="text-zinc-400 font-bold text-[9px] uppercase">{player.team_acronym} • {player.games_played}G</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 w-full mt-auto relative z-10">
          <StatBadge label="LANE" value={player.median_lane} />
          <StatBadge label="IMPACT" value={player.median_impact} />
          <StatBadge label="CONV" value={player.median_conversion} />
          <StatBadge label="VISION" value={player.median_vision} />
        </div>
      </Link>
    </div>
  );
}

function StatBadge({ label, value }: { label: string, value: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors">
      <span className="text-[7px] font-bold text-zinc-500 tracking-widest uppercase mb-0.5">{label}</span>
      <span className={`text-[11px] font-black ${getScoreColor(value)}`}>{value ? Math.round(value) : '-'}</span>
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
  
  return (
    <div className="group relative">
      <div className={`h-16 rounded-xl border transition-all flex items-center relative overflow-hidden shadow-sm ${isBlue ? 'border-blue-900/30 bg-blue-900/10 hover:border-blue-500/50' : 'border-red-900/30 bg-red-900/10 hover:border-red-500/50 flex-row-reverse'}`}>
        
        {data && mode === 'champion' && (
           <div className={`absolute inset-0 w-full h-full ${!isBlue ? '-scale-x-100' : ''}`}>
             <img src={data.splash} className="w-full h-full object-cover object-[center_20%] opacity-80 transition-transform duration-500 group-hover:scale-110" alt="" />
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

// NOVO SELETOR MÚLTIPLO PARA CAMPEONATOS
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
    { id: 'SCRIM', label: 'SCRIMS' } // OPÇÃO DE SCRIMS ADICIONADA AQUI
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
        className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[160px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase"
      >
        <span className="flex-1 text-left">{currentLabel}</span>
        <span className={`text-[8px] text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 min-w-[200px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar">
          {options.map((opt) => {
            const isSelected = value.includes(opt.id);
            return (
              <button 
                key={opt.id} 
                onClick={() => toggleOption(opt.id)} 
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0 ${isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
              >
                <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                   {isSelected && <span className="text-white text-[8px] font-black">✓</span>}
                </div>
                <span className="text-[10px] font-bold uppercase">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
}

// O componente CockpitDropdown original ainda é mantido pois é usado pelo SplitSelector (que aceita só 1 escolha)
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
        className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg flex items-center justify-between gap-4 min-w-[160px] hover:border-zinc-600 transition-colors text-[10px] text-zinc-300 font-bold uppercase"
      >
        <span className="flex-1 text-left">{currentLabel}</span>
        <span className={`text-[8px] text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl z-[9999] max-h-[300px] overflow-y-auto custom-scrollbar">
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

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return (
    <CockpitDropdown label="TIMELINE" value={value} onChange={onChange} options={[
      { id: 'ALL', label: 'ANO INTEIRO' }, { id: 'SPLIT 1', label: 'SPLIT 1' }, 
      { id: 'SPLIT 2', label: 'SPLIT 2' }, { id: 'SPLIT 3', label: 'SPLIT 3' }
    ]} />
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

const CustomXAxisTick = ({ x, y, payload, teamChartData }: any) => {
  const match = teamChartData?.find((d: any) => d.match_id === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      {match?.opponent_logo ? (
        <image href={match.opponent_logo} x={-8} y={5} width="16" height="16" />
      ) : (
        <text x={0} y={15} textAnchor="middle" fill="#71717a" fontSize={8} fontWeight="bold">VS {String(match?.opponent_acronym || '?').toUpperCase()}</text>
      )}
    </g>
  );
};

const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl min-w-[140px] uppercase">
        <div className="space-y-1.5">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between items-center gap-3 text-[9px] font-bold text-white">
              <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                 <span className="text-zinc-400">{p.name}</span>
              </div>
              <span className="font-black">{p.value.toFixed(1)}</span>
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