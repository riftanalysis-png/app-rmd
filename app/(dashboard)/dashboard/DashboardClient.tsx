// app/(dashboard)/dashboard-v2/DashboardClient.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client'; 
import { Shield, Moon, Brain, Activity, Plus } from 'lucide-react'; 

import DashboardFilters from './components/DashboardFilters'; 
import TopCockpit from './components/TopCockpit';
import AgendaCalendar from './components/AgendaCalendar';
import TargetIntel from './components/TargetIntel';
import SquadReadiness from './components/SquadReadiness';
import MatchupAnalytics from './components/MatchupAnalytics';
import TacticalMetrics from './components/TacticalMetrics';
import AdvancedLogs from './components/AdvancedLogs';

// --- FUNÇÕES UTILITÁRIAS GLOBAIS ---
function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

const getCurrentSplit = () => {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month >= 1 && month <= 5) return { id: `SPLIT 1 ${year}`, start: `${year}-01-01`, end: `${year}-05-31` };
  if (month >= 6 && month <= 11) return { id: `SPLIT 2 ${year}`, start: `${year}-06-01`, end: `${year}-11-30` };
  return { id: `OFF-SEASON ${year}`, start: `${year}-12-01`, end: `${year}-12-31` };
};

interface DashboardClientProps {
  sessionUser: any;
  squadConfig: any;
  playerStats: any[];
  radarStats: any[];
  h2hStats: any[];
  roster: any[];
  teams: any[];
  rawMatches: any[];
  rawMissions: any[];
  rawScrims: any[];
  teamWellness: any[];
}

