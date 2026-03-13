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
const ROLES_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'];

// --- CALIBRAGEM TÁTICA DO MAPA ---
const MAP_OFFSET = 3.5; 
const MAP_SCALE = 93;   
const GAME_MAX = 15000; 

const SEQUENCE_LABELS: { [key: number]: string } = {
  1: 'bb1', 2: 'rb1', 3: 'bb2', 4: 'rb2', 5: 'bb3', 6: 'rb3',
  7: 'b1', 8: 'r1', 9: 'r2', 10: 'b2', 11: 'b3', 12: 'r3',
  13: 'rb4', 14: 'bb4', 15: 'rb5', 16: 'bb5',
  17: 'r4', 18: 'b4', 19: 'b5', 20: 'r5'
};

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

// --- UTILITÁRIOS ---

function formatTime(decimal: number) {
  if (isNaN(decimal) || decimal === null) return "00:00";
  const mins = Math.floor(decimal);
  const secs = Math.round((decimal - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeRole(lane: string | null): string {
  if (!lane) return 'mid';
  const l = lane.toLowerCase().trim();
  if (l.includes('top')) return 'top';
  if (l.includes('jungle')) return 'jungle';
  if (l.includes('mid')) return 'mid';
  if (l.includes('bot') || l.includes('adc')) return 'adc';
  return 'support';
}

function sortPlayersByRole(players: any[]) {
  return [...players].sort((a, b) => {
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

function getScoreColor(score: number | null) {
  if (!score) return "text-slate-600";
  if (score >= 90) return "text-purple-400"; 
  if (score >= 80) return "text-blue-400";     
  if (score >= 70) return "text-emerald-400"; 
  if (score >= 60) return "text-yellow-400";  
  return "text-red-400";                             
}

function getRoleIcon(role: string, size: string = "w-5 h-5") {
  const basePath = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions";
  let iconName = "";
  switch (role.toLowerCase()) {
    case 'top': iconName = "icon-position-top.png"; break;
    case 'jungle': iconName = "icon-position-jungle.png"; break;
    case 'mid': iconName = "icon-position-middle.png"; break;
    case 'adc': iconName = "icon-position-bottom.png"; break; 
    case 'support': iconName = "icon-position-utility.png"; break;
    default: return <span className="text-[10px]">👤</span>;
  }
  return <img src={`${basePath}/${iconName}`} alt={role} className={`${size} object-contain`} />;
}

// --- DROPDOWNS CUSTOMIZADOS (Z-INDEX 200+) ---

function ObjectiveSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-[200]" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-3 min-w-[180px] hover:border-blue-500/50 transition-all shadow-lg font-black italic uppercase leading-none"
      >
        <img src={OBJECTIVE_ASSETS[value]?.icon} className="w-4 h-4 object-contain" alt="" />
        <span className="text-[10px] text-white flex-1 text-left">{OBJECTIVE_LABELS[value]}</span>
        <span className={`text-[8px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-[300]">
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {ORDERED_OBJECTIVES.map(objKey => (
              <button
                key={objKey}
                onClick={() => { onChange(objKey); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-600/20 transition-colors border-b border-slate-800 last:border-0 ${value === objKey ? 'bg-blue-600/10' : ''}`}
              >
                <img src={OBJECTIVE_ASSETS[objKey]?.icon} className="w-4 h-4 object-contain" alt="" />
                <span className={`text-[10px] uppercase font-black italic ${value === objKey ? 'text-blue-400' : 'text-slate-400'}`}>{OBJECTIVE_LABELS[objKey]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SideSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-[200]" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-3 min-w-[120px] hover:border-blue-500/50 transition-all shadow-lg font-black italic uppercase leading-none"
      >
        <div className={`w-1.5 h-3 rounded-full ${value === 'Blue' ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
        <span className="text-[10px] text-white flex-1 text-left">{value} Side</span>
        <span className={`text-[8px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-[300]">
          {['Blue', 'Red'].map(side => (
            <button
              key={side}
              onClick={() => { onChange(side); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${value === side ? 'bg-slate-800/50' : ''}`}
            >
              <div className={`w-1.5 h-3 rounded-full ${side === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <span className={`text-[10px] uppercase font-black italic ${value === side ? 'text-white' : 'text-slate-500'}`}>{side} Side</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- TICK & TOOLTIP COMPONENTS ---

const CustomXAxisTick = ({ x, y, payload, teamChartData }: any) => {
  const match = teamChartData?.find((d: any) => d.match_id === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      {match?.opponent_logo ? (
        <image href={match.opponent_logo} x={-10} y={8} width="20" height="20" style={{ filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))' }} />
      ) : (
        <text x={0} y={20} textAnchor="middle" fill="#475569" fontSize={7} className="font-black uppercase italic">VS {match?.opponent_acronym || '?'}</text>
      )}
    </g>
  );
};

const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-700 p-4 rounded-[20px] shadow-2xl min-w-[200px] backdrop-blur-md z-[9999] font-black italic uppercase relative border-t-blue-500/20">
        <div className="space-y-1.5">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between items-center gap-4 text-[10px] text-white">
              <span style={{ color: p.color }}>{p.name}</span>
              <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{p.value.toFixed(1)}</span>
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
      <div className="bg-slate-950 border border-slate-700 p-4 rounded-[24px] shadow-2xl min-w-[160px] backdrop-blur-xl z-[9999] font-black italic uppercase relative font-black italic uppercase">
        <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
           <div className={`w-1.5 h-3 rounded-full ${data.name === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
           <span className="text-white text-[10px] tracking-tighter">{data.name} PERFORMANCE</span>
        </div>
        <div className="space-y-1.5">
           {Object.keys(data.ratings).map(key => (
             <div key={key} className="flex justify-between items-center text-[9px]">
               <span className="text-slate-500 uppercase">{key}</span>
               <span className={`${getScoreColor(data.ratings[key])} font-black`}>{data.ratings[key].toFixed(1)}</span>
             </div>
           ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomObjectiveTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 border border-slate-700 p-5 rounded-[24px] shadow-2xl backdrop-blur-xl z-[9999] font-black italic uppercase relative border-t-amber-500/20 font-black italic uppercase">
        <div className="flex items-center gap-4 mb-4 border-b border-slate-800 pb-3">
          <img src={data.hoverImg} className="w-12 h-12 object-contain" alt="" />
          <div><p className="text-white text-xs tracking-tighter leading-none">{data.name}</p><span className="text-[7px] text-slate-500 tracking-widest mt-1">SQUAD TIMING DATA</span></div>
        </div>
        <div className="space-y-3 font-black">
           <div className="flex justify-between items-center leading-none"><span className="text-[8px] text-slate-500">MÉDIA TÁTICA</span><span className="text-blue-400 font-mono text-sm leading-none">{formatTime(data.avg)}</span></div>
           <div className="flex justify-between items-center leading-none"><span className="text-[8px] text-slate-500">JANELA MÍNIMA</span><span className="text-white font-mono text-xs leading-none">{formatTime(payload[0].value[0])}</span></div>
           <div className="flex justify-between items-center leading-none"><span className="text-[8px] text-slate-500">JANELA MÁXIMA</span><span className="text-white font-mono text-xs leading-none">{formatTime(payload[0].value[1])}</span></div>
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
      {assets && <image href={assets.icon} x={-12} y={10} width="24" height="24" style={{ filter: 'drop-shadow(0_0_5px_rgba(255,255,255,0.1))' }} />}
    </g>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function PlayersHubPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("TODOS");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [teamChartData, setTeamChartData] = useState<any[]>([]);
  const [teamObjectiveWindows, setTeamObjectiveWindows] = useState<any[]>([]);
  const [teamWards, setTeamWards] = useState<any[]>([]);
  const [draftStats, setDraftStats] = useState<any[]>([]);
  const [draftViewMode, setDraftViewMode] = useState<'champion' | 'role'>('champion');

  const [heatmapSide, setHeatmapSide] = useState<string>("Blue");
  const [heatmapObjective, setHeatmapObjective] = useState<string>("dragon1");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ puuid: '', nickname: '', team_acronym: '', photo_url: '', primary_role: '' });

  useEffect(() => { checkUserRole(); fetchInitialData(); }, []);
  useEffect(() => { if (filterTeam !== "TODOS") { fetchPerformanceData(filterTeam); fetchAnalysisData(filterTeam); } }, [filterTeam]);

  async function checkUserRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === 'scartiezin@gmail.com') setIsAdmin(true);
  }

  async function fetchInitialData() {
    const { data: t } = await supabase.from('teams').select('*').order('acronym');
    const { data: p } = await supabase.from('hub_players_roster').select('*');
    if (t) setTeams(t);
    if (p) setPlayers(p);
    setLoading(false);
  }

  async function fetchPerformanceData(team: string) {
    const { data } = await supabase.from('hub_players_performance').select('*').eq('team_acronym', team).order('game_start_time', { ascending: true });
    if (data) setTeamChartData(data);
  }

  async function fetchAnalysisData(team: string) {
    const [obj, draft, wards] = await Promise.all([
      supabase.from('hub_players_objectives').select('*').eq('team_acronym', team),
      supabase.from('hub_players_draft').select('*').eq('team_acronym', team),
      supabase.from('hub_players_vision').select('*').eq('team_acronym', team)
    ]);
    if (obj.data) setTeamObjectiveWindows(obj.data);
    if (draft.data) setDraftStats(draft.data);
    if (wards.data) setTeamWards(wards.data);
  }

  const sideStatsData = useMemo(() => {
    if (filterTeam === "TODOS" || teamChartData.length === 0) return null;
    const stats = { blue: { g: 0, w: 0, l: 0, i: 0, c: 0, v: 0 }, red: { g: 0, w: 0, l: 0, i: 0, c: 0, v: 0 } };
    teamChartData.forEach(m => {
      const target = (m.side || '').toUpperCase() === 'BLUE' ? stats.blue : stats.red;
      target.g++; if (m.win_status === 'W') target.w++;
      target.l += (m.avg_lane || 0); target.i += (m.avg_impact || 0); target.c += (m.avg_conversion || 0); target.v += (m.avg_vision || 0);
    });
    return [
      { name: 'Blue', value: stats.blue.g, wr: stats.blue.g > 0 ? Math.round((stats.blue.w / stats.blue.g) * 100) : 0, fill: '#3b82f6', ratings: { lane: stats.blue.l / stats.blue.g, impact: stats.blue.i / stats.blue.g, conv: stats.blue.c / stats.blue.g, vision: stats.blue.v / stats.blue.g } },
      { name: 'Red', value: stats.red.g, wr: stats.red.g > 0 ? Math.round((stats.red.w / stats.red.g) * 100) : 0, fill: '#ef4444', ratings: { lane: stats.red.l / stats.red.g, impact: stats.red.i / stats.red.g, conv: stats.red.c / stats.red.g, vision: stats.red.v / stats.red.g } }
    ].filter(s => s.value > 0);
  }, [teamChartData, filterTeam]);

  const activeWards = useMemo(() => {
    const window = teamObjectiveWindows.find(o => o.side === heatmapSide && o.objective_type.toLowerCase() === heatmapObjective.toLowerCase());
    if (!window) return [];
    return teamWards.filter(w => w.side === heatmapSide && w.minute >= window.min_minute && w.minute <= window.max_minute);
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
        const top = [...records].sort((a,b) => (b.total_count || 0) - (a.total_count || 0))[0];
        assignments[seq] = { name: top.champion, wr: top.win_rate, count: top.total_count, image: getChampionImageUrl(top.champion), ratings: top.avg_lane ? { lane: top.avg_lane, impact: top.avg_impact, conv: top.avg_conv, vision: top.avg_vision } : null };
      }
    }
    return assignments;
  }, [draftStats]);

  const sortedFilteredPlayers = useMemo(() => {
    return sortPlayersByRole(players.filter(p => p.team_acronym === filterTeam));
  }, [players, filterTeam]);

  const boxPlotData = useMemo(() => ORDERED_OBJECTIVES.map(objKey => {
    const s = teamObjectiveWindows.find(o => o.objective_type.toLowerCase() === objKey.toLowerCase() && o.side === heatmapSide);
    const assets = OBJECTIVE_ASSETS[objKey];
    return s ? { name: OBJECTIVE_LABELS[objKey], key: objKey, window: [s.min_minute, s.max_minute], avg: s.avg_minute, icon: assets?.icon, hoverImg: assets?.hover } : null;
  }).filter(Boolean), [teamObjectiveWindows, heatmapSide]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await supabase.from('players').update({ nickname: editForm.nickname, team_acronym: editForm.team_acronym.toUpperCase(), photo_url: editForm.photo_url, primary_role: editForm.primary_role }).eq('puuid', editForm.puuid);
      setIsEditModalOpen(false); fetchInitialData();
    } finally { setSaving(false); }
  };

  const handleDeletePlayer = async (puuid: string) => {
    if (!confirm("Confirmar exclusão definitiva?")) return;
    await supabase.from('players').delete().eq('puuid', puuid); setIsEditModalOpen(false); await fetchInitialData();
  };

  if (loading) return <div className="p-8 text-white text-center font-black animate-pulse uppercase italic tracking-widest leading-none">SCOUTING ENGINE SYNC...</div>;

  return (
    <div className="p-8 max-w-[1550px] mx-auto space-y-12 font-black uppercase italic tracking-tighter pb-20 overflow-visible">
      
      <header className="flex justify-between items-center border-b border-slate-800 pb-8 font-black uppercase italic leading-none overflow-visible">
        <div><h1 className="text-4xl text-white italic tracking-tighter leading-none font-black uppercase italic">Scouting <span className="text-blue-500">Pro</span></h1><p className="text-slate-500 text-[9px] mt-2 font-black">Database: {players.length} Active Operatives</p></div>
      </header>

      {/* FILTROS E SIDE TRACKER (OVERFLOW VISIBLE) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-[50] overflow-visible">
        <div className="flex flex-wrap gap-2 flex-1 font-black uppercase italic overflow-visible">
          <button onClick={() => setFilterTeam("TODOS")} className={`px-5 py-2 rounded-xl text-[10px] transition-all ${filterTeam === "TODOS" ? 'bg-white text-black' : 'bg-slate-900/40 text-slate-500 border border-slate-800'}`}>TODOS</button>
          {teams.map(t => (
            <button key={t.acronym} onClick={() => setFilterTeam(t.acronym)} className={`px-5 py-2 rounded-xl text-[10px] flex items-center gap-2 transition-all ${filterTeam === t.acronym ? 'bg-blue-600 text-white shadow-lg border-transparent' : 'bg-slate-900/40 text-slate-500 border border-slate-800'}`}>
              {t.logo_url && <img src={t.logo_url} alt="" className="w-3.5 h-3.5 object-contain" />}{t.acronym}
            </button>
          ))}
        </div>

        {filterTeam !== "TODOS" && sideStatsData && (
          <div className="flex items-center gap-6 bg-slate-900/40 border border-slate-800 p-4 rounded-[24px] shadow-2xl backdrop-blur-sm z-[100] group hover:border-blue-500/30 transition-all font-black uppercase italic overflow-visible">
             <div className="w-16 h-16 relative font-black uppercase italic leading-none">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={sideStatsData} innerRadius={18} outerRadius={28} paddingAngle={5} dataKey="value" stroke="none">
                      {sideStatsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[8px] text-white font-black">{teamChartData.length}G</div>
             </div>
             <div className="flex flex-col gap-1.5 font-black uppercase italic leading-none">
                {sideStatsData.map(side => (
                  <div key={side.name} className="flex items-center gap-2">
                    {/* LUZ DE LEGENDA CORRIGIDA */}
                    <div className={`w-1 h-2 rounded-full ${side.name === 'Blue' ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`} />
                    <div className="flex items-center gap-2"><span className={`text-[11px] ${side.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{side.wr}% WR</span><span className="text-[7px] text-slate-600 font-mono">{side.value} JOGOS</span></div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {filterTeam === "TODOS" ? (
        <div className="space-y-10 font-black uppercase italic overflow-visible">
          {ROLES_ORDER.map(role => {
            const rolePlayers = sortPlayersByRole(players.filter(p => normalizeRole(p.primary_role) === role));
            if (!rolePlayers.length) return null;
            return (
              <div key={role} className="w-full">
                <h2 className="text-2xl text-white mb-6 flex items-center gap-3 font-black uppercase italic tracking-tighter leading-none"><span className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-xl">{getRoleIcon(role)}</span>{role}</h2>
                <div className="flex overflow-x-auto gap-6 pb-6 snap-x custom-scrollbar">
                  {rolePlayers.map(p => <div key={p.puuid} className="min-w-[280px] snap-start"><PlayerCard player={p} teams={teams} isAdmin={isAdmin} onEdit={() => { setEditForm(p); setIsEditModalOpen(true); }} /></div>)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-12 overflow-visible">
          {/* PERFORMANCE TIMELINE */}
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 h-[320px] shadow-2xl relative overflow-visible font-black uppercase italic">
            <h3 className="text-base text-white tracking-tighter leading-none mb-4 italic font-black uppercase italic"><div className="w-1.5 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] inline-block mr-2" /> Performance Timeline</h3>
            <ResponsiveContainer width="100%" height="88%">
              <LineChart data={teamChartData} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="match_id" tick={(p) => <CustomXAxisTick {...p} teamChartData={teamChartData} />} interval={0} stroke="#1e293b" />
                <YAxis domain={[40, 100]} stroke="#475569" fontSize={9} fontStyle="italic" fontWeight="black" />
                <Tooltip content={<CustomChartTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                <Legend verticalAlign="bottom" align="center" iconType="rect" wrapperStyle={{ paddingTop: '15px', fontSize: '9px', fontWeight: '900' }} />
                <Line type="linear" dataKey="avg_lane" name="Lane" stroke="#c084fc" strokeWidth={3} dot={{ r: 2 }} />
                <Line type="linear" dataKey="avg_impact" name="Impacto" stroke="#60a5fa" strokeWidth={3} dot={{ r: 2 }} />
                <Line type="linear" dataKey="avg_conversion" name="Conv." stroke="#34d399" strokeWidth={3} dot={{ r: 2 }} />
                <Line type="linear" dataKey="avg_vision" name="Visão" stroke="#eab308" strokeWidth={3} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <section className="overflow-visible">
            <h2 className="text-xl text-white mb-8 italic uppercase font-black flex items-center gap-2 leading-none tracking-tighter font-black uppercase italic"><div className="w-2 h-5 bg-slate-700 rounded-full" /> Active Roster</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {sortedFilteredPlayers.map(p => <PlayerCard key={p.puuid} player={p} teams={teams} isAdmin={isAdmin} onEdit={() => { setEditForm(p); setIsEditModalOpen(true); }} />)}
            </div>
          </section>

          {/* TACTICAL VISION RADAR - OVERFLOW VISIBLE PARA DROPDOWNS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative overflow-visible font-black uppercase italic">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col shadow-2xl items-center relative overflow-visible group border-t-blue-500/20">
              <div className="w-full flex justify-between mb-8 items-center tracking-tighter leading-none relative z-[100]">
                <span className="text-white text-xl font-black italic">Tactical Vision Radar</span>
                <div className="flex gap-4">
                  {/* SELECTS CUSTOMIZADOS COM Z-INDEX ALTO */}
                  <SideSelector value={heatmapSide} onChange={setHeatmapSide} />
                  <ObjectiveSelector value={heatmapObjective} onChange={setHeatmapObjective} />
                </div>
              </div>

              <div className="relative w-full max-w-[420px] aspect-square bg-[#050810] rounded-[32px] overflow-hidden border-2 border-slate-800 z-20 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                <img src="https://pbs.twimg.com/media/G7GGWYIXgAEx4SP?format=jpg&name=medium" className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale contrast-150 brightness-90 font-black italic" alt="" />
                <div className="absolute inset-0 z-21 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '15px 15px' }} />

                <div className="absolute inset-0 z-25 pointer-events-none">
                  {activeWards.map(w => {
                    const posX = MAP_OFFSET + (w.player_x / GAME_MAX) * MAP_SCALE;
                    const posY = MAP_OFFSET + (w.player_y / GAME_MAX) * MAP_SCALE;
                    const isControl = w.type?.toLowerCase().includes('control');
                    const sensorColor = isControl ? '#ef4444' : '#eab308';
                    return (
                      <div key={`sensor-${w.id}`} className="absolute w-3 h-3 transform -translate-x-1/2 translate-y-1/2 group/ward pointer-events-auto" style={{ left: `${posX}%`, bottom: `${posY}%` }}>
                        <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: sensorColor }} />
                        <div className="relative w-full h-full rounded-full border border-white shadow-lg cursor-crosshair" style={{ backgroundColor: sensorColor, boxShadow: `0 0 10px ${sensorColor}` }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[8px] text-white opacity-0 group-hover/ward:opacity-100 transition-opacity whitespace-nowrap z-50 font-black italic">
                           {isControl ? 'CONTROL' : 'STEALTH'} @ {formatTime(w.minute)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* OBJECTIVE TIMELINE STRATEGY */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col h-[585px] shadow-2xl relative overflow-visible border-t-amber-500/20 font-black uppercase italic leading-none font-black italic">
               <h3 className="text-xl text-white mb-14 italic tracking-tighter">Objective Execution Strategy</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={boxPlotData} margin={{ bottom: 60, left: -20 }}>
                    <defs>
                      <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={1} /><stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.8} /></linearGradient>
                      <linearGradient id="barGradientRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={1} /><stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.8} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} vertical={true} />
                    <XAxis dataKey="key" tick={<ObjectiveAxisTick />} interval={0} height={100} axisLine={false} />
                    <YAxis domain={[0, 45]} stroke="#475569" fontSize={10} fontStyle="italic" fontWeight="black" tickFormatter={(v) => `${v}m`} />
                    <Tooltip content={<CustomObjectiveTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} wrapperStyle={{ zIndex: 9999 }} />
                    <Bar dataKey="window" radius={[12, 12, 12, 12]} barSize={28} fill={heatmapSide === 'Blue' ? "url(#barGradientBlue)" : "url(#barGradientRed)"}>
                       {boxPlotData.map((entry, index) => <Cell key={`cell-${index}`} fill={heatmapSide === 'Blue' ? "url(#barGradientBlue)" : "url(#barGradientRed)"} />)}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          {/* DRAFT STRATEGY PATTERN */}
          <section className="bg-black/40 border border-slate-800 rounded-[48px] p-12 shadow-2xl relative overflow-visible font-black uppercase italic leading-none font-black italic">
            <div className="flex justify-between items-center mb-16 relative z-10 font-black">
               <h3 className="text-4xl text-white tracking-tighter leading-none italic font-black italic">Draft Strategy Pattern</h3>
               <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl backdrop-blur-md font-black uppercase italic leading-none font-black italic">
                 <button onClick={() => setDraftViewMode('champion')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all italic leading-none ${draftViewMode === 'champion' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>CAMPEÕES</button>
                 <button onClick={() => setDraftViewMode('role')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all italic leading-none ${draftViewMode === 'role' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>ROTAS</button>
               </div>
            </div>

            <div className="grid grid-cols-12 gap-12 relative z-10 tracking-tighter leading-none font-black uppercase italic">
              <div className="lg:col-span-4 space-y-10 font-black">
                <div className="flex items-center gap-3 text-blue-500 text-lg uppercase leading-none italic font-black"><div className="w-2.5 h-6 bg-blue-600 rounded-full shadow-[0_0_15px_#3b82f6]" /> BLUE SIDE</div>
                <div className="flex gap-4">
                  {[1, 3, 5, 14, 16].map(seq => (
                    <div key={seq} className="text-center group relative leading-none font-black italic">
                       <p className="text-[7px] text-slate-600 mb-2 uppercase font-black leading-none italic tracking-widest font-black italic">{SEQUENCE_LABELS[seq]}</p>
                       <div className="w-11 h-11 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 leading-none">
                          {draftAssignments[seq] ? <img src={draftAssignments[seq].image} className="w-full h-full grayscale opacity-40 object-cover" alt="" /> : <div className="w-full h-full bg-slate-800/30" />}
                       </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {[7, 10, 11, 18, 19].map((seq, idx) => <DraftPickCard key={seq} label={`B${idx + 1}`} data={draftAssignments[seq]} side="blue" mode={draftViewMode} />)}
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-950/60 border border-slate-800 rounded-[50px] p-10 h-fit self-center shadow-inner relative overflow-hidden group font-black uppercase italic leading-none">
                <div className="absolute inset-0 bg-blue-500/5 blur-[80px] group-hover:bg-blue-500/10 transition-colors" />
                <h4 className="text-[11px] text-center mb-12 text-slate-500 uppercase font-black tracking-[0.4em] leading-none uppercase italic font-black italic">Top Efficiency Pool</h4>
                <div className="space-y-10">
                  {mostPickedOverall.map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between group-hover:translate-x-1 transition-transform font-black leading-none italic font-black italic">
                      <div className="flex items-center gap-5">
                        <img src={getChampionImageUrl(c.name)} className="w-14 h-14 rounded-[20px] border-2 border-slate-800 group-hover:border-blue-500 transition-all shadow-xl font-black italic" alt="" />
                        <div><span className="text-sm text-white font-black tracking-tighter leading-none">{c.name}</span><p className="text-[9px] text-slate-500 font-black mt-2 uppercase italic tracking-widest font-black italic">{c.count.toFixed(0)} JOGOS</p></div>
                      </div>
                      <span className={`text-sm font-black italic ${c.wins/c.count >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>{((c.wins/c.count)*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-10 text-right font-black uppercase italic">
                <div className="flex items-center gap-3 justify-end text-red-500 text-lg uppercase tracking-widest font-black leading-none uppercase italic tracking-tighter italic font-black uppercase tracking-widest">RED SIDE <div className="w-2.5 h-6 bg-red-600 rounded-full shadow-[0_0_20px_#ef4444]" /></div>
                <div className="flex gap-4 justify-end font-black uppercase italic leading-none font-black italic">
                  {[2, 4, 6, 13, 15].map(seq => (
                    <div key={seq} className="text-center group relative font-black uppercase italic leading-none font-black italic">
                       <p className="text-[7px] text-slate-600 mb-2 uppercase font-black leading-none italic tracking-widest font-black italic">{SEQUENCE_LABELS[seq]}</p>
                       <div className="w-11 h-11 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 leading-none">
                          {draftAssignments[seq] ? <img src={draftAssignments[seq].image} className="w-full h-full grayscale opacity-40 object-cover" alt="" /> : <div className="w-full h-full bg-slate-800/30" />}
                       </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {[8, 9, 12, 17, 20].map((seq, idx) => <DraftPickCard key={seq} label={`R${idx + 1}`} data={draftAssignments[seq]} side="red" mode={draftViewMode} />)}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL EDITAR JOGADOR */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm font-black uppercase italic overflow-visible">
          <form onSubmit={handleSaveChanges} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[40px] p-10 space-y-6 font-black uppercase italic overflow-visible">
            <h2 className="text-3xl italic leading-none font-black uppercase">Editar Operativo</h2>
            <div className="space-y-2 leading-none font-black italic uppercase leading-none font-black italic"><label className="text-[10px] text-slate-500 ml-2 font-black italic uppercase font-black italic">Nickname</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black italic uppercase leading-none font-black uppercase italic" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} /></div>
            <div className="space-y-2 leading-none font-black italic uppercase leading-none font-black italic"><label className="text-[10px] text-slate-500 ml-2 font-black italic uppercase font-black italic">Tag Time</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black uppercase italic leading-none font-black uppercase italic" value={editForm.team_acronym} onChange={e => setEditForm({...editForm, team_acronym: e.target.value})} /></div>
            <div className="flex gap-4 pt-6 font-black leading-none font-black uppercase italic leading-none">
              <button type="button" onClick={() => handleDeletePlayer(editForm.puuid)} className="px-6 py-4 bg-red-600 text-white rounded-2xl uppercase italic leading-none transition-all shadow-lg hover:bg-red-500 font-black">EXCLUIR</button>
              <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl uppercase italic shadow-lg hover:bg-blue-500 leading-none font-black font-black uppercase italic">{saving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</button>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-4 bg-slate-800 text-white rounded-2xl uppercase italic leading-none shadow-lg font-black italic">X</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- AUXILIARES (DRAFT E PLAYER) ---

function DraftPickCard({ label, data, side, mode }: any) {
  const isBlue = side === 'blue';
  return (
    <div className="group relative font-black uppercase italic leading-none font-black italic leading-none">
      <div className={`p-4 rounded-2xl border transition-all flex items-center gap-5 relative overflow-visible shadow-lg ${isBlue ? 'border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10 shadow-blue-500/10' : 'border-red-500/10 bg-red-500/5 flex-row-reverse hover:bg-red-500/10 shadow-red-500/10'}`}>
        <div className={`absolute top-0 bottom-0 w-1 ${isBlue ? 'left-0 bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'right-0 bg-red-500 shadow-[0_0_15px_#ef4444]'}`} />
        <span className={`text-xs font-black italic ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>{label}</span>
        {data ? (
          <>
            <div className="relative font-black uppercase italic leading-none">
              {mode === 'role' ? <div className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-xl shadow-lg leading-none">{getRoleIcon(data.name, "w-7 h-7")}</div> : <img src={data.image} className="w-12 h-12 rounded-xl border border-slate-700 shadow-xl group-hover:scale-105 transition-transform" alt="" />}
            </div>
            <div className={`flex-1 min-w-0 leading-none font-black italic ${!isBlue && 'text-right'}`}>
              <p className="text-xs text-white uppercase font-black tracking-tighter truncate leading-none mb-2">{data.name}</p>
              <div className={`flex items-center gap-3 text-[9px] font-black italic tracking-widest leading-none ${!isBlue && 'flex-row-reverse'}`}><span className={data.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}>{data.wr}% WR</span><span className="text-slate-600">|</span><span className="text-slate-500 uppercase leading-none font-black italic tracking-widest leading-none">{data.count} JOGOS</span></div>
            </div>
          </>
        ) : <span className="text-[9px] text-slate-800 font-black italic uppercase font-black italic leading-none">NO RECORDS FOUND</span>}
      </div>
      {data && data.ratings && (
        <div className={`absolute z-[9999] top-0 ${isBlue ? 'left-full ml-4' : 'right-full mr-4'} opacity-0 group-hover:opacity-100 transition-all pointer-events-none duration-300 transform scale-95 group-hover:scale-100 font-black uppercase italic leading-none`}>
          <div className="bg-slate-950 border border-slate-700 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[170px] backdrop-blur-xl border-t-blue-500/30 font-black uppercase leading-none font-black italic leading-none">
             <p className="text-[8px] text-slate-500 mb-3 font-black uppercase tracking-widest italic font-black italic">Team Stats with {data.name}</p>
             <div className="space-y-2 font-black italic uppercase font-black italic">
                <RatingLine label="LANE" value={data.ratings.lane} />
                <RatingLine label="IMPACT" value={data.ratings.impact} />
                <RatingLine label="CONVERSION" value={data.ratings.conv} />
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
    <div className="flex justify-between items-center gap-4 border-b border-slate-800 pb-1.5 last:border-0 font-black italic uppercase leading-none tracking-widest font-black uppercase italic leading-none">
      <span className="text-[8px] text-white/30 font-black uppercase tracking-tighter leading-none font-black italic">{label}</span>
      <span className={`text-[10px] font-mono font-black leading-none font-black italic ${getScoreColor(value)}`}>{value ? value.toFixed(1) : '0.0'}</span>
    </div>
  );
}

function PlayerCard({ player, teams, isAdmin, onEdit }: any) {
  const team = teams.find((t: any) => t.acronym === player.team_acronym);
  const isMVP = player.is_mvp;
  return (
    <div className="relative group h-full font-black uppercase italic tracking-tighter font-black italic leading-none overflow-visible">
      {isAdmin && <button onClick={(e) => { e.preventDefault(); onEdit(); }} className="absolute top-4 right-4 z-10 bg-slate-800/80 hover:bg-blue-600 p-2 rounded-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-all text-white shadow-xl hover:bg-blue-600 font-black transition-colors leading-none font-black italic">✏️</button>}
      {isMVP && <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-amber-400 to-yellow-600 text-black text-[10px] font-black px-4 py-1 rounded-full shadow-[0_0_15px_#fbbf2466] italic uppercase tracking-tighter border-2 border-slate-900 leading-none font-black italic">MVP</div>}
      <Link href={`/dashboard/players/${player.puuid}`} className={`bg-slate-900 border transition-all flex flex-col items-center block h-full p-6 rounded-[32px] relative overflow-hidden shadow-lg ${isMVP ? 'border-amber-500/50 shadow-[0_0_25px_#fbbf2415] font-black italic' : 'border-slate-800 hover:border-blue-500 font-black italic'} font-black uppercase italic`}>
        {isMVP && <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none font-black italic" />}
        <div className="relative mb-5 font-black italic">
          <div className={`p-1 rounded-[28px] transition-transform group-hover:scale-105 ${isMVP ? 'bg-gradient-to-tr from-amber-400 to-yellow-600 shadow-[0_0_15px_#fbbf2444] font-black italic' : 'font-black italic'} font-black italic`}>
            {player.photo_url ? <img src={player.photo_url} alt={player.nickname} className="w-20 h-20 object-cover rounded-[24px] bg-slate-800 shadow-lg font-black italic uppercase" /> : <div className="w-20 h-20 bg-slate-800 rounded-[24px] flex items-center justify-center text-xl font-black text-slate-500 italic leading-none tracking-tighter font-black italic">{player.nickname?.substring(0, 2).toUpperCase()}</div>}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-slate-800 p-1.5 rounded-xl border-2 border-slate-900 shadow-xl font-black italic leading-none font-black italic">{getRoleIcon(player.primary_role)}</div>
        </div>
        <h3 className={`text-xl font-black italic text-center uppercase truncate w-full leading-none mb-4 tracking-tighter transition-all ${isMVP ? 'text-amber-400 font-black italic' : 'text-white font-black italic'} font-black italic leading-none`}>{player.nickname}</h3>
        <div className="flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-slate-950/50 border border-slate-800 leading-none shadow-xl font-black italic uppercase">
          {team?.logo_url && <img src={team.logo_url} alt="" className="w-3.5 h-3.5 object-contain shadow-lg font-black italic uppercase" />}
          <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest italic tracking-tighter transition-all leading-none font-black italic uppercase">{player.team_acronym} • {player.games_played} G</p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full mt-auto relative z-10 transition-all leading-none font-black italic uppercase">
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
  const colorClass = getScoreColor(value);
  return (
    <div className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border ${colorClass} bg-slate-900/40 border-slate-800 font-black italic transition-all leading-none font-black italic uppercase`}>
      <span className="text-[8px] opacity-60 uppercase tracking-tighter font-black italic leading-none font-black italic uppercase tracking-tighter leading-none">{label}</span>
      <span className="text-xs font-mono font-black italic transition-all leading-none font-black italic uppercase leading-none">{value ? Math.round(value) : '-'}</span>
    </div>
  );
}