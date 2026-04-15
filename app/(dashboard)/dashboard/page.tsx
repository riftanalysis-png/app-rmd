"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area
} from 'recharts';

// --- FUNÇÕES UTILITÁRIAS GLOBAIS (Blindadas contra null/undefined) ---
function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

const getDifficultyColor = (diff: any) => { 
  const safeDiff = String(diff || '').toUpperCase();
  switch (safeDiff) { 
    case 'STOMPAMOS': return 'bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]'; 
    case 'MUITO FÁCIL': return 'bg-blue-500 text-white border-blue-400'; 
    case 'FÁCIL': return 'bg-sky-500 text-white border-sky-400'; 
    case 'CONTROLADO': return 'bg-zinc-500 text-white border-zinc-400'; 
    case 'DIFÍCIL': return 'bg-amber-500 text-white border-amber-400'; 
    case 'MT DIFÍCIL': return 'bg-orange-500 text-white border-orange-400'; 
    case 'STOMPADOS': return 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.3)]'; 
    default: return 'bg-zinc-800 text-zinc-300 border-zinc-700'; 
  } 
};

const getPunctualityColor = (punct: any) => { 
  const p = String(punct || '').toUpperCase();
  if (p.includes('PONTUAIS')) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'; 
  if (p.includes('NOSSO ATRASO')) return 'text-red-400 border-red-500/30 bg-red-500/10'; 
  if (p.includes('ATRASO DELES')) return 'text-orange-400 border-orange-500/30 bg-orange-500/10'; 
  return 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10'; 
};

const formatDate = (dateString: string) => { 
  if (!dateString) return ''; 
  const p = dateString.split('-'); 
  return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; 
};

