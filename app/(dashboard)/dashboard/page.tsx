"use client";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, LabelList
} from 'recharts';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit2, Trash2, 
  Target, Activity, Brain, Swords, Shield, Plus, X, Clock, 
  BarChart2, PieChart as PieChartIcon, Check, Zap, Moon,
  Flame, Hourglass, Crosshair, Users, UserMinus, UserPlus, ListFilter, ChevronDown
} from 'lucide-react';

// --- FUNÇÕES UTILITÁRIAS GLOBAIS ---
function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

const getDifficultyColor = (diff: any) => { 
  const safeDiff = String(diff || '').toUpperCase();
  switch (safeDiff) { 
    case 'STOMPAMOS': return 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.3)]'; 
    case 'MUITO FÁCIL': return 'bg-teal-400 text-white border-teal-300'; 
    case 'FÁCIL': return 'bg-lime-500 text-white border-lime-400'; 
    case 'CONTROLADO': return 'bg-yellow-400 text-white border-yellow-300'; 
    case 'DIFÍCIL': return 'bg-orange-400 text-white border-orange-300'; 
    case 'MT DIFÍCIL': return 'bg-red-500 text-white border-red-400'; 
    case 'STOMPADOS': return 'bg-red-800 text-white border-red-700 shadow-[0_0_10px_rgba(153,27,27,0.3)]'; 
    default: return 'bg-zinc-800 text-zinc-300 border-zinc-700'; 
  } 
};

const formatDate = (dateString: string) => { 
  if (!dateString) return ''; 
  const p = dateString.split('-'); 
  return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; 
};

