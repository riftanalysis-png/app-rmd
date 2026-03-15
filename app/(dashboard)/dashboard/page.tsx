"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

export default function DashboardPage() {
  // ==========================================
  // AUTENTICAÇÃO REAL (SUPABASE AUTH)
  // ==========================================
  const [currentUser, setCurrentUser] = useState({ 
    role: 'loading', 
    puuid: '', 
    name: 'CARREGANDO IDENTIFICAÇÃO...' 
  });
  
  // Variável de controle de acesso (RBAC)
  const isStaff = ['analista', 'treinador', 'diretor'].includes(currentUser.role.toLowerCase());

  const [wellnessHistoryModal, setWellnessHistoryModal] = useState<{isOpen: boolean, player: any, history: any[]}>({ 
    isOpen: false, player: null, history: [] 
  });

  const [stats, setStats] = useState({ matches: 0, winrate: 0, players: 0 });
  const [loading, setLoading] = useState(true);
  
  // ==========================================
  // ESTADOS CONECTADOS AO SUPABASE
  // ==========================================
  const [configId, setConfigId] = useState<string | null>(null);
  
  const [squadConfig, setSquadConfig] = useState({ 
    teamAcronym: '...', 
    directive: "CARREGANDO DIRETRIZES...", phase: 'LOADING', week: 0, intensity: 0, load: 'N/A' 
  });
  
  const [nextTargetIntel, setNextTargetIntel] = useState({
    team: 'ALVO NÃO DEFINIDO', topPicks: [], topBans: [], winConditions: []
  });
  
  const [upcomingMissions, setUpcomingMissions] = useState<any[]>([]);
  const [scrimReports, setScrimReports] = useState<any[]>([]);
  const [vodTasks, setVodTasks] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [teamWellness, setTeamWellness] = useState<any[]>([]);
  const [soloQData, setSoloQData] = useState<any[]>([]);
  const [squadForm, setSquadForm] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]); 
  
  // ==========================================
  // ESTADOS DOS MODAIS E FORMULÁRIOS
  // ==========================================
  const [isWellnessModalOpen, setWellnessModalOpen] = useState(false);
  const [isMissionModalOpen, setMissionModalOpen] = useState(false);
  const [isScrimModalOpen, setScrimModalOpen] = useState(false);
  const [isConfigModalOpen, setConfigModalOpen] = useState(false);
  const [isTargetModalOpen, setTargetModalOpen] = useState(false);
  const [isVodModalOpen, setVodModalOpen] = useState(false);

  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [editScrimId, setEditScrimId] = useState<string | null>(null);

  const [wellnessForm, setWellnessForm] = useState({ puuid: '', sleep: 3, mental: 3, physical: 3, focus: 3 });
  const [missionForm, setMissionForm] = useState({ date: '', time: '', opponent: '', type: 'SCRIM' });
  const [scrimForm, setScrimForm] = useState({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
  const [configForm, setConfigForm] = useState({ teamAcronym: '', directive: '', phase: '', week: 1, intensity: 50, load: 'MODERATE' });
  const [targetForm, setTargetForm] = useState({ team: '', win1: '', win2: '', win3: '' });
  const [vodForm, setVodForm] = useState({ tag: 'MACRO', text: '' });

  const [teamKpiData, setTeamKpiData] = useState([
    { subject: 'Lane Dom.', A: 0, B: 65 }, { subject: 'Impact', A: 0, B: 70 }, { subject: 'Conversion', A: 0, B: 75 }, { subject: 'Vision', A: 0, B: 80 }, { subject: 'Overall', A: 0, B: 70 }
  ]);

  // ==========================================
  // FETCH INICIAL
  // ==========================================
  useEffect(() => {
    async function fetchDashboardData() {
      // 0. AUTENTICAÇÃO REAL: Descobre quem é o usuário logado e busca o perfil dele
      const { data: { user } } = await supabase.auth.getUser();
      let loggedUser = { role: 'analista', puuid: 'TESTE', name: 'MODO TESTE/VISITANTE' }; // Fallback caso teste sem login

      if (user) {
         const { data: profile } = await supabase.from('profiles').select('full_name, role, puuid').eq('id', user.id).single();
         if (profile) {
            loggedUser = { 
               role: profile.role || 'jogador', 
               puuid: profile.puuid || '',
               name: profile.full_name || 'OPERADOR DESCONHECIDO'
            };
         }
      }
      setCurrentUser(loggedUser);

      // 0.1 Busca o Dicionário de Times
      const { data: teamsData } = await supabase.from('teams').select('acronym, name, logo_url');
      if (teamsData) setTeamsList(teamsData);

      // 1. Puxa a Configuração
      const { data: configData, error: configError } = await supabase.from('squad_config').select('*').limit(1).maybeSingle();
      if (configError) console.error("❌ ERRO AO BUSCAR SQUAD_CONFIG:", configError.message);

      let myTeam = ''; 

      if (configData && configData.my_team_tag) {
        myTeam = configData.my_team_tag;
        setConfigId(configData.id);
        setSquadConfig({
          teamAcronym: myTeam, 
          directive: configData.tactical_directive || 'NENHUMA DIRETRIZ DEFINIDA', 
          phase: configData.periodization_phase || 'N/A',
          week: configData.periodization_week || 0, 
          intensity: configData.intensity_score || 0, 
          load: configData.cognitive_load || 'N/A'
        });
      } else {
        myTeam = 'SEM TAG';
        setSquadConfig(prev => ({ ...prev, teamAcronym: 'SEM TAG', directive: '⚠️ CONFIGURE SEU TIME NO PAINEL' }));
      }

      // 2. Busca o Roster Oficial
      const { data: rosterData } = await supabase.from('players').select('puuid, nickname, primary_role, photo_url').ilike('team_acronym', `%${myTeam}%`);
      const activeRoster = rosterData || [];
      setRoster(activeRoster);

      // 3. ✨ CÁLCULO DE EFICIÊNCIA REAL ✨
      const { data: teamMatches } = await supabase.from('matches').select('id, blue_team_tag, red_team_tag, winner_side').or(`blue_team_tag.ilike."%${myTeam}%",red_team_tag.ilike."%${myTeam}%"`);
      const analyticCycles = teamMatches ? teamMatches.length : 0;
      let wins = 0;

      if (teamMatches && teamMatches.length > 0) {
        teamMatches.forEach(match => {
          const blueTag = String(match.blue_team_tag || '').trim().toUpperCase();
          const redTag = String(match.red_team_tag || '').trim().toUpperCase();
          const myTagNormalized = String(myTeam).trim().toUpperCase();

          const weAreBlue = blueTag.includes(myTagNormalized);
          const weAreRed = redTag.includes(myTagNormalized);
          const winner = String(match.winner_side || '').trim().toLowerCase(); 
          const isBlueWin = winner === 'blue' || winner === '100';
          const isRedWin = winner === 'red' || winner === '200';

          if ((weAreBlue && isBlueWin) || (weAreRed && isRedWin)) wins++;
        });
      }
      const globalEfficiency = analyticCycles > 0 ? Math.round((wins / analyticCycles) * 100) : 0;

      // 4. Configura UI com Roster Real
      if (activeRoster.length > 0) {
        setWellnessForm(prev => ({ ...prev, puuid: activeRoster[0].puuid }));
      }

      // 4.5 INTERNAL MVP RACE
      const { data: mvpData } = await supabase.from('hub_players_roster').select('nickname, primary_role, mvp_score').ilike('team_acronym', `%${myTeam}%`).order('mvp_score', { ascending: false });
      if (mvpData) {
        const formattedMvp = mvpData.map(p => {
          const score = p.mvp_score != null ? Number(p.mvp_score) : 0; 
          let streakText = 'STABLE';
          if (score >= 8.0) streakText = 'ON FIRE';
          else if (score < 6.0) streakText = 'COLD'; 
          return { name: p.nickname, role: p.primary_role, rating: score.toFixed(1), streak: streakText };
        });
        setSquadForm(formattedMvp);
      }

      // 5. ✨ SQUAD PERFORMANCE INDEX ✨
      const { data: perfData } = await supabase.from('hub_players_performance').select('avg_lane, avg_impact, avg_conversion, avg_vision').ilike('team_acronym', `%${myTeam}%`);
      if (perfData && perfData.length > 0) {
        const getMedian = (arr: number[]) => {
          if (!arr || arr.length === 0) return 0;
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };
        const lanes = perfData.map(p => Number(p.avg_lane || 0)); const impacts = perfData.map(p => Number(p.avg_impact || 0)); const conversions = perfData.map(p => Number(p.avg_conversion || 0)); const visions = perfData.map(p => Number(p.avg_vision || 0));
        const medLane = getMedian(lanes); const medImpact = getMedian(impacts); const medConversion = getMedian(conversions); const medVision = getMedian(visions);
        const overallScore = (medLane + medImpact + medConversion + medVision) / 4;

        setTeamKpiData([
          { subject: 'Lane Dom.', A: Math.round(medLane), B: 65 }, { subject: 'Impact', A: Math.round(medImpact), B: 70 }, { subject: 'Conversion', A: Math.round(medConversion), B: 75 }, { subject: 'Vision', A: Math.round(medVision), B: 80 }, { subject: 'Overall', A: Math.round(overallScore), B: 70 }
        ]);
      }

      // 6. Agenda de Eventos
      const { data: missions } = await supabase.from('missions').select('*').ilike('team_acronym', `%${myTeam}%`).order('mission_date', { ascending: true }).limit(5);
      let nextOpponent = '';
      if (missions && missions.length > 0) {
         setUpcomingMissions(missions);
         nextOpponent = missions[0].opponent_acronym;
      }

      // 7. Busca Intel do PRÓXIMO ALVO
      if (nextOpponent) {
         const { data: opponentData } = await supabase.from('opponent_intel').select('*').eq('opponent_acronym', nextOpponent).maybeSingle();
         if (opponentData) {
            setNextTargetIntel({ team: nextOpponent, topPicks: opponentData.top_picks || [], topBans: opponentData.top_bans || [], winConditions: opponentData.win_conditions || [] });
         } else {
            setNextTargetIntel({ team: nextOpponent, topPicks: [], topBans: [], winConditions: [] });
         }
      } else {
         setNextTargetIntel({ team: 'SEM ALVO', topPicks: [], topBans: [], winConditions: [] });
      }

      // 8. Busca Scrims e Tarefas de VOD
      const { data: scrims } = await supabase.from('scrim_reports').select('*').ilike('team_acronym', `%${myTeam}%`).order('scrim_date', { ascending: false }).limit(6);
      if (scrims) setScrimReports(scrims);

      const { data: tasks } = await supabase.from('vod_tasks').select('*').ilike('team_acronym', `%${myTeam}%`).order('created_at', { ascending: false });
      if (tasks) setVodTasks(tasks);

      // 9. Histórico de Wellness
      const { data: wellnessData } = await supabase.from('player_wellness').select('*').order('record_date', { ascending: false });
      const todayStr = new Date().toISOString().split('T')[0];

      const wellnessBase = activeRoster.map(p => {
         const playerRecords = wellnessData?.filter((w: any) => w.puuid === p.puuid) || [];
         const latestRecord = playerRecords.length > 0 ? playerRecords[0] : null;
         const hasAnsweredToday = latestRecord && latestRecord.record_date === todayStr;

         return { 
            puuid: p.puuid, name: p.nickname, role: p.primary_role, photo: p.photo_url, 
            score: latestRecord ? latestRecord.readiness_percent : 0, sleep: latestRecord ? latestRecord.sleep_score : 0, 
            mental: latestRecord ? latestRecord.mental_score : 0, physical: latestRecord ? latestRecord.physical_score : 0,
            hasAnsweredToday: !!hasAnsweredToday, history: playerRecords
         };
      });
      setTeamWellness(wellnessBase);

      setStats({ matches: analyticCycles, winrate: globalEfficiency, players: activeRoster.length });
      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  // ==========================================
  // HANDLERS (SUPABASE) BLINDADOS
  // ==========================================
  
  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return alert("Acesso Negado.");
    const payload = {
      my_team_tag: configForm.teamAcronym.toUpperCase(), tactical_directive: configForm.directive, periodization_phase: configForm.phase, periodization_week: configForm.week, intensity_score: configForm.intensity, cognitive_load: configForm.load 
    };
    if (configId) {
      const { error } = await supabase.from('squad_config').update(payload).eq('id', configId);
      if (error) alert("Erro ao atualizar config: " + error.message); else window.location.reload();
    } else {
      const { error } = await supabase.from('squad_config').insert([payload]).select();
      if (error) alert("Erro ao criar config: " + error.message); else window.location.reload();
    }
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    setVodTasks(tasks => tasks.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t));
    const { error } = await supabase.from('vod_tasks').update({ is_done: !currentStatus }).eq('id', id);
    if (error) alert("Erro ao atualizar tarefa: " + error.message);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return alert("Acesso Negado.");
    let formattedDate = missionForm.date;
    if (formattedDate.includes('/')) {
      const parts = formattedDate.split('/');
      formattedDate = `${parts.length === 3 ? parts[2] : new Date().getFullYear()}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const timeFormatted = missionForm.time.length === 5 ? `${missionForm.time}:00` : missionForm.time;
    const payload = { team_acronym: squadConfig.teamAcronym, mission_date: formattedDate, mission_time: timeFormatted, opponent_acronym: missionForm.opponent, mission_type: missionForm.type, status: 'SCHEDULED' };

    if (editMissionId) {
      const { data, error } = await supabase.from('missions').update(payload).eq('id', editMissionId).select();
      if (error) alert("Erro ao editar evento: " + error.message);
      else if (data) {
        setUpcomingMissions(prev => prev.map(m => m.id === editMissionId ? data[0] : m).sort((a, b) => new Date(a.mission_date).getTime() - new Date(b.mission_date).getTime()));
        setMissionForm({ date: '', time: '', opponent: '', type: 'SCRIM' }); setEditMissionId(null); setMissionModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from('missions').insert([payload]).select();
      if (error) alert("Erro ao criar evento: " + error.message);
      else if (data) {
        setUpcomingMissions(prev => [...prev, data[0]].sort((a, b) => new Date(a.mission_date).getTime() - new Date(b.mission_date).getTime()));
        setMissionForm({ date: '', time: '', opponent: '', type: 'SCRIM' }); setMissionModalOpen(false);
      }
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!isStaff) return;
    if (!window.confirm("Tem certeza que deseja excluir este evento da agenda?")) return;
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) alert("Erro ao excluir evento: " + error.message);
    else setUpcomingMissions(prev => prev.filter(m => m.id !== id));
  };

  const handleSaveScrim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return alert("Acesso Negado.");
    const today = new Date().toISOString().split('T')[0];
    const payload = {
      team_acronym: squadConfig.teamAcronym, scrim_date: scrimForm.date || today, opponent_acronym: scrimForm.opponent, result: scrimForm.result, score: scrimForm.score, mode: scrimForm.mode, comp_tested: scrimForm.comp, difficulty: scrimForm.difficulty, punctuality: scrimForm.punctuality, remakes: scrimForm.remakes, match_ids: scrimForm.match_ids
    };

    if (editScrimId) {
      const { data, error } = await supabase.from('scrim_reports').update(payload).eq('id', editScrimId).select();
      if (error) alert("Erro ao editar Scrim Report: " + error.message);
      else if (data) {
        setScrimReports(prev => prev.map(s => s.id === editScrimId ? data[0] : s).sort((a, b) => new Date(b.scrim_date).getTime() - new Date(a.scrim_date).getTime()));
        setScrimForm({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
        setEditScrimId(null); setScrimModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from('scrim_reports').insert([payload]).select();
      if (error) alert("Erro ao salvar Scrim Report: " + error.message);
      else if (data) {
        setScrimReports(prev => [data[0], ...prev].sort((a, b) => new Date(b.scrim_date).getTime() - new Date(a.scrim_date).getTime()));
        setScrimForm({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' });
        setScrimModalOpen(false);
      }
    }
  };

  const handleDeleteScrim = async (id: string) => {
    if (!isStaff) return;
    if (!window.confirm("Tem certeza que deseja excluir este Report permanentemente?")) return;
    const { error } = await supabase.from('scrim_reports').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message); else setScrimReports(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return alert("Acesso Negado.");
    const conditions = [targetForm.win1, targetForm.win2, targetForm.win3].filter(Boolean);
    const { error } = await supabase.from('opponent_intel').upsert({ opponent_acronym: targetForm.team.toUpperCase(), top_picks: [], top_bans: [], win_conditions: conditions }, { onConflict: 'opponent_acronym' }).select();
    if (error) alert(`Erro ao salvar Win Conditions: ${error.message}`);
    else { setNextTargetIntel(prev => ({ ...prev, team: targetForm.team.toUpperCase(), winConditions: conditions })); setTargetModalOpen(false); }
  };

  const handleAddVodTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return alert("Acesso Negado.");
    const { data, error } = await supabase.from('vod_tasks').insert([{ team_acronym: squadConfig.teamAcronym, tag: vodForm.tag, task_text: vodForm.text, is_done: false }]).select();
    if (error) alert("Erro ao salvar VOD Task: " + error.message);
    else if (data) { setVodTasks(prev => [data[0], ...prev]); setVodForm({ tag: 'MACRO', text: '' }); setVodModalOpen(false); }
  };

  const handleWellnessSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const totalScore = wellnessForm.sleep + wellnessForm.mental + wellnessForm.physical;
    const readiness = Math.round((totalScore / 15) * 100);
    const today = new Date().toISOString().split('T')[0]; 
    const { data, error } = await supabase.from('player_wellness').upsert({ puuid: wellnessForm.puuid, record_date: today, sleep_score: wellnessForm.sleep, mental_score: wellnessForm.mental, physical_score: wellnessForm.physical, focus_score: wellnessForm.focus, readiness_percent: readiness }, { onConflict: 'puuid, record_date' }).select();
    if (error) alert("Erro ao sincronizar biometria: " + error.message);
    else if (data) { setTeamWellness(prev => prev.map(p => p.puuid === wellnessForm.puuid ? { ...p, score: readiness, sleep: wellnessForm.sleep, mental: wellnessForm.mental, physical: wellnessForm.physical, hasAnsweredToday: true } : p)); setWellnessModalOpen(false); }
  };

  // --- HELPERS DE COR, FORMATAÇÃO E LOGOS ---
  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'STOMPAMOS': return 'bg-blue-600 text-white border-blue-500'; case 'FÁCIL': return 'bg-emerald-500 text-white border-emerald-400'; case 'CONTROLADO': return 'bg-emerald-700 text-emerald-100 border-emerald-600'; case 'DIFÍCIL': return 'bg-orange-600 text-white border-orange-500'; case 'MT DIFÍCIL': return 'bg-red-500 text-white border-red-400'; case 'STOMPADOS': return 'bg-red-600 text-white border-red-500 animate-pulse'; default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPunctualityColor = (punct: string) => {
    if (punct.includes('PONTUAIS')) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'; if (punct.includes('NOSSO ATRASO')) return 'text-red-400 border-red-500/30 bg-red-500/10'; if (punct.includes('ATRASO DELES')) return 'text-orange-400 border-orange-500/30 bg-orange-500/10'; if (punct.includes('DESMARCARAM')) return 'text-slate-400 border-slate-500/30 bg-slate-500/10 line-through'; return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
  };

  const formatDate = (dateString: string) => { if (!dateString) return ''; const parts = dateString.split('-'); return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : dateString; };
  const formatTime = (timeString: string) => { if (!timeString) return ''; return timeString.substring(0, 5); };

  const getIntensityTheme = (intensity: number) => {
    if (intensity < 40) return { text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.8)]' };
    if (intensity < 75) return { text: 'text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]' };
    return { text: 'text-red-400', bg: 'bg-red-500', shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.8)]' };
  };
  const intensityTheme = getIntensityTheme(squadConfig.intensity);

  const getTeamLogo = (acronym: string) => {
    if (!acronym) return 'https://ui-avatars.com/api/?name=?&background=1e293b&color=fff&bold=true';
    const team = teamsList.find(t => t.acronym.toUpperCase() === acronym.toUpperCase());
    if (team && team.logo_url) return team.logo_url;
    return `https://ui-avatars.com/api/?name=${acronym}&background=1e293b&color=fff&bold=true`;
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-blue-500 font-black italic animate-pulse text-xs tracking-widest">// ACESSANDO SERVIDORES DO SUPABASE...</div>;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-10 font-black uppercase italic tracking-tighter pb-20">
      
      {/* 1. HEADER & USER STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-8 relative group overflow-hidden bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-[48px] p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl transition-all hover:border-blue-500/30">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
          <div className="relative z-10 shrink-0">
             <div className="w-40 h-40 rounded-[40px] bg-slate-900 border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} className="w-full h-full object-cover" alt="Profile" />
             </div>
             <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] px-3 py-1 rounded-lg shadow-xl border border-white/20">A.I SYSTEM</div>
          </div>
          <div className="relative z-10 flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
               <p className="text-blue-400 text-xs tracking-[0.5em]">SYSTEM CONNECTED</p>
               <span className="bg-blue-500 text-black px-2 py-0.5 rounded font-black text-[9px] tracking-widest">TEAM: {squadConfig.teamAcronym}</span>
            </div>
            <h2 className="text-5xl lg:text-6xl text-white mb-4 leading-none truncate max-w-full">{currentUser.name.toUpperCase()}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
               <Badge text={currentUser.role} color={isStaff ? "bg-blue-500" : "bg-emerald-600"} />
               <Badge text="AUTHORIZED PERSONNEL" color="bg-purple-600" />
            </div>
          </div>
        </div>

        {/* AGENDA DE EVENTOS & TARGET INTEL */}
        <div className="lg:col-span-4 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl flex flex-col relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-20 group-hover:opacity-100 transition-all"></div>
           <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
             <div><h3 className="text-sm text-slate-400 tracking-widest leading-none">AGENDA DE EVENTOS</h3></div>
             {/* PROTEÇÃO RBAC */}
             {isStaff && (
               <button onClick={() => { setEditMissionId(null); setMissionForm({ date: '', time: '', opponent: '', type: 'SCRIM' }); setMissionModalOpen(true); }} className="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-[9px] tracking-widest transition-all">+ NOVO EVENTO</button>
             )}
           </div>
           
           <div className="space-y-3 mb-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
              {upcomingMissions.length > 0 ? upcomingMissions.map(m => (
                <div key={m.id} className="flex flex-col p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-all group/card">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <img src={getTeamLogo(m.opponent_acronym)} alt={m.opponent_acronym} className="w-11 h-11 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]" />
                        <div className="flex flex-col">
                           <span className="text-blue-400 text-[10px] tracking-widest mb-1">{formatDate(m.mission_date)} - {formatTime(m.mission_time)}</span>
                           <span className="text-white text-lg font-black tracking-tighter leading-none">{m.opponent_acronym}</span>
                        </div>
                     </div>
                     <span className="text-[9px] px-2 py-1 bg-black/40 rounded-lg border border-white/10 text-slate-400">{m.mission_type}</span>
                   </div>
                   
                   {/* PROTEÇÃO RBAC */}
                   {isStaff && (
                     <div className="flex justify-end gap-2 mt-3 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <button onClick={() => { setEditMissionId(m.id); setMissionForm({ date: m.mission_date, time: formatTime(m.mission_time), opponent: m.opponent_acronym, type: m.mission_type }); setMissionModalOpen(true); }} className="text-[9px] text-blue-400 hover:text-white px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-600 transition-colors tracking-widest">EDITAR</button>
                        <button onClick={() => handleDeleteMission(m.id)} className="text-[9px] text-red-400 hover:text-white px-3 py-1 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-600 transition-colors tracking-widest">EXCLUIR</button>
                     </div>
                   )}
                </div>
              )) : <p className="text-[10px] text-slate-600 text-center py-4">NENHUM EVENTO AGENDADO.</p>}
           </div>

           {/* TARGET INTEL DOSSIER */}
           <div className="mt-auto pt-6 border-t border-white/5 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between mb-4 relative z-10">
                 <div className="flex items-center gap-3">
                    <div className="relative">
                       <img src={getTeamLogo(nextTargetIntel.team)} alt="Target Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                       <div className="absolute -bottom-1 -right-1 bg-purple-600 w-4 h-4 rounded-full border-2 border-[#121212] flex items-center justify-center text-[8px]">🎯</div>
                    </div>
                    <div className="flex flex-col">
                       <h4 className="text-[8px] text-purple-400 tracking-[0.3em] uppercase mb-0.5">PRIMARY TARGET</h4>
                       <span className="text-white text-sm font-black italic tracking-widest">{nextTargetIntel.team !== 'SEM ALVO' ? `VS ${nextTargetIntel.team}` : 'AWAITING ASSIGNMENT'}</span>
                    </div>
                 </div>
                 {/* PROTEÇÃO RBAC */}
                 {isStaff && (
                   <button onClick={() => { 
                       if(nextTargetIntel.team === 'SEM ALVO') return alert('Agende um evento primeiro para ter um alvo.');
                       setTargetForm({ team: nextTargetIntel.team, win1: nextTargetIntel.winConditions[0] || '', win2: nextTargetIntel.winConditions[1] || '', win3: nextTargetIntel.winConditions[2] || '' }); 
                       setTargetModalOpen(true); 
                   }} className="text-[9px] bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-3 py-2 rounded-lg text-purple-400 transition-colors tracking-widest flex items-center gap-2">
                      <span>✏️</span> UPDATE INTEL
                   </button>
                 )}
              </div>

              <div className="space-y-2 relative z-10">
                 {nextTargetIntel.winConditions.length > 0 ? nextTargetIntel.winConditions.map((cond, i) => (
                   <div key={i} className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-900/20 to-transparent border-l-2 border-purple-500 rounded-r-xl">
                      <span className="text-[10px] text-purple-500 font-mono font-black pt-0.5">0{i+1}</span>
                      <p className="text-[10px] text-slate-300 tracking-widest leading-relaxed">{cond}</p>
                   </div>
                 )) : (
                   <div className="flex flex-col items-center justify-center py-4 bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
                      <span className="text-lg mb-1 opacity-50">📂</span>
                      <span className="text-[9px] text-slate-500 tracking-widest">NO INTEL ACQUIRED</span>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* 1.5 TACTICAL COMMAND BAR */}
      <div className="bg-[#121212] border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden group">
         <div className={`absolute left-0 top-0 bottom-0 w-1 ${intensityTheme.bg} transition-colors duration-1000`}></div>
         
         <div className="flex items-center gap-5 flex-1 w-full min-w-0">
            {/* PROTEÇÃO RBAC */}
            {isStaff && (
               <button onClick={() => { setConfigForm({ teamAcronym: squadConfig.teamAcronym, directive: squadConfig.directive, phase: squadConfig.phase, week: squadConfig.week, intensity: squadConfig.intensity, load: squadConfig.load }); setConfigModalOpen(true); }} className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors font-black px-4 py-3 rounded-xl text-[10px] tracking-widest shadow-lg shrink-0 flex items-center gap-2">
                  ⚙️ CONFIG
               </button>
            )}
            <div className="flex flex-col min-w-0">
               <span className="text-[9px] text-slate-500 tracking-widest uppercase mb-0.5">Tactical Directive</span>
               <span className="text-white text-sm tracking-[0.2em] font-black italic truncate">{squadConfig.directive}</span>
            </div>
         </div>

         <div className="w-px h-12 bg-white/10 hidden lg:block shrink-0"></div>

         <div className="flex flex-col w-full lg:w-[340px] shrink-0 gap-3">
            <div className="flex items-end justify-between w-full">
               <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 tracking-widest uppercase mb-0.5">Periodization</span>
                  <span className="text-white text-[11px] tracking-[0.2em] font-black italic uppercase">WEEK {squadConfig.week}: {squadConfig.phase}</span>
               </div>
               <span className={`text-[10px] font-black italic tracking-widest uppercase ${intensityTheme.text}`}>
                  {squadConfig.load} LOAD
               </span>
            </div>
            
            <div className="flex items-center gap-3 w-full">
               <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
                  <div className={`absolute top-0 bottom-0 left-0 ${intensityTheme.bg} ${intensityTheme.shadow} transition-all duration-1000`} style={{ width: `${squadConfig.intensity}%` }}></div>
               </div>
               <span className={`text-[10px] font-black ${intensityTheme.text} w-8 text-right`}>{squadConfig.intensity}%</span>
            </div>
         </div>
      </div>

      {/* BIOMETRIC & COGNITIVE TELEMETRY */}
      <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-20 group-hover:opacity-100 transition-all"></div>
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-white/5 pb-6">
            <div><h3 className="text-xl text-white italic flex items-center gap-3"><div className="w-1.5 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div> Squad Readiness</h3><p className="text-[9px] text-slate-500 tracking-[0.3em] mt-2">PREVENÇÃO DE LESÕES E BURN-OUT TÁTICO</p></div>
            <button onClick={() => setWellnessModalOpen(true)} className="bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white px-6 py-3 rounded-2xl text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2"><span className="text-lg leading-none">+</span> DAILY SYNC</button>
         </div>

         {teamWellness.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* RENDERIZA OS JOGADORES AUTORIZADOS */}
              {teamWellness
                .filter(p => isStaff || p.puuid === currentUser.puuid)
                .map((p) => {
                 const isDanger = p.score < 65; const isOptimal = p.score > 85;
                 const colorClass = isDanger ? 'text-red-400 border-red-500/30 bg-red-500/5' : isOptimal ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5';

                 return (
                   <div key={p.puuid} className={`relative p-5 rounded-[24px] border transition-all overflow-hidden ${colorClass}`}>
                      
                      {!p.hasAnsweredToday && (
                        <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-white/5">
                           <span className="text-3xl mb-3 animate-pulse opacity-50">⏳</span>
                           <span className="text-[9px] text-slate-400 tracking-[0.2em] font-black text-center px-4 leading-relaxed">PENDENTE DE<br/>RESPOSTA HOJE</span>
                        </div>
                      )}

                      {isStaff && p.history.length > 0 && (
                         <button onClick={() => setWellnessHistoryModal({ isOpen: true, player: p, history: p.history })} className="absolute top-4 right-4 z-30 text-[8px] bg-black/40 hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded border border-white/5 transition-all">
                            HISTÓRICO
                         </button>
                      )}

                      <div className="flex justify-between items-start mb-4 relative z-10">
                         <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                           {p.photo && <img src={p.photo} alt={p.name} className="w-9 h-9 rounded-full border border-white/10 object-cover shrink-0 mt-0.5" />}
                           <div className="flex-1 min-w-0">
                             <span className="text-[8px] text-slate-500 uppercase tracking-widest block mb-0.5">{p.role}</span>
                             <span className="text-sm font-black text-white break-words leading-tight block">{p.name}</span>
                           </div>
                         </div>
                         <span className={`text-2xl font-black italic leading-none shrink-0 pt-1 ${isDanger ? 'text-red-400 animate-pulse' : ''}`}>{p.score}%</span>
                      </div>
                      <div className="space-y-2 relative z-10">
                        <WellnessBar label="SONO" value={p.sleep} />
                        <WellnessBar label="MENTAL" value={p.mental} />
                        <WellnessBar label="FÍSICO" value={p.physical} />
                      </div>
                   </div>
                 );
              })}

              {/* TAPA-BURACO PARA QUANDO FOR JOGADOR (OCUPA O RESTO DO GRID) */}
              {!isStaff && teamWellness.filter(p => p.puuid === currentUser.puuid).length > 0 && (
                 <div className="md:col-span-1 lg:col-span-4 bg-white/[0.02] border border-dashed border-white/10 rounded-[24px] p-6 flex flex-col justify-center items-center text-center transition-all hover:border-white/20 hover:bg-white/[0.04]">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                       <span className="text-xl opacity-50 grayscale">🛡️</span>
                    </div>
                    <h4 className="text-white text-lg italic font-black mb-2 uppercase">PROTOCOLO DE PRIVACIDADE ATIVO</h4>
                    <p className="text-[10px] text-slate-400 max-w-lg leading-relaxed tracking-widest uppercase">
                       A BIOMETRIA DA SUA EQUIPE É ESTRITAMENTE RESTRITA À COMISSÃO TÉCNICA.<br/><br/>
                       SEU ÚNICO OBJETIVO É GARANTIR QUE SUA MÁQUINA ESTEJA 100% OPERACIONAL. FAÇA SEU DAILY SYNC TODOS OS DIAS ANTES DOS TREINOS.
                    </p>
                 </div>
              )}

           </div>
         ) : <div className="text-center py-10"><p className="text-slate-500 text-xs tracking-widest">NENHUM JOGADOR ATIVO NO ROSTER DA TAG {squadConfig.teamAcronym}.</p></div>}
      </div>

      {/* SQUAD FORM & KPI GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Analytic Cycles" value={stats.matches} color="text-blue-400" sub={`Matches (${squadConfig.teamAcronym})`} icon="⚡" />
          <StatCard label="Global Efficiency" value={`${stats.winrate}%`} color="text-emerald-400" sub="Squad Win Rate" icon="📈" />
          <StatCard label="Active Units" value={stats.players} color="text-purple-400" sub="Roster Depth" icon="👥" />
        </div>

        <div className="lg:col-span-4 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-20 group-hover:opacity-100 transition-all"></div>
          <h3 className="text-sm text-slate-500 tracking-widest leading-none mb-6">INTERNAL MVP RACE</h3>
          <div className="space-y-4">
             {squadForm.length > 0 ? squadForm.map((player, idx) => (
                <div key={player.name} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                   <div className="flex items-center gap-3 flex-1 pr-4">
                      <span className="text-[10px] text-slate-600 font-mono w-2 shrink-0">{idx + 1}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${player.rating >= 8 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{player.role}</span>
                      <span className="text-white text-xs break-words leading-tight">{player.name}</span>
                   </div>
                   <div className="flex items-center gap-4 shrink-0">
                      <span className={`text-[8px] tracking-widest ${player.streak.includes('FIRE') ? 'text-amber-500 animate-pulse' : 'text-slate-500'}`}>{player.streak}</span>
                      <span className="text-sm font-black italic text-white w-6 text-right">{player.rating}</span>
                   </div>
                </div>
             )) : <p className="text-[10px] text-slate-600">SEM DADOS.</p>}
          </div>
        </div>
      </div>

      {/* ADVANCED SCRIM REPORT */}
      <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-20 group-hover:opacity-100 transition-all"></div>
         <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
            <div><h3 className="text-xl text-white italic">Advanced Scrim Report</h3><p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">HISTÓRICO COMPORTAMENTAL</p></div>
            
            {/* PROTEÇÃO RBAC */}
            {isStaff && (
               <button onClick={() => { setEditScrimId(null); setScrimForm({ date: '', opponent: '', result: 'W', score: '', mode: 'MD1', comp: '', difficulty: 'CONTROLADO', punctuality: 'PONTUAIS', remakes: 0, match_ids: '' }); setScrimModalOpen(true); }} className="bg-white/10 border border-white/20 text-white hover:bg-white hover:text-black px-4 py-2 rounded-xl text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2"><span className="text-lg leading-none">+</span> LOG REPORT</button>
            )}
         </div>
         <div className="overflow-x-auto custom-scrollbar pb-4 max-h-[400px]">
            <table className="w-full text-left border-separate border-spacing-y-3 min-w-[800px]">
               <thead className="sticky top-0 bg-[#121212] z-10">
                 <tr className="text-[9px] text-slate-600 tracking-[0.2em] uppercase">
                   <th className="px-4 pb-2">DATA / OPONENTE</th>
                   <th className="px-4 pb-2 text-center">RES / PLACAR</th>
                   <th className="px-4 pb-2 text-center">MODO / COMP TESTADA</th>
                   <th className="px-4 pb-2 text-center">DIFICULDADE</th>
                   <th className="px-4 pb-2 text-center">PONTUALIDADE</th>
                   <th className="px-4 pb-2 text-center">REMAKES</th>
                 </tr>
               </thead>
               <tbody>
                 {scrimReports.length > 0 ? scrimReports.map((scrim) => (
                   <tr key={scrim.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all group/row relative">
                     <td className="p-4 rounded-l-2xl">
                        <div className="flex items-center gap-4">
                           <img src={getTeamLogo(scrim.opponent_acronym)} alt={scrim.opponent_acronym} className="w-11 h-11 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] shrink-0" />
                           <div className="flex flex-col">
                              <span className="text-blue-400 text-[10px] tracking-widest mb-1">{formatDate(scrim.scrim_date)}</span>
                              <span className="text-white text-lg font-black tracking-tighter leading-none">VS {scrim.opponent_acronym}</span>
                           </div>
                        </div>
                     </td>
                     <td className="p-4 text-center">
                         <div className="flex flex-col items-center">
                            <span className={`text-xl font-black italic leading-none ${scrim.result === 'W' ? 'text-emerald-400' : scrim.result === 'L' ? 'text-red-400' : 'text-slate-500'}`}>{scrim.result}</span>
                            {scrim.score && <span className="text-[10px] text-white mt-1 font-black">{scrim.score}</span>}
                         </div>
                     </td>
                     <td className="p-4 text-center">
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] text-white font-black tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10 mb-1">{scrim.mode || 'MD1'}</span>
                            <span className="text-[9px] text-slate-400 tracking-widest">{scrim.comp_tested || 'N/A'}</span>
                         </div>
                     </td>
                     <td className="p-4 text-center"><span className={`text-[9px] px-3 py-1.5 rounded-lg border tracking-widest ${getDifficultyColor(scrim.difficulty)}`}>{scrim.difficulty}</span></td>
                     <td className="p-4 text-center"><span className={`text-[9px] px-3 py-1 rounded border tracking-widest ${getPunctualityColor(scrim.punctuality)}`}>{scrim.punctuality}</span></td>
                     <td className="p-4 text-center rounded-r-2xl relative">
                        <span className={`text-[10px] font-black ${scrim.remakes === 0 ? 'text-slate-600' : scrim.remakes > 1 ? 'text-red-400' : 'text-yellow-400'}`}>{scrim.remakes} RMK</span>
                        
                        {/* PROTEÇÃO RBAC */}
                        {isStaff && (
                           <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-2 transition-all bg-[#121212]/90 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-xl">
                              <button onClick={() => { setEditScrimId(scrim.id); setScrimForm({ date: scrim.scrim_date, opponent: scrim.opponent_acronym, result: scrim.result, score: scrim.score || '', mode: scrim.mode || 'MD1', comp: scrim.comp_tested, difficulty: scrim.difficulty, punctuality: scrim.punctuality, remakes: scrim.remakes, match_ids: scrim.match_ids || '' }); setScrimModalOpen(true); }} className="text-[9px] text-blue-400 hover:text-white px-3 py-1 bg-blue-500/10 rounded hover:bg-blue-600 transition-colors tracking-widest">EDITAR</button>
                              <button onClick={() => handleDeleteScrim(scrim.id)} className="text-[9px] text-red-400 hover:text-white px-3 py-1 bg-red-500/10 rounded hover:bg-red-600 transition-colors tracking-widest">EXCLUIR</button>
                           </div>
                        )}
                     </td>
                   </tr>
                 )) : <tr><td colSpan={6} className="text-center py-6 text-[10px] text-slate-600">NENHUM REPORT CADASTRADO PARA {squadConfig.teamAcronym}.</td></tr>}
               </tbody>
            </table>
         </div>
      </div>

      {/* TACTICAL DATA BLOCKS E VOD REVIEW QUEUE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Radar Chart */}
        <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl h-[450px] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-20 group-hover:opacity-100 transition-all"></div>
          <h3 className="text-xl text-white mb-6 italic flex items-center gap-3"><div className="w-1.5 h-5 bg-blue-500 rounded-full"></div> Squad Performance Index</h3>
          <ResponsiveContainer width="100%" height="90%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={teamKpiData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900', fontStyle: 'italic' }} />
              <Radar name="Squad" dataKey="A" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.4} />
              <Radar name="Tier Avg" dataKey="B" stroke="#64748b" strokeWidth={2} strokeDasharray="3 3" fill="transparent" />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* VOD REVIEW QUEUE */}
        <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden group h-[450px] flex flex-col">
           <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-20 group-hover:opacity-100 transition-all"></div>
           <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4 shrink-0">
              <div><h3 className="text-xl text-white italic">VOD Review Queue</h3><p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">PENDING ANALYTICAL TASKS</p></div>
              <div className="text-[10px] text-amber-500 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg">{vodTasks.filter(t => !t.is_done).length} PENDING</div>
           </div>
           
           <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
              {vodTasks.length > 0 ? vodTasks.map((task) => {
                let colorClass = 'text-slate-400 border-slate-500/30 bg-slate-500/10';
                if (task.tag === 'URGENTE') colorClass = 'text-red-400 border-red-500/30 bg-red-500/10';
                if (task.tag === 'MACRO') colorClass = 'text-blue-400 border-blue-500/30 bg-blue-500/10';
                if (task.tag === 'MICRO') colorClass = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                if (task.tag === 'DRAFT') colorClass = 'text-purple-400 border-purple-500/30 bg-purple-500/10';

                return (
                  <div key={task.id} onClick={() => toggleTask(task.id, task.is_done)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${task.is_done ? 'bg-black/40 border-white/5 opacity-50 hover:opacity-100' : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'}`}>
                     <div className={`w-5 h-5 shrink-0 rounded-md border-2 mt-0.5 flex items-center justify-center transition-colors ${task.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>{task.is_done && <span className="text-white text-[10px]">✓</span>}</div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2"><span className={`text-[8px] px-2 py-0.5 rounded-md border ${colorClass} tracking-widest`}>{task.tag}</span></div>
                        <p className={`text-xs text-white leading-snug ${task.is_done ? 'line-through text-slate-500' : ''}`}>{task.task_text}</p>
                     </div>
                  </div>
                );
              }) : <p className="text-[10px] text-slate-600 text-center py-4">NENHUMA TAREFA PENDENTE.</p>}
           </div>

           {/* PROTEÇÃO RBAC NO VOD REVIEW TBM (Opcional, mas faz sentido) */}
           {isStaff && (
              <button onClick={() => setVodModalOpen(true)} className="w-full py-3 rounded-2xl border border-dashed border-white/10 text-slate-500 text-[10px] tracking-widest hover:border-white/30 hover:text-white transition-all bg-black/20 shrink-0 mt-auto">
                 + ADICIONAR NOVA TAREFA
              </button>
           )}
        </div>
      </div>

      {/* =========================================
         MODAIS DE CONTROLE (ANALYST TOOLS)
      ========================================= */}

      {/* MODAL 0: COMMAND BAR CONFIG */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleUpdateConfig} className="w-full max-w-2xl bg-[#121212] border border-yellow-500/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(234,179,8,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-900 to-yellow-500"></div>
            <div className="text-center mb-8"><h2 className="text-3xl italic leading-none font-black text-white">COMMAND PROTOCOL</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">ATUALIZAR DIRETRIZES E CONFIGURAÇÕES DA SQUAD</p></div>
            
            <div className="space-y-4">
              <div><label className="text-[10px] text-blue-400 ml-2 font-black">Nossa Tag (Filtro Global da Equipe)</label><input type="text" required className="w-full bg-blue-900/10 border border-blue-500/30 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase" placeholder="Ex: RMD" value={configForm.teamAcronym} onChange={e => setConfigForm({...configForm, teamAcronym: e.target.value.toUpperCase()})} /></div>
              <div><label className="text-[10px] text-slate-500 ml-2">Diretriz Tática Global (Foco da Semana)</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic uppercase" value={configForm.directive} onChange={e => setConfigForm({...configForm, directive: e.target.value.toUpperCase()})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] text-slate-500 ml-2">Fase da Temporada</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic uppercase" value={configForm.phase} onChange={e => setConfigForm({...configForm, phase: e.target.value.toUpperCase()})} /></div>
                <div><label className="text-[10px] text-slate-500 ml-2">Semana Atual</label><input type="number" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic" value={configForm.week} onChange={e => setConfigForm({...configForm, week: Number(e.target.value)})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] text-slate-500 ml-2 flex justify-between"><span>Intensidade de Treino</span> <span className="text-yellow-500">{configForm.intensity}%</span></label><div className="flex items-center h-14 bg-black border border-white/10 rounded-2xl px-4 mt-1"><input type="range" min="0" max="100" className="w-full accent-yellow-500" value={configForm.intensity} onChange={e => setConfigForm({...configForm, intensity: Number(e.target.value)})} /></div></div>
                <div>
                   <label className="text-[10px] text-slate-500 ml-2">Carga Cognitiva</label>
                   <select value={configForm.load} onChange={e => setConfigForm({...configForm, load: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 mt-1 text-white focus:border-yellow-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer">
                     <option value="RECOVERY">RECOVERY (LOW)</option><option value="MODERATE">MODERATE (MAINTENANCE)</option><option value="MAXIMUM">MAXIMUM (HIGH LOAD)</option>
                   </select>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setConfigModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-yellow-500 text-black rounded-2xl hover:bg-yellow-400 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.3)]">SALVAR & RECARREGAR</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: TARGET INTEL */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleUpdateTarget} className="w-full max-w-xl bg-[#121212] border border-purple-500/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(168,85,247,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-900 to-purple-500"></div>
            <div className="text-center mb-8"><h2 className="text-3xl italic leading-none font-black text-white">TARGET INTEL</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">DEFINIR CONDIÇÕES DE VITÓRIA</p></div>
            <div className="space-y-4">
              <div className="flex gap-4 items-center mb-6 p-4 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
                 <img src={getTeamLogo(targetForm.team)} className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                 <div>
                    <p className="text-[9px] text-purple-400 tracking-[0.3em]">LOCKED TARGET</p>
                    <p className="text-2xl text-white font-black italic">{targetForm.team}</p>
                 </div>
              </div>
              
              <div><label className="text-[10px] text-slate-500 ml-2">Win Condition #1 (Prioridade)</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-purple-500 outline-none transition-all font-black italic" placeholder="Ex: Isolar o Top laner no early game..." value={targetForm.win1} onChange={e => setTargetForm({...targetForm, win1: e.target.value})} /></div>
              <div><label className="text-[10px] text-slate-500 ml-2">Win Condition #2</label><input type="text" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-purple-500 outline-none transition-all font-black italic" value={targetForm.win2} onChange={e => setTargetForm({...targetForm, win2: e.target.value})} /></div>
              <div><label className="text-[10px] text-slate-500 ml-2">Win Condition #3</label><input type="text" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-purple-500 outline-none transition-all font-black italic" value={targetForm.win3} onChange={e => setTargetForm({...targetForm, win3: e.target.value})} /></div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setTargetModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-500 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.3)]">SALVAR INTEL</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: ADD VOD TASK */}
      {isVodModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleAddVodTask} className="w-full max-w-xl bg-[#121212] border border-amber-500/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(245,158,11,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-900 to-amber-500"></div>
            <div className="text-center mb-8"><h2 className="text-3xl italic leading-none font-black text-white">VOD REVIEW TASK</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">ADICIONAR TAREFA DE ANÁLISE</p></div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Tag da Categoria</label>
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setVodForm({...vodForm, tag: 'URGENTE'})} className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black ${vodForm.tag === 'URGENTE' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>URGENTE</button>
                  <button type="button" onClick={() => setVodForm({...vodForm, tag: 'MACRO'})} className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black ${vodForm.tag === 'MACRO' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>MACRO</button>
                  <button type="button" onClick={() => setVodForm({...vodForm, tag: 'MICRO'})} className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black ${vodForm.tag === 'MICRO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>MICRO</button>
                  <button type="button" onClick={() => setVodForm({...vodForm, tag: 'DRAFT'})} className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black ${vodForm.tag === 'DRAFT' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>DRAFT</button>
                </div>
              </div>
              <div><label className="text-[10px] text-slate-500 ml-2">Descrição da Tarefa</label><textarea required rows={3} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all font-black italic resize-none" value={vodForm.text} onChange={e => setVodForm({...vodForm, text: e.target.value})}></textarea></div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setVodModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)]">ADICIONAR TAREFA</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: DAILY SYNC */}
      {isWellnessModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleWellnessSubmit} className="w-full max-w-2xl bg-[#121212] border border-emerald-500/20 rounded-[40px] p-8 md:p-10 space-y-8 shadow-[0_0_100px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-900 to-emerald-400"></div>
            <div className="text-center mb-8"><h2 className="text-3xl italic leading-none font-black text-white">DAILY READINESS SYNC</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">PROTOCOLO DE BIOMETRIA</p></div>
            <div className="space-y-4 mb-4">
               <label className="text-[10px] text-slate-500 ml-2">Jogador</label>
               <select value={wellnessForm.puuid} onChange={e => setWellnessForm({...wellnessForm, puuid: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer">
                 {/* Staff vê todos, Jogador só vê a si mesmo */}
                 {roster.filter(p => isStaff || p.puuid === currentUser.puuid).map(p => <option key={p.puuid} value={p.puuid}>{p.nickname} ({p.primary_role})</option>)}
               </select>
            </div>
            <div className="space-y-8">
               <WellnessInput icon="💤" title="Qualidade do Sono" desc="1 = Insônia/Péssimo | 5 = Recuperação Total" value={wellnessForm.sleep} onChange={(v: any) => setWellnessForm({...wellnessForm, sleep: v})} />
               <WellnessInput icon="🧠" title="Estado Mental & Stress" desc="1 = Tiltado/Esgotado | 5 = Foco Total/Calmo" value={wellnessForm.mental} onChange={(v: any) => setWellnessForm({...wellnessForm, mental: v})} />
               <WellnessInput icon="🦾" title="Dores & Fadiga Física" desc="1 = Dor forte (Punho/Costas) | 5 = Zero Dor/Pronto" value={wellnessForm.physical} onChange={(v: any) => setWellnessForm({...wellnessForm, physical: v})} />
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setWellnessModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-500 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)]">SINCRONIZAR DADOS</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: ADD MISSION */}
      {isMissionModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveMission} className="w-full max-w-xl bg-[#121212] border border-blue-500/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(59,130,246,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-blue-400"></div>
            <div className="text-center mb-8"><h2 className="text-3xl italic leading-none font-black text-white">{editMissionId ? "EDIT EVENT" : "NEW MISSION"}</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">AGENDAR COMPROMISSO TÁTICO</p></div>
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                 {missionForm.opponent && <img src={getTeamLogo(missionForm.opponent)} className="w-14 h-14 rounded-2xl border border-blue-500/30 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />}
                 <div className="flex-1">
                    <label className="text-[10px] text-slate-500 ml-2">Adversário</label>
                    <select required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" value={missionForm.opponent} onChange={e => setMissionForm({...missionForm, opponent: e.target.value})}>
                       <option value="" disabled>SELECIONE A EQUIPE...</option>
                       {teamsList.map(t => <option key={t.acronym} value={t.acronym}>{t.name} ({t.acronym})</option>)}
                    </select>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] text-slate-500 ml-2">Data</label><input type="date" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase" value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} /></div>
                <div><label className="text-[10px] text-slate-500 ml-2">Horário</label><input type="time" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase" value={missionForm.time} onChange={e => setMissionForm({...missionForm, time: e.target.value})} /></div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Tipo de Missão</label>
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setMissionForm({...missionForm, type: 'SCRIM'})} className={`flex-1 py-4 rounded-xl border-2 transition-all ${missionForm.type === 'SCRIM' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>SCRIM</button>
                  <button type="button" onClick={() => setMissionForm({...missionForm, type: 'OFFICIAL'})} className={`flex-1 py-4 rounded-xl border-2 transition-all ${missionForm.type === 'OFFICIAL' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black/50 border-white/5 text-slate-500 hover:border-white/20'}`}>OFFICIAL MATCH</button>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setMissionModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                {editMissionId ? "SALVAR ALTERAÇÕES" : "ADICIONAR AO RADAR"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: LOG SCRIM REPORT */}
      {isScrimModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSaveScrim} className="w-full max-w-4xl bg-[#121212] border border-white/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(255,255,255,0.1)] relative overflow-hidden my-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-white"></div>
            <div className="text-center mb-6"><h2 className="text-3xl italic leading-none font-black text-white">{editScrimId ? "EDIT SCRIM REPORT" : "LOG SCRIM REPORT"}</h2><p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">AUDITORIA COMPORTAMENTAL</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               <div className="space-y-4">
                 <div className="flex gap-4 items-center">
                    {scrimForm.opponent && <img src={getTeamLogo(scrimForm.opponent)} className="w-14 h-14 rounded-2xl border border-white/20 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />}
                    <div className="flex-1">
                       <label className="text-[10px] text-slate-500 ml-2">Adversário (Tag)</label>
                       <select required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" value={scrimForm.opponent} onChange={e => setScrimForm({...scrimForm, opponent: e.target.value})}>
                          <option value="" disabled>SELECIONE A EQUIPE...</option>
                          {teamsList.map(t => <option key={t.acronym} value={t.acronym}>{t.name} ({t.acronym})</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] text-slate-500 ml-2">Data (Padrão: Hoje)</label><input type="date" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase" value={scrimForm.date} onChange={e => setScrimForm({...scrimForm, date: e.target.value})} /></div>
                    <div>
                       <label className="text-[10px] text-slate-500 ml-2">Modo de Jogo</label>
                       <select value={scrimForm.mode} onChange={e => setScrimForm({...scrimForm, mode: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer">
                         <option value="MD1">MD1</option><option value="MD2">MD2</option><option value="MD3">MD3</option><option value="MD5">MD5</option><option value="FEARLESS">FEARLESS</option>
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] text-slate-500 ml-2">Resultado da Série</label>
                       <div className="flex gap-2 mt-1">
                         <button type="button" onClick={() => setScrimForm({...scrimForm, result: 'W'})} className={`flex-1 py-4 rounded-xl border-2 transition-all ${scrimForm.result === 'W' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-black/50 border-white/5 text-slate-500'}`}>VITÓRIA</button>
                         <button type="button" onClick={() => setScrimForm({...scrimForm, result: 'L'})} className={`flex-1 py-4 rounded-xl border-2 transition-all ${scrimForm.result === 'L' ? 'bg-red-600 border-red-500 text-white' : 'bg-black/50 border-white/5 text-slate-500'}`}>DERROTA</button>
                       </div>
                    </div>
                    <div><label className="text-[10px] text-slate-500 ml-2">Placar (Opcional)</label><input type="text" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase mt-1" placeholder="Ex: 2-1" value={scrimForm.score} onChange={e => setScrimForm({...scrimForm, score: e.target.value})} /></div>
                 </div>
               </div>

               <div className="space-y-4">
                 <div><label className="text-[10px] text-slate-500 ml-2">Comp Testada (Foco Geral)</label><input type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase" placeholder="Ex: Hard Engage, Split Push 1-3-1" value={scrimForm.comp} onChange={e => setScrimForm({...scrimForm, comp: e.target.value})} /></div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 ml-2">Nível de Dificuldade</label>
                      <select value={scrimForm.difficulty} onChange={e => setScrimForm({...scrimForm, difficulty: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer">
                        <option value="STOMPAMOS">Stompamos</option><option value="FÁCIL">Fácil</option><option value="CONTROLADO">Controlado</option><option value="DIFÍCIL">Difícil</option><option value="MT DIFÍCIL">Muito Difícil</option><option value="STOMPADOS">Stompados</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 ml-2">Pontualidade</label>
                      <select value={scrimForm.punctuality} onChange={e => setScrimForm({...scrimForm, punctuality: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-white/50 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer">
                        <option value="PONTUAIS">Pontuais (Ambos)</option><option value="NOSSO ATRASO">Nosso Atraso</option><option value="ATRASO DELES">Atraso Deles</option><option value="DESMARCARAM NA HORA">Desmarcaram</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 items-start">
                    <div>
                      <label className="text-[10px] text-slate-500 ml-2">Remakes</label>
                      <div className="flex gap-2 mt-1">
                         {[0, 1, 2, 3].map(num => (<button key={num} type="button" onClick={() => setScrimForm({...scrimForm, remakes: num})} className={`flex-1 py-4 rounded-xl border-2 transition-all ${scrimForm.remakes === num ? 'bg-white text-black border-white' : 'bg-black/50 border-white/5 text-slate-500'}`}>{num}</button>))}
                      </div>
                    </div>
                    <div>
                       <label className="text-[10px] text-slate-500 ml-2">Match IDs (Separe por vírgula)</label>
                       <textarea className="w-full bg-black border border-white/10 rounded-2xl px-6 py-3 text-white focus:border-white/50 outline-none transition-all font-black italic text-xs resize-none mt-1 h-[60px]" placeholder="BR1_123456, BR1_654321" value={scrimForm.match_ids} onChange={e => setScrimForm({...scrimForm, match_ids: e.target.value})}></textarea>
                    </div>
                 </div>
               </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-white/5">
              <button type="button" onClick={() => setScrimModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" className="flex-1 px-8 py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                 {editScrimId ? "SALVAR ALTERAÇÕES" : "LOG REPORT"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: WELLNESS HISTORY (Exclusivo Staff) */}
      {wellnessHistoryModal.isOpen && wellnessHistoryModal.player && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#121212] border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
            
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <img src={wellnessHistoryModal.player.photo} className="w-12 h-12 rounded-full border-2 border-emerald-500/30 object-cover" />
                  <div>
                     <h2 className="text-2xl italic leading-none font-black text-white">{wellnessHistoryModal.player.name}</h2>
                     <p className="text-[10px] text-slate-500 tracking-[0.3em] mt-1 uppercase">HISTÓRICO BIOMÉTRICO</p>
                  </div>
               </div>
               <button onClick={() => setWellnessHistoryModal({ isOpen: false, player: null, history: [] })} className="text-slate-500 hover:text-white text-2xl font-black">&times;</button>
            </div>

            <div className="overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
               <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-[#121212] z-10">
                    <tr className="text-[9px] text-slate-600 tracking-[0.2em] uppercase">
                      <th className="px-4 pb-2">DATA</th>
                      <th className="px-4 pb-2 text-center">READINESS</th>
                      <th className="px-4 pb-2 text-center">SONO</th>
                      <th className="px-4 pb-2 text-center">MENTAL</th>
                      <th className="px-4 pb-2 text-center">FÍSICO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wellnessHistoryModal.history.map((record: any) => (
                      <tr key={record.record_date} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                        <td className="p-4 rounded-l-2xl text-[10px] font-black text-slate-300 tracking-widest">{formatDate(record.record_date)}</td>
                        <td className="p-4 text-center"><span className={`text-sm font-black italic ${record.readiness_percent < 65 ? 'text-red-400' : record.readiness_percent > 85 ? 'text-emerald-400' : 'text-yellow-400'}`}>{record.readiness_percent}%</span></td>
                        <td className="p-4 text-center text-xs">{record.sleep_score}</td>
                        <td className="p-4 text-center text-xs">{record.mental_score}</td>
                        <td className="p-4 text-center text-xs rounded-r-2xl">{record.physical_score}</td>
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

// --- SUB-COMPONENTES DE UI ---

function StatCard({ label, value, color, sub, icon }: any) {
  return (
    <div className="bg-[#121212] border border-white/5 p-8 rounded-[40px] hover:border-white/20 transition-all shadow-xl relative overflow-hidden group h-full">
      <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all pointer-events-none grayscale">{icon}</div>
      <div className="relative z-10 flex flex-col justify-center h-full">
        <p className="text-[10px] text-slate-500 tracking-[0.3em] mb-2 uppercase">{label}</p>
        <p className={`text-5xl font-black italic leading-none mb-3 ${color} drop-shadow-lg`}>{value}</p>
        <div className="h-px w-12 bg-white/10 mb-3"></div>
        <p className="text-[9px] text-slate-600 tracking-widest uppercase">{sub}</p>
      </div>
    </div>
  );
}

function Badge({ text, color }: { text: string, color: string }) {
  return (
    <span className={`${color} text-white text-[9px] px-3 py-1 rounded-full border border-white/10 shadow-lg tracking-widest uppercase`}>{text}</span>
  );
}

function WellnessBar({ label, value }: { label: string, value: number }) {
  const isDanger = value <= 2; const isMid = value === 3;
  const color = isDanger ? 'bg-red-500' : isMid ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[7px] text-slate-500 w-10 text-right">{label}</span>
      <div className="flex gap-1 flex-1">{[1, 2, 3, 4, 5].map((level) => (<div key={level} className={`h-1.5 flex-1 rounded-sm ${level <= value ? color : 'bg-white/5'}`}></div>))}</div>
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
            return (<button key={num} type="button" onClick={() => onChange(num)} className={`flex-1 py-4 rounded-xl border-2 text-lg font-black transition-all ${isActive ? `${activeColor} text-white` : 'bg-black/50 border-white/5 text-slate-600 hover:border-white/20'}`}>{num}</button>);
          })}
       </div>
    </div>
  );
}