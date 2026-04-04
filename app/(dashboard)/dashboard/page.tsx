"use client";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area
} from 'recharts';

// --- FUNÇÕES UTILITÁRIAS GLOBAIS (Imunes a erros de leitura do React) ---
function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

const getDifficultyColor = (diff: string) => { switch (diff) { case 'STOMPAMOS': return 'bg-blue-600 text-white border-blue-500'; case 'MUITO FÁCIL': return 'bg-blue-400 text-white border-blue-300'; case 'FÁCIL': return 'bg-sky-400 text-white border-sky-300'; case 'CONTROLADO': return 'bg-slate-400 text-white border-slate-300'; case 'DIFÍCIL': return 'bg-amber-400 text-white border-amber-300'; case 'MT DIFÍCIL': return 'bg-orange-500 text-white border-orange-400'; case 'STOMPADOS': return 'bg-red-600 text-white border-red-500 animate-pulse'; default: return 'bg-slate-800 text-slate-300 border-slate-700'; } };
const getPunctualityColor = (punct: string) => { if (punct.includes('PONTUAIS')) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'; if (punct.includes('NOSSO ATRASO')) return 'text-red-400 border-red-500/30 bg-red-500/10'; if (punct.includes('ATRASO DELES')) return 'text-orange-400 border-orange-500/30 bg-orange-500/10'; return 'text-slate-400 border-slate-500/30 bg-slate-500/10'; };
const formatDate = (dateString: string) => { if (!dateString) return ''; const p = dateString.split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; };
const formatTimeStr = (timeString: string) => { if (!timeString) return ''; return timeString.substring(0, 5); };

// --- DADOS FICTÍCIOS (PLACEHOLDERS) ---
const mockStressData = [
  { name: 'Seg', estresse: 40, carga: 35 },
  { name: 'Ter', estresse: 65, carga: 60 },
  { name: 'Qua', estresse: 85, carga: 80 },
  { name: 'Qui', estresse: 20, carga: 15 },
  { name: 'Sex', estresse: 50, carga: 45 },
  { name: 'Sab', estresse: 90, carga: 95 },
  { name: 'Dom', estresse: 95, carga: 100 },
];

const mockEfficiencyData = [
  { name: 'Bad', micro: 60, macro: 30, tf: 10 },
  { name: 'Average', micro: 30, macro: 50, tf: 20 },
  { name: 'Good', micro: 10, macro: 40, tf: 50 },
  { name: 'Excellent', micro: 5, macro: 35, tf: 60 },
];

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState({ id: '', role: 'analista', puuid: 'PUUID_DE_TESTE_DO_JOGADOR', name: 'CARREGANDO...', photo: '' });
  const isStaff = ['analista', 'treinador', 'diretor'].includes(currentUser.role.toLowerCase());

  const [loading, setLoading] = useState(true);
  
  // NOVOS FILTROS
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
  
  // MODAIS
  const [isWellnessModalOpen, setWellnessModalOpen] = useState(false);
  const [isMissionModalOpen, setMissionModalOpen] = useState(false);
  const [isScrimModalOpen, setScrimModalOpen] = useState(false);
  const [isTargetModalOpen, setTargetModalOpen] = useState(false);
  const [isVodModalOpen, setVodModalOpen] = useState(false);
  const [isMetricsModalOpen, setMetricsModalOpen] = useState(false);
  const [wellnessHistoryModal, setWellnessHistoryModal] = useState<{isOpen: boolean, player: any, history: any[]}>({ isOpen: false, player: null, history: [] });
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  
  const [expandedWellnessId, setExpandedWellnessId] = useState<string | null>(null);

  // FORMS
  const [profileForm, setProfileForm] = useState({ name: '', photo_url: '' });
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [editScrimId, setEditScrimId] = useState<string | null>(null);

  const [wellnessForm, setWellnessForm] = useState({ puuid: '', sleep: 3, mental: 3, physical: 3, focus: 3 });
  const [missionForm, setMissionForm] = useState({ date: '', time: '', opponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' });
  const [scrimForm, setScrimForm] = useState({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
  const [targetForm, setTargetForm] = useState({ team: '', win1: '', win2: '', win3: '' });
  const [vodForm, setVodForm] = useState({ tag: 'MACRO', text: '' });
  
  const [metricsForm, setMetricsForm] = useState({
     date: new Date().toISOString().split('T')[0],
     stress: 50, load: 50,
     early_micro: 33, early_macro: 33, early_tf: 34,
     mid_micro: 33, mid_macro: 33, mid_tf: 34,
     late_micro: 33, late_macro: 33, late_tf: 34,
  });

  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');
  const [currentDate, setCurrentDate] = useState(new Date());

  const upcomingMissions = useMemo(() => {
    const today = new Date();
    // Pega o YYYY-MM-DD local sem converter para UTC
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
      let loggedUser = { id: '', role: 'jogador', puuid: '', name: 'JOGADOR', photo: `https://ui-avatars.com/api/?name=User&background=1e293b&color=3b82f6` };

      if (user) {
         const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
         if (profile) {
            loggedUser.id = user.id;
            loggedUser.role = profile.role || 'jogador';
            loggedUser.puuid = profile.puuid || '';
            loggedUser.name = profile.full_name || 'JOGADOR';
            loggedUser.photo = profile.photo_url || `https://ui-avatars.com/api/?name=${profile.full_name || 'User'}&background=1e293b&color=3b82f6`;
         }
      } else {
         loggedUser = { id: 'dev', role: 'analista', puuid: 'TESTE', name: 'HEAD COACH', photo: `https://ui-avatars.com/api/?name=C&background=1e293b&color=3b82f6` };
      }

      const { data: configData } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
      const myTeam = configData?.my_team_tag?.toUpperCase() || 'RMD';
      setMyTeamTag(myTeam);

      const [rosterRes, teamsRes, matchesRes, viewRes, statsRes, missionsRes, scrimsRes, vodRes, wellnessRes, metricsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('matches').select('*'),
        supabase.from('view_matches_with_teams').select('*'),
        supabase.from('player_stats_detailed').select('*'),
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

      // Dentro do useEffect principal, troque o todayStr:
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
      const isScrim = String(m.game_type).toUpperCase().includes('SCRIM');
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;

      // Filtro de Data
      if (filterStartDate || filterEndDate) {
          let matchDateStr = '';
          if (m.game_start_time) {
              const d = new Date(String(m.game_start_time).replace(' ', 'T'));
              if (!isNaN(d.getTime())) {
                  matchDateStr = d.toISOString().split('T')[0];
              }
          }
          if (filterStartDate && matchDateStr && matchDateStr < filterStartDate) return false;
          if (filterEndDate && matchDateStr && matchDateStr > filterEndDate) return false;
      }

      // Filtro de Patch
      if (filterPatch && m.patch && !String(m.patch).includes(filterPatch)) return false;

      return true;
    });
  }, [matchesRaw, matchType, filterStartDate, filterEndDate, filterPatch]);

  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    filteredMatches.forEach(m => {
      const isScrim = String(m.game_type).toUpperCase().includes('SCRIM');
      
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
      
      let dateRaw = 'unknown-date';
      let timeRaw = '00:00';
      
      if (m.game_start_time) {
          const d = new Date(String(m.game_start_time).replace(' ', 'T'));
          
          if (!isNaN(d.getTime())) {
             // 1. CORREÇÃO DO FUSO (BRT):
             // Subtraímos 3 horas do horário bruto. 
             // Assim, o jogo de 00:00 UTC (Quinta) volta a ser 21:00 (Quarta).
             d.setHours(d.getHours() - 3);

             // 2. REGRA DA MADRUGADA (Só para Scrims):
             // Se for scrim e estiver rolando antes das 6 da manhã (já com o fuso corrigido),
             // subtrai mais 6 horas pra cair no calendário do dia anterior.
             if (isScrim && d.getHours() < 6) {
                 d.setHours(d.getHours() - 6);
             }

             // Salva a hora exata corrigida
             timeRaw = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
             
             const year = d.getFullYear(); 
             const month = String(d.getMonth() + 1).padStart(2, '0'); 
             const day = String(d.getDate()).padStart(2, '0');
             dateRaw = `${year}-${month}-${day}`;
          }
      }
      
      // 3. NOVO AGRUPAMENTO PARA OFICIAIS:
      // Agora, em vez de usar o 'series_id' (que pode juntar a semana toda), 
      // nós quebramos os jogos oficiais estritamente por DATA e ADVERSÁRIO.
      let sId = isScrim ? `SCRIM_${dateRaw}_${opp}` : `OFICIAL_${dateRaw}_${opp}`;
      
      if (!groups[sId]) {
        groups[sId] = { id: sId, isScrim: isScrim, calendarDate: dateRaw, time: timeRaw, opp: opp || 'UNKNOWN', ourWins: 0, theirWins: 0, games: [] };
      }
      groups[sId].games.push(m);
      
      const isOurWin = (weAreBlue && m.winner_side === 'blue') || (!weAreBlue && m.winner_side === 'red');
      if (isOurWin) {
          groups[sId].ourWins++;
      } else {
          groups[sId].theirWins++;
      }
    });
    
    return Object.values(groups);
  }, [filteredMatches, myTeamTag]);

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for(let i = 0; i < firstDayIndex; i++) grid.push(null);
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        // 1. Jogos Reais (Puxa do novo groupedSeries)
        const pastEvents = groupedSeries.filter(g => g.calendarDate === dateStr).map(g => {
            const ourScore = g.ourWins;
            const theirScore = g.theirWins;
            return { id: g.id, time: g.time, opp: g.opp, type: g.isScrim ? 'SCRIM' : 'OFICIAL', resultText: `${ourScore} - ${theirScore} ${ourScore > theirScore ? 'W' : theirScore > ourScore ? 'L' : 'D'}`, isWin: ourScore > theirScore, isPast: true };
        });

        // Extrai quem já jogamos pra poder limpar a agenda
        const opponentsPlayedToday = pastEvents.map(ev => String(ev.opp).toUpperCase().trim());

        // 2. Missões Agendadas
        const futureEvents = missionsRaw.filter(m => m.mission_date === dateStr).map(m => {
            const info = m.status ? m.status.split('|') : [];
            const gamesCount = info[1] ? info[1].trim() : 'TBD';
            return { id: m.id, time: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', opp: m.opponent_acronym, type: m.mission_type, mode: gamesCount, isPast: false, rawMission: m };
        }).filter(mission => {
            // Regra do espião: Se já tiver um resultado real no banco contra essa mesma tag (ou tag parecida), esconde do calendário
            const missionOpp = String(mission.opp).toUpperCase().trim();
            const isDuplicate = opponentsPlayedToday.some(playedOpp => playedOpp.includes(missionOpp) || missionOpp.includes(playedOpp));
            return !isDuplicate;
        });

        grid.push({ day: i, dateStr, isToday: dateStr === new Date().toISOString().split('T')[0], events: [...pastEvents, ...futureEvents].sort((a,b) => a.time.localeCompare(b.time)) });
    }
    
    while(grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [currentDate, groupedSeries, missionsRaw]);

  const stats = useMemo(() => {
    const total = filteredMatches.length;
    let blueTotal = 0; let blueWins = 0;
    let redTotal = 0; let redWins = 0;
    let totalDuration = 0;
    
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
      const weAreRed = String(m.red_team_tag || m.red_tag || '').toUpperCase().includes(myTeamTag);

      if (weAreBlue) {
          blueTotal++;
          if (m.winner_side === 'blue') blueWins++;
      } else if (weAreRed) {
          redTotal++;
          if (m.winner_side === 'red') redWins++;
      }
      totalDuration += (m.game_duration || 0);
    });

    const activeMatchIds = new Set(filteredMatches.map(m => String(m.id || m.match_id)));
    const teamStatsFiltered = statsDetailed.filter(s => activeMatchIds.has(String(s.match_id)) && String(s.team_acronym || s.team || '').toUpperCase().includes(myTeamTag));
    const avgGold12 = teamStatsFiltered.length > 0 ? Math.round(teamStatsFiltered.reduce((acc, curr) => acc + (Number(curr.gold_diff_at_12) || 0), 0) / teamStatsFiltered.length) : 0;

    return { 
      totalGames: total, 
      blueWR: blueTotal ? Math.round((blueWins / blueTotal) * 100) : 0, 
      redWR: redTotal ? Math.round((redWins / redTotal) * 100) : 0, 
      blueWins, blueTotal,
      redWins, redTotal,
      avgDuration: total && totalDuration ? Math.round(totalDuration / total / 60) : 0, 
      avgGold12 
    };
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
       const offIds = new Set(matchesRaw.filter(m => !String(m.game_type).toUpperCase().includes('SCRIM')).map(m => String(m.id || m.match_id)));
       const scrimIds = new Set(matchesRaw.filter(m => String(m.game_type).toUpperCase().includes('SCRIM')).map(m => String(m.id || m.match_id)));
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
    matchesRaw.filter(m => String(m.game_type).toUpperCase().includes('SCRIM')).forEach(m => {
       const d = new Date(String(m.game_start_time).replace(' ', 'T'));
       if (!isNaN(d.getTime())) d.setHours(d.getHours() - 6);
       const dateRaw = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       const opp = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag) ? (m.red_team_tag || m.red_tag) : (m.blue_team_tag || m.blue_tag);
       const key = `${dateRaw}_${opp}`;
       
       if (!autoScrimBlocks.has(key)) autoScrimBlocks.set(key, { date: dateRaw, opp, wins: 0, losses: 0, games: [] });
       const block = autoScrimBlocks.get(key); block.games.push(m);
       const weAreBlue = String(m.blue_team_tag || m.blue_tag || '').toUpperCase().includes(myTeamTag);
       if ((weAreBlue && m.winner_side === 'blue') || (!weAreBlue && m.winner_side === 'red')) block.wins++; else block.losses++;
    });

    const finalList: any[] = [];
    autoScrimBlocks.forEach((block, key) => {
       const manual = scrimReportsManual.find(sm => sm.scrim_date === block.date && sm.opponent_acronym === block.opp) || {};
       finalList.push({
         id: manual.id || `auto_${key}`, date: block.date, opponent: block.opp, result: block.wins > block.losses ? 'W' : block.losses > block.wins ? 'L' : 'D',
         score: `${block.wins} - ${block.losses}`, mode: manual.mode || `MD${block.games.length}`, comp: manual.comp_tested || 'AUTOMATIC LOG',
         difficulty: manual.difficulty || 'N/A', punctuality: manual.punctuality || 'N/A', remakes: manual.remakes || 0, isManual: !!manual.id
       });
    });
    scrimReportsManual.forEach(sm => { if (!finalList.find(f => f.id === sm.id)) finalList.push({ id: sm.id, date: sm.scrim_date, opponent: sm.opponent_acronym, result: sm.result, score: sm.score, mode: sm.mode, comp: sm.comp_tested, difficulty: sm.difficulty, punctuality: sm.punctuality, remakes: sm.remakes, isManual: true }); });
    return finalList.sort((a,b) => getSafeTimestamp(b.date) - getSafeTimestamp(a.date));
  }, [matchesRaw, scrimReportsManual, myTeamTag]);

  // --- MOTOR DOS GRÁFICOS MINI (LÊ O HISTÓRICO REAL DE SCRIMS E O TIER DOS TIMES) ---
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
          const diff = scrim.difficulty && diffOrder.includes(scrim.difficulty.toUpperCase()) 
            ? scrim.difficulty.toUpperCase() 
            : 'CONTROLADO';
            
          diffCounts[diff]++;

          // Procura o time na lista que veio do Supabase
          const opponentData = teamsList.find(t => t.acronym === scrim.opponent);
          
          // Pega a coluna tier do banco. Se não existir, cai para 'Average'
          let rawTier = opponentData?.tier ? String(opponentData.tier).trim() : 'Average';
          
          // Formata a string para garantir que fique igual aos nomes das nossas chaves (ex: 'bad' ou 'BAD' vira 'Bad')
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
    
    // Pega o valor real direto do objeto de dados original, ignorando a matemática empilhada do Recharts
    const val = payload?.[dataKey];
    
    // Só renderiza se for maior que zero
    if (!val || val === 0) return null;
    
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold">
        {Math.round(val)}
      </text>
    );
  };

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
     const info = m.status ? m.status.split('|') : [];
     let gc = '3 JOGOS'; let dm = 'PADRÃO';
     if (info.length >= 3) { gc = info[1].trim(); dm = info[2].trim(); }
     setMissionForm({ date: m.mission_date, time: m.mission_time.substring(0,5), opponent: m.opponent_acronym, type: m.mission_type, gamesCount: gc, draftMode: dm });
     setMissionModalOpen(true);
  }

  const handleSaveMission = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    
    // Garante que a data seja salva exatamente como o input mandou (YYYY-MM-DD)
    const d = missionForm.date; 
    const t = missionForm.time.length === 5 ? `${missionForm.time}:00` : missionForm.time; 
    
    const statusEncoded = `SCHEDULED | ${missionForm.gamesCount} | ${missionForm.draftMode}`;
    const payload = { 
        team_acronym: myTeamTag, 
        mission_date: d, 
        mission_time: t, 
        opponent_acronym: missionForm.opponent, 
        mission_type: missionForm.type, 
        status: statusEncoded 
    }; 

    if (editMissionId) { 
        const { data, error } = await supabase.from('missions').update(payload).eq('id', editMissionId).select(); 
        if (data) { 
            setMissionsRaw(prev => prev.map(m => m.id === editMissionId ? data[0] : m)); 
            setMissionModalOpen(false); 
        } 
    } else { 
        const { data, error } = await supabase.from('missions').insert([payload]).select(); 
        if (data) { 
            setMissionsRaw(prev => [...prev, data[0]]); 
            setMissionModalOpen(false); 
        } 
    } 
};

  const handleDeleteMission = async (id: string) => { if (!window.confirm("Deseja excluir?")) return; await supabase.from('missions').delete().eq('id', id); setMissionsRaw(prev => prev.filter(m => m.id !== id)); setMissionModalOpen(false); };
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (currentUser.id === 'dev') return alert('Modo Dev Ativo. Faça login com uma conta real para salvar as edições.');
      const { error } = await supabase.from('profiles').update({ full_name: profileForm.name, photo_url: profileForm.photo_url }).eq('id', currentUser.id);
      if (!error) { setCurrentUser({ ...currentUser, name: profileForm.name, photo: profileForm.photo_url || `https://ui-avatars.com/api/?name=${profileForm.name}&background=1e293b&color=3b82f6` }); setProfileModalOpen(false); } 
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

  const getTeamLogo = (acronym: string) => { const t = teamsList.find(t => t.acronym.toUpperCase() === (acronym||'').toUpperCase()); return t?.logo_url || `https://ui-avatars.com/api/?name=${acronym}&background=1e293b&color=fff&bold=true`; };
  const intensityTheme = squadConfig.intensity < 40 ? { text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.8)]' } : squadConfig.intensity < 75 ? { text: 'text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]' } : { text: 'text-red-400', bg: 'bg-red-500', shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.8)]' };

  if (loading) return <div className="flex items-center justify-center h-screen text-blue-500 font-black italic animate-pulse text-xs tracking-widest">// ACESSANDO SERVIDORES DO SUPABASE...</div>;

  const expandedPlayer = teamWellness.find(p => p.puuid === expandedWellnessId);

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 font-black uppercase italic tracking-tighter pb-20">
      
      {/* BARRA DE FILTROS SUPERIOR (ATUALIZADA) */}
      <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 shadow-xl max-w-fit mx-auto sticky top-4 z-[999] backdrop-blur-md">
         <div className="flex bg-black p-1.5 rounded-xl border border-slate-800">
           <button onClick={() => setMatchType('ALL')} className={`px-4 md:px-6 py-2 rounded-lg text-[10px] transition-all ${matchType === 'ALL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>AMBOS</button>
           <button onClick={() => setMatchType('OFICIAL')} className={`px-4 md:px-6 py-2 rounded-lg text-[10px] transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white' : 'text-blue-900 hover:text-blue-400'}`}>OFICIAL</button>
           <button onClick={() => setMatchType('SCRIM')} className={`px-4 md:px-6 py-2 rounded-lg text-[10px] transition-all ${matchType === 'SCRIM' ? 'bg-amber-500 text-black' : 'text-amber-900 hover:text-amber-500'}`}>SCRIMS</button>
         </div>
         
         <div className="h-6 w-px bg-slate-800 hidden md:block"></div>
         
         <div className="flex items-center gap-2">
            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-black border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-blue-500" />
            <span className="text-slate-500 text-[10px]">até</span>
            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-black border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-blue-500" />
         </div>

         <div className="flex items-center gap-2 bg-black border border-slate-800 rounded-lg px-3 py-1">
            <span className="text-slate-500 text-[10px]">Patch:</span>
            <input type="text" placeholder="Ex: 14.5" value={filterPatch} onChange={e => setFilterPatch(e.target.value)} className="w-12 bg-transparent text-[10px] text-slate-300 outline-none focus:text-white" />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-8 h-full">
          
          <div className="relative group overflow-hidden bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-[32px] p-6 flex flex-col md:flex-row items-center gap-6 shadow-2xl shrink-0">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
            <div className={`flex items-center md:items-start gap-6 relative z-10 w-full md:w-auto shrink-0`}>
               <div className="relative shrink-0">
                   <div className="w-24 h-24 md:w-32 md:h-32 rounded-[32px] bg-slate-900 border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] overflow-hidden">
                      <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
                   </div>
                   <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-lg shadow-xl border border-white/20">{isStaff ? 'STAFF' : 'ROSTER'}</div>
               </div>
               <div className="flex flex-col justify-center h-full py-2 w-full">
                  <div className="flex items-center justify-between mb-2 w-full">
                     <p className="text-blue-400 text-[10px] tracking-[0.5em] leading-none">{isStaff ? 'ACTIVE ANALYST PROTOCOL' : 'PLAYER TACTICAL HUB'}</p>
                     <button onClick={() => { setProfileForm({ name: currentUser.name, photo_url: currentUser.photo }); setProfileModalOpen(true); }} className="text-[10px] text-slate-500 hover:text-white bg-white/5 px-2 py-1 rounded">⚙️ EDITAR</button>
                  </div>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl text-white mb-3 leading-tight break-words max-w-[300px]">{currentUser.name}</h2>
                  <div className="flex flex-wrap gap-2">
                     <Badge text={currentUser.role} color="bg-blue-500" />
                     <Badge text="CBLOL ACADEMY" color="bg-purple-600" />
                  </div>
               </div>
            </div>

            {!isStaff && (
               <div className="relative z-10 flex-1 flex flex-col justify-center w-full">
                  <div className="flex justify-between items-center mb-4">
                     <span className="text-[9px] text-slate-400 tracking-[0.2em] uppercase">Tactical Matrix</span>
                  </div>
                  <div className="space-y-2">
                     <MiniStatBar label="Lane" value={myStats.lane} color="bg-blue-500" />
                     <MiniStatBar label="Impact" value={myStats.impact} color="bg-emerald-500" />
                     <MiniStatBar label="Conv." value={myStats.conversion} color="bg-amber-500" />
                     <MiniStatBar label="Vision" value={myStats.vision} color="bg-purple-500" />
                  </div>
               </div>
            )}
          </div>

          <div className="bg-[#121212] border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-6 relative overflow-hidden group shrink-0">
             <div className={`absolute left-0 top-0 bottom-0 w-1 ${intensityTheme.bg} transition-colors duration-1000`}></div>
             <div className="flex flex-col min-w-0 ml-4 flex-1">
                <span className="text-[9px] text-slate-500 tracking-widest uppercase mb-0.5 flex items-center gap-2">Tactical Directive <span className="bg-yellow-500/20 text-yellow-500 px-1.5 rounded border border-yellow-500/30">AUTO</span></span>
                <span className="text-white text-sm tracking-[0.2em] font-black italic truncate">{squadConfig.directive}</span>
             </div>
             <div className="flex flex-col w-full xl:w-[260px] shrink-0 gap-3">
                <div className="flex items-end justify-between w-full text-[10px] font-black italic uppercase">
                   <span className="text-white">WORKLOAD</span><span className={intensityTheme.text}>{squadConfig.load}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
                   <div className={`absolute top-0 bottom-0 left-0 ${intensityTheme.bg} transition-all duration-1000`} style={{ width: `${squadConfig.intensity}%` }}></div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <div className="bg-[#121212] border border-white/5 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group flex flex-col h-full min-h-[220px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] opacity-20 group-hover:opacity-100 transition-all"></div>
              <div className="flex items-center justify-between mb-4 z-10 shrink-0">
                 <h3 className="text-xs text-white italic flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#3b82f6] rounded-full"></div> 
                    Curva de Estresse e Carga Cognitiva
                 </h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartIntelligence.stressData} margin={{ top: 25, right: 15, left: -25, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                     <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 7, fontWeight: '900' }} axisLine={false} tickLine={false} />
                     <YAxis hide />
                     <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1e293b', fontSize: '9px' }} />
                     <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.2} label={{ fill: '#fff', fontSize: 12, fontWeight: '900', position: 'top' }} />
                   </AreaChart>
                 </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-[#121212] border border-white/5 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group flex flex-col h-full min-h-[220px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-500 opacity-20 group-hover:opacity-100 transition-all"></div>
              <div className="flex items-center justify-between mb-4 z-10 shrink-0">
                 <h3 className="text-xs text-white italic flex items-center gap-2">
                    <div className="w-1 h-3 bg-slate-500 rounded-full"></div> 
                    Eficiência Proporcional por Nível
                 </h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartIntelligence.efficiencyData} margin={{ top: 15, right: 5, left: -25, bottom: 0 }} stackOffset="none">
                     <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                     <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9, fontWeight: '900' }} axisLine={false} tickLine={false} />
                     <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#121212', borderColor: '#1e293b', fontSize: '9px' }} />
                     
                     <Bar dataKey="STOMPADOS" stackId="a" fill="#dc2626" label={(p: any) => renderCustomBarLabel({...p, dataKey: "STOMPADOS"})} />
                     <Bar dataKey="MT DIFÍCIL" stackId="a" fill="#f97316" label={(p: any) => renderCustomBarLabel({...p, dataKey: "MT DIFÍCIL"})} />
                     <Bar dataKey="DIFÍCIL" stackId="a" fill="#fbbf24" label={(p: any) => renderCustomBarLabel({...p, dataKey: "DIFÍCIL"})} />
                     <Bar dataKey="CONTROLADO" stackId="a" fill="#94a3b8" label={(p: any) => renderCustomBarLabel({...p, dataKey: "CONTROLADO"})} />
                     <Bar dataKey="FÁCIL" stackId="a" fill="#38bdf8" label={(p: any) => renderCustomBarLabel({...p, dataKey: "FÁCIL"})} />
                     <Bar dataKey="MUITO FÁCIL" stackId="a" fill="#3b82f6" label={(p: any) => renderCustomBarLabel({...p, dataKey: "MUITO FÁCIL"})} />
                     <Bar dataKey="STOMPAMOS" stackId="a" fill="#1e40af" label={(p: any) => renderCustomBarLabel({...p, dataKey: "STOMPAMOS"})} />
                   </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl flex flex-col h-full relative overflow-hidden group min-h-[400px]">
           <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-20 group-hover:opacity-100 transition-all"></div>
           <div className="mb-6 border-b border-white/5 pb-6">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm text-slate-400 tracking-widest leading-none">CALENDÁRIO ({currentDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()})</h3>
                 <div className="flex gap-1">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-black text-[8px]">&lt;</button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-black text-[8px]">HOJE</button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-black text-[8px]">&gt;</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                 {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-center text-[8px] text-slate-600 font-black mb-1">{d}</div>)}
                 {calendarGrid.map((cell, idx) => {
                    if (!cell) return <div key={`empty-${idx}`} className="min-h-[85px]"></div>;
                    let borderClass = 'border-white/5 hover:border-white/20 hover:bg-white/[0.05]';
                    if (cell.isToday) borderClass = 'border-blue-500/50 bg-blue-500/10 shadow-inner';
                    return (
                      <div key={cell.dateStr} onClick={() => handleDayClick(cell.dateStr)} className={`relative flex flex-col min-h-[85px] rounded-lg border transition-all p-1.5 group/day ${isStaff ? 'cursor-pointer' : ''} ${borderClass}`}>
                        <div className="flex justify-between items-center mb-1">
                           <span className={`text-[10px] font-black ${cell.isToday ? 'text-white' : 'text-slate-400'}`}>{cell.day}</span>
                           {isStaff && <span className="opacity-0 group-hover/day:opacity-100 text-blue-500 text-[10px]">+</span>}
                        </div>
                        <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
                           {cell.events.map((ev: any) => {
                              const isScrim = ev.type === 'SCRIM';
                              const bgClass = ev.isPast 
                                  ? (isScrim ? 'bg-amber-950/40 border-amber-500/30' : 'bg-blue-950/40 border-blue-500/30')
                                  : (isScrim ? 'bg-amber-500/20 border-amber-500/50' : 'bg-blue-500/20 border-blue-500/50');
                              const textClass = isScrim ? 'text-amber-400' : 'text-blue-400';

                              return (
                                 <div key={ev.id} onClick={(e) => { if(!ev.isPast) handleEditMission(e, ev.rawMission); else e.stopPropagation(); }} className={`p-1 rounded flex flex-col gap-0.5 border ${bgClass} transition-colors`}>
                                    <div className={`flex justify-between items-center text-[7px] font-mono ${textClass}`}>
                                       <span>{ev.time}</span><span>{isScrim ? 'SCR' : 'OFI'}</span>
                                    </div>
                                    <span className="text-[8px] font-black text-white truncate pt-0.5">VS {ev.opp}</span>
                                    <span className={`text-[7px] font-black text-right ${ev.isPast ? (ev.isWin ? 'text-emerald-400' : 'text-red-400') : 'text-slate-400'}`}>{ev.isPast ? ev.resultText : ev.mode}</span>
                                 </div>
                              );
                           })}
                        </div>
                      </div>
                    )
                 })}
              </div>
           </div>
           <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-sm text-slate-400 tracking-widest leading-none">PRÓXIMAS MISSÕES</h3>
                 {isStaff && <button onClick={() => { setEditMissionId(null); setMissionForm({ date: '', time: '14:00', opponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' }); setMissionModalOpen(true); }} className="bg-blue-500/10 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-[9px] hover:bg-blue-600 hover:text-white transition-all">+ NOVO</button>}
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[180px] custom-scrollbar pr-2">
                 {upcomingMissions.length > 0 ? upcomingMissions.map(m => (
                    <div key={m.id} className="flex flex-col p-3 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.05] group/card relative">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <img src={getTeamLogo(m.opponent_acronym)} className="w-8 h-8 object-contain" />
                             <div className="flex flex-col"><span className="text-blue-400 text-[8px] tracking-widest">{formatDate(m.mission_date)} - {formatTimeStr(m.mission_time)}</span><span className="text-white text-sm font-black">VS {m.opponent_acronym}</span></div>
                          </div>
                          <div className="flex flex-col items-end gap-1"><span className="text-[7px] px-2 py-0.5 bg-black/40 rounded border border-white/10 text-slate-400">{m.mission_type}</span><span className="text-[7px] text-amber-500/80 font-black">{m.status?.split('|')[1] || m.mode}</span></div>
                       </div>
                       {isStaff && <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 flex gap-2 transition-all bg-[#121212]/90 p-1.5 rounded-lg border border-white/10"><button onClick={(e) => handleEditMission(e, m)} className="text-[8px] text-blue-400 hover:text-white px-2 py-1">EDIT</button><button onClick={() => handleDeleteMission(m.id)} className="text-[8px] text-red-400 hover:text-white px-2 py-1">DEL</button></div>}
                    </div>
                 )) : <p className="text-[10px] text-slate-600 text-center py-2 italic font-black">LIVRE (NADA HOJE/AMANHÃ).</p>}
              </div>
           </div>
        </div>
      </div>

      <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden group w-full mt-8">
         <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-20 group-hover:opacity-100 transition-all"></div>
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-white/5 pb-6">
            <div><h3 className="text-xl text-white italic flex items-center gap-3"><div className="w-1.5 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div> Squad Readiness</h3><p className="text-[9px] text-slate-500 tracking-[0.3em] mt-2">PREVENÇÃO DE LESÕES E BURN-OUT TÁTICO</p></div>
            <button onClick={() => { if(!isStaff) setWellnessForm(prev => ({ ...prev, puuid: currentUser.puuid })); setWellnessModalOpen(true); }} className="bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-2xl text-[10px] hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"><span className="text-lg leading-none">+</span> DAILY SYNC</button>
         </div>

         <div className={`grid gap-4 ${isStaff ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-5'}`}>
            {teamWellness.filter(p => isStaff || p.puuid === currentUser.puuid).map((p) => {
               const isDanger = p.score < 65; const isOptimal = p.score > 85;
               const colorClass = isDanger ? 'text-red-400 border-red-500/30 bg-red-500/5' : isOptimal ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5';
               const isExpanded = expandedWellnessId === p.puuid;

               return (
                 <div key={p.puuid} onClick={() => setExpandedWellnessId(isExpanded ? null : p.puuid)} className={`relative p-5 rounded-[24px] border transition-all cursor-pointer hover:scale-[1.02] ${colorClass} ${isExpanded ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                    {!p.hasAnsweredToday && !isStaff && (
                      <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-white/5">
                         <span className="text-3xl mb-3 animate-pulse opacity-50">⏳</span><span className="text-[9px] text-slate-400 tracking-[0.2em] font-black text-center px-4 leading-relaxed">PENDENTE DE<br/>RESPOSTA HOJE</span>
                      </div>
                    )}
                    {isStaff && p.history.length > 0 && (
                       <button onClick={(e) => { e.stopPropagation(); setWellnessHistoryModal({ isOpen: true, player: p, history: p.history }); }} className="absolute top-4 right-4 z-30 text-[8px] bg-black/40 hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded border border-white/5 transition-all">HISTÓRICO</button>
                    )}
                    <div className="flex justify-between items-start mb-4 relative z-10">
                       <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                         {p.photo && <img src={p.photo} className="w-9 h-9 rounded-full border border-white/10 object-cover shrink-0 mt-0.5" />}
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-0.5"><span className="text-[8px] text-slate-500 uppercase">{String(p.role).replace(/jug/i, 'JNG')}</span>{!p.hasAnsweredToday && isStaff && <span className="text-[6px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse">PENDENTE</span>}</div>
                           <span className="text-sm font-black text-white break-words leading-tight block">{p.name}</span>
                         </div>
                       </div>
                       <span className={`text-2xl font-black italic leading-none shrink-0 pt-1 ${isDanger ? 'text-red-400 animate-pulse' : ''}`}>{p.score}%</span>
                    </div>
                    <div className="space-y-2 relative z-10"><WellnessBar label="SONO" value={p.sleep} /><WellnessBar label="MENTAL" value={p.mental} /><WellnessBar label="FÍSICO" value={p.physical} /></div>
                 </div>
               );
            })}
         </div>

         {expandedPlayer && expandedPlayer.history.length > 0 && (
            <div className="w-full bg-gradient-to-br from-black/40 to-emerald-900/10 border border-white/5 rounded-[24px] p-6 flex flex-col justify-center relative overflow-hidden group min-h-[250px] mt-6 animate-in slide-in-from-top-4">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-50 group-hover:opacity-100 transition-all"></div>
               <div className="flex items-center justify-between mb-4">
                  <div>
                     <h4 className="text-[10px] text-emerald-400 tracking-[0.3em] uppercase">Evolução Biométrica: {expandedPlayer.name}</h4>
                     <p className="text-[9px] text-slate-500 tracking-widest mt-1">ACOMPANHAMENTO DE ENERGIA E FOCO</p>
                  </div>
                  <button onClick={() => setExpandedWellnessId(null)} className="text-slate-500 hover:text-white font-black text-xl">&times;</button>
               </div>
               <div className="flex-1 w-full mt-2 min-h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={[...expandedPlayer.history].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="record_date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900', fontStyle: 'italic' }} axisLine={false} tickLine={false} />
                        <YAxis hide domain={[0, 100]} />
                        <Line type="monotone" dataKey="readiness_percent" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#121212', strokeWidth: 2, stroke: '#10b981'}} activeDot={{r: 6}} />
                        <Tooltip cursor={false} contentStyle={{ backgroundColor: '#121212', borderColor: '#10b981', fontSize: '10px', borderRadius: '12px' }} />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
        <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl h-[450px] relative flex flex-col overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-20 group-hover:opacity-100 transition-all"></div>
          <div className="flex justify-between items-start mb-6 shrink-0">
             <h3 className="text-xl text-white italic flex items-center gap-3"><div className="w-1.5 h-5 bg-blue-500 rounded-full"></div> Squad Performance Index</h3>
             <div className="flex bg-black border border-white/10 rounded-lg p-1">
                <button onClick={() => setRadarCompareMode('OFFICIAL_VS_SCRIM')} className={`px-3 py-1.5 text-[8px] rounded-md transition-all ${radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>OFF VS SCRIM</button>
                <button onClick={() => setRadarCompareMode('US_VS_OPP')} className={`px-3 py-1.5 text-[8px] rounded-md transition-all ${radarCompareMode === 'US_VS_OPP' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>US VS OPP</button>
             </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.4} />
                <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} strokeWidth={3} fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} fillOpacity={0.4} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1e293b', fontSize: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative flex flex-col h-[450px] overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-20 group-hover:opacity-100 transition-all"></div>
          <div className="flex items-center justify-between mb-6 shrink-0">
             <h3 className="text-sm text-slate-500 tracking-widest leading-none">INTERNAL MVP RACE</h3>
             <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-1 rounded-lg animate-pulse">LIVE RANKING</span>
          </div>
          
          <div className="flex flex-col gap-2 overflow-y-hidden flex-1">
             {squadForm.length > 0 ? squadForm.map((player, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;
                
                let rankColor = 'text-slate-500 bg-slate-800/50 border-slate-700/50';
                let borderGlow = 'border-white/5 hover:border-white/20 bg-white/[0.02]';
                let nameSize = 'text-xs text-slate-300';
                let ratingSize = 'text-lg text-white';
                let numberBox = 'w-7 h-7 text-xs';

                if (isFirst) {
                   rankColor = 'text-amber-400 bg-amber-500/20 border-amber-500/50 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]';
                   borderGlow = 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent shadow-[inset_4px_0_0_#f59e0b]';
                   nameSize = 'text-lg text-amber-400';
                   ratingSize = 'text-3xl text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]';
                   numberBox = 'w-10 h-10 text-lg';
                } else if (isSecond) {
                   rankColor = 'text-slate-200 bg-slate-400/20 border-slate-400/50';
                   borderGlow = 'border-slate-500/30 bg-gradient-to-r from-slate-400/10 to-transparent shadow-[inset_4px_0_0_#94a3b8]';
                   nameSize = 'text-base text-slate-200';
                   ratingSize = 'text-2xl text-slate-200';
                   numberBox = 'w-9 h-9 text-base';
                } else if (isThird) {
                   rankColor = 'text-orange-400 bg-orange-900/30 border-orange-700/50';
                   borderGlow = 'border-orange-900/50 bg-gradient-to-r from-orange-900/20 to-transparent shadow-[inset_4px_0_0_#c2410c]';
                   nameSize = 'text-sm text-orange-200';
                   ratingSize = 'text-xl text-orange-400';
                   numberBox = 'w-8 h-8 text-sm';
                }

                return (
                   <div key={player.name} className={`flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all border ${borderGlow}`}>
                      <div className="flex items-center gap-4 flex-1 pr-4">
                         <div className={`flex items-center justify-center rounded-xl border-2 font-black italic shrink-0 ${numberBox} ${rankColor}`}>
                            {idx + 1}
                         </div>
                         <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                               <span className={`text-[8px] px-1.5 py-0.5 rounded border bg-black/50 ${isFirst ? 'border-amber-500/30 text-amber-500' : 'border-white/10 text-slate-400'}`}>
                                  {String(player.role).replace(/jug/i, 'JNG')}
                               </span>
                               {player.streak.includes('FIRE') && (
                                  <span className="text-[7px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded animate-pulse border border-red-500/30 font-black">
                                     ON FIRE
                                  </span>
                               )}
                            </div>
                            <span className={`${nameSize} break-words font-black uppercase tracking-tighter leading-none`}>
                               {player.name}
                            </span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                         <span className="text-[7px] text-slate-500 tracking-[0.3em] mb-1">RATING</span>
                         <span className={`${ratingSize} font-black italic leading-none`}>{player.rating}</span>
                      </div>
                   </div>
                );
             }) : <p className="text-[10px] text-slate-600 text-center py-10">SEM DADOS NO FILTRO.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8">
        <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative flex flex-col min-h-[350px] overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-20 group-hover:opacity-100 transition-all"></div>
           <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4 shrink-0">
              <div><h3 className="text-xl text-white italic">VOD Review Queue</h3><p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">PENDING TASKS</p></div>
              <div className="text-[10px] text-amber-500 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg">{vodTasks.filter(t => !t.is_done).length} PENDING</div>
           </div>
           <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
              {vodTasks.map((task) => (
                  <div key={task.id} onClick={() => toggleTask(task.id, task.is_done)} className={`p-4 rounded-2xl border transition-all ${isStaff ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'} flex gap-4 items-start ${task.is_done ? 'opacity-40' : 'bg-white/[0.02] border-white/10'}`}>
                     <div className={`w-5 h-5 shrink-0 rounded-md border-2 mt-0.5 flex items-center justify-center ${task.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>{task.is_done && <span className="text-white text-[10px]">✓</span>}</div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2"><span className={`text-[8px] px-2 py-0.5 rounded-md border ${task.tag === 'URGENTE' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'} tracking-widest`}>{task.tag}</span></div>
                        <p className={`text-xs text-white leading-snug ${task.is_done ? 'line-through' : ''}`}>{task.task_text}</p>
                     </div>
                  </div>
              ))}
           </div>
           {isStaff && <button onClick={() => setVodModalOpen(true)} className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-slate-500 text-[10px] hover:text-white transition-all">+ ADICIONAR TAREFA</button>}
        </div>

        {/* --- NOVOS STAT CARDS COM WR POR LADO E FILTROS DINÂMICOS --- */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <StatCard label="WR Blue Side" value={`${stats.blueWR}%`} color="text-blue-400" sub={`${stats.blueWins}V - ${stats.blueTotal - stats.blueWins}D`} icon="🛡️" />
          <StatCard label="WR Red Side" value={`${stats.redWR}%`} color="text-red-400" sub={`${stats.redWins}V - ${stats.redTotal - stats.redWins}D`} icon="⚔️" />
          
          <div className="col-span-2 grid grid-cols-2 gap-4">
             <StatCard label="Avg Duration" value={`${stats.avgDuration}m`} color="text-emerald-400" sub={`Em ${stats.totalGames} jogos`} icon="⏱️" />
             <StatCard label="Gold Diff @12" value={`${stats.avgGold12 > 0 ? '+' : ''}${stats.avgGold12}`} color={stats.avgGold12 >= 0 ? 'text-amber-400' : 'text-red-400'} sub="Early Rating" icon="💰" />
          </div>
        </div>
      </div>

      <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative w-full mt-8 overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-20 group-hover:opacity-100 transition-all"></div>
         <h3 className="text-xl text-white italic mb-8 border-b border-white/5 pb-4">Advanced Scrim Report</h3>
         <div className="overflow-x-auto custom-scrollbar pb-4 max-h-[400px]">
            <table className="w-full text-left border-separate border-spacing-y-3 min-w-[800px]">
               <thead className="sticky top-0 bg-[#121212] z-10 text-[9px] text-slate-600 tracking-[0.2em] uppercase">
                 <tr><th className="px-4 pb-2">DATA / OPONENTE</th><th className="px-4 pb-2 text-center">RES / PLACAR</th><th className="px-4 pb-2 text-center">MODO / COMP TESTADA</th><th className="px-4 pb-2 text-center">DIFICULDADE</th><th className="px-4 pb-2 text-center">PONTUALIDADE</th><th className="px-4 pb-2 text-center">REMAKES</th></tr>
               </thead>
               <tbody>
                 {advancedScrims.length > 0 ? advancedScrims.map((scrim) => (
                   <tr key={scrim.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all group/row text-[10px]">
                     <td className="p-4 rounded-l-2xl"><div className="flex items-center gap-4"><img src={getTeamLogo(scrim.opponent)} className="w-11 h-11 object-contain shrink-0" /><div className="flex flex-col"><span className="text-blue-400 tracking-widest">{formatDate(scrim.date)}</span><span className="text-white text-lg font-black leading-none">VS {scrim.opponent}</span></div></div></td>
                     <td className="p-4 text-center"><div className="flex flex-col items-center"><span className={`text-xl font-black italic ${scrim.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{scrim.result}</span><span className="text-white font-black">{scrim.score}</span></div></td>
                     <td className="p-4 text-center"><div className="flex flex-col items-center"><span className="bg-white/5 px-2 py-0.5 rounded border border-white/10 mb-1">{scrim.mode}</span><span className="text-slate-400">{scrim.comp}</span></div></td>
                     <td className="p-4 text-center"><span className={`px-3 py-1.5 rounded-lg border font-black ${getDifficultyColor(scrim.difficulty)}`}>{scrim.difficulty}</span></td>
                     <td className="p-4 text-center"><span className={`px-3 py-1 rounded border ${getPunctualityColor(scrim.punctuality)}`}>{scrim.punctuality}</span></td>
                     <td className="p-4 text-center rounded-r-2xl relative"><span className={`font-black ${scrim.remakes > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{scrim.remakes} RMK</span>
                        {isStaff && <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-2 bg-[#121212]/90 p-2 rounded-xl border border-white/10"><button onClick={() => { setEditScrimId(scrim.isManual ? scrim.id : null); setScrimForm({ date: scrim.date, opponent: scrim.opponent, result: scrim.result, score: scrim.score, mode: scrim.mode, comp: scrim.comp, difficulty: scrim.difficulty, punctuality: scrim.punctuality, remakes: scrim.remakes, match_ids: '' }); setScrimModalOpen(true); }} className="text-blue-400 hover:text-white px-3 py-1 bg-blue-500/10 rounded">LOGAR DETALHES</button></div>}
                     </td>
                   </tr>
                 )) : <tr><td colSpan={6} className="text-center py-6 text-slate-600">NENHUMA SCRIM LOGADA.</td></tr>}
               </tbody>
            </table>
         </div>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleUpdateProfile} className="w-full max-w-md bg-[#121212] border border-blue-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl relative">
            <h2 className="text-3xl font-black text-white italic text-center">EDITAR PERFIL</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] text-slate-500 ml-2">Nickname</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic focus:border-blue-500 outline-none" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} /></div>
              <div><label className="text-[10px] text-slate-500 ml-2">URL da Foto</label><input type="url" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic focus:border-blue-500 outline-none" value={profileForm.photo_url} onChange={e => setProfileForm({...profileForm, photo_url: e.target.value})} /></div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setProfileModalOpen(false)} className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
              <button type="submit" className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-500">SALVAR</button>
            </div>
          </form>
        </div>
      )}

      {isMissionModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveMission} className="w-full max-w-xl bg-[#121212] border border-blue-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
            <div className="text-center mb-8"><h2 className="text-3xl italic font-black text-white">{editMissionId ? "EDITAR EVENTO" : "NOVO EVENTO"}</h2></div>
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                 {missionForm.opponent && <img src={getTeamLogo(missionForm.opponent)} className="w-14 h-14 rounded-2xl border border-blue-500/30 object-contain" />}
                 <div className="flex-1"><label className="text-[10px] text-slate-500 ml-2">Adversário</label><select required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic focus:border-blue-500 outline-none" value={missionForm.opponent} onChange={e => setMissionForm({...missionForm, opponent: e.target.value})}>{teamsList.map(t => <option key={t.acronym} value={t.acronym}>{t.name} ({t.acronym})</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] text-slate-500 ml-2">Data</label><input type="date" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic" value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} /></div>
                <div><label className="text-[10px] text-slate-500 ml-2">Hora</label><input type="time" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic" value={missionForm.time} onChange={e => setMissionForm({...missionForm, time: e.target.value})} /></div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'SCRIM'})} className={`flex-1 py-4 rounded-xl border-2 font-black ${missionForm.type === 'SCRIM' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/50 border-white/5 text-slate-500'}`}>SCRIM</button>
                <button type="button" onClick={() => setMissionForm({...missionForm, type: 'OFFICIAL'})} className={`flex-1 py-4 rounded-xl border-2 font-black ${missionForm.type === 'OFFICIAL' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/50 border-white/5 text-slate-500'}`}>OFICIAL</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select className="bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic" value={missionForm.gamesCount} onChange={e => setMissionForm({...missionForm, gamesCount: e.target.value})}><option value="1 JOGO">1 JOGO</option><option value="2 JOGOS">2 JOGOS</option><option value="3 JOGOS">3 JOGOS</option><option value="4 JOGOS">4 JOGOS</option><option value="5 JOGOS">5 JOGOS</option></select>
                <select className="bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic" value={missionForm.draftMode} onChange={e => setMissionForm({...missionForm, draftMode: e.target.value})}><option value="PADRÃO">PADRÃO</option><option value="FEARLESS">FEARLESS</option><option value="MISTO">MISTO</option></select>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              {editMissionId && <button type="button" onClick={() => handleDeleteMission(editMissionId)} className="px-6 py-4 bg-red-600/10 text-red-500 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition-all">EXCLUIR</button>}
              <button type="button" onClick={() => setMissionModalOpen(false)} className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
              <button type="submit" className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-500">SALVAR MISSÃO</button>
            </div>
          </form>
        </div>
      )}

      {isMetricsModalOpen && isStaff && (
         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
            <form onSubmit={handleSaveMetrics} className="w-full max-w-2xl bg-[#121212] border border-blue-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl relative my-auto">
               <h2 className="text-3xl font-black text-white italic text-center">STAFF TACTICAL SYNC</h2>
               <div className="flex flex-col gap-6">
                  <div>
                     <label className="text-[10px] text-slate-500">Data do Log</label>
                     <input type="date" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic outline-none mt-1" value={metricsForm.date} onChange={e => setMetricsForm({...metricsForm, date: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-6">
                     <div><label className="text-[10px] text-slate-500">Estresse do Time (0-100)</label><input type="number" min="0" max="100" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-pink-500 font-black italic outline-none mt-1" value={metricsForm.stress} onChange={e => setMetricsForm({...metricsForm, stress: Number(e.target.value)})} /></div>
                     <div><label className="text-[10px] text-slate-500">Carga Cognitiva (0-100)</label><input type="number" min="0" max="100" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-[#8b5cf6] font-black italic outline-none mt-1" value={metricsForm.load} onChange={e => setMetricsForm({...metricsForm, load: Number(e.target.value)})} /></div>
                  </div>
                  <div>
                     <label className="text-[10px] text-slate-500 block mb-2 uppercase tracking-widest text-center">Proporção de Eficiência (O ideal é somar 100 em cada linha)</label>
                     <div className="grid grid-cols-4 gap-2 items-center text-center">
                        <span className="text-[10px] text-slate-600 font-black">FASE</span>
                        <span className="text-[10px] text-cyan-400 font-black">MICRO</span>
                        <span className="text-[10px] text-blue-500 font-black">MACRO</span>
                        <span className="text-[10px] text-[#8b5cf6] font-black">TEAMFIGHT</span>
                     </div>
                     <div className="grid grid-cols-4 gap-2 mt-2 items-center">
                        <span className="text-[10px] text-slate-400 font-black text-center">EARLY</span>
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.early_micro} onChange={e => setMetricsForm({...metricsForm, early_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.early_macro} onChange={e => setMetricsForm({...metricsForm, early_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.early_tf} onChange={e => setMetricsForm({...metricsForm, early_tf: Number(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-4 gap-2 mt-2 items-center">
                        <span className="text-[10px] text-slate-400 font-black text-center">MID</span>
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.mid_micro} onChange={e => setMetricsForm({...metricsForm, mid_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.mid_macro} onChange={e => setMetricsForm({...metricsForm, mid_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.mid_tf} onChange={e => setMetricsForm({...metricsForm, mid_tf: Number(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-4 gap-2 mt-2 items-center">
                        <span className="text-[10px] text-slate-400 font-black text-center">LATE</span>
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.late_micro} onChange={e => setMetricsForm({...metricsForm, late_micro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.late_macro} onChange={e => setMetricsForm({...metricsForm, late_macro: Number(e.target.value)})} />
                        <input type="number" min="0" max="100" className="bg-black border border-white/10 rounded-lg p-3 text-center text-white" value={metricsForm.late_tf} onChange={e => setMetricsForm({...metricsForm, late_tf: Number(e.target.value)})} />
                     </div>
                  </div>
               </div>
               <div className="flex gap-4 pt-4 border-t border-white/5">
                 <button type="button" onClick={() => setMetricsModalOpen(false)} className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
                 <button type="submit" className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-500 tracking-widest uppercase">SALVAR MÉTRICAS DO DIA</button>
               </div>
            </form>
         </div>
      )}

      {isScrimModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSaveScrim} className="w-full max-w-xl bg-[#121212] border border-white/20 rounded-[40px] p-8 space-y-6 shadow-2xl my-auto relative">
            <h2 className="text-3xl italic font-black text-white text-center mb-6">LOG SCRIM DETAILS</h2>
            <div className="space-y-4">
               <div><label className="text-[10px] text-slate-500 ml-2">Comp Testada (Foco Geral)</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic outline-none" value={scrimForm.comp} onChange={e => setScrimForm({...scrimForm, comp: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] text-slate-500 ml-2">Dificuldade</label><select value={scrimForm.difficulty} onChange={e => setScrimForm({...scrimForm, difficulty: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic outline-none"><option value="STOMPAMOS">Stompamos</option><option value="MUITO FÁCIL">Muito Fácil</option><option value="FÁCIL">Fácil</option><option value="CONTROLADO">Controlado</option><option value="DIFÍCIL">Difícil</option><option value="MT DIFÍCIL">Muito Difícil</option><option value="STOMPADOS">Stompados</option></select></div>
                  <div><label className="text-[10px] text-slate-500 ml-2">Pontualidade</label><select value={scrimForm.punctuality} onChange={e => setScrimForm({...scrimForm, punctuality: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic outline-none"><option value="PONTUAIS">Pontuais (Ambos)</option><option value="NOSSO ATRASO">Nosso Atraso</option><option value="ATRASO DELES">Atraso Deles</option><option value="DESMARCARAM NA HORA">Desmarcaram</option></select></div>
               </div>
               <div>
                  <label className="text-[10px] text-slate-500 ml-2">Remakes (Problemas Técnicos/Draft)</label>
                  <div className="flex gap-2 mt-1">{[0, 1, 2, 3].map(num => (<button key={num} type="button" onClick={() => setScrimForm({...scrimForm, remakes: num})} className={`flex-1 py-4 rounded-xl border-2 font-black ${scrimForm.remakes === num ? 'bg-white text-black border-white' : 'bg-black/50 border-white/5 text-slate-500'}`}>{num}</button>))}</div>
               </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-white/5">
              <button type="button" onClick={() => setScrimModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-white text-black rounded-2xl font-black text-xs hover:bg-gray-200">SALVAR DETALHES</button>
            </div>
          </form>
        </div>
      )}

      {isVodModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleAddVodTask} className="w-full max-w-xl bg-[#121212] border border-amber-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
            <h2 className="text-3xl italic font-black text-white text-center mb-6">NOVA TAREFA VOD</h2>
            <div className="space-y-4">
              <select className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic" value={vodForm.tag} onChange={e => setVodForm({...vodForm, tag: e.target.value})}><option value="MACRO">MACRO</option><option value="MICRO">MICRO</option><option value="DRAFT">DRAFT</option><option value="URGENTE">URGENTE</option></select>
              <textarea required rows={3} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic focus:border-amber-500 outline-none" placeholder="O que analisar..." value={vodForm.text} onChange={e => setVodForm({...vodForm, text: e.target.value})} />
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setVodModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-amber-500 text-black rounded-2xl font-black text-xs hover:bg-amber-400">ADICIONAR TAREFA</button>
            </div>
          </form>
        </div>
      )}

      {isWellnessModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleWellnessSubmit} className="w-full max-w-2xl bg-[#121212] border border-emerald-500/20 rounded-[40px] p-8 space-y-8 shadow-2xl">
            <h2 className="text-3xl italic font-black text-white text-center">DAILY READINESS SYNC</h2>
            <div className="space-y-4 mb-4"><select value={wellnessForm.puuid} disabled={!isStaff} onChange={e => setWellnessForm({...wellnessForm, puuid: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic outline-none disabled:opacity-50">{roster.map(p => <option key={p.puuid} value={p.puuid}>{p.nickname} ({p.primary_role})</option>)}</select></div>
            <div className="space-y-8">
               <WellnessInput icon="💤" title="Qualidade do Sono" desc="1 = Insônia/Péssimo | 5 = Recuperação Total" value={wellnessForm.sleep} onChange={(v: any) => setWellnessForm({...wellnessForm, sleep: v})} />
               <WellnessInput icon="🧠" title="Estado Mental & Stress" desc="1 = Tiltado/Esgotado | 5 = Foco Total/Calmo" value={wellnessForm.mental} onChange={(v: any) => setWellnessForm({...wellnessForm, mental: v})} />
               <WellnessInput icon="🦾" title="Dores & Fadiga Física" desc="1 = Dor forte | 5 = Zero Dor/Pronto" value={wellnessForm.physical} onChange={(v: any) => setWellnessForm({...wellnessForm, physical: v})} />
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setWellnessModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black text-xs hover:bg-white/10">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-500">SINCRONIZAR DADOS</button>
            </div>
          </form>
        </div>
      )}

      {wellnessHistoryModal.isOpen && wellnessHistoryModal.player && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#121212] border border-white/10 rounded-[40px] p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4"><img src={wellnessHistoryModal.player.photo} className="w-12 h-12 rounded-full border-2 border-emerald-500/30 object-cover" /><div><h2 className="text-2xl italic font-black text-white">{wellnessHistoryModal.player.name}</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-1 uppercase">HISTÓRICO BIOMÉTRICO</p></div></div>
               <button onClick={() => setWellnessHistoryModal({ isOpen: false, player: null, history: [] })} className="text-slate-500 hover:text-white text-2xl font-black">&times;</button>
            </div>
            <div className="overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
               <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-[#121212] z-10"><tr className="text-[9px] text-slate-600 tracking-[0.2em] uppercase"><th className="px-4 pb-2">DATA</th><th className="px-4 pb-2 text-center">READINESS</th><th className="px-4 pb-2 text-center">SONO</th><th className="px-4 pb-2 text-center">MENTAL</th><th className="px-4 pb-2 text-center">FÍSICO</th></tr></thead>
                  <tbody>
                    {wellnessHistoryModal.history.map((record: any) => (
                      <tr key={record.record_date} className="bg-white/[0.02] hover:bg-white/[0.05]">
                        <td className="p-4 rounded-l-2xl text-[10px] font-black text-slate-300 tracking-widest">{formatDate(record.record_date)}</td>
                        <td className="p-4 text-center"><span className={`text-sm font-black italic ${record.readiness_percent < 65 ? 'text-red-400' : record.readiness_percent > 85 ? 'text-emerald-400' : 'text-yellow-400'}`}>{record.readiness_percent}%</span></td>
                        <td className="p-4 text-center text-xs text-white font-black">{record.sleep_score}</td>
                        <td className="p-4 text-center text-xs text-white font-black">{record.mental_score}</td>
                        <td className="p-4 text-center text-xs text-white font-black rounded-r-2xl">{record.physical_score}</td>
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

// --- SUB-COMPONENTES ---
function StatCard({ label, value, color, sub, icon }: any) {
  return (
    <div className="bg-[#121212] border border-white/5 p-8 rounded-[40px] hover:border-white/20 transition-all shadow-xl relative overflow-hidden group h-full">
      <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 group-hover:scale-110 grayscale transition-all">{icon}</div>
      <div className="relative z-10 flex flex-col justify-center h-full">
        <p className="text-[10px] text-slate-500 tracking-[0.3em] mb-2 uppercase font-black">{label}</p>
        <p className={`text-5xl font-black italic leading-none mb-3 ${color}`}>{value}</p>
        <p className="text-[9px] text-slate-600 tracking-widest uppercase font-black">{sub}</p>
      </div>
    </div>
  );
}

function Badge({ text, color }: { text: string, color: string }) {
  return <span className={`${color} text-white text-[9px] px-3 py-1 rounded-full border border-white/10 shadow-lg tracking-widest uppercase font-black`}>{text}</span>;
}

function WellnessBar({ label, value }: { label: string, value: number }) {
  const color = value <= 2 ? 'bg-red-500' : value === 3 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[7px] text-slate-500 w-10 text-right font-black">{label}</span>
      <div className="flex gap-1 flex-1">{[1, 2, 3, 4, 5].map((level) => (<div key={level} className={`h-1.5 flex-1 rounded-sm ${level <= value ? color : 'bg-white/5'}`}></div>))}</div>
    </div>
  );
}

function MiniStatBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[8px] text-slate-500 tracking-widest uppercase w-16 truncate font-black">{label}</span>
      <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden border border-white/5 relative">
         <div className={`absolute top-0 left-0 h-full ${color} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
      </div>
      <span className="text-[9px] font-black text-white w-6 text-right">{value}</span>
    </div>
  );
}

function WellnessInput({ icon, title, desc, value, onChange }: any) {
  return (
    <div>
       <div className="flex items-center gap-3 mb-3"><span className="text-xl">{icon}</span><div><p className="text-sm text-white font-black italic leading-none">{title}</p><p className="text-[8px] text-slate-500 tracking-widest mt-1">{desc}</p></div></div>
       <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((num) => {
            const isActive = value === num; const isDanger = num <= 2; const isMid = num === 3;
            const activeColor = isDanger ? 'bg-red-600 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : isMid ? 'bg-yellow-600 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'bg-emerald-600 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
            return (<button key={num} type="button" onClick={() => onChange(num)} className={`flex-1 py-4 rounded-xl border-2 text-lg font-black transition-all ${isActive ? `${activeColor} text-white` : 'bg-black/50 border-white/5 text-slate-600'}`}>{num}</button>);
          })}
       </div>
    </div>
  );
}