const getChampImage = (champName: string) => {
  if (!champName) return '';
  let name = String(champName).trim().replace(/['\s.]/g, ''); 
  
  const specialCases: Record<string, string> = {
    "wukong": "MonkeyKing", "renataglasc": "Renata", "ksante": "KSante", 
    "jarvaniv": "JarvanIV", "drmundo": "DrMundo", "tahmkench": "TahmKench", 
    "leesin": "LeeSin", "masteryi": "MasterYi", "missfortune": "MissFortune", 
    "xinzhao": "XinZhao", "twistedfate": "TwistedFate", "kogmaw": "KogMaw", 
    "aurelionsol": "AurelionSol", "reksai": "RekSai", "kaisa": "Kaisa", "chogath": "Chogath"
  };
  
  const rawLower = name.toLowerCase();
  name = specialCases[rawLower] ? specialCases[rawLower] : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  
  return `https://ddragon.leagueoflegends.com/cdn/14.5.1/img/champion/${name}.png`;
};

const getCurrentSplit = () => {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month >= 1 && month <= 5) return { id: `SPLIT 1 ${year}`, start: `${year}-01-01`, end: `${year}-05-31` };
  if (month >= 6 && month <= 11) return { id: `SPLIT 2 ${year}`, start: `${year}-06-01`, end: `${year}-11-30` };
  return { id: `OFF-SEASON ${year}`, start: `${year}-12-01`, end: `${year}-12-31` };
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState({ id: '', role: 'analista', puuid: 'PUUID_DE_TESTE_DO_JOGADOR', name: 'CARREGANDO...', photo: '' });
  const isStaff = ['analista', 'treinador', 'diretor'].includes(String(currentUser.role || '').toLowerCase());

  const [loading, setLoading] = useState(true);
  
  // FILTROS E ESTADOS TEMPORAIS
  const currentSplitObj = getCurrentSplit();
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState(currentSplitObj.id);
  const [filterStartDate, setFilterStartDate] = useState(currentSplitObj.start);
  const [filterEndDate, setFilterEndDate] = useState(currentSplitObj.end);
  const [filterPatch, setFilterPatch] = useState('');
  const [myTeamTag, setMyTeamTag] = useState('RMD'); 
  const [isSplitDropdownOpen, setSplitDropdownOpen] = useState(false);
  
  // PAGINAÇÃO DOS ADVANCED LOGS
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 20;
  
  const [matchesRaw, setMatchesRaw] = useState<any[]>([]);
  const [statsDetailed, setStatsDetailed] = useState<any[]>([]);
  const [missionsRaw, setMissionsRaw] = useState<any[]>([]);
  const [scrimReportsManual, setScrimReportsManual] = useState<any[]>([]);
  const [allPlayersList, setAllPlayersList] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [teamWellness, setTeamWellness] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]); 
  const [nextTargetIntel, setNextTargetIntel] = useState({ team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [], date: null });
  
  // UI STATE
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedWellnessId, setExpandedWellnessId] = useState<string | null>(null);
  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');
  const [oppChartMode, setOppChartMode] = useState<'COUNT' | 'RATE'>('COUNT');
  
  // ESTADOS DOS GRÁFICOS DO JOGADOR
  const [expandedChartMode, setExpandedChartMode] = useState<'OVERVIEW' | 'BIO' | 'TACTICAL' | 'CORRELATION'>('OVERVIEW');
  const [corrBio, setCorrBio] = useState('sleep_score');
  const [corrTact, setCorrTact] = useState('perf_score');

  // MODAIS & FORMS
  const [isWellnessModalOpen, setWellnessModalOpen] = useState(false);
  const [isMissionModalOpen, setMissionModalOpen] = useState(false);
  const [isScrimModalOpen, setScrimModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isRosterModalOpen, setRosterModalOpen] = useState(false);
  const [wellnessHistoryModal, setWellnessHistoryModal] = useState<{isOpen: boolean, player: any, history: any[]}>({ isOpen: false, player: null, history: [] });

  const [profileForm, setProfileForm] = useState({ name: '', photo_url: '' });
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [editScrimId, setEditScrimId] = useState<string | null>(null);
  const [wellnessForm, setWellnessForm] = useState({ puuid: '', sleep: 3, mental: 3, physical: 3, focus: 3 });
  const [missionForm, setMissionForm] = useState({ date: '', time: '', opponent: '', customOpponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' });
  const [scrimForm, setScrimForm] = useState({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
  
  // FORMS DO ELENCO
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState('');
  const [newPlayerForm, setNewPlayerForm] = useState({ nickname: '', role: 'TOP' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // OPÇÕES DO DROPDOWN DE SPLIT
  const splitOptions = useMemo(() => {
    const yr = new Date().getFullYear();
    return [
      { label: `SPLIT 1 ${yr}`, value: `SPLIT 1 ${yr}`, start: `${yr}-01-01`, end: `${yr}-05-31` },
      { label: `SPLIT 2 ${yr}`, value: `SPLIT 2 ${yr}`, start: `${yr}-06-01`, end: `${yr}-11-30` },
      { label: `ANO ${yr}`, value: `ANO ${yr}`, start: `${yr}-01-01`, end: `${yr}-12-31` },
      { label: 'TODO O HISTÓRICO', value: 'ALL', start: '', end: '' },
      { label: 'CUSTOMIZADO', value: 'CUSTOM', start: filterStartDate, end: filterEndDate }
    ];
  }, [filterStartDate, filterEndDate]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      const [authRes, configRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('squad_config').select('*').limit(1).maybeSingle()
      ]);

      const user = authRes.data?.user;
      let loggedUser = { id: '', role: 'jogador', puuid: '', name: 'JOGADOR', photo: `https://ui-avatars.com/api/?name=User&background=18181b&color=3b82f6` };

      if (user) {
         const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
         if (profile) {
            loggedUser.id = user.id;
            loggedUser.role = profile.role || 'jogador';
            loggedUser.puuid = profile.puuid || '';
            loggedUser.name = profile.full_name || 'JOGADOR';
            loggedUser.photo = profile.photo_url || `https://ui-avatars.com/api/?name=${profile.full_name || 'User'}&background=18181b&color=3b82f6`;
         }
      } else {
         loggedUser = { id: 'dev', role: 'analista', puuid: 'TESTE', name: 'HEAD COACH', photo: `https://ui-avatars.com/api/?name=C&background=18181b&color=3b82f6` };
      }

      const myTeam = configRes.data?.my_team_tag?.toUpperCase() || 'RMD';
      setMyTeamTag(myTeam);

      const [rosterRes, teamsRes, matchesRes, viewRes, statsRes, missionsRes, scrimsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('matches').select('id, match_id, game_start_time, game_type, patch').order('game_start_time', { ascending: false }).limit(10000),
        supabase.from('view_matches_with_teams').select('*').limit(10000),
        supabase.from('player_stats_detailed').select('match_id, puuid, team_acronym, lane_rating, impact_rating, conversion_rating, vision_rating, gold_diff_at_12, win, side, lane, patch').order('game_start_time', { ascending: false }).limit(15000),
        supabase.from('missions').select('*'),
        supabase.from('scrim_reports').select('*')
      ]);

      const allPlayersFetched = rosterRes.data || [];
      setAllPlayersList(allPlayersFetched);
      
      const activeRoster = allPlayersFetched.filter(p => String(p.team_acronym || p.team || '').toUpperCase().includes(myTeam));
      setRoster(activeRoster);

      const myPlayerInfo = activeRoster.find(p => p.puuid === loggedUser.puuid);
      if (myPlayerInfo) { 
          loggedUser.name = myPlayerInfo.nickname || myPlayerInfo.name; 
          if(myPlayerInfo.photo_url) loggedUser.photo = myPlayerInfo.photo_url; 
      }
      setCurrentUser(loggedUser);

      if (teamsRes.data) setTeamsList(teamsRes.data);
      if (statsRes.data) setStatsDetailed(statsRes.data);
      
      const safeMissions = (missionsRes.data || []).filter(m => String(m.team_acronym || '').toUpperCase().includes(myTeam));
      setMissionsRaw(safeMissions);
      
      const safeScrims = (scrimsRes.data || []).filter(s => String(s.team_acronym || '').toUpperCase().includes(myTeam));
      setScrimReportsManual(safeScrims);

      if (viewRes.data) {
        const matchMeta: Record<string, any> = {};
        if (matchesRes.data) {
            matchesRes.data.forEach(m => { matchMeta[m.id || m.match_id] = m; });
        }
        const enriched = viewRes.data
          .filter(v => {
             const b = String(v.blue_team_tag || v.blue_tag || '').toUpperCase();
             const r = String(v.red_team_tag || v.red_tag || '').toUpperCase();
             return b.includes(myTeam) || r.includes(myTeam);
          })
          .map(v => {
             const meta = matchMeta[v.match_id || v.id] || {};
             return { ...v, game_start_time: meta.game_start_time || v.game_start_time, game_type: meta.game_type || v.game_type, patch: meta.patch || v.patch };
          });
        setMatchesRaw(enriched.sort((a,b) => getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time)));
      }

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const activePuuids = activeRoster.map(p => p.puuid).filter(Boolean);

      const nextOfficial = safeMissions.filter(m => m.mission_date >= todayStr && m.mission_type === 'OFFICIAL').sort((a,b) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`));
      
      let targetMission = nextOfficial.length > 0 ? nextOfficial[0] : null;
      if (!targetMission) {
         const upcoming = safeMissions.filter(m => m.mission_date >= todayStr).sort((a,b) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`));
         if (upcoming.length > 0) targetMission = upcoming[0];
      }

      const fetchPromises: any[] = [
         activePuuids.length > 0 ? supabase.from('player_wellness').select('*').in('puuid', activePuuids).order('record_date', { ascending: false }) : Promise.resolve({ data: [] })
      ];

      if (targetMission) {
         const nextOp = targetMission.opponent_acronym;
         fetchPromises.push(supabase.from('hub_players_draft').select('*').eq('team_acronym', nextOp));
         fetchPromises.push(supabase.from('hub_players_performance').select('*').eq('team_acronym', nextOp));
         fetchPromises.push(supabase.from('hub_players_roster').select('*').eq('team_acronym', nextOp));
         fetchPromises.push(supabase.from('hub_players_objectives').select('*').eq('team_acronym', nextOp));
      }

      const [wellnessDataRes, draftRes, perfRes, hubRosterRes, objRes] = await Promise.all(fetchPromises);

      if (targetMission) {
         const nextOp = targetMission.opponent_acronym;
         let topPicks: any[] = []; 
         let topBans: any[] = [];
         
         if (draftRes && draftRes.data) {
             const picksRaw = draftRes.data.filter((d: any) => String(d.type||'').toLowerCase() === 'pick');
             
             const champGroups: Record<string, any> = {};
             picksRaw.forEach((p: any) => {
                 if (!champGroups[p.champion]) champGroups[p.champion] = { roles: new Set(), total: 0, wins: 0, minSeq: 99 };
                 champGroups[p.champion].roles.add(p.role);
                 champGroups[p.champion].total += Number(p.total_count) || 0;
                 champGroups[p.champion].wins += (Number(p.total_count) || 0) * ((Number(p.win_rate) || 0) / 100);
                 if (p.sequence < champGroups[p.champion].minSeq) champGroups[p.champion].minSeq = p.sequence;
             });

             topPicks = Object.entries(champGroups)
                 .sort((a: any, b: any) => b[1].total - a[1].total)
                 .slice(0, 3)
                 .map(([name, data]: any) => ({ 
                     name, 
                     winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0,
                     isFlex: data.roles.size > 1,
                     roles: Array.from(data.roles),
                     isBlind: data.minSeq <= 3 
                 }));
             
             const bans = draftRes.data.filter((d: any) => String(d.type||'').toLowerCase() === 'ban').sort((a: any, b: any) => b.total_count - a.total_count);
             topBans = bans.slice(0, 3).map((b: any) => ({ name: b.champion }));
         }
         
         const kpis: any[] = [];
         
         if (perfRes && perfRes.data && perfRes.data.length > 0) {
             let bW=0, bT=0, rW=0, rT=0;
             perfRes.data.forEach((m: any) => {
                const side = String(m.side).toLowerCase();
                const wStatus = String(m.win_status).toLowerCase();
                const isWin = wStatus === 'win' || wStatus === 'vitória' || wStatus === 'vitoria' || wStatus === '1' || wStatus === 'true';
                if (side.includes('blue') || side === '100') { bT++; if(isWin) bW++; }
                else if (side.includes('red') || side === '200') { rT++; if(isWin) rW++; }
             });
             const bWR = bT > 0 ? Math.round((bW/bT)*100) : 0;
             const rWR = rT > 0 ? Math.round((rW/rT)*100) : 0;
             
             kpis.push({ type: 'wr', blue: bWR, red: rWR });
             
             const totalLane = perfRes.data.reduce((acc: number, curr: any) => acc + (Number(curr.avg_lane)||0), 0);
             const avgLane = totalLane / perfRes.data.length;
             
             kpis.push({ 
                 type: avgLane >= 50 ? 'early' : 'scaling', 
                 text: avgLane >= 50 ? `Early Game Forte (Lane Score: ${Math.round(avgLane)})` : `Estilo Scaling (Lane Score: ${Math.round(avgLane)})` 
             });
         }
         
         if (hubRosterRes && hubRosterRes.data && hubRosterRes.data.length > 0) {
             const carry = [...hubRosterRes.data].sort((a: any, b: any) => (Number(b.median_impact) || 0) - (Number(a.median_impact) || 0))[0];
             if (carry) {
                 kpis.push({ 
                     type: 'pressure', 
                     text: `Foco de Pressão: Anular ${String(carry.primary_role).toUpperCase()} (${carry.nickname})`,
                     player: carry
                 });
             }
         }

         if (objRes && objRes.data && objRes.data.length > 0) {
             const firstDrake = objRes.data.find((o:any) => o.objective_type === 'DRAGON' && o.avg_minute > 4 && o.avg_minute < 10);
             const firstGrubs = objRes.data.find((o:any) => o.objective_type === 'HORDE' || o.objective_type === 'GRUBS');
             
             if (firstDrake || firstGrubs) {
                 kpis.push({
                     type: 'macro',
                     drakeTime: firstDrake ? Number(firstDrake.avg_minute).toFixed(1) : '-',
                     grubsTime: firstGrubs ? Number(firstGrubs.avg_minute).toFixed(1) : '-'
                 });
             }
         }

         if (kpis.length === 0) kpis.push({ type: 'empty', text: 'Aguardando coleta de dados.' });

         setNextTargetIntel({ 
             team: nextOp, 
             topPicks, 
             topBans, 
             winConditions: kpis, 
             date: targetMission.mission_date
         });
      }

      if (wellnessDataRes && wellnessDataRes.data) {
        setTeamWellness(activeRoster.map(p => {
           const pRecs = wellnessDataRes.data.filter((w: any) => w.puuid === p.puuid);
           const lRec = pRecs.length > 0 ? pRecs[0] : null;
           return { puuid: p.puuid, name: p.nickname || p.name, role: p.primary_role || p.role, photo: p.photo_url || p.photo, score: lRec ? lRec.readiness_percent : 0, sleep: lRec ? lRec.sleep_score : 0, mental: lRec ? lRec.mental_score : 0, physical: lRec ? lRec.physical_score : 0, hasAnsweredToday: !!(lRec && lRec.record_date === todayStr), history: pRecs };
        }));
      }
      if (activeRoster.length > 0) setWellnessForm(prev => ({ ...prev, puuid: activeRoster[0].puuid }));

      setLoading(false);
    }
    
    fetchDashboardData();
  }, [refreshTrigger]);

  const squadConfig = useMemo(() => {
    let intensity = 70; let load = 'NORMAL'; let directive = 'FUNDAMENTALS & SCRIMS'; let daysToMatch = -1;

    if (nextTargetIntel.date) {
        const today = new Date();
        const targetDate = new Date(`${nextTargetIntel.date}T00:00:00`);
        const diffTime = targetDate.getTime() - today.getTime();
        daysToMatch = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysToMatch === 0) { intensity = 100; load = 'MAXIMUM'; directive = 'MATCH DAY - EXECUTION'; }
        else if (daysToMatch === 1) { intensity = 60; load = 'MODERATE'; directive = 'TACTICAL REFINEMENT & VODS'; }
        else if (daysToMatch <= 3) { intensity = 95; load = 'HIGH'; directive = 'HEAVY SCRIM BLOCKS'; }
        else { intensity = 80; load = 'HIGH'; directive = 'FUNDAMENTALS & DRAFT PREP'; }
    } else {
        const day = new Date().getDay(); 
        if (day === 4) { intensity = 0; load = 'RECOVERY'; directive = 'REST & RECOVERY'; } 
        else if (day === 5) { intensity = 40; load = 'MODERATE'; directive = 'LIGHT PREP & MACRO REVIEW'; } 
        else if (day === 6 || day === 0) { intensity = 95; load = 'MAXIMUM'; directive = 'HEAVY SCRIM BLOCKS'; } 
    }
    
    return { directive, load, intensity, daysToMatch };
  }, [nextTargetIntel.date]);

  // BASE PURA: APENAS FILTRA TIPO E PATCH (Ignora a data para alimentar o Calendário)
  const calendarMatches = useMemo(() => {
    return matchesRaw.filter(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;
      if (filterPatch && m.patch && !String(m.patch).includes(filterPatch)) return false;
      return true;
    });
  }, [matchesRaw, matchType, filterPatch]);

 // FILTRAGEM GLOBAL: Afeta Radares, Win Rates e Logs
  const filteredMatches = useMemo(() => {
    return calendarMatches.filter(m => {
      if (filterStartDate || filterEndDate) {
          let matchDateStr = '';
          if (m.game_start_time) {
              const d = new Date(String(m.game_start_time).replace(' ', 'T'));
              if (!isNaN(d.getTime())) matchDateStr = d.toISOString().split('T')[0];
          }
          
          if (!matchDateStr) return false; 
          
          if (filterStartDate && matchDateStr < filterStartDate) return false;
          if (filterEndDate && matchDateStr > filterEndDate) return false;
      }
      return true;
    });
  }, [calendarMatches, filterStartDate, filterEndDate]);

  // CALENDÁRIO USA A BASE PURA
  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    calendarMatches.forEach(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
      
      let dateRaw = 'unknown-date'; let timeRaw = '00:00';
      
      if (m.game_start_time) {
          const d = new Date(String(m.game_start_time).replace(' ', 'T'));
          if (!isNaN(d.getTime())) {
             d.setHours(d.getHours() - 3);
             if (isScrim && d.getHours() < 6) d.setHours(d.getHours() - 6);
             timeRaw = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
             dateRaw = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
      }
      
      let sId = isScrim ? `SCRIM_${dateRaw}_${opp}` : `OFICIAL_${dateRaw}_${opp}`;
      if (!groups[sId]) groups[sId] = { id: sId, isScrim: isScrim, calendarDate: dateRaw, time: timeRaw, opp: opp || 'UNKNOWN', ourWins: 0, theirWins: 0, games: [] };
      groups[sId].games.push(m);
      
      const isOurWin = (weAreBlue && String(m.winner_side).toLowerCase() === 'blue') || (!weAreBlue && String(m.winner_side).toLowerCase() === 'red');
      if (isOurWin) groups[sId].ourWins++; else groups[sId].theirWins++;
    });
    return Object.values(groups);
  }, [calendarMatches, myTeamTag]);

  const opponentStatsData = useMemo(() => {
    const stats: Record<string, { opponent: string, wins: number, losses: number, total: number }> = {};
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? String(m.red_team_tag || m.red_tag) : String(m.blue_team_tag || m.blue_tag);
      const oppKey = opp.toUpperCase() || 'UNKNOWN';

      if (!stats[oppKey]) stats[oppKey] = { opponent: oppKey, wins: 0, losses: 0, total: 0 };
      
      const rawWinner = String(m.winner_side || '').toLowerCase();
      const isOurWin = (weAreBlue && (rawWinner === 'blue' || rawWinner === '100')) || (!weAreBlue && (rawWinner === 'red' || rawWinner === '200'));

      stats[oppKey].total++;
      if (isOurWin) stats[oppKey].wins++;
      else stats[oppKey].losses++;
    });

    return Object.values(stats)
      .map(s => ({ ...s, winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredMatches, myTeamTag]);

  const championshipStatsData = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? String(m.red_team_tag || m.red_tag) : String(m.blue_team_tag || m.blue_tag);
      const oppKey = opp.toUpperCase() || 'UNKNOWN';

      const teamObj = teamsList.find(t => String(t.acronym).toUpperCase() === oppKey);
      const region = teamObj ? String(teamObj.region || teamObj.league || teamObj.tier || 'OUTROS').toUpperCase() : 'OUTROS';

      if (!stats[region]) stats[region] = 0;
      stats[region]++;
    });

    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMatches, myTeamTag, teamsList]);

  const getTeamLogo = (acronym: string) => { 
     const t = teamsList.find(t => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
     return t?.logo_url || null; 
  };

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const grid = [];
    
    for(let i = firstDayIndex - 1; i >= 0; i--) {
        grid.push({ day: daysInPrevMonth - i, isGhost: true, events: [] });
    }
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const pastEvents = groupedSeries.filter(g => g.calendarDate === dateStr).map(g => {
            return { id: g.id, time: g.time, opp: g.opp, type: g.isScrim ? 'SCRIM' : 'OFICIAL', resultText: `${g.ourWins} - ${g.theirWins} ${g.ourWins > g.theirWins ? 'W' : g.theirWins > g.ourWins ? 'L' : 'D'}`, isWin: g.ourWins > g.theirWins, isPast: true, isAuto: true, logo: getTeamLogo(String(g.opp)) };
        });

        const manualPastEvents = scrimReportsManual.filter(s => s.scrim_date === dateStr).map(s => {
            return { id: s.id, time: 'MANUAL', opp: s.opponent_acronym, type: 'SCRIM', resultText: `${s.score} ${s.result}`, isWin: s.result === 'W', isPast: true, isAuto: false, logo: getTeamLogo(s.opponent_acronym), rawScrim: s };
        });

        const allPastEvents = [...pastEvents, ...manualPastEvents];
        const opponentsPlayedToday = allPastEvents.map(ev => String(ev.opp).toUpperCase().trim());

        const futureEvents = missionsRaw.filter(m => m.mission_date === dateStr).map(m => {
            const info = m.status ? m.status.split('|') : [];
            return { id: m.id, time: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', opp: m.opponent_acronym, type: m.mission_type, mode: info[1] ? info[1].trim() : 'TBD', isPast: false, isAuto: false, rawMission: m, logo: getTeamLogo(String(m.opponent_acronym)) };
        }).filter(mission => !opponentsPlayedToday.some(playedOpp => playedOpp.includes(String(mission.opp).toUpperCase().trim()) || String(mission.opp).toUpperCase().trim().includes(playedOpp)));

        grid.push({ day: i, dateStr, isToday: dateStr === new Date().toISOString().split('T')[0], events: [...allPastEvents, ...futureEvents].sort((a,b) => a.time.localeCompare(b.time)), isGhost: false });
    }
    
    let nextMonthDay = 1;
    while(grid.length % 7 !== 0) {
        grid.push({ day: nextMonthDay++, isGhost: true, events: [] });
    }
    
    return grid;
  }, [currentDate, groupedSeries, missionsRaw, scrimReportsManual, teamsList]);

  const stats = useMemo(() => {
    const total = filteredMatches.length;
    let blueTotal = 0; let blueWins = 0; let redTotal = 0; let redWins = 0;
    
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const weAreRed = String(m.red_team_tag || m.red_tag || '').toUpperCase().includes(myTeamTag);
      const rawWinner = String(m.winner_side || '').toLowerCase().trim();

      if (weAreBlue) { blueTotal++; if (rawWinner === 'blue' || rawWinner === '100') blueWins++; } 
      else if (weAreRed) { redTotal++; if (rawWinner === 'red' || rawWinner === '200') redWins++; }
    });

    const activeMatchIds = new Set<string>(
      filteredMatches.reduce((acc: string[], m: any) => {
        if (m.id) acc.push(String(m.id));
        if (m.match_id) acc.push(String(m.match_id));
        return acc;
      }, [])
    );
    
    const teamStatsFiltered = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag));
    const avgGold12 = teamStatsFiltered.length > 0 ? Math.round(teamStatsFiltered.reduce((acc, curr) => acc + (Number(curr.gold_diff_at_12) || 0), 0) / teamStatsFiltered.length) : 0;

    return { totalGames: total, blueWR: blueTotal ? Math.round((blueWins / blueTotal) * 100) : 0, redWR: redTotal ? Math.round((redWins / redTotal) * 100) : 0, blueWins, blueTotal, redWins, redTotal, avgDuration: 0, avgGold12 };
  }, [filteredMatches, statsDetailed, myTeamTag]);

  const myStats = useMemo(() => {
     let temp = { lane: 0, impact: 0, conversion: 0, vision: 0 };
     
     const activeMatchIds = new Set<string>(
       filteredMatches.reduce((acc: string[], m: any) => {
         if (m.id) acc.push(String(m.id));
         if (m.match_id) acc.push(String(m.match_id));
         return acc;
       }, [])
     );

     const myGames = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && s.puuid === currentUser.puuid);
     
     if (myGames.length > 0) {
        const getMed = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2; };
        temp.lane = Math.round(getMed(myGames.map(s => Number(s.lane_rating) || 0)));
        temp.impact = Math.round(getMed(myGames.map(s => Number(s.impact_rating) || 0)));
        temp.conversion = Math.round(getMed(myGames.map(s => Number(s.conversion_rating) || 0)));
        temp.vision = Math.round(getMed(myGames.map(s => Number(s.vision_rating) || 0)));
     }
     return temp;
  }, [statsDetailed, filteredMatches, currentUser.puuid]);

  const earlyGameSnowball = useMemo(() => {
    const recentMatches = [...filteredMatches].slice(0, 10).reverse();
    
    return recentMatches.map((m, index) => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
      const fullOpp = opp ? String(opp).toUpperCase() : 'UNKNOWN';
      const oppKey = fullOpp.substring(0, 4);

      const teamStats = statsDetailed.filter(s => (s.match_id === m.id || s.match_id === m.match_id) && String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag));
      const totalGD12 = teamStats.reduce((acc, curr) => acc + (Number(curr.gold_diff_at_12) || 0), 0);

      const rawWinner = String(m.winner_side || '').toLowerCase();
      const isOurWin = (weAreBlue && (rawWinner === 'blue' || rawWinner === '100')) || (!weAreBlue && (rawWinner === 'red' || rawWinner === '200'));

      let dateFormatted = '';
      if (m.game_start_time) {
          const d = new Date(String(m.game_start_time).replace(' ', 'T'));
          if (!isNaN(d.getTime())) {
             dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
      }

      return {
         uniqueKey: `eg_${index}`,
         match: oppKey,
         fullOpponent: fullOpp,
         date: dateFormatted,
         goldDiff: totalGD12,
         isWin: isOurWin
      };
    });
  }, [filteredMatches, statsDetailed, myTeamTag]);

  const radarData = useMemo<any[]>(() => {
    const calcAvg = (matchesSet: Set<string>, getOp: boolean = false) => {
       const relevantStats = statsDetailed.filter(s => matchesSet.has(String(s.match_id)));
       const filtered = relevantStats.filter(s => { const isUs = String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag); return getOp ? !isUs : isUs; });
       if (!filtered.length) return { l: 0, i: 0, c: 0, v: 0, o: 0 };
       const l = filtered.reduce((a,b)=>a+(Number(b.lane_rating)||0),0)/filtered.length;
       const i = filtered.reduce((a,b)=>a+(Number(b.impact_rating)||0),0)/filtered.length;
       const c = filtered.reduce((a,b)=>a+(Number(b.conversion_rating)||0),0)/filtered.length;
       const v = filtered.reduce((a,b)=>a+(Number(b.vision_rating)||0),0)/filtered.length;
       return { l: Math.round(l), i: Math.round(i), c: Math.round(c), v: Math.round(v), o: Math.round((l+i+c+v)/4) };
    };

    if (radarCompareMode === 'OFFICIAL_VS_SCRIM') {
       const offIds = new Set<string>(
           filteredMatches.filter(m => !String(m.game_type || '').toUpperCase().includes('SCRIM')).reduce((acc: string[], m: any) => {
             if (m.id) acc.push(String(m.id));
             if (m.match_id) acc.push(String(m.match_id));
             return acc;
           }, [])
       );
       const scrimIds = new Set<string>(
           filteredMatches.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).reduce((acc: string[], m: any) => {
             if (m.id) acc.push(String(m.id));
             if (m.match_id) acc.push(String(m.match_id));
             return acc;
           }, [])
       );
       const offStats = calcAvg(offIds, false); const scrimStats = calcAvg(scrimIds, false);
       return [
         { subject: 'Lane Dom.', Oficial: offStats.l, Scrim: scrimStats.l }, 
         { subject: 'Impact', Oficial: offStats.i, Scrim: scrimStats.i }, 
         { subject: 'Conversion', Oficial: offStats.c, Scrim: scrimStats.c }, 
         { subject: 'Vision', Oficial: offStats.v, Scrim: scrimStats.v }, 
         { subject: 'Overall', Oficial: offStats.o, Scrim: scrimStats.o }
       ];
    } else {
       const activeIds = new Set<string>(
           filteredMatches.reduce((acc: string[], m: any) => {
             if (m.id) acc.push(String(m.id));
             if (m.match_id) acc.push(String(m.match_id));
             return acc;
           }, [])
       );
       const usStats = calcAvg(activeIds, false); const oppStats = calcAvg(activeIds, true);
       return [
         { subject: 'Lane Dom.', [myTeamTag]: usStats.l, Oponentes: oppStats.l }, 
         { subject: 'Impact', [myTeamTag]: usStats.i, Oponentes: oppStats.i }, 
         { subject: 'Conversion', [myTeamTag]: usStats.c, Oponentes: oppStats.c }, 
         { subject: 'Vision', [myTeamTag]: usStats.v, Oponentes: oppStats.v }, 
         { subject: 'Overall', [myTeamTag]: usStats.o, Oponentes: oppStats.o }
       ];
    }
  }, [radarCompareMode, statsDetailed, filteredMatches, myTeamTag]);

  const advancedScrims = useMemo(() => {
    const autoScrimBlocks = new Map();
    filteredMatches.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).forEach(m => {
       const d = new Date(String(m.game_start_time).replace(' ', 'T'));
       if (!isNaN(d.getTime())) d.setHours(d.getHours() - 6);
       const dateRaw = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       const opp = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag) ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
       const key = `${dateRaw}_${opp}`;
       
       if (!autoScrimBlocks.has(key)) autoScrimBlocks.set(key, { date: dateRaw, opp, wins: 0, losses: 0, games: [] });
       const block = autoScrimBlocks.get(key); block.games.push(m);
       const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
       const rawWinner = String(m.winner_side || '').toLowerCase();
       if ((weAreBlue && (rawWinner === 'blue' || rawWinner === '100')) || (!weAreBlue && (rawWinner === 'red' || rawWinner === '200'))) block.wins++; else block.losses++;
    });

    const finalList: any[] = [];
    
    autoScrimBlocks.forEach((block, key) => {
       const manual = scrimReportsManual.find(sm => sm.scrim_date === block.date && sm.opponent_acronym === block.opp) || {};
       finalList.push({ id: manual.id || `auto_${key}`, date: block.date, opponent: block.opp, result: block.wins > block.losses ? 'W' : block.losses > block.wins ? 'L' : 'D', score: `${block.wins} - ${block.losses}`, mode: manual.mode || `MD${block.games.length}`, comp: manual.comp_tested || 'AUTOMATIC LOG', difficulty: manual.difficulty || 'CONTROLADO', punctuality: manual.punctuality || 'PONTUAIS', remakes: manual.remakes || 0, isManual: !!manual.id, isMission: false });
    });
    
    scrimReportsManual.forEach(sm => { 
        if (!finalList.find(f => f.id === sm.id)) {
            if (filterStartDate && sm.scrim_date < filterStartDate) return;
            if (filterEndDate && sm.scrim_date > filterEndDate) return;
            finalList.push({ id: sm.id, date: sm.scrim_date, opponent: sm.opponent_acronym, result: sm.result, score: sm.score, mode: sm.mode, comp: sm.comp_tested, difficulty: sm.difficulty || 'CONTROLADO', punctuality: sm.punctuality || 'PONTUAIS', remakes: sm.remakes || 0, isManual: true, isMission: false }); 
        }
    });

    missionsRaw.forEach(m => {
        if (filterStartDate && m.mission_date < filterStartDate) return;
        if (filterEndDate && m.mission_date > filterEndDate) return;

        const info = m.status ? m.status.split('|') : [];
        const mode = info.length >= 2 ? info[1].trim() : 'TBD';
        
        finalList.push({
            id: m.id,
            date: m.mission_date,
            opponent: m.opponent_acronym,
            result: 'AGEND.', 
            score: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', 
            mode: mode,
            comp: m.mission_type, 
            difficulty: 'AGUARDANDO',
            punctuality: '-',
            remakes: 0,
            isManual: true,
            isMission: true, 
            rawObj: m
        });
    });

    return finalList.sort((a,b) => getSafeTimestamp(b.date) - getSafeTimestamp(a.date));
  }, [filteredMatches, scrimReportsManual, missionsRaw, myTeamTag, filterStartDate, filterEndDate]);

  // Efeito de reset da página de logs
  useEffect(() => {
    setLogsPage(1);
  }, [advancedScrims]);

  const chartIntelligence = useMemo(() => {
      const diffOrder = ['STOMPAMOS', 'MUITO FÁCIL', 'FÁCIL', 'CONTROLADO', 'DIFÍCIL', 'MT DIFÍCIL', 'STOMPADOS'];
      const diffCounts: Record<string, number> = {};
      diffOrder.forEach(d => diffCounts[d] = 0);

      const tierCounts: Record<string, Record<string, number>> = { 'Bad': {}, 'Average': {}, 'Good': {}, 'Excellent': {} };
      ['Bad', 'Average', 'Good', 'Excellent'].forEach(t => { diffOrder.forEach(d => tierCounts[t][d] = 0); });

      // CORREÇÃO: Ignorar missões futuras para não poluir os dados com "AGUARDANDO"
      const validScrims = advancedScrims.filter(s => !s.isMission && s.result !== 'AGEND.');

      validScrims.forEach((scrim) => {
          const diff = diffOrder.includes(String(scrim.difficulty || '').toUpperCase()) ? String(scrim.difficulty || '').toUpperCase() : 'CONTROLADO';
          diffCounts[diff]++;
          const opponentData = teamsList.find(t => t.acronym === scrim.opponent);
          let rawTier = opponentData?.tier ? String(opponentData.tier).trim() : 'Average';
          rawTier = rawTier.charAt(0).toUpperCase() + rawTier.slice(1).toLowerCase();
          const assignedTier = ['Bad', 'Average', 'Good', 'Excellent'].includes(rawTier) ? rawTier : 'Average';
          tierCounts[assignedTier][diff]++;
      });

      return { 
        stressData: diffOrder.map(diff => ({ name: diff.replace('MUITO', 'MT').replace('STOMPAMOS', 'STOMP.').replace('STOMPADOS', 'STOMP.'), count: diffCounts[diff] })), 
        efficiencyData: ['Bad', 'Average', 'Good', 'Excellent'].map(tier => ({ name: tier, ...tierCounts[tier] })) 
      };
  }, [advancedScrims, teamsList]);

  const expandedPlayer = useMemo(() => {
    return teamWellness.find(p => p.puuid === expandedWellnessId);
  }, [teamWellness, expandedWellnessId]);

  const groupedTeamsByRegion = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    teamsList.forEach(t => {
      let region = String(t.region || t.league || 'OUTRAS REGIÕES');
      let upperRegion = region.toUpperCase().trim();

      const nameUpper = String(t.name || '').toUpperCase();
      const acrUpper = String(t.acronym || '').toUpperCase();

      const isAcademy = nameUpper.includes('ACADEMY') || acrUpper.includes('ACADEMY');
      if ((upperRegion === 'CBLOL' && isAcademy) || upperRegion === 'CBLOL ACADEMY') {
        upperRegion = 'CIRCUITO DESAFIANTE';
      }

      if (!groups[upperRegion]) groups[upperRegion] = [];
      groups[upperRegion].push(t);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'CIRCUITO DESAFIANTE') return -1;
      if (b === 'CIRCUITO DESAFIANTE') return 1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, any[]> = {};
    sortedKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [teamsList]);

  const wellnessChartData = useMemo(() => {
    if (!expandedPlayer || !expandedPlayer.history) return [];
    const matchDates: Record<string, string> = {};
    filteredMatches.forEach(m => {
      if (m.game_start_time) {
        const d = new Date(String(m.game_start_time).replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          d.setHours(d.getHours() - 3);
          const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
          if (isScrim && d.getHours() < 6) d.setHours(d.getHours() - 6);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          if (m.id) matchDates[String(m.id)] = dateStr;
          if (m.match_id) matchDates[String(m.match_id)] = dateStr;
        }
      }
    });

    const statsByDate: Record<string, {l:number[], i:number[], c:number[], v:number[], o:number[]}> = {};
    statsDetailed.forEach(s => {
      if (s.puuid === expandedPlayer.puuid && matchDates[String(s.match_id)]) {
        const dateStr = matchDates[String(s.match_id)];
        const l = Number(s.lane_rating)||0; const i = Number(s.impact_rating)||0; const c = Number(s.conversion_rating)||0; const v = Number(s.vision_rating)||0; const o = (l+i+c+v)/4;
        if (!statsByDate[dateStr]) statsByDate[dateStr] = {l:[], i:[], c:[], v:[], o:[]};
        statsByDate[dateStr].l.push(l); statsByDate[dateStr].i.push(i); statsByDate[dateStr].c.push(c); statsByDate[dateStr].v.push(v); statsByDate[dateStr].o.push(o);
      }
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;

    const filteredHistory = expandedPlayer.history.filter((record: any) => {
        if (filterStartDate && record.record_date < filterStartDate) return false;
        if (filterEndDate && record.record_date > filterEndDate) return false;
        return true;
    });

    return [...filteredHistory].reverse().map((record: any) => ({
      ...record,
      perf_score: statsByDate[record.record_date] ? Math.round(avg(statsByDate[record.record_date].o) || 0) : null,
      lane_score: statsByDate[record.record_date] ? Math.round(avg(statsByDate[record.record_date].l) || 0) : null,
      impact_score: statsByDate[record.record_date] ? Math.round(avg(statsByDate[record.record_date].i) || 0) : null,
      conv_score: statsByDate[record.record_date] ? Math.round(avg(statsByDate[record.record_date].c) || 0) : null,
      vision_score: statsByDate[record.record_date] ? Math.round(avg(statsByDate[record.record_date].v) || 0) : null,
    }));
  }, [expandedPlayer, filteredMatches, statsDetailed, filterStartDate, filterEndDate]);

  const currentTargetH2H = useMemo(() => {
     if (nextTargetIntel.team === 'SEM ALVO') return null;
     return opponentStatsData.find(s => s.opponent === nextTargetIntel.team) || { wins: 0, losses: 0, total: 0 };
  }, [opponentStatsData, nextTargetIntel.team]);

  const getBioName = (key: string) => { if (key === 'sleep_score') return 'Qualidade do Sono'; if (key === 'mental_score') return 'Estado Mental'; if (key === 'physical_score') return 'Estado Físico'; return 'Readiness Geral (%)'; };
  const getTactName = (key: string) => { if (key === 'lane_score') return 'Dominância de Rota'; if (key === 'impact_score') return 'Impacto no Mapa'; if (key === 'conv_score') return 'Conversão'; if (key === 'vision_score') return 'Controle de Visão'; return 'Performance Overall'; };

  const intensityTheme = squadConfig.intensity < 40 ? { text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.8)]' } : squadConfig.intensity < 75 ? { text: 'text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]' } : { text: 'text-red-400', bg: 'bg-red-500', shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.8)]' };

  const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#64748b'];

  const handleDayClick = (dateStr: string) => { 
     if(!isStaff) return; 
     
     const clickedDate = new Date(dateStr + "T00:00:00");
     const today = new Date();
     today.setHours(0,0,0,0);

     if (clickedDate < today) {
         setEditScrimId(null);
         setScrimForm({ 
            date: dateStr, 
            opponent: '', 
            result: 'W', 
            score: '', 
            mode: 'MD1', 
            comp: '', 
            difficulty: 'CONTROLADO', 
            punctuality: 'PONTUAIS', 
            remakes: 0, 
            match_ids: '' 
         });
         setScrimModalOpen(true);
     } else {
         setEditMissionId(null); 
         setMissionForm({ 
            date: dateStr, 
            time: '14:00', 
            opponent: '', 
            customOpponent: '', 
            type: 'SCRIM', 
            gamesCount: '3 JOGOS', 
            draftMode: 'PADRÃO' 
         }); 
         setMissionModalOpen(true); 
     }
  };
  
  const handleEditMission = (e: React.MouseEvent, m: any) => { 
     e.stopPropagation(); 
     if(!isStaff) return; 
     setEditMissionId(m.id); 
     const info = (m && m.status) ? String(m.status).split('|') : []; 
     let gc = '3 JOGOS'; let dm = 'PADRÃO'; 
     if (info.length >= 3) { gc = info[1].trim(); dm = info[2].trim(); } 
     
     const isKnownTeam = teamsList.some(t => t.acronym === m.opponent_acronym);
     
     setMissionForm({ 
        date: m.mission_date, 
        time: m.mission_time.substring(0,5), 
        opponent: isKnownTeam ? m.opponent_acronym : 'MIX', 
        customOpponent: !isKnownTeam ? m.opponent_acronym : '', 
        type: m.mission_type, 
        gamesCount: gc, 
        draftMode: dm 
     }); 
     setMissionModalOpen(true); 
  }

  const handleEditCalendarEvent = (e: React.MouseEvent, ev: any) => { 
     e.stopPropagation(); 
     if (!isStaff) return; 

     if (ev.isPast && !ev.isAuto) { 
        const s = ev.rawScrim; 
        setEditScrimId(s.id); 
        setScrimForm({ date: s.scrim_date, opponent: s.opponent_acronym, result: s.result, score: s.score, mode: s.mode, comp: s.comp_tested || '', difficulty: s.difficulty || 'CONTROLADO', punctuality: s.punctuality || 'PONTUAIS', remakes: s.remakes || 0, match_ids: s.match_ids || '' }); 
        setScrimModalOpen(true); 
     } else if (!ev.isPast) { 
        handleEditMission(e, ev.rawMission); 
     } 
  };

  const handleDeleteCalendarEvent = async (ev: any) => { 
     if (!window.confirm("Deseja eliminar este registo?")) return; 
     if (ev.isPast && !ev.isAuto) { 
        await supabase.from('scrim_reports').delete().eq('id', ev.id); 
        setScrimReportsManual(prev => prev.filter(s => s.id !== ev.id)); 
     } else if (!ev.isPast) { 
        await supabase.from('missions').delete().eq('id', ev.id); 
        setMissionsRaw(prev => prev.filter(m => m.id !== ev.id)); 
     } 
  };
  
  const handleSaveMission = async (e: React.FormEvent) => { 
     e.preventDefault(); 
     const finalOpp = missionForm.opponent === 'MIX' ? missionForm.customOpponent.toUpperCase() : missionForm.opponent;
     if (!finalOpp.trim()) return alert('Insira o nome da equipe adversária.');

     const d = missionForm.date; 
     const t = missionForm.time.length === 5 ? `${missionForm.time}:00` : missionForm.time; 
     const statusEncoded = `SCHEDULED | ${missionForm.gamesCount} | ${missionForm.draftMode}`; 
     
     const payload = { 
        team_acronym: myTeamTag, 
        mission_date: d, 
        mission_time: t, 
        opponent_acronym: finalOpp, 
        mission_type: missionForm.type, 
        status: statusEncoded 
     }; 
     
     if (editMissionId) { 
        const { data } = await supabase.from('missions').update(payload).eq('id', editMissionId).select(); 
        if (data) { 
           setMissionsRaw(prev => prev.map(m => m.id === editMissionId ? data[0] : m)); 
           setMissionModalOpen(false); 
        } 
     } else { 
        const { data } = await supabase.from('missions').insert([payload]).select(); 
        if (data) { 
           setMissionsRaw(prev => [...prev, data[0]]); 
           setMissionModalOpen(false); 
        } 
     } 
  };
  
  const handleUpdateProfile = async (e: React.FormEvent) => { e.preventDefault(); if (currentUser.id === 'dev') return alert('Modo Dev Ativo. Inicia sessão para guardar as edições.'); const { error } = await supabase.from('profiles').update({ full_name: profileForm.name, photo_url: profileForm.photo_url }).eq('id', currentUser.id); if (!error) { setCurrentUser({ ...currentUser, name: profileForm.name, photo: profileForm.photo_url || `https://ui-avatars.com/api/?name=${profileForm.name}&background=18181b&color=3b82f6` }); setProfileModalOpen(false); } };
  
  const handleSaveScrim = async (e: React.FormEvent) => { 
     e.preventDefault(); 
     const payload = { 
         team_acronym: myTeamTag, 
         scrim_date: scrimForm.date || new Date().toISOString().split('T')[0], 
         opponent_acronym: scrimForm.opponent, 
         result: scrimForm.result, 
         score: scrimForm.score, 
         mode: scrimForm.mode, 
         comp_tested: scrimForm.comp, 
         difficulty: scrimForm.difficulty, 
         punctuality: scrimForm.punctuality, 
         remakes: scrimForm.remakes, 
         match_ids: scrimForm.match_ids 
     }; 
     
     if (editScrimId) { 
         const { data, error } = await supabase.from('scrim_reports').update(payload).eq('id', editScrimId).select(); 
         if (data && !error) { 
            setScrimReportsManual(prev => prev.map(s => s.id === editScrimId ? data[0] : s)); 
            setScrimModalOpen(false); 
         } 
     } else { 
         const { data, error } = await supabase.from('scrim_reports').insert([payload]).select(); 
         if (data && !error) { 
            setScrimReportsManual(prev => [data[0], ...prev]); 
            
            const relatedMission = missionsRaw.find(m => m.mission_date === payload.scrim_date && m.opponent_acronym === payload.opponent_acronym);
            if (relatedMission) {
                await supabase.from('missions').delete().eq('id', relatedMission.id);
                setMissionsRaw(prev => prev.filter(m => m.id !== relatedMission.id));
            }

            setScrimModalOpen(false); 
         } 
     } 
  };
  
  const handleWellnessSubmit = async (e: React.FormEvent) => { e.preventDefault(); const r = Math.round(((wellnessForm.sleep + wellnessForm.mental + wellnessForm.physical) / 15) * 100); const td = new Date().toISOString().split('T')[0]; const { data } = await supabase.from('player_wellness').upsert({ puuid: wellnessForm.puuid, record_date: td, sleep_score: wellnessForm.sleep, mental_score: wellnessForm.mental, physical_score: wellnessForm.physical, focus_score: wellnessForm.focus, readiness_percent: r }, { onConflict: 'puuid, record_date' }).select(); if (data) { setTeamWellness(prev => prev.map(p => p.puuid === wellnessForm.puuid ? { ...p, score: r, sleep: wellnessForm.sleep, mental: wellnessForm.mental, physical: wellnessForm.physical, hasAnsweredToday: true } : p)); setWellnessModalOpen(false); } };

  // LÓGICA DE MERCADO / GESTÃO DE ELENCO
  const handleRemoveFromRoster = async (player: any) => {
      if (!window.confirm(`Tens a certeza que queres remover ${player.nickname} da equipa?`)) return;
      
      // CORREÇÃO: Usar apenas team_acronym
      const { error } = await supabase.from('players').update({ team_acronym: 'FA' }).eq('puuid', player.puuid);
      
      if (error) {
          alert('Erro ao remover jogador da base de dados: ' + error.message);
          return;
      }
      
      setRoster(prev => prev.filter(p => p.puuid !== player.puuid));
      setRefreshTrigger(prev => prev + 1);
  };

  const handleAddExistingPlayer = async () => {
      if (!selectedPlayerToAdd) return alert("Seleciona um jogador da lista.");
      const player = allPlayersList.find(p => p.puuid === selectedPlayerToAdd);
      if (!player) return;

      // CORREÇÃO: Usar apenas team_acronym
      const { error } = await supabase.from('players').update({ team_acronym: myTeamTag }).eq('puuid', player.puuid);
      
      if (error) {
          alert('Erro ao adicionar jogador: ' + error.message);
          return;
      }
      
      setSelectedPlayerToAdd('');
      setRoster(prev => [...prev, { ...player, team_acronym: myTeamTag }]);
      alert(`${player.nickname} foi adicionado com sucesso!`);
      setRefreshTrigger(prev => prev + 1);
  };

  const handleCreateNewPlayer = async () => {
      if (!newPlayerForm.nickname.trim()) return alert("Insere o Nickname do jogador.");
      const tempPuuid = 'PUUID_MANUAL_' + Date.now(); 
      const payload = {
          puuid: tempPuuid,
          nickname: newPlayerForm.nickname.toUpperCase(),
          team_acronym: myTeamTag, // CORREÇÃO: Usar apenas team_acronym
          primary_role: newPlayerForm.role,
          photo_url: `https://ui-avatars.com/api/?name=${newPlayerForm.nickname}&background=18181b&color=10b981`
      };

      const { data, error } = await supabase.from('players').insert([payload]).select();
      
      if (error) {
          alert('Erro ao criar jogador: ' + error.message);
          return;
      }
      
      setNewPlayerForm({ nickname: '', role: 'TOP' });
      if (data && data.length > 0) {
          setRoster(prev => [...prev, data[0]]);
      }
      alert(`Jogador Criado e Adicionado!`);
      setRefreshTrigger(prev => prev + 1);
  };

  const totalLogPages = Math.ceil(advancedScrims.length / LOGS_PER_PAGE);
  const paginatedLogs = advancedScrims.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-4">
      <div className="w-10 h-10 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase animate-pulse">A Sincronizar Base de Dados...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans relative">
      
      {/* OVERLAY PARA FECHAR O DROPDOWN QUANDO SE CLICA FORA */}
      {isSplitDropdownOpen && (
         <div className="fixed inset-0 z-[998]" onClick={() => setSplitDropdownOpen(false)}></div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-glow { animation: pulseGlow 2s infinite; }
        .hover-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}} />

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 pb-20">
        
        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="animate-fade-in-up flex flex-wrap items-center justify-center gap-4 bg-zinc-950/80 backdrop-blur-xl p-2.5 rounded-2xl border border-zinc-800/80 shadow-lg max-w-fit mx-auto sticky top-4 z-[999]" style={{ opacity: 0, animationDelay: '0.1s' }}>
           <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
             <button onClick={() => setMatchType('ALL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'ALL' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>AMBOS</button>
             <button onClick={() => setMatchType('OFICIAL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>OFICIAL</button>
             <button onClick={() => setMatchType('SCRIM')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'SCRIM' ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>SCRIMS</button>
           </div>
           
           <div className="h-5 w-px bg-zinc-800 hidden md:block"></div>
           
           {/* NOVO: DROPDOWN DE SPLIT CUSTOMIZADO */}
           <div className="relative">
              <div 
                 onClick={() => setSplitDropdownOpen(!isSplitDropdownOpen)} 
                 className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2 cursor-pointer transition-colors"
              >
                 <ListFilter size={12} className="text-blue-500" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {splitOptions.find(o => o.value === selectedPeriod)?.label || selectedPeriod}
                 </span>
                 <ChevronDown size={14} className="text-zinc-500 ml-1" />
              </div>
              
              {isSplitDropdownOpen && (
                 <div className="absolute top-[calc(100%+8px)] left-0 w-[200px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1.5 overflow-hidden z-[1000] animate-[fadeInUp_0.2s_ease-out_forwards]">
                    {splitOptions.map(opt => (
                       <div 
                          key={opt.value} 
                          onClick={() => {
                             setSelectedPeriod(opt.value);
                             if (opt.value !== 'CUSTOM') {
                                 setFilterStartDate(opt.start);
                                 setFilterEndDate(opt.end);
                             }
                             setSplitDropdownOpen(false);
                          }} 
                          className={`px-4 py-3 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-between ${selectedPeriod === opt.value ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                       >
                          {opt.label}
                          {selectedPeriod === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.8)]"></div>}
                       </div>
                    ))}
                 </div>
              )}
           </div>

           <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
              <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setSelectedPeriod('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
              <span className="text-zinc-600 text-[10px] font-black uppercase">ATÉ</span>
              <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setSelectedPeriod('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
           </div>
        </div>

        {/* ----------------------------------------------------
            TOP BAR (COCKPIT): PROFILE + DIRECTIVE
        ---------------------------------------------------- */}
        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-4 md:p-6 flex flex-col xl:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden mt-6" style={{ opacity: 0, animationDelay: '0.15s' }}>
           <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-50 pointer-events-none"></div>
           
           <div className="flex items-center gap-5 w-full xl:w-auto relative z-10">
              <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-xl bg-zinc-900 border-2 border-zinc-700 overflow-hidden shadow-md">
                     <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white font-black text-[7px] px-1.5 py-0.5 rounded shadow-lg uppercase tracking-widest">{isStaff ? 'STAFF' : 'ROSTER'}</div>
              </div>
              <div className="flex flex-col justify-center flex-1">
                 <div className="flex items-center gap-3 mb-0.5">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight truncate drop-shadow-md">{currentUser.name}</h2>
                    <button onClick={() => { setProfileForm({ name: currentUser.name, photo_url: currentUser.photo }); setProfileModalOpen(true); }} className="text-[8px] font-bold text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 px-2 py-1 rounded transition-colors uppercase tracking-widest">EDITAR</button>
                    {isStaff && (
                       <button onClick={() => setRosterModalOpen(true)} className="ml-2 text-[8px] font-black text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 px-2.5 py-1 rounded transition-all uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <Users size={10} /> ELENCO
                       </button>
                    )}
                 </div>
                 <div className="flex flex-wrap gap-2 mt-1">
                    <Badge text={currentUser.role} color="bg-blue-600 border-blue-500" />
                    <Badge text={myTeamTag} color="bg-zinc-800 text-zinc-300 border-zinc-700" />
                 </div>
              </div>
           </div>

           {!isStaff && (
              <div className="hidden md:flex flex-1 items-center gap-6 px-6 border-x border-zinc-800/60 relative z-10">
                 <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between gap-4">
                       <MiniStatBar label="LANE" value={myStats.lane} color="bg-blue-500" />
                       <MiniStatBar label="IMPACT" value={myStats.impact} color="bg-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <MiniStatBar label="CONV." value={myStats.conversion} color="bg-amber-500" />
                       <MiniStatBar label="VISION" value={myStats.vision} color="bg-purple-500" />
                    </div>
                 </div>
              </div>
           )}

           <div className="flex items-center gap-4 w-full xl:w-[350px] shrink-0 relative z-10 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50">
              <div className={`w-1 h-full rounded-full ${intensityTheme.bg}`}></div>
              <div className="flex flex-col flex-1">
                 <div className="flex justify-between items-end mb-1">
                    <span className="text-[8px] text-zinc-500 font-black tracking-widest uppercase">DIRETRIZ DA STAFF</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${intensityTheme.text}`}>{squadConfig.load}</span>
                 </div>
                 <span className="text-white text-[11px] font-black uppercase tracking-tight truncate leading-tight mb-1.5">{squadConfig.directive}</span>
                 <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div className={`h-full ${intensityTheme.bg} transition-all duration-1000 ease-out`} style={{ width: `${squadConfig.intensity}%` }}></div>
                 </div>
              </div>
           </div>
        </div>

        {/* DIVISOR SECÇÃO 1 */}
        <div className="flex items-center gap-4 py-2 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.2s' }}>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
           <h2 className="text-[9px] font-black tracking-[0.3em] text-zinc-600 uppercase flex items-center gap-2">
             <div className="w-1 h-1 bg-blue-500 rounded-full"></div> Operações Diárias
           </h2>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
        </div>

        {/* ----------------------------------------------------
            SECÇÃO 1: CALENDAR | TARGET INTEL (AUTOMATED)
        ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
           
           {/* CALENDÁRIO */}
           <div className="lg:col-span-5 animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl flex flex-col shrink-0 hover-lift h-full min-h-[450px]" style={{ opacity: 0, animationDelay: '0.25s' }}>
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-zinc-800/60 shrink-0">
                 <h3 className="text-[10px] text-zinc-300 font-black tracking-[0.2em] uppercase flex items-center gap-2">
                   <CalendarIcon size={14} className="text-blue-500" /> Agenda - {currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                 </h3>
                 <div className="flex gap-1.5">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all flex items-center"><ChevronLeft size={12} /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white font-black text-[8px] transition-all uppercase tracking-widest">HOJE</button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all flex items-center"><ChevronRight size={12} /></button>
                 </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
                 {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={`hdr-${i}`} className="text-center text-[9px] text-zinc-500 font-black mb-1 uppercase tracking-widest">{d}</div>)}
                 {calendarGrid.map((cell, idx) => {
                    if (cell.isGhost) {
                        return (
                            <div key={`ghost-${idx}`} className="flex flex-col items-center justify-center min-h-[50px] rounded-lg border border-transparent bg-zinc-900/10 opacity-40 grayscale pointer-events-none">
                                <span className="text-[10px] font-black text-zinc-600">{cell.day}</span>
                            </div>
                        );
                    }

                    let borderClass = 'border-transparent bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-800/80';
                    if (cell.isToday) borderClass = 'border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_10px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20';

                    return (
                      <div key={cell.dateStr} onClick={() => handleDayClick(cell.dateStr)} className={`relative flex flex-col items-center justify-center min-h-[50px] rounded-lg border transition-all duration-300 group/day cursor-pointer ${borderClass}`}>
                         <span className={`text-[10px] font-black z-10 transition-colors ${cell.isToday ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-200'}`}>{cell.day}</span>
                         
                         {cell.events.length > 0 && (
                            <div className="flex gap-0.5 mt-0.5 z-10">
                               {cell.events.slice(0, 3).map((ev: any, i: number) => {
                                  let dotColor = ev.type === 'TRYOUT' ? 'bg-fuchsia-500' : ev.type === 'SCRIM' ? 'bg-amber-500' : 'bg-blue-500';
                                  if (ev.isPast) {
                                      dotColor = ev.isWin ? 'bg-emerald-500' : ev.resultText.includes('D') ? 'bg-zinc-500' : 'bg-red-500';
                                  }
                                  return <div key={i} className={`w-1 h-1 rounded-full ${dotColor}`} />
                               })}
                            </div>
                         )}

                         {cell.events.length > 0 && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl rounded-xl z-[100] opacity-0 pointer-events-none group-hover/day:opacity-100 group-hover/day:pointer-events-auto transition-all duration-300 delay-300 group-hover/day:delay-0 p-2 flex flex-col gap-1.5 transform translate-y-2 group-hover/day:translate-y-0 after:content-[''] after:absolute after:w-full after:h-6 after:-bottom-6 after:left-0">
                               <div className="flex justify-between items-center px-1 border-b border-zinc-800 pb-1.5 mb-0.5">
                                  <span className="text-[9px] font-black text-white tracking-widest">DIA {cell.day}</span>
                                  <span className="text-[7px] text-zinc-400 font-bold uppercase">{cell.events.length} Eventos</span>
                               </div>
                               <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                  {cell.events.map((ev: any) => (
                                     <CalendarEventItem key={ev.id} ev={ev} isStaff={isStaff} onEdit={handleEditCalendarEvent} onDelete={handleDeleteCalendarEvent} />
                                  ))}
                               </div>
                            </div>
                         )}
                      </div>
                    )
                 })}
              </div>
           </div>

           {/* TARGET INTEL */}
           <div className="lg:col-span-7 animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden hover-lift flex flex-col h-[450px] group" style={{ opacity: 0, animationDelay: '0.3s' }}>
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
             
             <div className="flex justify-between items-start mb-4 border-b border-zinc-800/60 pb-4 shrink-0 z-10">
                <div className="flex items-center gap-3">
                   {getTeamLogo(nextTargetIntel.team) ? (
                      <img src={getTeamLogo(nextTargetIntel.team)!} className="w-10 h-10 object-contain shrink-0 bg-zinc-900 p-1 rounded-lg border border-zinc-800" alt={nextTargetIntel.team} />
                   ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-600">{nextTargetIntel.team.substring(0,3)}</div>
                   )}
                   <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                         <Target size={14} className="text-red-500 animate-pulse" /> Target Intel
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                         <p className="text-[8px] text-zinc-400 font-bold tracking-widest uppercase">OP: {nextTargetIntel.team}</p>
                         {currentTargetH2H && (
                            <>
                               <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                               <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                  <span className="text-zinc-500">H2H:</span>
                                  <span className="text-emerald-400">{currentTargetH2H.wins}W</span>
                                  <span className="text-zinc-600">-</span>
                                  <span className="text-red-400">{currentTargetH2H.losses}L</span>
                               </div>
                            </>
                         )}
                      </div>
                   </div>
                </div>
                
                {nextTargetIntel.team !== 'SEM ALVO' && (
                   <button onClick={() => alert('Em breve: Abre modal com os últimos 5 drafts!')} className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5">
                      <Swords size={10} /> DRAFTS
                   </button>
                )}
             </div>

             <div className="flex-1 flex flex-col justify-between overflow-hidden z-10 mt-1">
               {nextTargetIntel.team !== 'SEM ALVO' ? (
                 <>
                   <div className="flex flex-col shrink-0">
                     <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Zap size={12} className="text-red-500" /> WIN CONS & ALVOS</p>
                     <div className="flex flex-row items-stretch gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">

                       <ul className="flex-1 flex flex-col justify-center gap-2.5">
                         {nextTargetIntel.winConditions.filter(wc => wc.type !== 'pressure').length > 0 ?
                            nextTargetIntel.winConditions.filter(wc => wc.type !== 'pressure').map((wc: any, i) => (
                           <li key={i} className="text-xs text-zinc-300 font-bold flex flex-col justify-center leading-snug">
                             {wc.type === 'wr' && (
                                <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]"></div> Blue WR: {wc.blue}%</div>
                                   <span className="text-zinc-700 font-black px-1 text-sm">|</span>
                                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]"></div> Red WR: {wc.red}%</div>
                                </div>
                             )}
                             {wc.type === 'early' && <div className="flex items-center gap-2"><Flame size={15} className="text-orange-500" /> {wc.text}</div>}
                             {wc.type === 'scaling' && <div className="flex items-center gap-2"><Hourglass size={15} className="text-blue-400" /> {wc.text}</div>}
                             
                             {wc.type === 'macro' && (
                                <div className="flex items-center gap-5 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/60 mt-1.5 w-fit shadow-inner">
                                   <div className="flex flex-col">
                                      <span className="text-[8px] text-zinc-500 font-black tracking-[0.15em] uppercase mb-0.5">AVG 1º Drake</span>
                                      <span className="text-xs text-orange-400 font-black">{wc.drakeTime} min</span>
                                   </div>
                                   <div className="w-px h-6 bg-zinc-800/80"></div>
                                   <div className="flex flex-col">
                                      <span className="text-[8px] text-zinc-500 font-black tracking-[0.15em] uppercase mb-0.5">AVG 1º Grubs</span>
                                      <span className="text-xs text-purple-400 font-black">{wc.grubsTime} min</span>
                                   </div>
                                </div>
                             )}

                             {wc.type === 'empty' && <span className="text-[10px] text-zinc-600 uppercase">{wc.text}</span>}
                           </li>
                         )) : (
                           <li className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center py-2">Sem dados registados</li>
                         )}
                       </ul>

                       {nextTargetIntel.winConditions.find(wc => wc.type === 'pressure') && (
                          <div className="w-[180px] shrink-0 border-l border-zinc-800/60 pl-5 flex flex-col justify-center">
                             {(() => {
                                const target = nextTargetIntel.winConditions.find(wc => wc.type === 'pressure');
                                const p = target.player;
                                return (
                                   <>
                                      <div className="flex items-center gap-3 mb-2.5">
                                         <div className="relative">
                                            <img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.nickname}&background=18181b&color=ef4444`} className="w-10 h-10 rounded-full border-2 border-red-500/50 object-cover shadow-md" alt={p.nickname} />
                                            <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 shadow-sm"><Crosshair size={10} className="text-white"/></div>
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-white font-black text-xs uppercase tracking-tight leading-none truncate w-[100px] block">{p.nickname}</span>
                                            <span className="text-red-400 font-bold text-[8px] tracking-widest uppercase mt-0.5">{String(p.primary_role).replace(/jug/i, 'JNG')}</span>
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                                         <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Lane</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_lane || 0)}</span></div>
                                         <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Impacto</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_impact || 0)}</span></div>
                                         <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Visão</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_vision || 0)}</span></div>
                                         <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Conv.</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_conversion || 0)}</span></div>
                                      </div>
                                   </>
                                )
                             })()}
                          </div>
                       )}

                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 shrink-0 mt-3">
                     <div className="bg-zinc-900/30 p-3.5 rounded-xl border border-zinc-800/50 flex flex-col justify-center">
                       <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">PRIORITY PICKS</p>
                       <div className="grid grid-cols-3 gap-2.5 w-full">
                          {nextTargetIntel.topPicks.length > 0 ? nextTargetIntel.topPicks.map((champ: any, i) => (
                            <div key={i} className="relative flex items-center gap-2.5 bg-blue-500/5 border border-blue-500/20 pr-2 pl-1.5 py-1.5 rounded-lg hover:bg-blue-500/10 hover:border-blue-500/50 hover:scale-105 transition-all duration-200 cursor-default group/champ min-w-0">
                               
                               <div className="relative shrink-0">
                                  <img src={getChampImage(champ.name)} className="w-7 h-7 rounded-md border border-blue-500/30 object-cover shadow-sm group-hover/champ:border-blue-400 transition-colors" alt={champ.name} onError={(e: any) => { e.target.src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'; }} />
                                  {champ.isBlind && <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-500 border-[1.5px] border-zinc-900 rounded-full"></div>}
                                  {champ.isFlex && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 border-[1.5px] border-zinc-900 rounded-full"></div>}
                               </div>

                               <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                  <span className="text-[10px] text-blue-300 font-black tracking-wider uppercase truncate">{champ.name}</span>
                                  <span className="text-[8px] text-blue-500/80 font-bold uppercase leading-none">{champ.winRate}% WR</span>
                               </div>

                               <div className="absolute bottom-[115%] left-1/2 -translate-x-1/2 w-[160px] bg-zinc-950 border border-zinc-700/80 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/champ:opacity-100 group-hover/champ:pointer-events-auto transition-all duration-200 z-[100] transform translate-y-2 group-hover/champ:translate-y-0">
                                   <p className="text-[11px] font-black text-white uppercase border-b border-zinc-800 pb-1.5 mb-2 text-center">{champ.name}</p>
                                   
                                   <div className="flex flex-col gap-2">
                                      {champ.isBlind && (
                                         <div className="flex items-center gap-2">
                                            <span className="bg-amber-500 text-white text-[7px] px-1.5 py-0.5 rounded font-black tracking-widest shadow-sm">BLIND</span>
                                            <span className="text-[8px] text-zinc-400 uppercase font-bold">Pickado B1/R1-R2</span>
                                         </div>
                                      )}
                                      
                                      {champ.isFlex ? (
                                         <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                               <span className="bg-purple-500 text-white text-[7px] px-1.5 py-0.5 rounded font-black tracking-widest shadow-sm">FLEX</span>
                                               <span className="text-[8px] text-zinc-400 uppercase font-bold">Rotas:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                               {champ.roles.map((r: string) => (
                                                  <span key={r} className="bg-zinc-800 border border-zinc-700 text-[7px] text-zinc-300 font-black px-1.5 py-0.5 rounded uppercase">{r}</span>
                                               ))}
                                            </div>
                                         </div>
                                      ) : (
                                         <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] text-zinc-500 uppercase font-bold">Main Role:</span>
                                            <span className="text-[8px] text-zinc-300 font-black uppercase">{champ.roles[0] || 'Desconhecido'}</span>
                                         </div>
                                      )}
                                   </div>
                               </div>
                            </div>
                          )) : <span className="text-[9px] text-zinc-600 font-bold uppercase col-span-3">N/A</span>}
                       </div>
                     </div>
                     <div className="bg-zinc-900/30 p-3.5 rounded-xl border border-zinc-800/50 flex flex-col justify-center">
                       <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">MUST BANS</p>
                       <div className="grid grid-cols-3 gap-2.5 w-full">
                          {nextTargetIntel.topBans.length > 0 ? nextTargetIntel.topBans.map((champ: any, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-red-500/5 border border-red-500/20 pr-2 pl-1.5 py-1.5 rounded-lg hover:bg-red-500/10 hover:border-red-500/50 hover:scale-105 transition-all duration-200 cursor-default group/ban min-w-0 overflow-hidden">
                               <img src={getChampImage(champ.name)} className="w-7 h-7 rounded-md border border-red-500/30 object-cover grayscale opacity-80 shrink-0 shadow-sm group-hover/ban:grayscale-0 group-hover/ban:opacity-100 group-hover/ban:border-red-400 transition-all" alt={champ.name} onError={(e: any) => { e.target.src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'; }} />
                               <span className="text-[10px] text-red-300 font-black tracking-wider uppercase line-through truncate flex-1 min-w-0">{champ.name}</span>
                            </div>
                          )) : <span className="text-[9px] text-zinc-600 font-bold uppercase col-span-3">N/A</span>}
                       </div>
                     </div>
                   </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                   <Shield size={36} className="mb-3 text-zinc-600 opacity-50" />
                   <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Aguardando Próxima Operação</p>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* DIVISOR SECÇÃO 2 */}
        <div className="flex items-center gap-4 py-2 mt-4 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.4s' }}>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
           <h2 className="text-[9px] font-black tracking-[0.3em] text-zinc-600 uppercase flex items-center gap-2">
             <div className="w-1 h-1 bg-emerald-500 rounded-full"></div> Condição do Elenco
           </h2>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
        </div>

        {/* ----------------------------------------------------
            SECÇÃO 2: SQUAD READINESS (Integração Total)
        ---------------------------------------------------- */}
        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group w-full hover-lift" style={{ opacity: 0, animationDelay: '0.45s' }}>
           <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
           <div className="absolute right-0 top-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full transition-opacity duration-1000"></div>
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 border-b border-zinc-800/60 pb-5 relative z-10">
              <div>
                 <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3"><div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]"></div> Squad Readiness</h3>
                 <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] mt-1.5 uppercase">Monitorização Biométrica de Prontidão</p>
              </div>
              <button onClick={() => { if(!isStaff) setWellnessForm(prev => ({ ...prev, puuid: currentUser.puuid })); setWellnessModalOpen(true); }} className="bg-zinc-900 border border-zinc-800 text-emerald-400 px-5 py-2.5 rounded-xl text-[9px] font-black hover:bg-emerald-600 hover:border-emerald-500 hover:text-white transition-all flex items-center gap-2 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] uppercase tracking-widest"><Plus size={14} /> DAILY SYNC</button>
           </div>

           <div className={`grid gap-4 relative z-10 ${isStaff ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-5'}`}>
              {teamWellness.filter(p => isStaff || p.puuid === currentUser.puuid).map((p) => {
                 const isDanger = p.score < 65; const isOptimal = p.score > 85;
                 const colorClass = isDanger ? 'text-red-400 border-red-500/30 bg-red-500/5 shadow-[inset_4px_0_20px_-5px_rgba(239,68,68,0.15)]' : isOptimal ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shadow-[inset_4px_0_20px_-5px_rgba(16,185,129,0.15)]' : 'text-amber-400 border-amber-500/30 bg-amber-500/5 shadow-[inset_4px_0_20px_-5px_rgba(245,158,11,0.15)]';
                 const isExpanded = expandedWellnessId === p.puuid;

                 return (
                   <div key={p.puuid} onClick={() => setExpandedWellnessId(isExpanded ? null : p.puuid)} className={`group/player relative p-5 rounded-[20px] border border-zinc-800/80 bg-zinc-950/40 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:bg-zinc-900/80 ${colorClass} ${isExpanded ? 'ring-1 ring-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}`}>
                      {!p.hasAnsweredToday && !isStaff && (
                        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md z-20 flex flex-col items-center justify-center border border-zinc-800 rounded-[20px]">
                           <Clock size={28} className="mb-3 animate-pulse opacity-50 text-zinc-400" />
                           <span className="text-[8px] text-zinc-400 tracking-[0.2em] font-black text-center px-4 leading-relaxed uppercase">PENDENTE DE<br/>REGISTO HOJE</span>
                        </div>
                      )}
                      {isStaff && p.history.length > 0 && (
                         <button onClick={(e) => { e.stopPropagation(); setWellnessHistoryModal({ isOpen: true, player: p, history: p.history }); }} className="absolute top-4 right-4 z-30 text-[7px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-2 py-1 rounded border border-zinc-700 transition-colors font-bold tracking-widest shadow-sm">HIST</button>
                      )}
                      <div className="flex justify-between items-start mb-4 relative z-10">
                         <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                           {p.photo && <img src={p.photo} className="w-10 h-10 rounded-lg border border-zinc-700 object-cover shrink-0 shadow-md group-hover/player:border-zinc-500 transition-colors" />}
                           <div className="flex-1 min-w-0 py-0.5">
                             <div className="flex items-center gap-1.5 mb-1"><span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{String(p.role).replace(/jug/i, 'JNG')}</span>{!p.hasAnsweredToday && isStaff && <span className="text-[6px] font-black bg-red-500/10 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse">PEND</span>}</div>
                             <span className="text-sm font-black text-white break-words leading-tight block uppercase drop-shadow-md truncate">{p.name}</span>
                           </div>
                         </div>
                         <span className={`text-2xl font-black italic leading-none shrink-0 tracking-tighter ${isDanger ? 'text-red-400 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isOptimal ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`}>{p.score}%</span>
                      </div>
                      <div className="space-y-2 relative z-10"><WellnessBar label="SONO" value={p.sleep} /><WellnessBar label="MENTAL" value={p.mental} /><WellnessBar label="FÍSICO" value={p.physical} /></div>
                   </div>
                 );
              })}
           </div>

           {expandedPlayer && expandedPlayer.history.length > 0 && (
             <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-[20px] p-6 flex flex-col justify-center relative overflow-hidden group/chart mt-6 animate-fade-in-up shadow-inner">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-50 group-hover/chart:opacity-100 transition-all duration-500"></div>
                
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-5 border-b border-zinc-800/50 pb-4">
                   <div>
                      <h4 className="text-[10px] text-emerald-400 font-black tracking-[0.2em] uppercase flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> Evolução: {expandedPlayer.name}
                      </h4>
                      <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">MONITORIZAÇÃO DE PRONTIDÃO VS PERFORMANCE</p>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap bg-zinc-950 border border-zinc-800 rounded-lg p-1 shadow-inner">
                         <button onClick={() => setExpandedChartMode('OVERVIEW')} className={`px-3 py-1.5 text-[8px] font-black rounded transition-all tracking-widest uppercase ${expandedChartMode === 'OVERVIEW' ? 'bg-zinc-800 text-white shadow-md border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>VISÃO GERAL</button>
                         <button onClick={() => setExpandedChartMode('BIO')} className={`px-3 py-1.5 text-[8px] font-black rounded transition-all tracking-widest uppercase ${expandedChartMode === 'BIO' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>BIOMETRIA</button>
                         <button onClick={() => setExpandedChartMode('TACTICAL')} className={`px-3 py-1.5 text-[8px] font-black rounded transition-all tracking-widest uppercase ${expandedChartMode === 'TACTICAL' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>TÁTICA</button>
                         <button onClick={() => setExpandedChartMode('CORRELATION')} className={`px-3 py-1.5 text-[8px] font-black rounded transition-all tracking-widest uppercase ${expandedChartMode === 'CORRELATION' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>CORRELAÇÃO</button>
                      </div>
                      <button onClick={() => setExpandedWellnessId(null)} className="text-zinc-500 hover:text-white font-black transition-colors bg-zinc-900 hover:bg-zinc-800 w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-800"><X size={14}/></button>
                   </div>
                </div>

                {expandedChartMode === 'CORRELATION' && (
                  <div className="flex flex-wrap items-center gap-3 mb-4 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Comparar:</span>
                    <select value={corrBio} onChange={(e) => setCorrBio(e.target.value)} className="bg-zinc-950 border border-zinc-700 text-purple-400 text-[9px] font-bold px-2 py-1.5 rounded outline-none uppercase tracking-widest shadow-inner cursor-pointer">
                      <option value="sleep_score">Qualidade do Sono</option>
                      <option value="mental_score">Estado Mental</option>
                      <option value="physical_score">Condição Física</option>
                      <option value="readiness_percent">Readiness Geral</option>
                    </select>
                    <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">VS</span>
                    <select value={corrTact} onChange={(e) => setCorrTact(e.target.value)} className="bg-zinc-950 border border-zinc-700 text-blue-400 text-[9px] font-bold px-2 py-1.5 rounded outline-none uppercase tracking-widest shadow-inner cursor-pointer">
                      <option value="perf_score">Performance Overall</option>
                      <option value="lane_score">Dominância de Rota</option>
                      <option value="impact_score">Impacto no Mapa</option>
                      <option value="conv_score">Conversão</option>
                      <option value="vision_score">Controle de Visão</option>
                    </select>
                  </div>
                )}
                
                <div className="w-full h-[220px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wellnessChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                         <XAxis dataKey="record_date" tickFormatter={formatDate} tick={{ fill: '#71717a', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                         <Tooltip cursor={{ stroke: '#27272a', strokeWidth: 2, strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(8px)', borderColor: '#27272a', fontSize: '9px', borderRadius: '8px', color: '#fff', fontWeight: 'bold', padding: '8px' }} />
                         <Legend wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', paddingTop: '10px' }} iconType="circle" />
                         
                         {expandedChartMode === 'OVERVIEW' && (
                           <>
                             <YAxis yAxisId="left" hide domain={[0, 100]} />
                             <Line yAxisId="left" name="Readiness Biométrico (%)" type="monotone" dataKey="readiness_percent" stroke="#10b981" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#10b981'}} activeDot={{r: 5, fill: '#10b981', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="left" name="Performance em Jogo (0-100)" type="monotone" dataKey="perf_score" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#3b82f6'}} activeDot={{r: 5, fill: '#3b82f6', stroke: '#fff'}} connectNulls />
                           </>
                         )}

                         {expandedChartMode === 'BIO' && (
                           <>
                             <YAxis yAxisId="right" orientation="right" hide domain={[0, 5]} />
                             <Line yAxisId="right" name="Qualidade do Sono" type="monotone" dataKey="sleep_score" stroke="#a855f7" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#a855f7'}} activeDot={{r: 5, fill: '#a855f7', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="right" name="Estado Mental" type="monotone" dataKey="mental_score" stroke="#f59e0b" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#f59e0b'}} activeDot={{r: 5, fill: '#f59e0b', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="right" name="Prontidão Física" type="monotone" dataKey="physical_score" stroke="#ef4444" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#ef4444'}} activeDot={{r: 5, fill: '#ef4444', stroke: '#fff'}} connectNulls />
                           </>
                         )}

                         {expandedChartMode === 'TACTICAL' && (
                           <>
                             <YAxis yAxisId="left" hide domain={[0, 100]} />
                             <Line yAxisId="left" name="Dominância de Rota" type="monotone" dataKey="lane_score" stroke="#3b82f6" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#3b82f6'}} activeDot={{r: 5, fill: '#3b82f6', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="left" name="Impacto no Mapa" type="monotone" dataKey="impact_score" stroke="#10b981" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#10b981'}} activeDot={{r: 5, fill: '#10b981', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="left" name="Conversão de Vantagem" type="monotone" dataKey="conv_score" stroke="#f59e0b" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#f59e0b'}} activeDot={{r: 5, fill: '#f59e0b', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="left" name="Controle de Visão" type="monotone" dataKey="vision_score" stroke="#a855f7" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#a855f7'}} activeDot={{r: 5, fill: '#a855f7', stroke: '#fff'}} connectNulls />
                           </>
                         )}

                         {expandedChartMode === 'CORRELATION' && (
                           <>
                             <YAxis yAxisId="left" hide domain={[0, 100]} />
                             <YAxis yAxisId="right" orientation="right" hide domain={corrBio === 'readiness_percent' ? [0, 100] : [0, 5]} />
                             <Line yAxisId="right" name={getBioName(corrBio)} type="monotone" dataKey={corrBio} stroke="#a855f7" strokeWidth={2} isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#a855f7'}} activeDot={{r: 5, fill: '#a855f7', stroke: '#fff'}} connectNulls />
                             <Line yAxisId="left" name={getTactName(corrTact)} type="monotone" dataKey={corrTact} stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" isAnimationActive={false} dot={{r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#3b82f6'}} activeDot={{r: 5, fill: '#3b82f6', stroke: '#fff'}} connectNulls />
                           </>
                         )}
                      </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>
           )}
        </div>

        {/* DIVISOR SECÇÃO 3 */}
        <div className="flex items-center gap-4 py-2 mt-4 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.5s' }}>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
           <h2 className="text-[9px] font-black tracking-[0.3em] text-zinc-600 uppercase flex items-center gap-2">
             <div className="w-1 h-1 bg-amber-500 rounded-full"></div> Matchup Analytics
           </h2>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
        </div>

        {/* ----------------------------------------------------
            SECÇÃO 3: MATCHUP ANALYTICS (OPPONENTS E CHAMPS)
        ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-6">
          
          {/* WIN / LOSS / WR STACKED BAR CHART */}
          <div className="animate-fade-in-up lg:col-span-8 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 md:p-8 shadow-2xl relative flex flex-col h-[400px] overflow-hidden group hover-lift" style={{ opacity: 0, animationDelay: '0.55s' }}>
             <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
             <div className="flex items-center justify-between mb-4 shrink-0 border-b border-zinc-800/60 pb-4">
                <div>
                   <h3 className="text-[13px] font-black text-white uppercase tracking-tight flex items-center gap-2"><Swords size={16} className="text-amber-500" /> Confrontos Diretos</h3>
                   <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Desempenho contra organizações</p>
                </div>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5 shadow-inner">
                   <button onClick={() => setOppChartMode('COUNT')} className={`px-2.5 py-1 text-[8px] font-black rounded transition-all tracking-widest uppercase ${oppChartMode === 'COUNT' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>QTD JOGOS</button>
                   <button onClick={() => setOppChartMode('RATE')} className={`px-2.5 py-1 text-[8px] font-black rounded transition-all tracking-widest uppercase ${oppChartMode === 'RATE' ? 'bg-amber-600/20 text-amber-500 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>WIN RATE</button>
                </div>
             </div>
             
             <div className="flex-1 w-full min-h-0 relative mt-1">
                {opponentStatsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={opponentStatsData} margin={{ top: 25, right: 20, left: -10, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                      
                      <XAxis 
                        dataKey="opponent" 
                        axisLine={false} 
                        tickLine={false}
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const logoUrl = getTeamLogo(payload.value);
                          
                          return (
                            <g transform={`translate(${x},${y})`}>
                              {logoUrl ? (
                                <>
                                  <image x={-12} y={5} width={24} height={24} href={logoUrl} />
                                  <text x={0} y={40} textAnchor="middle" fill="#71717a" fontSize={8} fontWeight="bold">{payload.value}</text>
                                </>
                              ) : (
                                <text x={0} y={20} textAnchor="middle" fill="#71717a" fontSize={9} fontWeight="bold">{payload.value}</text>
                              )}
                            </g>
                          );
                        }}
                      />
                      
                      <YAxis 
                        tick={{ fill: '#52525b', fontSize: 10, fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false} 
                        allowDecimals={false}
                      />
                      
                      <Tooltip 
                         cursor={{ fill: 'rgba(255,255,255,0.02)' }} 
                         content={<CustomMatchupTooltip />}
                      />
                      
                      {oppChartMode === 'COUNT' && <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', bottom: -5 }} iconType="circle" />}
                      
                      {oppChartMode === 'COUNT' ? (
                        <>
                           <Bar dataKey="wins" name="Vitórias" stackId="a" fill="#10b981" maxBarSize={45}>
                              <LabelList dataKey="wins" position="center" fill="#ffffff" fontSize={11} fontWeight="black" formatter={(val: number) => val > 0 ? val : ''} />
                           </Bar>
                           <Bar dataKey="losses" name="Derrotas" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={45}>
                              <LabelList dataKey="losses" position="center" fill="#ffffff" fontSize={11} fontWeight="black" formatter={(val: number) => val > 0 ? val : ''} />
                           </Bar>
                        </>
                      ) : (
                        <Bar dataKey="winRate" name="Win Rate (%)" radius={[4, 4, 0, 0]} maxBarSize={50}>
                           <LabelList dataKey="winRate" position="top" fill="#a1a1aa" fontSize={10} fontWeight="black" formatter={(val: number) => `${val}%`} />
                           {opponentStatsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.winRate >= 50 ? '#10b981' : '#ef4444'} />
                           ))}
                        </Bar>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                     <BarChart2 size={32} className="mb-2 text-zinc-600 opacity-50" />
                     <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Sem confrontos registados.</p>
                  </div>
                )}
             </div>
          </div>

          {/* DONUT CHART: CAMPEONATOS */}
          <div className="lg:col-span-4 animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 shadow-xl relative flex flex-col h-[400px] hover-lift" style={{ opacity: 0, animationDelay: '0.6s' }}>
             <div className="flex items-center justify-between mb-2 border-b border-zinc-800/60 pb-3 shrink-0">
                <div>
                   <h3 className="text-[11px] font-black text-white uppercase tracking-tight">Distribuição de Ligas</h3>
                   <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Oponentes por Campeonato/Região</p>
                </div>
             </div>
             
             <div className="flex-1 w-full min-h-0 relative flex flex-col">
               {championshipStatsData.length > 0 ? (
                 <>
                   <div className="h-[170px] w-full relative shrink-0 mt-2 z-0">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie 
                              data={championshipStatsData} 
                              innerRadius={55} 
                              outerRadius={80} 
                              paddingAngle={4} 
                              dataKey="value"
                              stroke="none"
                              cornerRadius={4}
                           >
                              {championshipStatsData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                           </Pie>
                           <Tooltip 
                             cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                             wrapperStyle={{ zIndex: 9999, outline: 'none' }}
                             content={<CustomDonutTooltip totalGames={championshipStatsData.reduce((acc, curr) => acc + curr.value, 0)} />} 
                           />
                        </PieChart>
                     </ResponsiveContainer>
                     
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-black text-white leading-none tracking-tighter drop-shadow-md">
                          {championshipStatsData.reduce((acc, curr) => acc + curr.value, 0)}
                        </span>
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Jogos</span>
                     </div>
                   </div>

                   <div className="flex-1 w-full overflow-y-auto custom-scrollbar mt-4 pr-2 pb-2 flex flex-col gap-3 relative z-0">
                      {championshipStatsData.map((entry, index) => {
                         const total = championshipStatsData.reduce((acc, curr) => acc + curr.value, 0);
                         const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                         const color = CHART_COLORS[index % CHART_COLORS.length];
                         
                         return (
                            <div key={index} className="relative flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 py-3 px-4 rounded-xl hover:bg-zinc-800/80 transition-all duration-300 group cursor-default hover:scale-[1.02] shadow-sm shrink-0">
                               <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                  <div className="h-full opacity-[0.08] transition-all duration-1000 group-hover:opacity-[0.15]" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                               </div>
                               <div className="flex items-center gap-3 min-w-0 relative z-10">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#121214] group-hover:ring-zinc-800 transition-all" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}80` }}></div>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate group-hover:text-white transition-colors">{entry.name}</span>
                               </div>
                               <div className="flex flex-col items-end shrink-0 pl-3 relative z-10">
                                  <div className="flex items-center gap-1.5 mb-1">
                                     <span className="text-[13px] font-black text-white drop-shadow-sm">{entry.value}</span>
                                     <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">JGs</span>
                                  </div>
                                  <span className="text-[9px] font-black tracking-widest drop-shadow-md" style={{ color: color }}>{pct}% SHARE</span>
                               </div>
                            </div>
                         )
                      })}
                   </div>
                 </>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                     <PieChartIcon size={32} className="mb-2 text-zinc-600 opacity-50" />
                     <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Aguardando dados geográficos.</p>
                  </div>
               )}
             </div>
          </div>

        </div>

        {/* DIVISOR SECÇÃO 4 */}
        <div className="flex items-center gap-4 py-2 mt-4 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.65s' }}>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
           <h2 className="text-[9px] font-black tracking-[0.3em] text-zinc-600 uppercase flex items-center gap-2">
             <div className="w-1 h-1 bg-purple-500 rounded-full"></div> Métricas de Desempenho e Histórico
           </h2>
           <div className="h-px bg-zinc-800/60 flex-1"></div>
        </div>

        {/* ----------------------------------------------------
            SECÇÃO 4: MACRO TACTICAL CHARTS & SQUAD PERFORMANCE
        ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-6">
          
          {/* RADAR GIGANTE (4 COLUNAS) */}
          <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift" style={{ opacity: 0, animationDelay: '0.7s' }}>
             <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
             <div className="flex justify-between items-start mb-2 shrink-0 border-b border-zinc-800/60 pb-3 z-10">
                <div>
                  <h3 className="text-[12px] font-black text-white uppercase tracking-tight flex items-center gap-2"><Brain size={14} className="text-purple-500" /> Squad Performance</h3>
                  <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Impacto Tático</p>
                </div>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5 shadow-inner">
                   <button onClick={() => setRadarCompareMode('OFFICIAL_VS_SCRIM')} className={`px-2 py-1 text-[7px] font-black rounded transition-all tracking-widest uppercase ${radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>OFF VS SCR</button>
                   <button onClick={() => setRadarCompareMode('US_VS_OPP')} className={`px-2 py-1 text-[7px] font-black rounded transition-all tracking-widest uppercase ${radarCompareMode === 'US_VS_OPP' ? 'bg-red-600/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}>US VS OPP</button>
                </div>
             </div>
             
             <div className="flex-1 w-full min-h-0 relative z-10 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="82%" data={radarData}>
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#d4d4d8', fontSize: 10, fontWeight: '900' }} tickFormatter={(val) => String(val).toUpperCase()} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  
                  <Radar 
                    name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} 
                    dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} 
                    stroke="#3b82f6" 
                    strokeWidth={2.5} 
                    fill="#3b82f6" 
                    fillOpacity={0.2} 
                    dot={{ r: 4, fill: '#18181b', strokeWidth: 2, stroke: '#3b82f6' }}
                    activeDot={{ r: 6, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                  <Radar 
                    name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
                    dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
                    stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
                    strokeWidth={2.5} 
                    fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
                    fillOpacity={0.2}
                    dot={{ r: 4, fill: '#18181b', strokeWidth: 2, stroke: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444" }}
                    activeDot={{ r: 6, fill: '#fff', stroke: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444", strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                  
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px', fontWeight: 'bold' }} />
                  
                  <Tooltip 
                     cursor={false}
                     wrapperStyle={{ zIndex: 9999, outline: 'none' }}
                     content={<CustomRadarTooltip />} 
                  />
                </RadarChart>
              </ResponsiveContainer>
             </div>
          </div>

          {/* EFICIÊNCIA DE SCRIMS (4 COLUNAS) */}
          <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift" style={{ opacity: 0, animationDelay: '0.75s' }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-2 z-10 shrink-0 border-b border-zinc-800/60 pb-3">
               <div>
                  <h3 className="text-[12px] text-white font-black uppercase tracking-tight flex items-center gap-1.5"><Activity size={14} className="text-emerald-500" /> Eficiência de Scrims</h3>
                  <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Dificuldade vs Nível do Oponente</p>
               </div>
            </div>
            <div className="flex-1 w-full min-h-0 mt-3">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartIntelligence.efficiencyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} stackOffset="none">
                   <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                   
                   <XAxis dataKey="name" tick={{ fill: '#d4d4d8', fontSize: 10, fontWeight: '900' }} tickFormatter={(val) => String(val).toUpperCase()} axisLine={false} tickLine={false} dy={10} />
                   <YAxis tick={{ fill: '#52525b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} allowDecimals={false} />
                   
                   <Tooltip 
                     cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                     wrapperStyle={{ zIndex: 9999, outline: 'none' }}
                     content={<CustomEfficiencyTooltip />} 
                   />

                   <Bar dataKey="STOMPADOS" stackId="a" fill="#7f1d1d" maxBarSize={45} />
                   <Bar dataKey="MT DIFÍCIL" stackId="a" fill="#dc2626" maxBarSize={45} />
                   <Bar dataKey="DIFÍCIL" stackId="a" fill="#f87171" maxBarSize={45} />
                   <Bar dataKey="CONTROLADO" stackId="a" fill="#52525b" maxBarSize={45} />
                   <Bar dataKey="FÁCIL" stackId="a" fill="#60a5fa" maxBarSize={45} />
                   <Bar dataKey="MUITO FÁCIL" stackId="a" fill="#2563eb" maxBarSize={45} />
                   <Bar dataKey="STOMPAMOS" stackId="a" fill="#1e3a8a" maxBarSize={45} />
                 </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          {/* EARLY GAME MOMENTUM (4 COLUNAS) */}
          <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift" style={{ opacity: 0, animationDelay: '0.8s' }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-4 z-10 shrink-0 border-b border-zinc-800/60 pb-3">
               <div>
                  <h3 className="text-[12px] text-white font-black uppercase tracking-tight flex items-center gap-1.5"><Zap size={14} className="text-amber-500" /> Early Game Momentum</h3>
                  <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Diferencial de Ouro aos 12 Minutos</p>
               </div>
            </div>
            <div className="flex-1 w-full min-h-0 mt-2">
               {earlyGameSnowball.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={earlyGameSnowball} margin={{ top: 5, right: 5, left: -15, bottom: 50 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.3} />
                     
                     <XAxis 
                        dataKey="fullOpponent" 
                        axisLine={false} 
                        tickLine={false}
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const fullData = payload.payload || {};
                          const logoUrl = getTeamLogo(payload.value);
                          const shortName = payload.value.substring(0, 4);
                          const dateStr = fullData.date;

                          return (
                            <g transform={`translate(${x},${y})`}>
                              {logoUrl ? (
                                <>
                                  <image x={-10} y={5} width={20} height={20} href={logoUrl} />
                                  <text x={0} y={35} textAnchor="middle" fill="#71717a" fontSize={8} fontWeight="bold">{shortName}</text>
                                  <text x={0} y={45} textAnchor="middle" fill="#52525b" fontSize={7} fontWeight="900">{dateStr}</text>
                                </>
                              ) : (
                                <>
                                  <text x={0} y={20} textAnchor="middle" fill="#71717a" fontSize={8} fontWeight="bold">{shortName}</text>
                                  <text x={0} y={30} textAnchor="middle" fill="#52525b" fontSize={7} fontWeight="900">{dateStr}</text>
                                </>
                              )}
                            </g>
                          );
                        }}
                     />
                     <YAxis tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`} tick={{ fill: '#71717a', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                     
                     <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                        wrapperStyle={{ zIndex: 9999, outline: 'none' }}
                        content={<CustomEarlyGameTooltip />} 
                     />
                     <Bar dataKey="goldDiff" radius={[2, 2, 2, 2]}>
                       {earlyGameSnowball.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.goldDiff >= 0 ? '#3b82f6' : '#ef4444'} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                     <span className="text-2xl mb-2 grayscale opacity-50">💰</span>
                     <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Sem dados de ouro aos 12 min.</p>
                  </div>
               )}
            </div>
          </div>
        </div>


        {/* ADVANCED SCRIM REPORT (TABELA FULL WIDTH) */}
        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative w-full overflow-hidden group hover-lift h-[500px] flex flex-col mt-6" style={{ opacity: 0, animationDelay: '0.85s' }}>
           <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
           <div className="flex justify-between items-center mb-6 border-b border-zinc-800/60 pb-4 shrink-0">
              <div>
                 <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-zinc-400 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.4)] animate-pulse"></div> Advanced Logs
                 </h3>
                 <p className="text-[9px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Histórico Detalhado de Operações</p>
              </div>
              {isStaff && (
                 <button onClick={() => { 
                     setEditScrimId(null); 
                     setScrimForm({ 
                        date: new Date().toISOString().split('T')[0], 
                        opponent: '', 
                        result: 'W', 
                        score: '', 
                        mode: 'MD3', 
                        comp: '', 
                        difficulty: 'CONTROLADO', 
                        punctuality: 'PONTUAIS', 
                        remakes: 0, 
                        match_ids: '' 
                     }); 
                     setScrimModalOpen(true); 
                 }} className="bg-zinc-900 border border-zinc-800 text-white hover:bg-white hover:text-black px-4 py-2 rounded-lg text-[9px] font-black transition-all uppercase tracking-widest hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] flex items-center gap-1">
                    <Plus size={12} /> Log Manual
                 </button>
              )}
           </div>
           
           <div className="flex-1 overflow-auto custom-scrollbar pr-2">
              <table className="w-full text-left border-separate border-spacing-y-2.5 min-w-[700px]">
                 <thead className="sticky top-0 bg-[#121214]/95 backdrop-blur-md z-10 text-[8px] text-zinc-500 font-black tracking-[0.2em] uppercase">
                    <tr><th className="px-4 pb-2 border-b border-zinc-800/80">DATA / OPONENTE</th><th className="px-4 pb-2 border-b border-zinc-800/80 text-center">RES / PLACAR</th><th className="px-4 pb-2 border-b border-zinc-800/80 text-center">COMP TESTADA</th><th className="px-4 pb-2 border-b border-zinc-800/80 text-center">DIFICULDADE</th><th className="px-4 pb-2 border-b border-zinc-800/80 text-center">REMAKES</th></tr>
                 </thead>
                 <tbody>
                    {paginatedLogs.length > 0 ? paginatedLogs.map((scrim) => (
                       <tr key={scrim.id} className={`transition-all duration-300 group/row text-[9px] cursor-default border border-zinc-800/30 ${scrim.isMission ? 'bg-blue-950/10 hover:bg-blue-900/20' : 'bg-zinc-900/30 hover:bg-zinc-800/60'}`}>
                          <td className="p-3 rounded-l-xl border-y border-l border-zinc-800/30">
                             <div className="flex items-center gap-3">
                                {getTeamLogo(scrim.opponent) ? (
                                  <img src={getTeamLogo(scrim.opponent)!} className="w-8 h-8 object-contain shrink-0 bg-zinc-950 rounded-lg p-1 border border-zinc-800 drop-shadow-sm group-hover/row:border-zinc-600 transition-colors" />
                                ) : (
                                  <div className="w-8 h-8 shrink-0 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-600 group-hover/row:border-zinc-600 transition-colors">{scrim.opponent.substring(0,3)}</div>
                                )}
                                <div className="flex flex-col gap-0.5">
                                   <span className={`${scrim.isMission ? 'text-blue-500' : 'text-blue-400'} font-bold tracking-[0.2em] uppercase transition-colors text-[8px]`}>{formatDate(scrim.date)}</span>
                                   <span className="text-white text-sm font-black leading-none uppercase tracking-tight drop-shadow-sm">VS {scrim.opponent}</span>
                                </div>
                             </div>
                          </td>
                          <td className="p-3 text-center border-y border-zinc-800/30">
                             <div className="flex flex-col items-center gap-1">
                                <span className={`text-base font-black ${scrim.result === 'W' ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : scrim.result === 'L' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]' : scrim.result === 'AGEND.' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'text-zinc-400'}`}>{scrim.result}</span>
                                <span className={`font-black px-2 py-0.5 rounded border ${scrim.isMission ? 'bg-blue-950/50 text-blue-300 border-blue-900/50' : 'bg-zinc-950/80 text-white border-zinc-700'}`}>{scrim.score}</span>
                             </div>
                          </td>
                          <td className="p-3 text-center border-y border-zinc-800/30">
                             <div className="flex flex-col items-center gap-1">
                                <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 font-black tracking-widest text-[7px] uppercase">{scrim.mode}</span>
                                <span className="text-zinc-400 font-bold group-hover/row:text-white transition-colors">{scrim.comp}</span>
                             </div>
                          </td>
                          <td className="p-3 text-center border-y border-zinc-800/30">
                             <span className={`px-2 py-1 rounded-md border font-black text-[8px] tracking-widest uppercase shadow-sm ${scrim.isMission ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : getDifficultyColor(scrim.difficulty)}`}>{scrim.difficulty}</span>
                          </td>
                          <td className="p-3 text-center rounded-r-xl border-y border-r border-zinc-800/30 relative">
                             <span className={`font-black text-[9px] ${scrim.remakes > 0 ? 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]' : 'text-zinc-600'}`}>{scrim.remakes > 0 ? `${scrim.remakes} RMK` : '-'}</span>
                             
                             {isStaff && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-2 bg-zinc-900/95 backdrop-blur-sm p-1.5 rounded-lg border border-zinc-700 shadow-xl transition-all duration-300 translate-x-2 group-hover/row:translate-x-0">
                                   <button onClick={() => { 
                                       if (scrim.isMission) {
                                           setEditScrimId(null);
                                           setEditMissionId(null);
                                           const info = scrim.rawObj.status ? String(scrim.rawObj.status).split('|') : []; 
                                           let dm = 'PADRÃO'; 
                                           if (info.length >= 3) { dm = info[2].trim(); }
                                           const isKnownTeam = teamsList.some(t => t.acronym === scrim.opponent);
                                           setScrimForm({ 
                                              date: scrim.rawObj.mission_date, 
                                              opponent: isKnownTeam ? scrim.opponent : 'MIX', 
                                              result: 'W', 
                                              score: '', 
                                              mode: scrim.mode, 
                                              comp: dm, 
                                              difficulty: 'CONTROLADO', 
                                              punctuality: 'PONTUAIS', 
                                              remakes: 0, 
                                              match_ids: '' 
                                           });
                                           setScrimModalOpen(true);
                                       } else {
                                           setEditScrimId(scrim.isManual ? scrim.id : null); 
                                           setScrimForm({ date: scrim.date, opponent: scrim.opponent, result: scrim.result, score: scrim.score, mode: scrim.mode, comp: scrim.comp, difficulty: scrim.difficulty, punctuality: scrim.punctuality, remakes: scrim.remakes, match_ids: '' }); 
                                           setScrimModalOpen(true); 
                                       }
                                   }} className="text-blue-400 hover:text-white px-2.5 py-1 bg-blue-500/10 hover:bg-blue-600 hover:border-blue-500 rounded font-black tracking-widest border border-transparent transition-all uppercase text-[7px] flex items-center gap-1">
                                      <Edit2 size={10}/> {scrim.isMission ? 'LOGAR RESULTADO' : 'EDITAR'}
                                   </button>
                                </div>
                             )}
                          </td>
                       </tr>
                    )) : <tr><td colSpan={6} className="text-center py-10 text-[9px] font-black text-zinc-600 uppercase tracking-widest opacity-80">NENHUM REGISTO ENCONTRADO NO PERÍODO.</td></tr>}
                 </tbody>
              </table>

              {totalLogPages > 1 && (
                 <div className="flex justify-between items-center px-4 py-3 mt-2 border-t border-zinc-800/60 shrink-0">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                       Página {logsPage} de {totalLogPages}
                    </span>
                    <div className="flex gap-2">
                       <button 
                          onClick={() => setLogsPage(p => Math.max(1, p - 1))} 
                          disabled={logsPage === 1}
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg disabled:opacity-50 font-bold text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-colors"
                       >Anterior</button>
                       <button 
                          onClick={() => setLogsPage(p => Math.min(totalLogPages, p + 1))} 
                          disabled={logsPage === totalLogPages}
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg disabled:opacity-50 font-bold text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-colors"
                       >Próxima</button>
                    </div>
                 </div>
              )}
           </div>
        </div>

      </div>

      {/* MODAIS */}
      
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleUpdateProfile} className="w-full max-w-md bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center">Editar Perfil</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Nickname</label><input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} /></div>
              <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">URL da Foto</label><input type="url" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={profileForm.photo_url} onChange={e => setProfileForm({...profileForm, photo_url: e.target.value})} /></div>
            </div>
            <div className="flex gap-4 pt-5 border-t border-zinc-800/60 mt-2">
              <button type="button" onClick={() => setProfileModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {isMissionModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveMission} className="w-full max-w-xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center">{editMissionId ? "Editar Evento" : "Novo Evento"}</h2>
            <div className="space-y-5">
              <div className="flex gap-5 items-center">
                 {missionForm.opponent && missionForm.opponent !== 'MIX' && getTeamLogo(missionForm.opponent) ? (
                    <img src={getTeamLogo(missionForm.opponent)!} className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 object-contain p-1 shadow-md" />
                 ) : (
                    <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center"><Shield className="text-zinc-600" size={24} /></div>
                 )}
                 <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Adversário</label>
                    <select 
                      required 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner cursor-pointer" 
                      value={missionForm.opponent} 
                      onChange={e => setMissionForm({...missionForm, opponent: e.target.value})}
                    >
                      <option value="" disabled>SELECIONA UM ADVERSÁRIO</option>
                      <option value="MIX" className="text-amber-400">MIX / EQUIPE TIER 3 (CUSTOM)</option>
                      {Object.keys(groupedTeamsByRegion).map((region) => (
                        <optgroup key={region} label={region} className="bg-zinc-950 text-zinc-500 font-black text-[9px] tracking-widest uppercase py-2">
                          {groupedTeamsByRegion[region].map((t: any) => (
                            <option key={t.acronym} value={t.acronym} className="bg-zinc-900 text-white font-bold text-xs normal-case">
                              {t.name} ({t.acronym})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    
                    {missionForm.opponent === 'MIX' && (
                       <input 
                          type="text" 
                          required 
                          placeholder="Digite a tag da equipe mix/teste..." 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner uppercase mt-3" 
                          value={missionForm.customOpponent} 
                          onChange={e => setMissionForm({...missionForm, customOpponent: e.target.value})} 
                       />
                    )}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Data</label><input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} /></div>
                <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Hora</label><input type="time" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.time} onChange={e => setMissionForm({...missionForm, time: e.target.value})} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'SCRIM'})} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors ${missionForm.type === 'SCRIM' ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>SCRIM</button>
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'TRYOUT'})} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors ${missionForm.type === 'TRYOUT' ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>TRYOUT</button>
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'OFFICIAL'})} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors ${missionForm.type === 'OFFICIAL' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>OFICIAL</button>
              </div>
              <div className="grid grid-cols-2 gap-5 pt-2">
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.gamesCount} onChange={e => setMissionForm({...missionForm, gamesCount: e.target.value})}><option value="1 JOGO">1 JOGO</option><option value="2 JOGOS">2 JOGOS</option><option value="3 JOGOS">3 JOGOS</option><option value="4 JOGOS">4 JOGOS</option><option value="5 JOGOS">5 JOGOS</option></select>
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.draftMode} onChange={e => setMissionForm({...missionForm, draftMode: e.target.value})}><option value="PADRÃO">DRAFT PADRÃO</option><option value="FEARLESS">DRAFT FEARLESS</option><option value="MISTO">MISTO</option></select>
              </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-2">
              <button type="button" onClick={() => setMissionModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {isScrimModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSaveScrim} className="w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl my-auto relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">
              {editScrimId ? "Editar Registo" : "Novo Registo de Scrim"}
            </h2>
            
            <div className="space-y-5">
               <div className="grid grid-cols-2 gap-5">
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Data da Scrim</label>
                     <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner" value={scrimForm.date} onChange={e => setScrimForm({...scrimForm, date: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Oponente (Sigla)</label>
                     <input type="text" required placeholder="EX: LOUD" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner uppercase" value={scrimForm.opponent} onChange={e => setScrimForm({...scrimForm, opponent: e.target.value.toUpperCase()})} />
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-5">
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Resultado</label>
                     <select value={scrimForm.result} onChange={e => setScrimForm({...scrimForm, result: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner">
                        <option value="W">Vitória (W)</option>
                        <option value="L">Derrota (L)</option>
                        <option value="D">Empate (D)</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Placar</label>
                     <input type="text" required placeholder="Ex: 2 - 1" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner" value={scrimForm.score} onChange={e => setScrimForm({...scrimForm, score: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Formato</label>
                     <select value={scrimForm.mode} onChange={e => setScrimForm({...scrimForm, mode: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner">
                        <option value="MD1">MD1</option>
                        <option value="MD2">MD2</option>
                        <option value="MD3">MD3</option>
                        <option value="MD5">MD5</option>
                        <option value="BLOCO">BLOCO</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Comp Testada (Foco Geral)</label>
                  <input type="text" required placeholder="Ex: Poke, Engage, Scalonamento..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner" value={scrimForm.comp} onChange={e => setScrimForm({...scrimForm, comp: e.target.value})} />
               </div>

               <div className="grid grid-cols-2 gap-5">
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Dificuldade Tática</label>
                     <select value={scrimForm.difficulty} onChange={e => setScrimForm({...scrimForm, difficulty: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner">
                        <option value="STOMPAMOS">Stompamos</option>
                        <option value="MUITO FÁCIL">Muito Fácil</option>
                        <option value="FÁCIL">Fácil</option>
                        <option value="CONTROLADO">Controlado</option>
                        <option value="DIFÍCIL">Difícil</option>
                        <option value="MT DIFÍCIL">Muito Difícil</option>
                        <option value="STOMPADOS">Stompados</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Pontualidade</label>
                     <select value={scrimForm.punctuality} onChange={e => setScrimForm({...scrimForm, punctuality: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner">
                        <option value="PONTUAIS">Pontuais (Ambos)</option>
                        <option value="NOSSO ATRASO">Nosso Atraso</option>
                        <option value="ATRASO DELES">Atraso Deles</option>
                        <option value="DESMARCARAM NA HORA">Desmarcaram</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">Remakes (Problemas Técnicos/Draft)</label>
                  <div className="flex gap-2">
                     {[0, 1, 2, 3].map(num => (
                        <button key={num} type="button" onClick={() => setScrimForm({...scrimForm, remakes: num})} className={`flex-1 py-3 rounded-xl border-2 text-lg font-black transition-all duration-200 hover:-translate-y-0.5 ${scrimForm.remakes === num ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-white hover:bg-zinc-800'}`}>
                           {num}
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-4">
              <button type="button" onClick={() => setScrimModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(217,119,6,0.4)]">Guardar Registo</button>
            </div>
          </form>
        </div>
      )}

      {isWellnessModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleWellnessSubmit} className="w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-8 shadow-2xl animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">Daily Readiness Sync</h2>
            <div className="space-y-4 mb-5">
               <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 block mb-1.5">Atleta Selecionado</label>
               <select value={wellnessForm.puuid} disabled={!isStaff} onChange={e => setWellnessForm({...wellnessForm, puuid: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-emerald-500 transition-colors shadow-inner disabled:opacity-50 disabled:cursor-not-allowed">
                  {roster.map(p => <option key={p.puuid} value={p.puuid}>{p.nickname} ({p.primary_role})</option>)}
               </select>
            </div>
            <div className="space-y-6">
               <WellnessInput icon={<Moon size={24} className="text-indigo-400" />} title="Qualidade do Sono" desc="1 = Insónia/Péssimo | 5 = Recuperação Total" value={wellnessForm.sleep} onChange={(v: any) => setWellnessForm({...wellnessForm, sleep: v})} />
               <WellnessInput icon={<Brain size={24} className="text-amber-400" />} title="Estado Mental & Stress" desc="1 = Esgotado | 5 = Foco Total/Calmo" value={wellnessForm.mental} onChange={(v: any) => setWellnessForm({...wellnessForm, mental: v})} />
               <WellnessInput icon={<Activity size={24} className="text-emerald-400" />} title="Dores & Fadiga Física" desc="1 = Dor forte | 5 = Zero Dor/Pronto" value={wellnessForm.physical} onChange={(v: any) => setWellnessForm({...wellnessForm, physical: v})} />
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-4">
              <button type="button" onClick={() => setWellnessModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)]">Sincronizar Dados</button>
            </div>
          </form>
        </div>
      )}

      {wellnessHistoryModal.isOpen && wellnessHistoryModal.player && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            <div className="flex items-center justify-between mb-8 border-b border-zinc-800/60 pb-5">
               <div className="flex items-center gap-5">
                  <img src={wellnessHistoryModal.player.photo} className="w-14 h-14 rounded-xl border-2 border-emerald-500/30 object-cover shadow-[0_0_10px_rgba(16,185,129,0.2)]" />
                  <div>
                     <h2 className="text-2xl font-black text-white uppercase tracking-tight">{wellnessHistoryModal.player.name}</h2>
                     <p className="text-[10px] text-emerald-500 font-bold tracking-widest mt-1 uppercase">Histórico Biométrico</p>
                  </div>
               </div>
               <button onClick={() => setWellnessHistoryModal({ isOpen: false, player: null, history: [] })} className="text-zinc-500 hover:text-white transition-colors w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
               <table className="w-full text-left border-separate border-spacing-y-2.5">
                  <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur-md z-10">
                     <tr className="text-[9px] text-zinc-500 font-black tracking-widest uppercase">
                        <th className="px-4 pb-3 border-b border-zinc-800/80">DATA</th>
                        <th className="px-4 pb-3 border-b border-zinc-800/80 text-center">READINESS</th>
                        <th className="px-4 pb-3 border-b border-zinc-800/80 text-center">SONO</th>
                        <th className="px-4 pb-3 border-b border-zinc-800/80 text-center">MENTAL</th>
                        <th className="px-4 pb-3 border-b border-zinc-800/80 text-center">FÍSICO</th>
                     </tr>
                  </thead>
                  <tbody>
                     {wellnessHistoryModal.history.map((record: any) => (
                       <tr key={record.record_date} className="bg-zinc-900/30 hover:bg-zinc-800/60 transition-colors border border-zinc-800/50">
                         <td className="p-4 rounded-l-xl text-[10px] font-bold text-zinc-300 tracking-widest border-y border-l border-zinc-800/30">{formatDate(record.record_date)}</td>
                         <td className="p-4 text-center border-y border-zinc-800/30"><span className={`text-base font-black ${record.readiness_percent < 65 ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : record.readiness_percent > 85 ? 'text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-amber-500'}`}>{record.readiness_percent}%</span></td>
                         <td className="p-4 text-center text-xs text-white font-bold border-y border-zinc-800/30">{record.sleep_score}</td>
                         <td className="p-4 text-center text-xs text-white font-bold border-y border-zinc-800/30">{record.mental_score}</td>
                         <td className="p-4 text-center text-xs text-white font-bold rounded-r-xl border-y border-r border-zinc-800/30">{record.physical_score}</td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTÃO DO ELENCO (ROSTER) */}
      {isRosterModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl my-auto relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            
            <div className="flex justify-between items-start border-b border-zinc-800/60 pb-5 mb-6">
               <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                     <Users className="text-emerald-500" size={24} /> Gestão de Line-Up
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1.5 uppercase">Elenco Ativo: {myTeamTag}</p>
               </div>
               <button onClick={() => setRosterModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               {/* LADO ESQUERDO: LISTA ATUAL */}
               <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] text-zinc-400 font-black tracking-widest uppercase border-b border-zinc-800/50 pb-2 mb-1">Roster Atual</h4>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                     {roster.map(p => (
                        <div key={p.puuid} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 p-2.5 rounded-xl">
                           <div className="flex items-center gap-3">
                              <img src={p.photo_url || p.photo} className="w-8 h-8 rounded-lg border border-zinc-700 object-cover" />
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-white uppercase leading-none">{p.nickname}</span>
                                 <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">{String(p.primary_role).replace(/jug/i, 'JNG')}</span>
                              </div>
                           </div>
                           <button onClick={() => handleRemoveFromRoster(p)} className="p-1.5 bg-red-500/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded-lg transition-colors group/btn">
                              <UserMinus size={14} className="group-hover/btn:scale-110 transition-transform" />
                           </button>
                        </div>
                     ))}
                  </div>
               </div>

               {/* LADO DIREITO: MERCADO E ADIÇÃO */}
               <div className="flex flex-col gap-6">
                  
                  {/* TRAZER JOGADOR EXISTENTE */}
                  <div className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
                     <h4 className="text-[10px] text-blue-400 font-black tracking-widest uppercase mb-3 flex items-center gap-1.5"><ListFilter size={12}/> Importar da Base de Dados</h4>
                     <div className="flex flex-col gap-3">
                        <select value={selectedPlayerToAdd} onChange={e => setSelectedPlayerToAdd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner text-xs cursor-pointer">
                           <option value="" disabled>SELECIONAR JOGADOR LIVRE / OUTRA EQUIPA</option>
                           {allPlayersList.filter(p => !String(p.team_acronym || '').toUpperCase().includes(myTeamTag)).map(p => (
                              <option key={p.puuid} value={p.puuid}>{p.nickname} ({p.team_acronym || 'FA'} - {p.primary_role})</option>
                           ))}
                        </select>
                        <button onClick={handleAddExistingPlayer} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-[0_0_10px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2">
                           <Plus size={14}/> Contratar Jogador
                        </button>
                     </div>
                  </div>

                  {/* CRIAR JOGADOR NOVO */}
                  <div className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
                     <h4 className="text-[10px] text-emerald-400 font-black tracking-widest uppercase mb-3 flex items-center gap-1.5"><UserPlus size={12}/> Criar Novo Jogador (Scouting)</h4>
                     <div className="grid grid-cols-2 gap-3 mb-3">
                        <input type="text" placeholder="NICKNAME" value={newPlayerForm.nickname} onChange={e => setNewPlayerForm({...newPlayerForm, nickname: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:border-emerald-500 transition-colors shadow-inner text-xs uppercase" />
                        <select value={newPlayerForm.role} onChange={e => setNewPlayerForm({...newPlayerForm, role: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:border-emerald-500 transition-colors shadow-inner text-xs cursor-pointer">
                           <option value="TOP">TOP</option><option value="JNG">JUNGLE</option><option value="MID">MID</option><option value="ADC">ADC</option><option value="SUP">SUPPORT</option>
                        </select>
                     </div>
                     <button onClick={handleCreateNewPlayer} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                        Promover à Equipa Principal
                     </button>
                  </div>

               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function CustomMatchupTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[150px]">
        <p className="text-[11px] font-black text-white uppercase mb-2.5 border-b border-zinc-800 pb-1.5">{data.opponent}</p>
        <div className="flex justify-between items-center gap-4 text-[10px] font-bold mb-1.5">
          <span className="text-zinc-500 uppercase tracking-widest">Jogos Totais:</span>
          <span className="text-white bg-zinc-900 px-1.5 py-0.5 rounded">{data.total}</span>
        </div>
        <div className="flex justify-between items-center gap-4 text-[10px] font-bold mb-1.5">
          <span className="text-emerald-500/80 uppercase tracking-widest">Vitórias:</span>
          <span className="text-emerald-400">{data.wins}</span>
        </div>
        <div className="flex justify-between items-center gap-4 text-[10px] font-bold mb-2.5 border-b border-zinc-800 pb-2">
          <span className="text-red-500/80 uppercase tracking-widest">Derrotas:</span>
          <span className="text-red-400">{data.losses}</span>
        </div>
        <div className="flex justify-between items-center gap-4 text-[11px] font-black">
          <span className="text-zinc-400 uppercase tracking-widest">Win Rate:</span>
          <span className={data.winRate >= 50 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'}>{data.winRate}%</span>
        </div>
      </div>
    );
  }
  return null;
}

function CustomDonutTooltip({ active, payload, totalGames }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = payload[0].payload.fill;
    const pct = totalGames > 0 ? Math.round((data.value / totalGames) * 100) : 0;
    
    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[160px] flex flex-col gap-2">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-1">
           <div className="w-2.5 h-2.5 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}></div>
           <span className="text-[11px] font-black text-white uppercase tracking-widest">{data.name}</span>
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-bold">
           <span className="text-zinc-500 uppercase tracking-widest">Partidas:</span>
           <span className="text-white bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">{data.value}</span>
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-black mt-0.5">
           <span className="text-zinc-400 uppercase tracking-widest">Share (%):</span>
           <span style={{ color: color }} className="drop-shadow-sm">{pct}%</span>
        </div>
      </div>
    );
  }
  return null;
}

function CustomRadarTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length >= 2) {
    const val1 = payload[0].value;
    const val2 = payload[1].value;
    const diff = val1 - val2;
    const isFirstLeading = diff >= 0;

    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[160px] flex flex-col gap-2.5">
        <span className="text-[11px] font-black text-white uppercase border-b border-zinc-800 pb-1.5 mb-1 tracking-[0.15em] text-center">
          {label}
        </span>
        
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between items-center text-[10px] font-bold">
            <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
               <span className="text-zinc-400 uppercase tracking-widest">{entry.name}:</span>
            </div>
            <span className="font-black drop-shadow-sm text-[11px]" style={{ color: entry.color }}>
              {entry.value} <span className="text-[8px] opacity-60 ml-0.5">PTS</span>
            </span>
          </div>
        ))}
        
        <div className="mt-1 pt-2 border-t border-zinc-800/60 flex justify-between items-center">
           <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Vantagem:</span>
           <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
             diff === 0 ? 'bg-zinc-900 text-zinc-400 border-zinc-800' :
             isFirstLeading ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
           }`}>
              {diff === 0 ? 'EQUILÍBRIO' : `${Math.abs(diff)} PTS (${isFirstLeading ? payload[0].name : payload[1].name})`}
           </span>
        </div>
      </div>
    );
  }
  return null;
}

function CustomEfficiencyTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc: number, entry: any) => acc + (entry.value || 0), 0);
    const activeData = payload.filter((entry: any) => entry.value > 0).reverse();

    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[190px] flex flex-col gap-2">
        <div className="flex justify-between items-end border-b border-zinc-800 pb-2 mb-1">
           <span className="text-[12px] font-black text-white uppercase tracking-widest">{label}</span>
           <div className="flex flex-col items-end">
              <span className="text-[13px] font-black text-emerald-400 leading-none">{total}</span>
              <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Jogos Totais</span>
           </div>
        </div>
        
        {activeData.length > 0 ? activeData.map((entry: any, index: number) => {
          const pct = Math.round((entry.value / total) * 100);
          return (
            <div key={index} className="flex justify-between items-center text-[10px] font-bold">
              <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
                 <span className="text-zinc-300 uppercase tracking-widest">{entry.name}:</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-white bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-black w-6 text-center shadow-inner">{entry.value}</span>
                 <span className="text-[9px] w-7 text-right font-black drop-shadow-sm" style={{ color: entry.color }}>{pct}%</span>
              </div>
            </div>
          );
        }) : (
           <span className="text-[9px] text-zinc-600 font-black uppercase text-center py-3">Sem dados registados</span>
        )}
      </div>
    );
  }
  return null;
}

function CustomEarlyGameTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.goldDiff >= 0;
    const color = isPositive ? '#3b82f6' : '#ef4444';
    const sign = isPositive ? '+' : '';

    return (
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[160px] flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
           <div className="flex flex-col">
              <span className="text-[11px] font-black text-white uppercase tracking-widest truncate max-w-[90px]">{data.fullOpponent}</span>
              <span className="text-[7px] font-bold text-zinc-500 tracking-widest mt-0.5">{data.date}</span>
           </div>
           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${data.isWin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
             {data.isWin ? 'VITÓRIA' : 'DERROTA'}
           </span>
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-bold mt-0.5">
           <span className="text-zinc-500 uppercase tracking-widest">Ouro @ 12:</span>
           <span className="text-[13px] font-black drop-shadow-md" style={{ color: color }}>
              {sign}{data.goldDiff} <span className="text-[8px] text-zinc-500 font-black">G</span>
           </span>
        </div>
      </div>
    );
  }
  return null;
}

function CalendarEventItem({ ev, isStaff, onEdit, onDelete }: any) {
   const isScrim = ev.type === 'SCRIM';
   const isTryout = ev.type === 'TRYOUT';
   
   const bgClass = ev.isPast 
       ? (isTryout ? 'bg-fuchsia-950/20 border-fuchsia-900/40 hover:bg-fuchsia-900/40' : isScrim ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-900/40' : 'bg-blue-950/20 border-blue-900/40 hover:bg-blue-900/40')
       : (isTryout ? 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/20' : isScrim ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20');
   
   const textClass = isTryout ? 'text-fuchsia-400' : isScrim ? 'text-amber-500' : 'text-blue-400';

   return (
      <div onClick={(e) => { if(!ev.isAuto && isStaff) onEdit(e, ev); else e.stopPropagation(); }} className={`p-2 rounded-lg flex items-center gap-2.5 border ${bgClass} transition-colors w-full cursor-pointer overflow-hidden shrink-0 group/item hover:border-zinc-500`}>
         {ev.logo ? (
            <img src={ev.logo} className="w-8 h-8 object-contain drop-shadow-lg shrink-0 bg-black/40 rounded p-0.5 border border-zinc-800" alt={ev.opp} />
         ) : (
            <div className="w-8 h-8 rounded bg-black/40 border border-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-500 shrink-0"><Shield size={14} /></div>
         )}
         <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
             <div className="flex justify-between items-center">
                <span className={`text-[10px] font-black ${textClass} uppercase truncate group-hover/item:text-white transition-colors pr-2`}>{ev.opp}</span>
                <span className="text-[8px] text-zinc-400 font-bold tracking-widest">{ev.time}</span>
             </div>
             <div className="flex justify-between items-center mt-0.5">
                <span className="text-[8px] font-bold text-zinc-500 uppercase">{ev.type}</span>
                <span className={`text-[9px] font-black uppercase leading-none ${ev.isPast ? (ev.isWin ? 'text-emerald-500' : ev.resultText.includes('D') ? 'text-zinc-400' : 'text-red-500') : 'text-zinc-300'}`}>
                   {ev.isPast ? ev.resultText : ev.mode}
                </span>
             </div>
             {isStaff && !ev.isAuto && (
                <div className="flex gap-1.5 mt-1.5 border-t border-zinc-800/40 pt-1.5">
                   <button onClick={(e) => { e.stopPropagation(); onEdit(e, ev); }} className="flex-1 flex justify-center items-center py-1 bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition-colors border border-blue-500/20 hover:border-blue-500">
                      <Edit2 size={10} />
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); onDelete(ev); }} className="flex-1 flex justify-center items-center py-1 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors border border-red-500/20 hover:border-red-500">
                      <Trash2 size={10} />
                   </button>
                </div>
             )}
         </div>
      </div>
   );
}

function Badge({ text, color }: { text: string, color: string }) {
  return <span className={`${color} text-white text-[9px] px-3 py-1.5 rounded-lg border uppercase font-black tracking-widest leading-none shadow-sm`}>{text}</span>;
}

function WellnessBar({ label, value }: { label: string, value: number }) {
  const color = value <= 2 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : value === 3 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[8px] text-zinc-500 w-12 text-right font-black tracking-widest uppercase">{label}</span>
      <div className="flex gap-1 flex-1">{[1, 2, 3, 4, 5].map((level) => (<div key={level} className={`h-1.5 flex-1 rounded-[2px] transition-colors duration-300 ${level <= value ? color : 'bg-zinc-800'}`}></div>))}</div>
    </div>
  );
}

function MiniStatBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 group/bar">
      <span className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase w-16 truncate group-hover/bar:text-zinc-300 transition-colors">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 relative">
         <div className={`absolute top-0 left-0 h-full ${color} shadow-[0_0_8px_currentColor] transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
      </div>
      <span className="text-[10px] font-black text-white w-8 text-right">{value}</span>
    </div>
  );
}

function WellnessInput({ icon, title, desc, value, onChange }: any) {
  return (
    <div>
       <div className="flex items-center gap-4 mb-4">
          <span className="bg-zinc-900 border border-zinc-800 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner">{icon}</span>
          <div>
             <p className="text-sm text-white font-black uppercase tracking-tight leading-none mb-1.5">{title}</p>
             <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">{desc}</p>
          </div>
       </div>
       <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((num) => {
            const isActive = value === num; const isDanger = num <= 2; const isMid = num === 3;
            const activeColor = isDanger ? 'bg-red-600 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : isMid ? 'bg-amber-600 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-600 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
            return (<button key={num} type="button" onClick={() => onChange(num)} className={`flex-1 py-4 rounded-xl border-2 text-lg font-black transition-all duration-200 hover:-translate-y-0.5 ${isActive ? `${activeColor} text-white scale-[1.02]` : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-white hover:bg-zinc-800'}`}>{num}</button>);
          })}
       </div>
    </div>
  );
}