const formatTimeStr = (timeString: string) => { 
  if (!timeString) return ''; 
  return timeString.substring(0, 5); 
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState({ id: '', role: 'analista', puuid: 'PUUID_DE_TESTE_DO_JOGADOR', name: 'CARREGANDO...', photo: '' });
  const isStaff = ['analista', 'treinador', 'diretor'].includes(String(currentUser.role || '').toLowerCase());

  const [loading, setLoading] = useState(true);
  
  // FILTROS E ESTADOS
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPatch, setFilterPatch] = useState('');
  const [myTeamTag, setMyTeamTag] = useState('RMD'); 
  
  const [matchesRaw, setMatchesRaw] = useState<any[]>([]);
  const [statsDetailed, setStatsDetailed] = useState<any[]>([]);
  const [missionsRaw, setMissionsRaw] = useState<any[]>([]);
  const [scrimReportsManual, setScrimReportsManual] = useState<any[]>([]);
  const [vodTasks, setVodTasks] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [teamWellness, setTeamWellness] = useState<any[]>([]);
  const [teamMetricsRaw, setTeamMetricsRaw] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]); 
  const [nextTargetIntel, setNextTargetIntel] = useState({ team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [] });
  
  // UI STATE
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedWellnessId, setExpandedWellnessId] = useState<string | null>(null);
  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');

  // MODAIS & FORMS
  const [isWellnessModalOpen, setWellnessModalOpen] = useState(false);
  const [isMissionModalOpen, setMissionModalOpen] = useState(false);
  const [isScrimModalOpen, setScrimModalOpen] = useState(false);
  const [isTargetModalOpen, setTargetModalOpen] = useState(false);
  const [isVodModalOpen, setVodModalOpen] = useState(false);
  const [isMetricsModalOpen, setMetricsModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [wellnessHistoryModal, setWellnessHistoryModal] = useState<{isOpen: boolean, player: any, history: any[]}>({ isOpen: false, player: null, history: [] });

  const [profileForm, setProfileForm] = useState({ name: '', photo_url: '' });
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [editScrimId, setEditScrimId] = useState<string | null>(null);
  const [wellnessForm, setWellnessForm] = useState({ puuid: '', sleep: 3, mental: 3, physical: 3, focus: 3 });
  const [missionForm, setMissionForm] = useState({ date: '', time: '', opponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' });
  const [scrimForm, setScrimForm] = useState({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
  const [targetForm, setTargetForm] = useState({ team: '', win1: '', win2: '', win3: '' });
  const [vodForm, setVodForm] = useState({ tag: 'MACRO', text: '' });
  const [metricsForm, setMetricsForm] = useState({
     date: new Date().toISOString().split('T')[0], stress: 50, load: 50,
     early_micro: 33, early_macro: 33, early_tf: 34, mid_micro: 33, mid_macro: 33, mid_tf: 34, late_micro: 33, late_macro: 33, late_tf: 34,
  });

  const upcomingMissions = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    return missionsRaw
       .filter(m => m.mission_date === todayStr || m.mission_date === tomorrowStr)
       .sort((a, b) => {
          const dateTimeA = `${a.mission_date}T${a.mission_time || '00:00:00'}`;
          const dateTimeB = `${b.mission_date}T${b.mission_time || '00:00:00'}`;
          return dateTimeA.localeCompare(dateTimeB);
       });
  }, [missionsRaw]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
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

      const { data: configData } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
      const myTeam = configData?.my_team_tag?.toUpperCase() || 'RMD';
      setMyTeamTag(myTeam);

      const [rosterRes, teamsRes, matchesRes, viewRes, statsRes, missionsRes, scrimsRes, vodRes, wellnessRes, metricsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('matches').select('*').limit(50000),
        supabase.from('view_matches_with_teams').select('*').limit(50000),
        supabase.from('player_stats_detailed').select('*').limit(50000),
        supabase.from('missions').select('*'),
        supabase.from('scrim_reports').select('*'),
        supabase.from('vod_tasks').select('*'),
        supabase.from('player_wellness').select('*').order('record_date', { ascending: false }),
        supabase.from('team_daily_metrics').select('*').order('record_date', { ascending: true }) 
      ]);

      const activeRoster = (rosterRes.data || []).filter(p => String(p.team_acronym || p.team || '').toUpperCase().includes(myTeam));
      setRoster(activeRoster);

      const myPlayerInfo = activeRoster.find(p => p.puuid === loggedUser.puuid);
      if (myPlayerInfo) { loggedUser.name = myPlayerInfo.nickname || myPlayerInfo.name; if(myPlayerInfo.photo_url) loggedUser.photo = myPlayerInfo.photo_url; }
      setCurrentUser(loggedUser);

      if (teamsRes.data) setTeamsList(teamsRes.data);
      if (statsRes.data) setStatsDetailed(statsRes.data);
      
      const safeMissions = (missionsRes.data || []).filter(m => String(m.team_acronym || '').toUpperCase().includes(myTeam));
      setMissionsRaw(safeMissions);
      
      const safeScrims = (scrimsRes.data || []).filter(s => String(s.team_acronym || '').toUpperCase().includes(myTeam));
      setScrimReportsManual(safeScrims);
      
      const safeVod = (vodRes.data || []).filter(v => String(v.team_acronym || '').toUpperCase().includes(myTeam));
      setVodTasks(safeVod);

      const safeMetrics = (metricsRes.data || []).filter(v => String(v.team_acronym || '').toUpperCase().includes(myTeam));
      setTeamMetricsRaw(safeMetrics);

      if (viewRes.data && matchesRes.data) {
        const matchMeta: Record<string, any> = {};
        matchesRes.data.forEach(m => { matchMeta[m.id || m.match_id] = m; });
        const enriched = viewRes.data
          .filter(v => {
             const b = String(v.blue_team_tag || v.blue_tag || '').toUpperCase();
             const r = String(v.red_team_tag || v.red_tag || '').toUpperCase();
             return b.includes(myTeam) || r.includes(myTeam);
          })
          .map(v => {
             const meta = matchMeta[v.match_id || v.id] || {};
             return { ...v, game_start_time: meta.game_start_time, game_type: meta.game_type || v.game_type, game_duration: meta.game_duration || 0, patch: meta.patch || v.patch };
          });
        setMatchesRaw(enriched.sort((a,b) => getSafeTimestamp(b.game_start_time) - getSafeTimestamp(a.game_start_time)));
      }

      if (safeMissions.length > 0) {
         const today = new Date();
         const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
         const upcoming = safeMissions.filter(m => m.mission_date >= todayStr).sort((a,b) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`)).slice(0, 5);
         if (upcoming.length > 0) {
            const nextOp = upcoming[0].opponent_acronym;
            const { data: opData } = await supabase.from('opponent_intel').select('*').eq('opponent_acronym', nextOp).maybeSingle();
            if (opData) setNextTargetIntel({ team: nextOp, topPicks: opData.top_picks || [], topBans: opData.top_bans || [], winConditions: opData.win_conditions || [] });
            else setNextTargetIntel({ team: nextOp, topPicks: [], topBans: [], winConditions: [] });
         }
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (wellnessRes.data) {
        setTeamWellness(activeRoster.map(p => {
           const pRecs = wellnessRes.data.filter((w: any) => w.puuid === p.puuid);
           const lRec = pRecs.length > 0 ? pRecs[0] : null;
           return { puuid: p.puuid, name: p.nickname || p.name, role: p.primary_role || p.role, photo: p.photo_url || p.photo, score: lRec ? lRec.readiness_percent : 0, sleep: lRec ? lRec.sleep_score : 0, mental: lRec ? lRec.mental_score : 0, physical: lRec ? lRec.physical_score : 0, hasAnsweredToday: !!(lRec && lRec.record_date === todayStr), history: pRecs };
        }));
      }
      if (activeRoster.length > 0) setWellnessForm(prev => ({ ...prev, puuid: activeRoster[0].puuid }));

      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  const squadConfig = useMemo(() => {
    const day = new Date().getDay(); 
    let intensity = 0; let load = 'RECOVERY'; let directive = 'DAY OFF / DESCANDO';
    
    if (day === 4) { intensity = 0; load = 'RECOVERY'; directive = 'REST & RECOVERY'; } 
    else if (day === 5) { intensity = 40; load = 'MODERATE'; directive = 'LIGHT PREP & MACRO REVIEW'; } 
    else if (day === 6 || day === 0) { intensity = 95; load = 'MAXIMUM'; directive = 'HEAVY SCRIM BLOCKS'; } 
    else { intensity = 75; load = 'HIGH'; directive = 'OFFICIAL MATCH PREP'; }
    
    return { directive, load, intensity };
  }, []);

  const filteredMatches = useMemo(() => {
    return matchesRaw.filter(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;

      if (filterStartDate || filterEndDate) {
          let matchDateStr = '';
          if (m.game_start_time) {
              const d = new Date(String(m.game_start_time).replace(' ', 'T'));
              if (!isNaN(d.getTime())) matchDateStr = d.toISOString().split('T')[0];
          }
          if (filterStartDate && matchDateStr && matchDateStr < filterStartDate) return false;
          if (filterEndDate && matchDateStr && matchDateStr > filterEndDate) return false;
      }

      if (filterPatch && m.patch && !String(m.patch).includes(filterPatch)) return false;
      return true;
    });
  }, [matchesRaw, matchType, filterStartDate, filterEndDate, filterPatch]);

  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    filteredMatches.forEach(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
      
      let dateRaw = 'unknown-date';
      let timeRaw = '00:00';
      
      if (m.game_start_time) {
          const d = new Date(String(m.game_start_time).replace(' ', 'T'));
          
          if (!isNaN(d.getTime())) {
             d.setHours(d.getHours() - 3);

             if (isScrim && d.getHours() < 6) {
                 d.setHours(d.getHours() - 6);
             }

             timeRaw = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
             const year = d.getFullYear(); 
             const month = String(d.getMonth() + 1).padStart(2, '0'); 
             const day = String(d.getDate()).padStart(2, '0');
             dateRaw = `${year}-${month}-${day}`;
          }
      }
      
      let sId = isScrim ? `SCRIM_${dateRaw}_${opp}` : `OFICIAL_${dateRaw}_${opp}`;
      
      if (!groups[sId]) {
        groups[sId] = { id: sId, isScrim: isScrim, calendarDate: dateRaw, time: timeRaw, opp: opp || 'UNKNOWN', ourWins: 0, theirWins: 0, games: [] };
      }
      groups[sId].games.push(m);
      
      const isOurWin = (weAreBlue && String(m.winner_side).toLowerCase() === 'blue') || (!weAreBlue && String(m.winner_side).toLowerCase() === 'red');
      if (isOurWin) {
          groups[sId].ourWins++;
      } else {
          groups[sId].theirWins++;
      }
    });
    
    return Object.values(groups);
  }, [filteredMatches, myTeamTag]);

  const getTeamLogo = (acronym: string) => { 
     const t = teamsList.find(t => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
     return t?.logo_url || null; 
  };

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for(let i = 0; i < firstDayIndex; i++) grid.push(null);
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const pastEvents = groupedSeries.filter(g => g.calendarDate === dateStr).map(g => {
            const ourScore = g.ourWins;
            const theirScore = g.theirWins;
            return { id: g.id, time: g.time, opp: g.opp, type: g.isScrim ? 'SCRIM' : 'OFICIAL', resultText: `${ourScore} - ${theirScore} ${ourScore > theirScore ? 'W' : theirScore > ourScore ? 'L' : 'D'}`, isWin: ourScore > theirScore, isPast: true, logo: getTeamLogo(String(g.opp)) };
        });

        const opponentsPlayedToday = pastEvents.map(ev => String(ev.opp).toUpperCase().trim());

        const futureEvents = missionsRaw.filter(m => m.mission_date === dateStr).map(m => {
            const info = m.status ? m.status.split('|') : [];
            const gamesCount = info[1] ? info[1].trim() : 'TBD';
            return { id: m.id, time: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', opp: m.opponent_acronym, type: m.mission_type, mode: gamesCount, isPast: false, rawMission: m, logo: getTeamLogo(String(m.opponent_acronym)) };
        }).filter(mission => {
            const missionOpp = String(mission.opp).toUpperCase().trim();
            const isDuplicate = opponentsPlayedToday.some(playedOpp => playedOpp.includes(missionOpp) || missionOpp.includes(playedOpp));
            return !isDuplicate;
        });

        grid.push({ day: i, dateStr, isToday: dateStr === new Date().toISOString().split('T')[0], events: [...pastEvents, ...futureEvents].sort((a,b) => a.time.localeCompare(b.time)) });
    }
    
    while(grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [currentDate, groupedSeries, missionsRaw, teamsList]);

  const stats = useMemo(() => {
    const total = filteredMatches.length;
    let blueTotal = 0; let blueWins = 0;
    let redTotal = 0; let redWins = 0;
    let totalDuration = 0;
    
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const weAreRed = String(m.red_team_tag || m.red_tag || '').toUpperCase().includes(myTeamTag);
      const rawWinner = String(m.winner_side || '').toLowerCase().trim();

      if (weAreBlue) {
          blueTotal++;
          if (rawWinner === 'blue' || rawWinner === '100') blueWins++;
      } else if (weAreRed) {
          redTotal++;
          if (rawWinner === 'red' || rawWinner === '200') redWins++;
      }
      totalDuration += (m.game_duration || 0);
    });

    const activeMatchIds = new Set(filteredMatches.map(m => String(m.id || m.match_id)));
    const teamStatsFiltered = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag));
    const avgGold12 = teamStatsFiltered.length > 0 ? Math.round(teamStatsFiltered.reduce((acc, curr) => acc + (Number(curr.gold_diff_at_12) || 0), 0) / teamStatsFiltered.length) : 0;

    return { totalGames: total, blueWR: blueTotal ? Math.round((blueWins / blueTotal) * 100) : 0, redWR: redTotal ? Math.round((redWins / redTotal) * 100) : 0, blueWins, blueTotal, redWins, redTotal, avgDuration: total && totalDuration ? Math.round(totalDuration / total / 60) : 0, avgGold12 };
  }, [filteredMatches, statsDetailed, myTeamTag]);

  const squadForm = useMemo(() => {
    const activeMatchIds = new Set(filteredMatches.map(m => String(m.id || m.match_id)));
    const teamStats = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag));
    const playerMap: Record<string, { role: string, scores: number[] }> = {};
    
    teamStats.forEach(s => {
       const roleToUse = s.role || s.primary_role || 'Unknown';
       if (!playerMap[s.puuid]) playerMap[s.puuid] = { role: roleToUse, scores: [] };
       const avgMatch = (Number(s.lane_rating) + Number(s.impact_rating) + Number(s.conversion_rating) + Number(s.vision_rating)) / 4;
       if (!isNaN(avgMatch)) playerMap[s.puuid].scores.push(avgMatch);
    });

    return roster.map(p => {
       const pData = playerMap[p.puuid];
       const scores = pData ? pData.scores : [];
       const rating = scores.length > 0 ? scores.reduce((a,b)=>a+b, 0) / scores.length : 0;
       return { name: p.nickname || p.name, role: p.primary_role || p.role || 'N/A', puuid: p.puuid, rating: (rating / 10).toFixed(1), streak: rating >= 80 ? 'ON FIRE' : rating < 60 ? 'COLD' : 'STABLE' };
    }).sort((a, b) => Number(b.rating) - Number(a.rating));
  }, [statsDetailed, filteredMatches, roster, myTeamTag]);

  const myStats = useMemo(() => {
     let temp = { lane: 0, impact: 0, conversion: 0, vision: 0, rank: 0, streak: 'STABLE' };
     const activeMatchIds = new Set(filteredMatches.map(m => String(m.id || m.match_id)));
     const myGames = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && s.puuid === currentUser.puuid);
     
     if (myGames.length > 0) {
        const getMed = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2; };
        temp.lane = Math.round(getMed(myGames.map(s => Number(s.lane_rating) || 0)));
        temp.impact = Math.round(getMed(myGames.map(s => Number(s.impact_rating) || 0)));
        temp.conversion = Math.round(getMed(myGames.map(s => Number(s.conversion_rating) || 0)));
        temp.vision = Math.round(getMed(myGames.map(s => Number(s.vision_rating) || 0)));
     }
     const myRankIndex = squadForm.findIndex(p => p.puuid === currentUser.puuid);
     if (myRankIndex !== -1) { temp.rank = myRankIndex + 1; temp.streak = squadForm[myRankIndex].streak; }
     return temp;
  }, [statsDetailed, filteredMatches, currentUser.puuid, squadForm]);

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
       const offIds = new Set(matchesRaw.filter(m => !String(m.game_type || '').toUpperCase().includes('SCRIM')).map(m => String(m.id || m.match_id)));
       const scrimIds = new Set(matchesRaw.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).map(m => String(m.id || m.match_id)));
       const offStats = calcAvg(offIds, false); const scrimStats = calcAvg(scrimIds, false);
       return [
         { subject: 'Lane Dom.', Oficial: offStats.l, Scrim: scrimStats.l }, 
         { subject: 'Impact', Oficial: offStats.i, Scrim: scrimStats.i }, 
         { subject: 'Conversion', Oficial: offStats.c, Scrim: scrimStats.c }, 
         { subject: 'Vision', Oficial: offStats.v, Scrim: scrimStats.v }, 
         { subject: 'Overall', Oficial: offStats.o, Scrim: scrimStats.o }
       ];
    } else {
       const activeIds = new Set(filteredMatches.map(m => String(m.id || m.match_id)));
       const usStats = calcAvg(activeIds, false); const oppStats = calcAvg(activeIds, true);
       return [
         { subject: 'Lane Dom.', [myTeamTag]: usStats.l, Oponentes: oppStats.l }, 
         { subject: 'Impact', [myTeamTag]: usStats.i, Oponentes: oppStats.i }, 
         { subject: 'Conversion', [myTeamTag]: usStats.c, Oponentes: oppStats.c }, 
         { subject: 'Vision', [myTeamTag]: usStats.v, Oponentes: oppStats.v }, 
         { subject: 'Overall', [myTeamTag]: usStats.o, Oponentes: oppStats.o }
       ];
    }
  }, [radarCompareMode, statsDetailed, matchesRaw, filteredMatches, myTeamTag]);

  const advancedScrims = useMemo(() => {
    const autoScrimBlocks = new Map();
    matchesRaw.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).forEach(m => {
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
       finalList.push({
         id: manual.id || `auto_${key}`, date: block.date, opponent: block.opp, result: block.wins > block.losses ? 'W' : block.losses > block.wins ? 'L' : 'D',
         score: `${block.wins} - ${block.losses}`, mode: manual.mode || `MD${block.games.length}`, comp: manual.comp_tested || 'AUTOMATIC LOG',
         difficulty: manual.difficulty || 'CONTROLADO', punctuality: manual.punctuality || 'PONTUAIS', remakes: manual.remakes || 0, isManual: !!manual.id
       });
    });
    scrimReportsManual.forEach(sm => { if (!finalList.find(f => f.id === sm.id)) finalList.push({ id: sm.id, date: sm.scrim_date, opponent: sm.opponent_acronym, result: sm.result, score: sm.score, mode: sm.mode, comp: sm.comp_tested, difficulty: sm.difficulty || 'CONTROLADO', punctuality: sm.punctuality || 'PONTUAIS', remakes: sm.remakes || 0, isManual: true }); });
    return finalList.sort((a,b) => getSafeTimestamp(b.date) - getSafeTimestamp(a.date));
  }, [matchesRaw, scrimReportsManual, myTeamTag]);

  const chartIntelligence = useMemo(() => {
      const diffOrder = ['STOMPAMOS', 'MUITO FÁCIL', 'FÁCIL', 'CONTROLADO', 'DIFÍCIL', 'MT DIFÍCIL', 'STOMPADOS'];

      const diffCounts: Record<string, number> = {};
      diffOrder.forEach(d => diffCounts[d] = 0);

      const tierCounts: Record<string, Record<string, number>> = {
          'Bad': {}, 'Average': {}, 'Good': {}, 'Excellent': {}
      };
      ['Bad', 'Average', 'Good', 'Excellent'].forEach(t => {
          diffOrder.forEach(d => tierCounts[t][d] = 0);
      });

      advancedScrims.forEach((scrim) => {
          const safeDiff = String(scrim.difficulty || '').toUpperCase();
          const diff = diffOrder.includes(safeDiff) ? safeDiff : 'CONTROLADO';
            
          diffCounts[diff]++;

          const opponentData = teamsList.find(t => t.acronym === scrim.opponent);
          let rawTier = opponentData?.tier ? String(opponentData.tier).trim() : 'Average';
          
          rawTier = rawTier.charAt(0).toUpperCase() + rawTier.slice(1).toLowerCase();
          
          const validTiers = ['Bad', 'Average', 'Good', 'Excellent'];
          const assignedTier = validTiers.includes(rawTier) ? rawTier : 'Average';
          
          tierCounts[assignedTier][diff]++;
      });

      const stressData = diffOrder.map(diff => ({
          name: diff.replace('MUITO', 'MT').replace('STOMPAMOS', 'STOMP.').replace('STOMPADOS', 'STOMP.'), 
          count: diffCounts[diff]
      }));

      const efficiencyData = ['Bad', 'Average', 'Good', 'Excellent'].map(tier => ({
          name: tier,
          ...tierCounts[tier]
      }));

      return { stressData, efficiencyData };
  }, [advancedScrims, teamsList]); 

  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, payload, dataKey } = props;
    const val = payload?.[dataKey];
    if (!val || val === 0) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold">
        {Math.round(val)}
      </text>
    );
  };

  const intensityTheme = squadConfig.intensity < 40 ? { text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.8)]' } : squadConfig.intensity < 75 ? { text: 'text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]' } : { text: 'text-red-400', bg: 'bg-red-500', shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.8)]' };

  // --- HANDLERS ---
  const toggleTask = async (id: string, currentStatus: boolean) => { if(!isStaff) return; setVodTasks(tasks => tasks.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t)); await supabase.from('vod_tasks').update({ is_done: !currentStatus }).eq('id', id); };
  
  const handleDayClick = (dateStr: string) => {
     if(!isStaff) return;
     setEditMissionId(null);
     setMissionForm({ date: dateStr, time: '14:00', opponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' });
     setMissionModalOpen(true);
  };
  
  const handleEditMission = (e: React.MouseEvent, m: any) => {
     e.stopPropagation(); if(!isStaff) return;
     setEditMissionId(m.id);
     
     const info = (m && m.status) ? String(m.status).split('|') : [];
     let gc = '3 JOGOS'; let dm = 'PADRÃO';
     if (info.length >= 3) { gc = info[1].trim(); dm = info[2].trim(); }
     
     setMissionForm({ date: m.mission_date, time: m.mission_time.substring(0,5), opponent: m.opponent_acronym, type: m.mission_type, gamesCount: gc, draftMode: dm });
     setMissionModalOpen(true);
  }

  const handleSaveMission = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const d = missionForm.date; 
    const t = missionForm.time.length === 5 ? `${missionForm.time}:00` : missionForm.time; 
    const statusEncoded = `SCHEDULED | ${missionForm.gamesCount} | ${missionForm.draftMode}`;
    const payload = { team_acronym: myTeamTag, mission_date: d, mission_time: t, opponent_acronym: missionForm.opponent, mission_type: missionForm.type, status: statusEncoded }; 

    if (editMissionId) { 
        const { data, error } = await supabase.from('missions').update(payload).eq('id', editMissionId).select(); 
        if (data) { setMissionsRaw(prev => prev.map(m => m.id === editMissionId ? data[0] : m)); setMissionModalOpen(false); } 
    } else { 
        const { data, error } = await supabase.from('missions').insert([payload]).select(); 
        if (data) { setMissionsRaw(prev => [...prev, data[0]]); setMissionModalOpen(false); } 
    } 
  };

  const handleDeleteMission = async (id: string) => { if (!window.confirm("Deseja excluir?")) return; await supabase.from('missions').delete().eq('id', id); setMissionsRaw(prev => prev.filter(m => m.id !== id)); setMissionModalOpen(false); };
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (currentUser.id === 'dev') return alert('Modo Dev Ativo. Faça login para salvar as edições.');
      const { error } = await supabase.from('profiles').update({ full_name: profileForm.name, photo_url: profileForm.photo_url }).eq('id', currentUser.id);
      if (!error) { setCurrentUser({ ...currentUser, name: profileForm.name, photo: profileForm.photo_url || `https://ui-avatars.com/api/?name=${profileForm.name}&background=18181b&color=3b82f6` }); setProfileModalOpen(false); } 
  };

  const handleSaveScrim = async (e: React.FormEvent) => { e.preventDefault(); const payload = { team_acronym: myTeamTag, scrim_date: scrimForm.date || new Date().toISOString().split('T')[0], opponent_acronym: scrimForm.opponent, result: scrimForm.result, score: scrimForm.score, mode: scrimForm.mode, comp_tested: scrimForm.comp, difficulty: scrimForm.difficulty, punctuality: scrimForm.punctuality, remakes: scrimForm.remakes, match_ids: scrimForm.match_ids }; if (editScrimId) { const { data } = await supabase.from('scrim_reports').update(payload).eq('id', editScrimId).select(); if (data) { setScrimReportsManual(prev => prev.map(s => s.id === editScrimId ? data[0] : s)); setScrimModalOpen(false); } } else { const { data } = await supabase.from('scrim_reports').insert([payload]).select(); if (data) { setScrimReportsManual(prev => [data[0], ...prev]); setScrimModalOpen(false); } } };
  const handleDeleteScrim = async (id: string) => { if (!window.confirm("Excluir Report Manual?")) return; await supabase.from('scrim_reports').delete().eq('id', id); setScrimReportsManual(prev => prev.filter(s => s.id !== id)); };
  const handleUpdateTarget = async (e: React.FormEvent) => { e.preventDefault(); const c = [targetForm.win1, targetForm.win2, targetForm.win3].filter(Boolean); await supabase.from('opponent_intel').upsert({ opponent_acronym: targetForm.team.toUpperCase(), top_picks: [], top_bans: [], win_conditions: c }, { onConflict: 'opponent_acronym' }).select(); setNextTargetIntel(prev => ({ ...prev, team: targetForm.team.toUpperCase(), winConditions: c })); setTargetModalOpen(false); };
  const handleAddVodTask = async (e: React.FormEvent) => { e.preventDefault(); const { data } = await supabase.from('vod_tasks').insert([{ team_acronym: myTeamTag, tag: vodForm.tag, task_text: vodForm.text, is_done: false }]).select(); if (data) { setVodTasks(prev => [data[0], ...prev]); setVodModalOpen(false); } };
  const handleWellnessSubmit = async (e: React.FormEvent) => { e.preventDefault(); const r = Math.round(((wellnessForm.sleep + wellnessForm.mental + wellnessForm.physical) / 15) * 100); const td = new Date().toISOString().split('T')[0]; const { data } = await supabase.from('player_wellness').upsert({ puuid: wellnessForm.puuid, record_date: td, sleep_score: wellnessForm.sleep, mental_score: wellnessForm.mental, physical_score: wellnessForm.physical, focus_score: wellnessForm.focus, readiness_percent: r }, { onConflict: 'puuid, record_date' }).select(); if (data) { setTeamWellness(prev => prev.map(p => p.puuid === wellnessForm.puuid ? { ...p, score: r, sleep: wellnessForm.sleep, mental: wellnessForm.mental, physical: wellnessForm.physical, hasAnsweredToday: true } : p)); setWellnessModalOpen(false); } };

  const handleSaveMetrics = async (e: React.FormEvent) => {
     e.preventDefault();
     const payload = {
        team_acronym: myTeamTag, record_date: metricsForm.date,
        stress_level: metricsForm.stress, cognitive_load: metricsForm.load,
        early_micro: metricsForm.early_micro, early_macro: metricsForm.early_macro, early_tf: metricsForm.early_tf,
        mid_micro: metricsForm.mid_micro, mid_macro: metricsForm.mid_macro, mid_tf: metricsForm.mid_tf,
        late_micro: metricsForm.late_micro, late_macro: metricsForm.late_macro, late_tf: metricsForm.late_tf
     };
     
     const { data, error } = await supabase.from('team_daily_metrics').upsert(payload, { onConflict: 'team_acronym, record_date' }).select();
     if (!error && data) {
         setTeamMetricsRaw(prev => {
            const arr = prev.filter(m => m.record_date !== metricsForm.date);
            return [...arr, data[0]].sort((a,b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime());
         });
         setMetricsModalOpen(false);
     } else {
         alert("Erro ao salvar métricas. Garanta que a tabela team_daily_metrics existe no Supabase.");
     }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-black text-blue-500 font-bold text-xs tracking-widest uppercase animate-pulse">Sincronizando Banco de Dados...</div>;

  const expandedPlayer = teamWellness.find(p => p.puuid === expandedWellnessId);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-glow { animation: pulseGlow 2s infinite; }
        .hover-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5); }
      `}} />

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 pb-20">
        
        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="animate-fade-in-up flex flex-wrap items-center justify-center gap-4 bg-zinc-950/80 backdrop-blur-xl p-2.5 rounded-2xl border border-zinc-800/80 shadow-lg max-w-fit mx-auto sticky top-4 z-[999]" style={{ opacity: 0, animationDelay: '0.1s' }}>
           <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
             <button onClick={() => setMatchType('ALL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'ALL' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>AMBOS</button>
             <button onClick={() => setMatchType('OFICIAL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>OFICIAL</button>
             <button onClick={() => setMatchType('SCRIM')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'SCRIM' ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>SCRIMS</button>
           </div>
           
           <div className="h-5 w-px bg-zinc-800 hidden md:block"></div>
           
           <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
              <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest" />
              <span className="text-zinc-600 text-[10px] font-black uppercase">ATÉ</span>
              <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest" />
           </div>

           <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2">
              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Patch:</span>
              <input type="text" placeholder="Ex: 14.5" value={filterPatch} onChange={e => setFilterPatch(e.target.value)} className="w-12 bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-white transition-colors text-center" />
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col gap-6 h-full">
            
            {/* PROFILE CARD */}
            <div className="animate-fade-in-up relative group bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-8 shrink-0 hover-lift shadow-xl overflow-hidden" style={{ opacity: 0, animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className={`flex items-center md:items-start gap-6 relative z-10 w-full md:w-auto shrink-0`}>
                 <div className="relative shrink-0">
                     <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-zinc-900 border-2 border-zinc-700 overflow-hidden shadow-lg group-hover:border-blue-500/50 transition-colors duration-500">
                        <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
                     </div>
                     <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white font-black text-[9px] px-3 py-1.5 rounded-lg shadow-lg uppercase tracking-widest animate-pulse-glow">{isStaff ? 'STAFF' : 'ROSTER'}</div>
                 </div>
                 <div className="flex flex-col justify-center h-full py-1 w-full">
                    <div className="flex items-center justify-between mb-3 w-full">
                       <p className="text-blue-400 font-bold text-[10px] tracking-[0.2em] uppercase leading-none drop-shadow-sm">{isStaff ? 'ANALYST PROTOCOL' : 'PLAYER TACTICAL HUB'}</p>
                       <button onClick={() => { setProfileForm({ name: currentUser.name, photo_url: currentUser.photo }); setProfileModalOpen(true); }} className="text-[10px] font-bold text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest">EDITAR</button>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight uppercase truncate max-w-[280px] drop-shadow-md">{currentUser.name}</h2>
                    <div className="flex flex-wrap gap-2">
                       <Badge text={currentUser.role} color="bg-blue-600 border-blue-500" />
                       <Badge text="CBLOL ACADEMY" color="bg-zinc-800 text-zinc-300 border-zinc-700" />
                    </div>
                 </div>
              </div>

              {!isStaff && (
                 <div className="relative z-10 flex-1 flex flex-col justify-center w-full md:border-l md:border-zinc-800 md:pl-8">
                    <div className="flex justify-between items-center mb-4">
                       <span className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Tactical Matrix</span>
                    </div>
                    <div className="space-y-3">
                       <MiniStatBar label="LANE" value={myStats.lane} color="bg-blue-500" />
                       <MiniStatBar label="IMPACT" value={myStats.impact} color="bg-emerald-500" />
                       <MiniStatBar label="CONV." value={myStats.conversion} color="bg-amber-500" />
                       <MiniStatBar label="VISION" value={myStats.vision} color="bg-purple-500" />
                    </div>
                 </div>
              )}
            </div>

            {/* TACTICAL DIRECTIVE */}
            <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 flex flex-col xl:flex-row items-center justify-between gap-6 relative overflow-hidden shrink-0 shadow-lg hover-lift" style={{ opacity: 0, animationDelay: '0.25s' }}>
               <div className={`absolute left-0 top-0 bottom-0 w-1 ${intensityTheme.bg} transition-colors duration-1000`}></div>
               <div className="flex flex-col min-w-0 ml-3 flex-1">
                  <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1.5 flex items-center gap-2">DIRETRIZ TÁTICA DO DIA <span className="bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] border border-zinc-700 font-black">AUTO</span></span>
                  <span className="text-white text-lg font-black uppercase tracking-tight truncate drop-shadow-sm">{squadConfig.directive}</span>
               </div>
               <div className="flex flex-col w-full xl:w-[280px] shrink-0 gap-2.5">
                  <div className="flex items-end justify-between w-full text-[10px] font-black uppercase tracking-widest">
                     <span className="text-zinc-400">WORKLOAD</span><span className={intensityTheme.text}>{squadConfig.load}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden relative shadow-inner">
                     <div className={`absolute top-0 bottom-0 left-0 ${intensityTheme.bg} transition-all duration-1000 ease-out`} style={{ width: `${squadConfig.intensity}%` }}></div>
                  </div>
               </div>
            </div>

            {/* CHARTS CONTAINER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-lg relative overflow-hidden group flex flex-col h-full min-h-[240px] hover-lift" style={{ opacity: 0, animationDelay: '0.3s' }}>
                <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="flex items-center justify-between mb-5 z-10 shrink-0">
                   <h3 className="text-[11px] text-zinc-300 font-black uppercase tracking-widest flex items-center gap-2.5">
                      <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div> 
                      Estresse vs Carga
                   </h3>
                </div>
                <div className="flex-1 w-full min-h-0">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartIntelligence.stressData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.6} />
                       <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                       <YAxis hide />
                       <Tooltip contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(8px)', borderColor: '#27272a', fontSize: '10px', color: '#fff', borderRadius: '12px', fontWeight: 'bold' }} />
                       <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.15} label={{ fill: '#fff', fontSize: 10, fontWeight: 'black', position: 'top' }} animationDuration={1500} />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
              
              <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-lg relative overflow-hidden group flex flex-col h-full min-h-[240px] hover-lift" style={{ opacity: 0, animationDelay: '0.35s' }}>
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="flex items-center justify-between mb-5 z-10 shrink-0">
                   <h3 className="text-[11px] text-zinc-300 font-black uppercase tracking-widest flex items-center gap-2.5">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div> 
                      Eficiência de Scrims
                   </h3>
                </div>
                <div className="flex-1 w-full min-h-0">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={chartIntelligence.efficiencyData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }} stackOffset="none">
                       <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.6} />
                       <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(8px)', borderColor: '#27272a', fontSize: '10px', color: '#fff', borderRadius: '12px', fontWeight: 'bold' }} />
                       <Bar dataKey="STOMPADOS" stackId="a" fill="#ef4444" label={(p: any) => renderCustomBarLabel({...p, dataKey: "STOMPADOS"})} animationDuration={1000} radius={[0,0,2,2]} />
                       <Bar dataKey="MT DIFÍCIL" stackId="a" fill="#f97316" label={(p: any) => renderCustomBarLabel({...p, dataKey: "MT DIFÍCIL"})} animationDuration={1000} />
                       <Bar dataKey="DIFÍCIL" stackId="a" fill="#f59e0b" label={(p: any) => renderCustomBarLabel({...p, dataKey: "DIFÍCIL"})} animationDuration={1000} />
                       <Bar dataKey="CONTROLADO" stackId="a" fill="#71717a" label={(p: any) => renderCustomBarLabel({...p, dataKey: "CONTROLADO"})} animationDuration={1000} />
                       <Bar dataKey="FÁCIL" stackId="a" fill="#0ea5e9" label={(p: any) => renderCustomBarLabel({...p, dataKey: "FÁCIL"})} animationDuration={1000} />
                       <Bar dataKey="MUITO FÁCIL" stackId="a" fill="#3b82f6" label={(p: any) => renderCustomBarLabel({...p, dataKey: "MUITO FÁCIL"})} animationDuration={1000} />
                       <Bar dataKey="STOMPAMOS" stackId="a" fill="#2563eb" label={(p: any) => renderCustomBarLabel({...p, dataKey: "STOMPAMOS"})} animationDuration={1000} radius={[2,2,0,0]} />
                     </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* CALENDÁRIO COM GRID COMPACTO E POPOVER */}
          <div className="lg:col-span-5 flex flex-col h-full gap-6">
             <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-xl flex flex-col shrink-0 hover-lift" style={{ opacity: 0, animationDelay: '0.4s' }}>
                <div className="flex justify-between items-center mb-6 pb-5 border-b border-zinc-800/60">
                   <h3 className="text-[11px] text-zinc-300 font-black tracking-[0.2em] uppercase">Agenda Mensal ({currentDate.toLocaleDateString('pt-BR', { month: 'short' })})</h3>
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 hover:border-blue-500 text-zinc-400 hover:text-white font-black text-[10px] transition-all">&lt;</button>
                      <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 hover:border-blue-500 text-zinc-400 hover:text-white font-black text-[10px] transition-all uppercase tracking-widest shadow-sm">HOJE</button>
                      <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 hover:border-blue-500 text-zinc-400 hover:text-white font-black text-[10px] transition-all">&gt;</button>
                   </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                   {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={`hdr-${i}`} className="text-center text-[10px] text-zinc-500 font-black mb-2 uppercase tracking-widest">{d}</div>)}
                   {calendarGrid.map((cell, idx) => {
                      if (!cell) return <div key={`empty-${idx}`} className="aspect-square sm:h-12"></div>;
                      let borderClass = 'border-transparent bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-800/80';
                      if (cell.isToday) borderClass = 'border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20';

                      return (
                        <div key={cell.dateStr} onClick={() => handleDayClick(cell.dateStr)} className={`relative flex flex-col items-center justify-center aspect-square sm:h-12 rounded-xl border transition-all duration-300 group/day cursor-pointer ${borderClass}`}>
                           
                           <span className={`text-[12px] font-black z-10 transition-colors ${cell.isToday ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-zinc-500 group-hover:text-zinc-200'}`}>{cell.day}</span>
                           
                           {/* Indicadores Minimalistas com Glow */}
                           {cell.events.length > 0 && (
                              <div className="flex gap-1 mt-1 z-10">
                                 {cell.events.slice(0, 3).map((ev: any, i: number) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full shadow-sm ${ev.type === 'SCRIM' ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]' : 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]'}`} />
                                 ))}
                                 {cell.events.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                              </div>
                           )}

                           {/* Hover Popover Detalhado com Motion Smooth */}
                           {cell.events.length > 0 && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[240px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/80 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] rounded-2xl z-[100] opacity-0 pointer-events-none group-hover/day:opacity-100 group-hover/day:pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] p-2.5 flex flex-col gap-2 transform translate-y-3 scale-95 group-hover/day:translate-y-0 group-hover/day:scale-100 origin-bottom">
                                 <div className="flex justify-between items-center px-1.5 border-b border-zinc-800 pb-2 mb-1">
                                    <span className="text-[11px] font-black text-white tracking-widest drop-shadow-md">DIA {cell.day}</span>
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{cell.events.length} Eventos</span>
                                 </div>
                                 <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                    {cell.events.map((ev: any) => (
                                       <CalendarEventItem key={ev.id} ev={ev} isStaff={isStaff} onEdit={handleEditMission} />
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                      )
                   })}
                </div>
             </div>
             
             <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 md:p-8 shadow-xl flex-1 flex flex-col overflow-hidden hover-lift" style={{ opacity: 0, animationDelay: '0.45s' }}>
                <div className="flex items-center justify-between mb-5 border-b border-zinc-800/60 pb-5 shrink-0">
                   <h3 className="text-[11px] text-zinc-300 font-black tracking-[0.2em] uppercase flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> Próximas Operações
                   </h3>
                   {isStaff && <button onClick={() => { setEditMissionId(null); setMissionForm({ ...missionForm, date: '', time: '14:00', opponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' }); setMissionModalOpen(true); }} className="text-[9px] font-bold bg-zinc-900 border border-zinc-800 hover:bg-blue-600 hover:border-blue-500 px-3 py-1.5 rounded-lg transition-colors uppercase text-zinc-400 hover:text-white tracking-widest">+ Novo</button>}
                </div>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2">
                   {upcomingMissions.map(m => {
                      const safeStatus = (m && m.status) ? String(m.status).split('|') : [];
                      const displayStatus = safeStatus[1] ? safeStatus[1].trim() : (m.mode || 'TBD');

                      return (
                         <div key={m.id} className="group flex items-center justify-between p-4 bg-zinc-900/40 hover:bg-zinc-800/80 rounded-2xl border border-zinc-800/50 hover:border-zinc-600 transition-all duration-300 cursor-pointer hover:translate-x-1 relative overflow-hidden shadow-sm hover:shadow-md">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="flex items-center gap-4 pl-1">
                               {getTeamLogo(m.opponent_acronym) ? <img src={getTeamLogo(m.opponent_acronym)!} className="w-10 h-10 rounded-xl bg-zinc-950 object-contain p-1 border border-zinc-800 shadow-sm" /> : <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[11px] text-zinc-500 font-black shadow-sm">{m.opponent_acronym.substring(0,3)}</div>}
                               <div className="flex flex-col gap-0.5">
                                  <span className="text-blue-400 font-bold text-[9px] uppercase tracking-widest drop-shadow-sm">{formatDate(m.mission_date)} - {formatTimeStr(m.mission_time)}</span>
                                  <span className="text-white text-sm font-black uppercase tracking-tight drop-shadow-sm">VS {m.opponent_acronym}</span>
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                               <span className="text-[8px] font-black px-2 py-0.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-400 uppercase tracking-widest">{m.mission_type}</span>
                               <span className="text-[9px] text-amber-500 font-black uppercase drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{displayStatus}</span>
                            </div>
                            {isStaff && <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-2 transition-all duration-300 bg-zinc-900/95 backdrop-blur-sm p-1.5 rounded-xl border border-zinc-700 shadow-xl translate-x-2 group-hover:translate-x-0"><button onClick={(e) => handleEditMission(e, m)} className="text-[9px] text-blue-400 hover:text-white px-2.5 py-1.5 font-bold tracking-widest">EDIT</button><button onClick={() => handleDeleteMission(m.id)} className="text-[9px] text-red-400 hover:text-white px-2.5 py-1.5 font-bold tracking-widest">DEL</button></div>}
                         </div>
                      );
                   })}
                   {upcomingMissions.length === 0 && <div className="text-center py-10 text-[10px] font-bold text-zinc-600 uppercase tracking-widest opacity-80">Nenhuma operação agendada</div>}
                </div>
             </div>
          </div>
        </div>

        {/* SQUAD READINESS */}
        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group w-full mt-8 hover-lift" style={{ opacity: 0, animationDelay: '0.5s' }}>
           <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
           <div className="absolute right-0 top-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full transition-opacity duration-1000"></div>
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-zinc-800/60 pb-6 relative z-10">
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3"><div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]"></div> Squad Readiness</h3>
                 <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] mt-2 uppercase">Monitoramento Biométrico de Prontidão</p>
              </div>
              <button onClick={() => { if(!isStaff) setWellnessForm(prev => ({ ...prev, puuid: currentUser.puuid })); setWellnessModalOpen(true); }} className="bg-zinc-900 border border-zinc-800 text-emerald-400 px-6 py-3 rounded-xl text-[10px] font-black hover:bg-emerald-600 hover:border-emerald-500 hover:text-white transition-all duration-300 flex items-center gap-2 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] uppercase tracking-widest"><span className="text-base leading-none mb-0.5">+</span> DAILY SYNC</button>
           </div>

           <div className={`grid gap-5 relative z-10 ${isStaff ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-5'}`}>
              {teamWellness.filter(p => isStaff || p.puuid === currentUser.puuid).map((p) => {
                 const isDanger = p.score < 65; const isOptimal = p.score > 85;
                 const colorClass = isDanger ? 'text-red-400 border-red-500/30 bg-red-500/5 shadow-[inset_4px_0_20px_-5px_rgba(239,68,68,0.15)]' : isOptimal ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shadow-[inset_4px_0_20px_-5px_rgba(16,185,129,0.15)]' : 'text-amber-400 border-amber-500/30 bg-amber-500/5 shadow-[inset_4px_0_20px_-5px_rgba(245,158,11,0.15)]';
                 const isExpanded = expandedWellnessId === p.puuid;

                 return (
                   <div key={p.puuid} onClick={() => setExpandedWellnessId(isExpanded ? null : p.puuid)} className={`group/player relative p-6 rounded-[24px] border border-zinc-800/80 bg-zinc-950/40 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:bg-zinc-900/80 ${colorClass} ${isExpanded ? 'ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : ''}`}>
                      {!p.hasAnsweredToday && !isStaff && (
                        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md z-20 flex flex-col items-center justify-center border border-zinc-800 rounded-[24px]">
                           <span className="text-4xl mb-4 animate-pulse opacity-50 drop-shadow-lg">⏳</span><span className="text-[9px] text-zinc-400 tracking-[0.2em] font-black text-center px-4 leading-relaxed uppercase">PENDENTE DE<br/>RESPOSTA HOJE</span>
                        </div>
                      )}
                      {isStaff && p.history.length > 0 && (
                         <button onClick={(e) => { e.stopPropagation(); setWellnessHistoryModal({ isOpen: true, player: p, history: p.history }); }} className="absolute top-5 right-5 z-30 text-[8px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-zinc-700 transition-colors font-bold tracking-widest shadow-sm">HIST</button>
                      )}
                      <div className="flex justify-between items-start mb-5 relative z-10">
                         <div className="flex items-start gap-3.5 flex-1 min-w-0 pr-2">
                           {p.photo && <img src={p.photo} className="w-11 h-11 rounded-xl border border-zinc-700 object-cover shrink-0 shadow-md group-hover/player:border-zinc-500 transition-colors" />}
                           <div className="flex-1 min-w-0 py-0.5">
                             <div className="flex items-center gap-2 mb-1"><span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{String(p.role).replace(/jug/i, 'JNG')}</span>{!p.hasAnsweredToday && isStaff && <span className="text-[7px] font-black bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-md animate-pulse">PEND</span>}</div>
                             <span className="text-base font-black text-white break-words leading-tight block uppercase drop-shadow-md truncate">{p.name}</span>
                           </div>
                         </div>
                         <span className={`text-3xl font-black italic leading-none shrink-0 pt-1 tracking-tighter ${isDanger ? 'text-red-400 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isOptimal ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`}>{p.score}%</span>
                      </div>
                      <div className="space-y-2.5 relative z-10"><WellnessBar label="SONO" value={p.sleep} /><WellnessBar label="MENTAL" value={p.mental} /><WellnessBar label="FÍSICO" value={p.physical} /></div>
                   </div>
                 );
              })}
           </div>

           {/* --- GRÁFICO INLINE DO USUÁRIO --- */}
           {expandedPlayer && expandedPlayer.history.length > 0 && (
             <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-[24px] p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group/chart mt-8 animate-fade-in-up shadow-inner">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-50 group-hover/chart:opacity-100 transition-all duration-500"></div>
                <div className="flex items-center justify-between mb-6 border-b border-zinc-800/50 pb-4">
                   <div>
                      <h4 className="text-[11px] text-emerald-400 font-black tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> Evolução Biométrica: {expandedPlayer.name}</h4>
                      <p className="text-[9px] text-zinc-500 font-bold tracking-widest mt-1.5 uppercase">ACOMPANHAMENTO DE ENERGIA E FOCO RECENTE</p>
                   </div>
                   <button onClick={() => setExpandedWellnessId(null)} className="text-zinc-500 hover:text-white font-black text-2xl transition-colors bg-zinc-900 hover:bg-zinc-800 w-8 h-8 flex items-center justify-center rounded-xl border border-zinc-800">&times;</button>
                </div>
                
                <div className="w-full h-[220px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...expandedPlayer.history].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.6} />
                         <XAxis dataKey="record_date" tickFormatter={formatDate} tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                         <YAxis hide domain={[0, 100]} />
                         <Line type="monotone" dataKey="readiness_percent" stroke="#10b981" strokeWidth={3} isAnimationActive={false} dot={{r: 5, fill: '#09090b', strokeWidth: 2, stroke: '#10b981'}} activeDot={{r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2}} />
                         <Tooltip cursor={{ stroke: '#27272a', strokeWidth: 2, strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(8px)', borderColor: '#10b981', fontSize: '10px', borderRadius: '12px', color: '#fff', fontWeight: 'bold', padding: '10px' }} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>
           )}
        </div>

        {/* FINAL ROW: PERFORMANCE & MVP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
          <div className="animate-fade-in-up lg:col-span-7 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl h-[450px] relative flex flex-col overflow-hidden group hover-lift" style={{ opacity: 0, animationDelay: '0.55s' }}>
             <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
             <div className="flex justify-between items-start mb-6 shrink-0 border-b border-zinc-800/60 pb-5">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3"><div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div> Squad Performance Index</h3>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-inner">
                   <button onClick={() => setRadarCompareMode('OFFICIAL_VS_SCRIM')} className={`px-4 py-2 text-[9px] font-black rounded-lg transition-all tracking-widest uppercase ${radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'bg-zinc-800 text-white shadow-md border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>OFF VS SCRIM</button>
                   <button onClick={() => setRadarCompareMode('US_VS_OPP')} className={`px-4 py-2 text-[9px] font-black rounded-lg transition-all tracking-widest uppercase ${radarCompareMode === 'US_VS_OPP' ? 'bg-red-600/20 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'text-zinc-500 hover:text-zinc-300'}`}>US VS OPP</button>
                </div>
             </div>
             <div className="flex-1 w-full min-h-0 relative">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(39,39,42,0.3)_0%,transparent_70%)] pointer-events-none rounded-full"></div>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#27272a" strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.2} animationDuration={1500} />
                  <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} strokeWidth={3} fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} fillOpacity={0.2} animationDuration={1500} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(8px)', borderColor: '#27272a', fontSize: '10px', borderRadius: '12px', fontWeight: 'bold' }} />
                </RadarChart>
              </ResponsiveContainer>
             </div>
          </div>

          <div className="animate-fade-in-up lg:col-span-5 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative flex flex-col h-[450px] overflow-hidden group hover-lift" style={{ opacity: 0, animationDelay: '0.6s' }}>
             <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
             <div className="flex items-center justify-between mb-6 shrink-0 border-b border-zinc-800/60 pb-5">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2.5"><span className="text-amber-500 animate-pulse text-xl">👑</span> MVP Race</h3>
                <span className="text-[9px] bg-amber-500/10 text-amber-500 font-bold px-3 py-1.5 rounded-lg border border-amber-500/20 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.15)] tracking-widest uppercase">LIVE RANKING</span>
             </div>
             
             <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                {squadForm.length > 0 ? squadForm.map((player, idx) => {
                   const isFirst = idx === 0;
                   const isSecond = idx === 1;
                   const isThird = idx === 2;
                   
                   let rankColor = 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50 group-hover:text-white';
                   let borderGlow = 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 hover:bg-zinc-800 hover:-translate-y-0.5 shadow-sm';
                   let nameSize = 'text-xs text-zinc-300 group-hover:text-blue-400';
                   let ratingSize = 'text-lg text-white';
                   let numberBox = 'w-8 h-8 text-xs';

                   if (isFirst) {
                      rankColor = 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.3)] group-hover:bg-amber-400 group-hover:text-amber-950';
                      borderGlow = 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 shadow-[inset_4px_0_0_#f59e0b] hover:-translate-y-1';
                      nameSize = 'text-lg text-amber-400 drop-shadow-sm';
                      ratingSize = 'text-2xl text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]';
                      numberBox = 'w-10 h-10 text-lg';
                   } else if (isSecond) {
                      rankColor = 'text-zinc-200 bg-zinc-700/50 border-zinc-500/50';
                      borderGlow = 'border-zinc-500/30 bg-zinc-700/10 hover:bg-zinc-700/20 shadow-[inset_4px_0_0_#a1a1aa] hover:-translate-y-0.5';
                      nameSize = 'text-base text-zinc-200';
                      ratingSize = 'text-xl text-zinc-200';
                      numberBox = 'w-9 h-9 text-base';
                   } else if (isThird) {
                      rankColor = 'text-orange-400 bg-orange-900/30 border-orange-700/50';
                      borderGlow = 'border-orange-900/50 bg-orange-900/10 hover:bg-orange-900/20 shadow-[inset_4px_0_0_#c2410c] hover:-translate-y-0.5';
                      nameSize = 'text-sm text-orange-200';
                      ratingSize = 'text-lg text-orange-400';
                      numberBox = 'w-8 h-8 text-sm';
                   }

                   return (
                      <div key={player.name} className={`group flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 border cursor-default ${borderGlow}`}>
                         <div className="flex items-center gap-4 flex-1 pr-4">
                            <div className={`flex items-center justify-center rounded-xl border-2 font-black shrink-0 transition-colors ${numberBox} ${rankColor}`}>
                               {idx + 1}
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                               <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-md border font-black uppercase tracking-widest ${isFirst ? 'border-amber-500/30 text-amber-500 bg-amber-500/10' : 'border-zinc-700 text-zinc-400 bg-zinc-950'}`}>
                                     {String(player.role).replace(/jug/i, 'JNG')}
                                  </span>
                                  {player.streak.includes('FIRE') && (
                                     <span className="text-[7px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md animate-pulse border border-red-500/30 font-black tracking-widest uppercase">
                                        ON FIRE
                                     </span>
                                  )}
                               </div>
                               <span className={`${nameSize} break-words font-black uppercase tracking-tight leading-none transition-colors truncate`}>
                                  {player.name}
                               </span>
                            </div>
                         </div>
                         <div className="flex flex-col items-end shrink-0">
                            <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest mb-1">RATING</span>
                            <span className={`${ratingSize} font-black leading-none transition-colors group-hover:text-white`}>{player.rating}</span>
                         </div>
                      </div>
                   );
                }) : <p className="text-[10px] text-zinc-500 font-bold text-center py-10 opacity-80 uppercase tracking-widest">SEM DADOS NO FILTRO.</p>}
             </div>
          </div>
        </div>

        {/* --- ADVANCED SCRIM REPORT ANIMADO E COMPLETO --- */}
        <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 md:p-10 shadow-2xl relative w-full mt-8 overflow-hidden group hover-lift" style={{ opacity: 0, animationDelay: '0.65s' }}>
           <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
           <div className="flex justify-between items-center mb-8 border-b border-zinc-800/60 pb-5">
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse"></div> Advanced Scrim Logs
                 </h3>
                 <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1.5 uppercase">Histórico Detalhado de Treinamentos</p>
              </div>
              {isStaff && (
                 <button onClick={() => { setEditScrimId(null); setScrimForm({...scrimForm, date: '', comp: ''}); setScrimModalOpen(true); }} className="bg-zinc-900 border border-zinc-800 text-amber-500 hover:bg-amber-600 hover:border-amber-500 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                    + Log Manual
                 </button>
              )}
           </div>
           
           <div className="overflow-x-auto custom-scrollbar pb-4 max-h-[500px]">
              <table className="w-full text-left border-separate border-spacing-y-3 min-w-[900px]">
                 <thead className="sticky top-0 bg-[#121214]/95 backdrop-blur-md z-10 text-[9px] text-zinc-500 font-black tracking-[0.2em] uppercase">
                    <tr><th className="px-5 pb-3 border-b border-zinc-800/80">DATA / OPONENTE</th><th className="px-5 pb-3 border-b border-zinc-800/80 text-center">RES / PLACAR</th><th className="px-5 pb-3 border-b border-zinc-800/80 text-center">MODO / COMP TESTADA</th><th className="px-5 pb-3 border-b border-zinc-800/80 text-center">DIFICULDADE</th><th className="px-5 pb-3 border-b border-zinc-800/80 text-center">PONTUALIDADE</th><th className="px-5 pb-3 border-b border-zinc-800/80 text-center">REMAKES</th></tr>
                 </thead>
                 <tbody>
                    {advancedScrims.length > 0 ? advancedScrims.map((scrim) => (
                       <tr key={scrim.id} className="bg-zinc-900/30 hover:bg-zinc-800/60 transition-all duration-300 group/row text-[10px] cursor-default border border-zinc-800/30">
                          <td className="p-4 rounded-l-2xl border-y border-l border-zinc-800/30">
                             <div className="flex items-center gap-4">
                                {getTeamLogo(scrim.opponent) ? (
                                  <img src={getTeamLogo(scrim.opponent)!} className="w-10 h-10 object-contain shrink-0 bg-zinc-950 rounded-xl p-1 border border-zinc-800 drop-shadow-sm group-hover/row:border-zinc-600 transition-colors" />
                                ) : (
                                  <div className="w-10 h-10 shrink-0 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center text-[11px] font-black text-zinc-600 group-hover/row:border-zinc-600 transition-colors">{scrim.opponent.substring(0,3)}</div>
                                )}
                                <div className="flex flex-col gap-0.5">
                                   <span className="text-blue-400 font-bold tracking-[0.2em] uppercase group-hover/row:text-blue-300 transition-colors text-[9px]">{formatDate(scrim.date)}</span>
                                   <span className="text-white text-base font-black leading-none uppercase tracking-tight drop-shadow-sm">VS {scrim.opponent}</span>
                                </div>
                             </div>
                          </td>
                          <td className="p-4 text-center border-y border-zinc-800/30">
                             <div className="flex flex-col items-center gap-1">
                                <span className={`text-xl font-black ${scrim.result === 'W' ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : scrim.result === 'L' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'text-zinc-400'}`}>{scrim.result}</span>
                                <span className="text-white font-black px-2.5 py-0.5 rounded-md border border-zinc-700 bg-zinc-950/80">{scrim.score}</span>
                             </div>
                          </td>
                          <td className="p-4 text-center border-y border-zinc-800/30">
                             <div className="flex flex-col items-center gap-1.5">
                                <span className="bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-700 font-black tracking-widest text-[8px] uppercase">{scrim.mode}</span>
                                <span className="text-zinc-400 font-bold group-hover/row:text-white transition-colors">{scrim.comp}</span>
                             </div>
                          </td>
                          <td className="p-4 text-center border-y border-zinc-800/30"><span className={`px-3 py-1.5 rounded-lg border font-black text-[9px] tracking-widest uppercase shadow-sm ${getDifficultyColor(scrim.difficulty)}`}>{scrim.difficulty}</span></td>
                          <td className="p-4 text-center border-y border-zinc-800/30"><span className={`px-3 py-1.5 rounded-md border font-black tracking-widest text-[8px] uppercase ${getPunctualityColor(scrim.punctuality)}`}>{scrim.punctuality}</span></td>
                          <td className="p-4 text-center rounded-r-2xl border-y border-r border-zinc-800/30 relative">
                             <span className={`font-black text-[10px] ${scrim.remakes > 0 ? 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]' : 'text-zinc-600'}`}>{scrim.remakes} RMK</span>
                             {isStaff && <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-2 bg-zinc-900/95 backdrop-blur-sm p-1.5 rounded-xl border border-zinc-700 shadow-xl transition-all duration-300 translate-x-2 group-hover/row:translate-x-0"><button onClick={() => { setEditScrimId(scrim.isManual ? scrim.id : null); setScrimForm({ date: scrim.date, opponent: scrim.opponent, result: scrim.result, score: scrim.score, mode: scrim.mode, comp: scrim.comp, difficulty: scrim.difficulty, punctuality: scrim.punctuality, remakes: scrim.remakes, match_ids: '' }); setScrimModalOpen(true); }} className="text-blue-400 hover:text-white px-3.5 py-1.5 bg-blue-500/10 hover:bg-blue-600 hover:border-blue-500 rounded-lg font-black tracking-widest border border-transparent transition-all uppercase text-[8px]">LOGAR</button></div>}
                          </td>
                       </tr>
                    )) : <tr><td colSpan={6} className="text-center py-10 text-[10px] font-black text-zinc-600 uppercase tracking-widest opacity-80">NENHUMA SCRIM LOGADA NO PERÍODO.</td></tr>}
                 </tbody>
              </table>
           </div>
        </div>

        {/* ROW FINAL: VOD QUEUE E STAT CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
          
          <div className="animate-fade-in-up lg:col-span-7 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-xl relative flex flex-col min-h-[350px] hover-lift" style={{ opacity: 0, animationDelay: '0.7s' }}>
             <div className="flex items-center justify-between mb-6 border-b border-zinc-800/60 pb-5 shrink-0">
                <div><h3 className="text-lg font-black text-white uppercase tracking-tight">VOD Review Queue</h3><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Tarefas Pendentes</p></div>
                <div className="text-[10px] font-black text-amber-500 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg uppercase shadow-[0_0_10px_rgba(245,158,11,0.15)] tracking-widest">{vodTasks.filter(t => !t.is_done).length} Pendentes</div>
             </div>
             
             <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-5">
                {vodTasks.map((task) => (
                    <div key={task.id} onClick={() => toggleTask(task.id, task.is_done)} className={`group p-4 rounded-2xl border transition-all duration-300 flex gap-4 items-start ${isStaff ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'} ${task.is_done ? 'opacity-40 border-zinc-800/50 bg-zinc-900/30' : 'bg-zinc-900/40 border-zinc-700/60 hover:border-blue-500/50'}`}>
                       <div className={`w-5 h-5 shrink-0 rounded-lg border-2 mt-0.5 flex items-center justify-center transition-colors ${task.is_done ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-950 border-zinc-600 group-hover:border-blue-500'}`}>{task.is_done && <span className="text-white text-[10px] font-black">✓</span>}</div>
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2"><span className={`text-[8px] font-black px-2 py-0.5 rounded-md border ${task.tag === 'URGENTE' ? 'text-red-400 border-red-500/30 bg-red-500/10 shadow-[0_0_8px_rgba(220,38,38,0.2)]' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'} tracking-[0.2em] uppercase`}>{task.tag}</span></div>
                          <p className={`text-xs font-bold leading-snug transition-colors ${task.is_done ? 'line-through text-zinc-500' : 'text-zinc-300 group-hover:text-white'}`}>{task.task_text}</p>
                       </div>
                    </div>
                ))}
             </div>
             {isStaff && <button onClick={() => setVodModalOpen(true)} className="w-full py-3.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase hover:text-white hover:bg-zinc-800 hover:border-zinc-500 transition-all">+ Adicionar Tarefa</button>}
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-5">
            <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.75s' }}>
              <StatCard label="WR Blue Side" value={`${stats.blueWR}%`} color="text-blue-500 drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]" sub={`${stats.blueWins}V - ${stats.blueTotal - stats.blueWins}D`} icon="🛡️" />
            </div>
            <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.8s' }}>
              <StatCard label="WR Red Side" value={`${stats.redWR}%`} color="text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]" sub={`${stats.redWins}V - ${stats.redTotal - stats.redWins}D`} icon="⚔️" />
            </div>
            
            <div className="col-span-2 grid grid-cols-2 gap-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.85s' }}>
               <StatCard label="Avg Duration" value={`${stats.avgDuration}m`} color="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" sub={`Em ${stats.totalGames} jogos`} icon="⏱️" />
               <StatCard label="Gold Diff @12" value={`${stats.avgGold12 > 0 ? '+' : ''}${stats.avgGold12}`} color={stats.avgGold12 >= 0 ? 'text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]'} sub="Rating Médio Global" icon="💰" />
            </div>
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
              <button type="submit" className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Salvar</button>
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
                 {missionForm.opponent && <img src={getTeamLogo(missionForm.opponent)!} className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 object-contain p-1 shadow-md" />}
                 <div className="flex-1"><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Adversário</label><select required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.opponent} onChange={e => setMissionForm({...missionForm, opponent: e.target.value})}>{teamsList.map(t => <option key={t.acronym} value={t.acronym}>{t.name} ({t.acronym})</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Data</label><input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} /></div>
                <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Hora</label><input type="time" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.time} onChange={e => setMissionForm({...missionForm, time: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'SCRIM'})} className={`flex-1 py-4 rounded-xl border-2 font-black text-[11px] uppercase tracking-[0.2em] transition-colors ${missionForm.type === 'SCRIM' ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>SCRIM</button>
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'OFFICIAL'})} className={`flex-1 py-4 rounded-xl border-2 font-black text-[11px] uppercase tracking-[0.2em] transition-colors ${missionForm.type === 'OFFICIAL' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>OFICIAL</button>
              </div>
              <div className="grid grid-cols-2 gap-5 pt-2">
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.gamesCount} onChange={e => setMissionForm({...missionForm, gamesCount: e.target.value})}><option value="1 JOGO">1 JOGO</option><option value="2 JOGOS">2 JOGOS</option><option value="3 JOGOS">3 JOGOS</option><option value="4 JOGOS">4 JOGOS</option><option value="5 JOGOS">5 JOGOS</option></select>
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={missionForm.draftMode} onChange={e => setMissionForm({...missionForm, draftMode: e.target.value})}><option value="PADRÃO">DRAFT PADRÃO</option><option value="FEARLESS">DRAFT FEARLESS</option><option value="MISTO">MISTO</option></select>
              </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-2">
              {editMissionId && <button type="button" onClick={() => handleDeleteMission(editMissionId)} className="px-6 py-3.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">Excluir</button>}
              <button type="button" onClick={() => setMissionModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors ml-auto">Cancelar</button>
              <button type="submit" className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {isMetricsModalOpen && isStaff && (
         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
            <form onSubmit={handleSaveMetrics} className="w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl relative my-auto animate-[fadeInUp_0.3s_ease-out_forwards]">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">Staff Tactical Sync</h2>
               <div className="flex flex-col gap-6">
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Data do Log</label>
                     <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={metricsForm.date} onChange={e => setMetricsForm({...metricsForm, date: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-5 border-b border-zinc-800/60 pb-8">
                     <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Estresse Geral (0-100)</label><input type="number" min="0" max="100" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-blue-500 font-black outline-none focus:border-blue-500 transition-colors shadow-inner text-lg" value={metricsForm.stress} onChange={e => setMetricsForm({...metricsForm, stress: Number(e.target.value)})} /></div>
                     <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Carga Cognitiva (0-100)</label><input type="number" min="0" max="100" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-emerald-500 font-black outline-none focus:border-emerald-500 transition-colors shadow-inner text-lg" value={metricsForm.load} onChange={e => setMetricsForm({...metricsForm, load: Number(e.target.value)})} /></div>
                  </div>
                  <div>
                     <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block text-center mb-4">Proporção de Eficiência (Soma = 100 por fase)</label>
                     <div className="grid grid-cols-4 gap-2 items-center text-center bg-zinc-900 p-2.5 rounded-t-xl border-b border-zinc-800">
                        <span className="text-[9px] text-zinc-500 font-black tracking-widest">FASE</span>
                        <span className="text-[9px] text-cyan-500 font-black tracking-widest">MICRO</span>
                        <span className="text-[9px] text-blue-500 font-black tracking-widest">MACRO</span>
                        <span className="text-[9px] text-purple-500 font-black tracking-widest">TEAMFIGHT</span>
                     </div>
                     <div className="grid grid-cols-4 gap-3 mt-4 items-center">
                        <span className="text-[10px] text-zinc-400 font-black text-center tracking-widest uppercase">Early</span>
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-cyan-500 transition-colors shadow-inner" value={metricsForm.early_micro} onChange={e => setMetricsForm({...metricsForm, early_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={metricsForm.early_macro} onChange={e => setMetricsForm({...metricsForm, early_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-purple-500 transition-colors shadow-inner" value={metricsForm.early_tf} onChange={e => setMetricsForm({...metricsForm, early_tf: Number(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-4 gap-3 mt-3 items-center">
                        <span className="text-[10px] text-zinc-400 font-black text-center tracking-widest uppercase">Mid</span>
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-cyan-500 transition-colors shadow-inner" value={metricsForm.mid_micro} onChange={e => setMetricsForm({...metricsForm, mid_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={metricsForm.mid_macro} onChange={e => setMetricsForm({...metricsForm, mid_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-purple-500 transition-colors shadow-inner" value={metricsForm.mid_tf} onChange={e => setMetricsForm({...metricsForm, mid_tf: Number(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-4 gap-3 mt-3 items-center">
                        <span className="text-[10px] text-zinc-400 font-black text-center tracking-widest uppercase">Late</span>
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-cyan-500 transition-colors shadow-inner" value={metricsForm.late_micro} onChange={e => setMetricsForm({...metricsForm, late_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={metricsForm.late_macro} onChange={e => setMetricsForm({...metricsForm, late_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none focus:border-purple-500 transition-colors shadow-inner" value={metricsForm.late_tf} onChange={e => setMetricsForm({...metricsForm, late_tf: Number(e.target.value)})} />
                     </div>
                  </div>
               </div>
               <div className="flex gap-4 pt-8 border-t border-zinc-800/60 mt-4">
                 <button type="button" onClick={() => setMetricsModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
                 <button type="submit" className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Salvar Métricas do Dia</button>
               </div>
            </form>
         </div>
      )}

      {isScrimModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSaveScrim} className="w-full max-w-xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl my-auto relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">Log Scrim Details</h2>
            <div className="space-y-5">
               <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Comp Testada (Foco Geral)</label><input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner" value={scrimForm.comp} onChange={e => setScrimForm({...scrimForm, comp: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-5">
                  <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Dificuldade Tática</label><select value={scrimForm.difficulty} onChange={e => setScrimForm({...scrimForm, difficulty: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner"><option value="STOMPAMOS">Stompamos</option><option value="MUITO FÁCIL">Muito Fácil</option><option value="FÁCIL">Fácil</option><option value="CONTROLADO">Controlado</option><option value="DIFÍCIL">Difícil</option><option value="MT DIFÍCIL">Muito Difícil</option><option value="STOMPADOS">Stompados</option></select></div>
                  <div><label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1.5 ml-1">Pontualidade</label><select value={scrimForm.punctuality} onChange={e => setScrimForm({...scrimForm, punctuality: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-amber-500 transition-colors shadow-inner"><option value="PONTUAIS">Pontuais (Ambos)</option><option value="NOSSO ATRASO">Nosso Atraso</option><option value="ATRASO DELES">Atraso Deles</option><option value="DESMARCARAM NA HORA">Desmarcaram</option></select></div>
               </div>
               <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">Remakes (Problemas Técnicos/Draft)</label>
                  <div className="flex gap-2">{[0, 1, 2, 3].map(num => (<button key={num} type="button" onClick={() => setScrimForm({...scrimForm, remakes: num})} className={`flex-1 py-3.5 rounded-xl border-2 font-black transition-colors ${scrimForm.remakes === num ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>{num}</button>))}</div>
               </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-4">
              <button type="button" onClick={() => setScrimModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(217,119,6,0.4)]">Salvar Detalhes</button>
            </div>
          </form>
        </div>
      )}

      {isVodModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleAddVodTask} className="w-full max-w-xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">Nova Tarefa VOD</h2>
            <div className="space-y-5">
              <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" value={vodForm.tag} onChange={e => setVodForm({...vodForm, tag: e.target.value})}><option value="MACRO">REVIEW MACRO</option><option value="MICRO">REVIEW MICRO</option><option value="DRAFT">REVIEW DRAFT</option><option value="URGENTE">CORREÇÃO URGENTE</option></select>
              <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 text-white font-bold outline-none focus:border-blue-500 transition-colors resize-none shadow-inner" placeholder="O que analisar..." value={vodForm.text} onChange={e => setVodForm({...vodForm, text: e.target.value})} />
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-800/60">
              <button type="button" onClick={() => setVodModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">Criar Tarefa</button>
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
               <WellnessInput icon="💤" title="Qualidade do Sono" desc="1 = Insônia/Péssimo | 5 = Recuperação Total" value={wellnessForm.sleep} onChange={(v: any) => setWellnessForm({...wellnessForm, sleep: v})} />
               <WellnessInput icon="🧠" title="Estado Mental & Stress" desc="1 = Tiltado/Esgotado | 5 = Foco Total/Calmo" value={wellnessForm.mental} onChange={(v: any) => setWellnessForm({...wellnessForm, mental: v})} />
               <WellnessInput icon="🦾" title="Dores & Fadiga Física" desc="1 = Dor forte | 5 = Zero Dor/Pronto" value={wellnessForm.physical} onChange={(v: any) => setWellnessForm({...wellnessForm, physical: v})} />
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
               <button onClick={() => setWellnessHistoryModal({ isOpen: false, player: null, history: [] })} className="text-zinc-500 hover:text-white text-3xl font-black transition-colors w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800">&times;</button>
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

    </div>
  );
}

// --- SUB-COMPONENTES EXCLUSIVOS DO CALENDÁRIO ---
function CalendarEventItem({ ev, isStaff, onEdit }: any) {
   const isScrim = ev.type === 'SCRIM';
   const bgClass = ev.isPast 
       ? (isScrim ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-900/40' : 'bg-blue-950/20 border-blue-900/40 hover:bg-blue-900/40')
       : (isScrim ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20');
   const textClass = isScrim ? 'text-amber-500' : 'text-blue-400';

   return (
      <div onClick={(e) => { if(!ev.isPast && isStaff) onEdit(e, ev.rawMission); else e.stopPropagation(); }} className={`p-2 rounded-lg flex items-center gap-2.5 border ${bgClass} transition-colors w-full cursor-pointer overflow-hidden shrink-0 group/item hover:border-zinc-500`}>
         {ev.logo ? (
            <img src={ev.logo} className="w-8 h-8 object-contain drop-shadow-lg shrink-0 bg-black/40 rounded p-0.5 border border-zinc-800" alt={ev.opp} />
         ) : (
            <div className="w-8 h-8 rounded bg-black/40 border border-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-500 shrink-0">{String(ev.opp).substring(0,3)}</div>
         )}
         <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
             <div className="flex justify-between items-center">
                <span className={`text-[10px] font-black ${textClass} uppercase truncate group-hover/item:text-white transition-colors`}>{ev.opp}</span>
                <span className="text-[8px] text-zinc-400 font-bold tracking-widest">{ev.time}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[8px] font-bold text-zinc-500">{isScrim ? 'SCRIM' : 'OFICIAL'}</span>
                <span className={`text-[9px] font-black uppercase leading-none ${ev.isPast ? (ev.isWin ? 'text-emerald-500' : 'text-red-500') : 'text-zinc-300'}`}>
                   {ev.isPast ? ev.resultText : ev.mode}
                </span>
             </div>
         </div>
      </div>
   );
}

// --- SUB-COMPONENTES GENÉRICOS ---
function StatCard({ label, value, color, sub, icon }: any) {
  return (
    <div className="bg-[#121214] border border-zinc-800/80 p-8 rounded-[24px] hover:border-zinc-700 transition-all duration-300 shadow-lg hover:shadow-xl relative overflow-hidden group h-full hover-lift">
      <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 group-hover:scale-110 group-hover:-rotate-6 grayscale transition-all duration-500 ease-out">{icon}</div>
      <div className="relative z-10 flex flex-col justify-center h-full">
        <p className="text-[10px] text-zinc-500 font-bold tracking-widest mb-2 uppercase">{label}</p>
        <p className={`text-5xl font-black leading-none mb-3 transition-transform duration-300 group-hover:scale-[1.02] origin-left ${color}`}>{value}</p>
        <p className="text-[9px] text-zinc-400 font-bold tracking-widest uppercase">{sub}</p>
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
          <span className="text-2xl bg-zinc-900 border border-zinc-800 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner">{icon}</span>
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