export default function DashboardClient(props: DashboardClientProps) {
  // --- ESTADOS GLOBAIS DE FILTRO ---
  const currentSplitObj = getCurrentSplit();
  const [matchType, setMatchType] = useState<'ALL' | 'OFICIAL' | 'SCRIM'>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState(currentSplitObj.id);
  const [filterStartDate, setFilterStartDate] = useState(currentSplitObj.start);
  const [filterEndDate, setFilterEndDate] = useState(currentSplitObj.end);
  const [filterPatch, setFilterPatch] = useState('');
  
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

  // --- ESTADOS DE DADOS MUTÁVEIS (Permite CRUD na tela) ---
  const [missionsRaw, setMissionsRaw] = useState<any[]>(props.rawMissions || []);
  const [scrimReportsManual, setScrimReportsManual] = useState<any[]>(props.rawScrims || []);
  const [teamStatsRaw, setTeamStatsRaw] = useState<any[]>([]);
  const [playerStatsRaw, setPlayerStatsRaw] = useState<any[]>([]); 
  const [wellnessDataRaw, setWellnessDataRaw] = useState<any[]>(props.teamWellness || []);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [nextTargetIntel, setNextTargetIntel] = useState({ team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [], date: null });
  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');

  // --- ESTADOS DOS MODAIS (Agenda, Logs e Wellness) ---
  const [isMissionModalOpen, setMissionModalOpen] = useState(false);
  const [isScrimModalOpen, setScrimModalOpen] = useState(false);
  const [isWellnessModalOpen, setWellnessModalOpen] = useState(false);
  
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [editScrimId, setEditScrimId] = useState<string | null>(null);
  
  const [missionForm, setMissionForm] = useState({ date: '', time: '', opponent: '', customOpponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' });
  const [scrimForm, setScrimForm] = useState({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
  const [wellnessForm, setWellnessForm] = useState({ puuid: '', sleep: 3, mental: 3, physical: 3 });

  const myTeamTag = props.squadConfig?.my_team_tag?.toUpperCase() || 'RMD';
  const isStaff = ['analista', 'treinador', 'diretor', 'coach', 'head coach'].includes(String(props.sessionUser?.role || '').toLowerCase());

  // --- O GRANDE FILTRO DA EQUIPE ---
  const myTeamMatches = useMemo(() => {
    return props.rawMatches.filter((m: any) => {
      const b = String(m.blue_team_tag || '').toUpperCase();
      const r = String(m.red_team_tag || '').toUpperCase();
      return b.includes(myTeamTag) || r.includes(myTeamTag);
    });
  }, [props.rawMatches, myTeamTag]);

  const calendarMatches = useMemo(() => {
    return myTeamMatches.filter(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      if (matchType === 'SCRIM' && !isScrim) return false;
      if (matchType === 'OFICIAL' && isScrim) return false;
      if (filterPatch && m.patch && !String(m.patch).includes(filterPatch)) return false;
      return true;
    });
  }, [myTeamMatches, matchType, filterPatch]);

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

  // Recupera as estatísticas vitais do Hub
  useEffect(() => {
    async function fetchMissingStats() {
         const activeMatchIds = myTeamMatches.map((m: any) => String(m.match_id || m.id)).slice(0, 200);
         if (activeMatchIds.length > 0) {
             // 1. Busca os stats do time (Radar, Snowball, etc)
             const { data: teamData } = await supabase.from('bff_dashboard_team_stats')
                 .select('*')
                 .in('match_id', activeMatchIds);
             if (teamData) setTeamStatsRaw(teamData);

             // 2. Busca os stats individuais (Para o Gráfico de Evolução do Squad Readiness)
             const { data: playerData } = await supabase.from('bff_player_matches')
                 .select('match_id, puuid, lane_rating, impact_rating, conversion_rating, vision_rating, perf_score')
                 .in('match_id', activeMatchIds);
             if (playerData) setPlayerStatsRaw(playerData);
         }
    }
    if (myTeamMatches.length > 0) fetchMissingStats();
  }, [myTeamMatches]);

  // --- 1. LÓGICA DE MATCHUPS ---
  const opponentStatsData = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? String(m.red_team_tag) : String(m.blue_team_tag);
      const oppKey = opp.toUpperCase() || 'UNKNOWN';

      if (!stats[oppKey]) stats[oppKey] = { opponent: oppKey, wins: 0, losses: 0, total: 0 };
      
      const rawWinner = String(m.winner_side || '').toLowerCase();
      const isOurWin = (weAreBlue && (rawWinner === 'blue' || rawWinner === '100')) || (!weAreBlue && (rawWinner === 'red' || rawWinner === '200'));

      stats[oppKey].total++;
      if (isOurWin) stats[oppKey].wins++;
      else stats[oppKey].losses++;
    });

    return Object.values(stats)
      .map((s: any) => ({ ...s, winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0 }))
      .sort((a: any, b: any) => b.total - a.total);
  }, [filteredMatches, myTeamTag]);

  // Adicione isso no DashboardClient.tsx
  const currentTargetH2H = useMemo(() => {
       if (nextTargetIntel.team === 'SEM ALVO') return null;
       return opponentStatsData.find((s: any) => s.opponent === nextTargetIntel.team) || { wins: 0, losses: 0, total: 0 };
  }, [opponentStatsData, nextTargetIntel.team]);

  const championshipStatsData = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredMatches.forEach(m => {
      const weAreBlue = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? String(m.red_team_tag) : String(m.blue_team_tag);
      const oppKey = opp.toUpperCase() || 'UNKNOWN';

      const teamObj = props.teams.find((t: any) => String(t.acronym).toUpperCase() === oppKey);
      const region = teamObj ? String(teamObj.tier || teamObj.league || teamObj.region || 'OUTROS').toUpperCase() : 'OUTROS';

      if (!stats[region]) stats[region] = 0;
      stats[region]++;
    });

    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredMatches, myTeamTag, props.teams]);

  // --- 2. LÓGICA DA BIOMETRIA ---
  const teamWellnessData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return props.roster.map((p: any) => {
      const pRecs = wellnessDataRaw.filter((w: any) => String(w.puuid).toLowerCase() === String(p.puuid).toLowerCase());
      const lRec = pRecs.length > 0 ? pRecs[0] : null;
      return {
        puuid: p.puuid,
        name: p.nickname || p.name,
        role: p.primary_role || p.role,
        photo: p.photo_url || p.photo,
        score: lRec ? lRec.readiness_percent : 0,
        sleep: lRec ? lRec.sleep_score : 0,
        mental: lRec ? lRec.mental_score : 0,
        physical: lRec ? lRec.physical_score : 0,
        hasAnsweredToday: !!(lRec && lRec.record_date === todayStr),
        history: pRecs
      };
    });
  }, [props.roster, wellnessDataRaw]);

  // --- 3. LÓGICA DOS GRÁFICOS TÁTICOS ---
  const earlyGameSnowball = useMemo(() => {
    const recentMatches = [...filteredMatches].slice(0, 10).reverse();
    return recentMatches.map((m, index) => {
      const weAreBlue = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? m.red_team_tag : m.blue_team_tag;
      const fullOpp = opp ? String(opp).toUpperCase() : 'UNKNOWN';
      const oppKey = fullOpp.substring(0, 4);

      const tStat = teamStatsRaw.find(s => String(s.match_id) === String(m.match_id || m.id) && String(s.team_acronym).toUpperCase().includes(myTeamTag));
      const goldDiff = tStat ? (Number(tStat.gold_diff_at_12) || 0) : 0;

      const rawWinner = String(m.winner_side || '').toLowerCase();
      const isOurWin = (weAreBlue && (rawWinner === 'blue' || rawWinner === '100')) || (!weAreBlue && (rawWinner === 'red' || rawWinner === '200'));

      let dateFormatted = '';
      if (m.game_start_time) {
          const d = new Date(String(m.game_start_time).replace(' ', 'T'));
          if (!isNaN(d.getTime())) dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      return { uniqueKey: `eg_${index}`, match: oppKey, fullOpponent: fullOpp, date: dateFormatted, goldDiff, isWin: isOurWin };
    });
  }, [filteredMatches, teamStatsRaw, myTeamTag]);

  const radarData = useMemo<any[]>(() => {
    const calcAvg = (matchesSet: Set<string>, getOp: boolean = false) => {
       const filtered = teamStatsRaw.filter(s => matchesSet.has(String(s.match_id)) && (getOp ? !String(s.team_acronym).toUpperCase().includes(myTeamTag) : String(s.team_acronym).toUpperCase().includes(myTeamTag)));
       if (!filtered.length) return { l: 0, i: 0, c: 0, v: 0, o: 0 };
       
       const l = filtered.reduce((a,b)=>a+(Number(b.avg_lane)||0),0)/filtered.length;
       const i = filtered.reduce((a,b)=>a+(Number(b.avg_impact)||0),0)/filtered.length;
       const c = filtered.reduce((a,b)=>a+(Number(b.avg_conversion)||0),0)/filtered.length;
       const v = filtered.reduce((a,b)=>a+(Number(b.avg_vision)||0),0)/filtered.length;
       return { l: Math.round(l), i: Math.round(i), c: Math.round(c), v: Math.round(v), o: Math.round((l+i+c+v)/4) };
    };

    if (radarCompareMode === 'OFFICIAL_VS_SCRIM') {
       const offIds = new Set<string>(filteredMatches.filter(m => !String(m.game_type || '').toUpperCase().includes('SCRIM')).map((m: any) => String(m.match_id || m.id)));
       const scrimIds = new Set<string>(filteredMatches.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).map((m: any) => String(m.match_id || m.id)));
       const offStats = calcAvg(offIds, false); const scrimStats = calcAvg(scrimIds, false);
       return [
         { subject: 'Lane Dom.', Oficial: offStats.l, Scrim: scrimStats.l }, 
         { subject: 'Impact', Oficial: offStats.i, Scrim: scrimStats.i }, 
         { subject: 'Conversion', Oficial: offStats.c, Scrim: scrimStats.c }, 
         { subject: 'Vision', Oficial: offStats.v, Scrim: scrimStats.v }, 
         { subject: 'Overall', Oficial: offStats.o, Scrim: scrimStats.o }
       ];
    } else {
       const activeIds = new Set<string>(filteredMatches.map((m: any) => String(m.match_id || m.id)));
       const usStats = calcAvg(activeIds, false); const oppStats = calcAvg(activeIds, true);
       return [
         { subject: 'Lane Dom.', [myTeamTag]: usStats.l, Oponentes: oppStats.l }, 
         { subject: 'Impact', [myTeamTag]: usStats.i, Oponentes: oppStats.i }, 
         { subject: 'Conversion', [myTeamTag]: usStats.c, Oponentes: oppStats.c }, 
         { subject: 'Vision', [myTeamTag]: usStats.v, Oponentes: oppStats.v }, 
         { subject: 'Overall', [myTeamTag]: usStats.o, Oponentes: oppStats.o }
       ];
    }
  }, [radarCompareMode, teamStatsRaw, filteredMatches, myTeamTag]);

  // --- 4. LÓGICA DA AGENDA E LOGS ---
  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    calendarMatches.forEach(m => {
      const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
      const weAreBlue = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag);
      const opp = weAreBlue ? m.red_team_tag : m.blue_team_tag;
      
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

  const getTeamLogo = (acronym: string) => { 
      const t = props.teams.find((t: any) => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
      return t?.logo_url || null; 
  };

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const grid = [];
    for(let i = firstDayIndex - 1; i >= 0; i--) { grid.push({ day: daysInPrevMonth - i, isGhost: true, events: [] }); }
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const manualPastEvents = scrimReportsManual.filter(s => s.scrim_date === dateStr).map(s => {
            const autoMatch = groupedSeries.find(g => g.calendarDate === dateStr && String(g.opp).toUpperCase() === String(s.opponent_acronym).toUpperCase());
            return { id: s.id, time: autoMatch ? autoMatch.time : 'MANUAL', opp: s.opponent_acronym, type: 'SCRIM', resultText: `${s.score} ${s.result}`, isWin: s.result === 'W', isPast: true, isAuto: false, logo: getTeamLogo(s.opponent_acronym), rawScrim: s };
        });

        const pastEvents = groupedSeries.filter(g => g.calendarDate === dateStr).map(g => {
            const isOverridden = scrimReportsManual.some(s => s.scrim_date === dateStr && String(s.opponent_acronym).toUpperCase() === String(g.opp).toUpperCase());
            if (isOverridden) return null; 
            return { id: g.id, time: g.time, opp: g.opp, type: g.isScrim ? 'SCRIM' : 'OFICIAL', resultText: `${g.ourWins} - ${g.theirWins} ${g.ourWins > g.theirWins ? 'W' : g.theirWins > g.ourWins ? 'L' : 'D'}`, isWin: g.ourWins > g.theirWins, isPast: true, isAuto: true, logo: getTeamLogo(String(g.opp)) };
        }).filter(Boolean); 

        const allPastEvents = [...pastEvents, ...manualPastEvents];
        const opponentsPlayedToday = allPastEvents.map(ev => String(ev.opp).toUpperCase().trim());

        const futureEvents = missionsRaw.filter(m => m.mission_date === dateStr).map(m => {
            const info = m.status ? m.status.split('|') : [];
            return { id: m.id, time: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', opp: m.opponent_acronym, type: m.mission_type, mode: info[1] ? info[1].trim() : 'TBD', isPast: false, isAuto: false, rawMission: m, logo: getTeamLogo(String(m.opponent_acronym)) };
        }).filter(mission => !opponentsPlayedToday.some(playedOpp => playedOpp.includes(String(mission.opp).toUpperCase().trim()) || String(mission.opp).toUpperCase().trim().includes(playedOpp)));

        grid.push({ day: i, dateStr, isToday: dateStr === new Date().toISOString().split('T')[0], events: [...allPastEvents, ...futureEvents].sort((a: any, b: any) => a.time.localeCompare(b.time)), isGhost: false });
    }
    
    let nextMonthDay = 1;
    while(grid.length % 7 !== 0) { grid.push({ day: nextMonthDay++, isGhost: true, events: [] }); }
    return grid;
  }, [currentDate, groupedSeries, missionsRaw, scrimReportsManual, props.teams]);

  const advancedScrims = useMemo(() => {
    const autoScrimBlocks = new Map();
    filteredMatches.filter(m => String(m.game_type || '').toUpperCase().includes('SCRIM')).forEach(m => {
       const d = new Date(String(m.game_start_time).replace(' ', 'T'));
       if (!isNaN(d.getTime())) d.setHours(d.getHours() - 6);
       const dateRaw = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       const opp = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag) ? m.red_team_tag : m.blue_team_tag;
       const key = `${dateRaw}_${opp}`;
       
       if (!autoScrimBlocks.has(key)) autoScrimBlocks.set(key, { date: dateRaw, opp, wins: 0, losses: 0, games: [] });
       const block = autoScrimBlocks.get(key); block.games.push(m);
       const weAreBlue = String(m.blue_team_tag || '').toUpperCase().includes(myTeamTag);
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
        
        finalList.push({ id: m.id, date: m.mission_date, opponent: m.opponent_acronym, result: 'AGEND.', score: m.mission_time ? m.mission_time.substring(0, 5) : 'TBD', mode: mode, comp: m.mission_type, difficulty: 'AGUARDANDO', punctuality: '-', remakes: 0, isManual: true, isMission: true, rawObj: m });
    });

    return finalList.sort((a,b) => getSafeTimestamp(b.date) - getSafeTimestamp(a.date));
  }, [filteredMatches, scrimReportsManual, missionsRaw, myTeamTag, filterStartDate, filterEndDate]);


  const chartIntelligence = useMemo(() => {
      const diffOrder = ['STOMPAMOS', 'MUITO FÁCIL', 'FÁCIL', 'CONTROLADO', 'DIFÍCIL', 'MT DIFÍCIL', 'STOMPADOS'];
      const diffCounts: Record<string, number> = {};
      diffOrder.forEach(d => diffCounts[d] = 0);

      const tierCounts: Record<string, Record<string, number>> = { 'Bad': {}, 'Average': {}, 'Good': {}, 'Excellent': {} };
      ['Bad', 'Average', 'Good', 'Excellent'].forEach(t => { diffOrder.forEach(d => tierCounts[t][d] = 0); });

      const validScrims = advancedScrims.filter(s => !s.isMission && s.result !== 'AGEND.');

      validScrims.forEach((scrim) => {
          const diff = diffOrder.includes(String(scrim.difficulty || '').toUpperCase()) ? String(scrim.difficulty || '').toUpperCase() : 'CONTROLADO';
          diffCounts[diff]++;
          const opponentData = props.teams.find((t: any) => t.acronym === scrim.opponent);
          let rawTier = opponentData?.tier ? String(opponentData.tier).trim() : 'Average';
          rawTier = rawTier.charAt(0).toUpperCase() + rawTier.slice(1).toLowerCase();
          const assignedTier = ['Bad', 'Average', 'Good', 'Excellent'].includes(rawTier) ? rawTier : 'Average';
          tierCounts[assignedTier][diff]++;
      });

      return { 
        stressData: diffOrder.map(diff => ({ name: diff.replace('MUITO', 'MT').replace('STOMPAMOS', 'STOMP.').replace('STOMPADOS', 'STOMP.'), count: diffCounts[diff] })), 
        efficiencyData: ['Bad', 'Average', 'Good', 'Excellent'].map(tier => ({ name: tier, ...tierCounts[tier] })) 
      };
  }, [advancedScrims, props.teams]);

  // --- 5. TARGET INTEL FETCH ---
  useEffect(() => {
    async function fetchTargetIntelData() {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const safeMissions = missionsRaw || [];
      const nextOfficial = safeMissions
        .filter(m => m.mission_date >= todayStr && m.mission_type === 'OFFICIAL')
        .sort((a,b) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`));
      
      let targetMission = nextOfficial.length > 0 ? nextOfficial[0] : null;
      if (!targetMission) {
         const upcoming = safeMissions.filter(m => m.mission_date >= todayStr).sort((a,b) => `${a.mission_date}T${a.mission_time||'00:00'}`.localeCompare(`${b.mission_date}T${b.mission_time||'00:00'}`));
         if (upcoming.length > 0) targetMission = upcoming[0];
      }

      if (!targetMission) {
         setNextTargetIntel({ team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [], date: null });
         return;
      }

      const nextOp = targetMission.opponent_acronym;
      
      try {
         const [draftRes, perfRes, hubRosterRes, objRes] = await Promise.all([
            supabase.from('bff_hub_draft').select('*').ilike('team_acronym', `%${nextOp}%`),
            supabase.from('bff_hub_performance').select('*').ilike('team_acronym', `%${nextOp}%`),
            supabase.from('bff_hub_players_roster').select('*').ilike('team_acronym', `%${nextOp}%`),
            supabase.from('bff_hub_objectives').select('*').ilike('team_acronym', `%${nextOp}%`)
         ]);

         let topPicks: any[] = []; 
         let topBans: any[] = [];
         
         if (draftRes && draftRes.data) {
             const picksRaw = draftRes.data.filter((d: any) => String(d.type||'').toLowerCase() === 'pick');
             const champGroups: Record<string, any> = {};
             picksRaw.forEach((p: any) => {
                 if (!champGroups[p.champion]) champGroups[p.champion] = { roles: new Set(), total: 0, wins: 0, minSeq: 99 };
                 champGroups[p.champion].roles.add(p.role);
                 champGroups[p.champion].total += Number(p.total_picks) || 0;
                 champGroups[p.champion].wins += (Number(p.total_picks) || 0) * ((Number(p.win_rate) || 0) / 100);
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
             
             const bans = draftRes.data.filter((d: any) => String(d.type||'').toLowerCase() === 'ban').sort((a: any, b: any) => b.total_picks - a.total_picks);
             topBans = bans.slice(0, 3).map((b: any) => ({ name: b.champion }));
         }
         
         const kpis: any[] = [];
         if (perfRes && perfRes.data && perfRes.data.length > 0) {
             let bW=0, bT=0, rW=0, rT=0;
             perfRes.data.forEach((m: any) => {
                const side = String(m.side).toLowerCase();
                const wStatus = String(m.win_status).toLowerCase();
                const isWin = wStatus === 'w' || wStatus === 'win';
                if (side.includes('blue') || side === '100') { bT++; if(isWin) bW++; }
                else if (side.includes('red') || side === '200') { rT++; if(isWin) rW++; }
             });
             const bWR = bT > 0 ? Math.round((bW/bT)*100) : 0;
             const rWR = rT > 0 ? Math.round((rW/rT)*100) : 0;
             kpis.push({ type: 'wr', blue: bWR, red: rWR });
             
             const totalLane = perfRes.data.reduce((acc: number, curr: any) => acc + (Number(curr.avg_lane)||0), 0);
             const avgLane = totalLane / perfRes.data.length;
             kpis.push({ type: avgLane >= 50 ? 'early' : 'scaling', text: avgLane >= 50 ? `Early Game Forte (Lane Score: ${Math.round(avgLane)})` : `Estilo Scaling (Lane Score: ${Math.round(avgLane)})` });
         }
         
         if (hubRosterRes && hubRosterRes.data && hubRosterRes.data.length > 0) {
             const carry = [...hubRosterRes.data].sort((a: any, b: any) => (Number(b.median_impact) || 0) - (Number(a.median_impact) || 0))[0];
             if (carry) kpis.push({ type: 'pressure', text: `Foco de Pressão: Anular ${String(carry.primary_role).toUpperCase()} (${carry.nickname})`, player: carry });
         }

         if (objRes && objRes.data && objRes.data.length > 0) {
             const firstDrake = objRes.data.find((o:any) => o.objective_type === 'DRAGON' && o.avg_minute > 4 && o.avg_minute < 10);
             const firstGrubs = objRes.data.find((o:any) => o.objective_type === 'HORDE' || o.objective_type === 'GRUBS');
             if (firstDrake || firstGrubs) kpis.push({ type: 'macro', drakeTime: firstDrake ? Number(firstDrake.avg_minute).toFixed(1) : '-', grubsTime: firstGrubs ? Number(firstGrubs.avg_minute).toFixed(1) : '-' });
         }

         if (kpis.length === 0) kpis.push({ type: 'empty', text: 'Aguardando coleta de dados.' });

         setNextTargetIntel({ team: nextOp, topPicks, topBans, winConditions: kpis, date: targetMission.mission_date as any });
      } catch (error) {
         console.error("Erro ao buscar Target Intel", error);
      }
    }
    fetchTargetIntelData();
  }, [missionsRaw]);

  // --- 6. HANDLERS DOS MODAIS E AÇÕES GLOBAIS ---

  const groupedTeamsByRegion = useMemo(() => {
    const groups: Record<string, any[]> = {};
    props.teams.forEach((t: any) => {
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
    sortedKeys.forEach(key => { sortedGroups[key] = groups[key]; });
    return sortedGroups;
  }, [props.teams]);

  const handleDayClick = (dateStr: string) => { 
      if(!isStaff) return; 
      const clickedDate = new Date(dateStr + "T00:00:00");
      const today = new Date();
      today.setHours(0,0,0,0);

      if (clickedDate < today) {
          setEditScrimId(null);
          setScrimForm({ date: dateStr, opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
          setScrimModalOpen(true);
      } else {
          setEditMissionId(null); 
          setMissionForm({ date: dateStr, time: '14:00', opponent: '', customOpponent: '', type: 'SCRIM', gamesCount: '3 JOGOS', draftMode: 'PADRÃO' }); 
          setMissionModalOpen(true); 
      }
  };

  const handleEditCalendarEvent = (e: React.MouseEvent, ev: any) => { 
      e.stopPropagation(); 
      if (!isStaff) return; 

      if (ev.isPast && !ev.isAuto) { 
         const s = ev.rawScrim; 
         setEditScrimId(s.id); 
         setScrimForm({ date: s.scrim_date, opponent: s.opponent_acronym, result: s.result, score: s.score, mode: s.mode, comp: s.comp_tested || '', difficulty: s.difficulty || 'CONTROLADO', punctuality: s.punctuality || 'PONTUAIS', remakes: s.remakes || 0, match_ids: s.match_ids || '' }); 
         setScrimModalOpen(true); 
      } else if (!ev.isPast) { 
         const m = ev.rawMission;
         setEditMissionId(m.id); 
         const info = (m && m.status) ? String(m.status).split('|') : []; 
         let gc = '3 JOGOS'; let dm = 'PADRÃO'; 
         if (info.length >= 3) { gc = info[1].trim(); dm = info[2].trim(); } 
         
         const isKnownTeam = props.teams.some((t: any) => t.acronym === m.opponent_acronym);
         
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

  const handleEditLog = (scrim: any) => {
      if (scrim.isMission) {
          setEditScrimId(null);
          setEditMissionId(null);
          const info = scrim.rawObj.status ? String(scrim.rawObj.status).split('|') : []; 
          let dm = 'PADRÃO'; 
          if (info.length >= 3) { dm = info[2].trim(); }
          const isKnownTeam = props.teams.some((t: any) => t.acronym === scrim.opponent);
          
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

  const handleWellnessSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const r = Math.round(((wellnessForm.sleep + wellnessForm.mental + wellnessForm.physical) / 15) * 100); 
      
      const today = new Date();
      const td = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const payload = { 
          puuid: wellnessForm.puuid, 
          record_date: td, 
          sleep_score: wellnessForm.sleep, 
          mental_score: wellnessForm.mental, 
          physical_score: wellnessForm.physical, 
          readiness_percent: r 
      };

      const { data, error } = await supabase
          .from('player_wellness')
          .upsert(payload, { onConflict: 'puuid, record_date' })
          .select(); 

      if (error) {
          console.error("ERRO AO SALVAR WELLNESS:", error);
          alert(`Erro ao salvar: Certifique-se que o Supabase está configurado corretamente.\n${error.message}`);
      } else if (data && data.length > 0) { 
          setWellnessDataRaw(prev => [data[0], ...prev.filter(w => !(w.puuid === payload.puuid && w.record_date === td))]);
          setWellnessModalOpen(false); 
      } 
  };


  // --- RENDERIZAÇÃO LIMPA E MODULAR ---
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans relative pb-20 p-4 md:p-8 space-y-8">
      
      {/* 1. BARRA DE FILTROS TOTALMENTE MODULARIZADA */}
      <DashboardFilters 
         matchType={matchType} setMatchType={setMatchType}
         selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod}
         filterStartDate={filterStartDate} setFilterStartDate={setFilterStartDate}
         filterEndDate={filterEndDate} setFilterEndDate={setFilterEndDate}
         splitOptions={splitOptions}
      />

      {/* COCKPIT */}
      <TopCockpit 
         currentUser={props.sessionUser} 
         squadConfig={props.squadConfig} 
         myTeamTag={myTeamTag} 
         isStaff={isStaff} 
      />

      {/* SECÇÃO 1: CALENDAR | TARGET INTEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5">
           <AgendaCalendar 
             isStaff={isStaff} 
             calendarGrid={calendarGrid} 
             onDayClick={handleDayClick}
             onEditEvent={handleEditCalendarEvent}
             onDeleteEvent={handleDeleteCalendarEvent}
           />
        </div>
        <div className="lg:col-span-7">
           <TargetIntel 
             nextTargetIntel={nextTargetIntel} 
             currentTargetH2H={currentTargetH2H}
             teamsList={props.teams} 
           />
        </div>
      </div>

      {/* SECÇÃO 2: SQUAD READINESS */}
      <SquadReadiness 
         isStaff={isStaff} 
         teamWellness={teamWellnessData} 
         currentUser={props.sessionUser} 
         filteredMatches={filteredMatches} 
         playerStats={playerStatsRaw} // <--- MUDE DE props.playerStats PARA playerStatsRaw AQUI
         filterStartDate={filterStartDate} 
         filterEndDate={filterEndDate}
         onOpenDailySync={() => {
            if(!isStaff) setWellnessForm(prev => ({ ...prev, puuid: props.sessionUser.puuid }));
            setWellnessModalOpen(true);
         }}
      />

      {/* SECÇÃO 3: MATCHUP ANALYTICS */}
      <MatchupAnalytics 
         opponentStatsData={opponentStatsData} 
         championshipStatsData={championshipStatsData} 
         teamsList={props.teams}
      />

      {/* SECÇÃO 4: TACTICAL METRICS */}
      <TacticalMetrics 
         myTeamTag={myTeamTag} 
         radarData={radarData} 
         earlyGameSnowball={earlyGameSnowball}
         efficiencyData={chartIntelligence.efficiencyData} 
         radarCompareMode={radarCompareMode}
         setRadarCompareMode={setRadarCompareMode}
         teamsList={props.teams}
      />

      {/* SECÇÃO 5: ADVANCED LOGS */}
      <AdvancedLogs 
         isStaff={isStaff} 
         advancedScrims={advancedScrims} 
         teamsList={props.teams}
         onEditLog={handleEditLog}
         onOpenManualLog={() => { 
            setEditScrimId(null); 
            setScrimForm({ 
               date: new Date().toISOString().split('T')[0], 
               opponent: '', result: 'W', score: '', mode: 'MD3', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' 
            }); 
            setScrimModalOpen(true); 
         }}
      />
      
      {/* -------------------------------------------------------------------------
          MODAIS JSX
      --------------------------------------------------------------------------- */}

      {/* MODAL DE MISSION (Agenda) */}
      {isMissionModalOpen && isStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveMission} className="w-full max-w-xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center">{editMissionId ? "Editar Evento" : "Novo Evento"}</h2>
            <div className="space-y-5">
              <div className="flex gap-5 items-center">
                 {missionForm.opponent && missionForm.opponent !== 'MIX' && getTeamLogo(missionForm.opponent) ? (
                    <img src={getTeamLogo(missionForm.opponent)!} className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 object-contain p-1 shadow-md" alt="Logo" />
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

      {/* MODAL DE SCRIM MANUAL (Logs) */}
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

      {/* MODAL DE DAILY SYNC (Biometria) */}
      {isWellnessModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleWellnessSubmit} className="w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-8 space-y-6 shadow-2xl my-auto relative animate-[fadeInUp_0.3s_ease-out_forwards]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6">
              Daily Sync <span className="text-emerald-500">Biometria</span>
            </h2>

            <div className="space-y-6">
              {isStaff && (
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">Selecionar Atleta</label>
                  <select
                    required
                    value={wellnessForm.puuid}
                    onChange={e => setWellnessForm({ ...wellnessForm, puuid: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors shadow-inner uppercase"
                  >
                    <option value="" disabled>SELECIONE UM JOGADOR</option>
                    {props.roster.map((p: any) => (
                      <option key={p.puuid} value={p.puuid}>{p.nickname || p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <WellnessInput 
                icon={<Moon size={20} className="text-purple-400" />} 
                title="Qualidade do Sono" desc="Como foi sua recuperação nesta noite?" 
                value={wellnessForm.sleep} onChange={(val: number) => setWellnessForm({ ...wellnessForm, sleep: val })} 
              />
              <WellnessInput 
                icon={<Brain size={20} className="text-amber-400" />} 
                title="Estado Mental" desc="Nível de estresse e cansaço psicológico" 
                value={wellnessForm.mental} onChange={(val: number) => setWellnessForm({ ...wellnessForm, mental: val })} 
              />
              <WellnessInput 
                icon={<Activity size={20} className="text-red-400" />} 
                title="Condição Física" desc="Dores musculares, fadiga ou lesões" 
                value={wellnessForm.physical} onChange={(val: number) => setWellnessForm({ ...wellnessForm, physical: val })} 
              />
            </div>

            <div className="flex gap-4 pt-6 border-t border-zinc-800/60 mt-4">
              <button type="button" onClick={() => setWellnessModalOpen(false)} className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)]">Registrar Sync</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

// --- SUBCOMPONENTE DE WELLNESS INPUT ---
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