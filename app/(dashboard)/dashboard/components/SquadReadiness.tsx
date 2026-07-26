"use client";

import { useState, useMemo } from 'react';
import { Plus, Clock, X } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

const formatDate = (dateString: string) => { 
  if (!dateString) return ''; 
  const p = dateString.split('-'); 
  return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; 
};

export default function SquadReadiness({ teamWellness, isStaff, currentUser, onOpenDailySync, filteredMatches, playerStats, filterStartDate, filterEndDate }: any) {
  const [expandedWellnessId, setExpandedWellnessId] = useState<string | null>(null);
  const [expandedChartMode, setExpandedChartMode] = useState<'OVERVIEW' | 'BIO' | 'TACTICAL' | 'CORRELATION'>('OVERVIEW');
  const [corrBio, setCorrBio] = useState('sleep_score');
  const [corrTact, setCorrTact] = useState('perf_score');

  const expandedPlayer = useMemo(() => {
    return teamWellness.find((p: any) => p.puuid === expandedWellnessId);
  }, [teamWellness, expandedWellnessId]);

  const wellnessChartData = useMemo(() => {
    if (!expandedPlayer || !expandedPlayer.history) return [];
    
    const matchDates: Record<string, string> = {};
    filteredMatches.forEach((m: any) => {
      if (m.game_start_time) {
        const d = new Date(String(m.game_start_time).replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          d.setHours(d.getHours() - 3);
          const isScrim = String(m.game_type || '').toUpperCase().includes('SCRIM');
          if (isScrim && d.getHours() < 6) d.setHours(d.getHours() - 6);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          matchDates[String(m.match_id || m.id)] = dateStr;
        }
      }
    });

    const statsByDate: Record<string, {l:number[], i:number[], c:number[], v:number[], o:number[]}> = {};
    
    // Processamento dos dados que agora vêm do bff_player_matches!
    playerStats.forEach((s: any) => {
      if (String(s.puuid).toLowerCase() === String(expandedPlayer.puuid).toLowerCase() && matchDates[String(s.match_id)]) {
        const dateStr = matchDates[String(s.match_id)];
        const l = Number(s.lane_rating)||0; 
        const i = Number(s.impact_rating)||0; 
        const c = Number(s.conversion_rating)||0; 
        const v = Number(s.vision_rating)||0; 
        const o = Number(s.perf_score) || ((l+i+c+v)/4); // Utiliza o Score do banco ou calcula a média segura
        
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
  }, [expandedPlayer, filteredMatches, playerStats, filterStartDate, filterEndDate]);

  const getBioName = (key: string) => { if (key === 'sleep_score') return 'Qualidade do Sono'; if (key === 'mental_score') return 'Estado Mental'; if (key === 'physical_score') return 'Estado Físico'; return 'Readiness Geral (%)'; };
  const getTactName = (key: string) => { if (key === 'lane_score') return 'Dominância de Rota'; if (key === 'impact_score') return 'Impacto no Mapa'; if (key === 'conv_score') return 'Conversão'; if (key === 'vision_score') return 'Controle de Visão'; return 'Performance Overall'; };

  const WellnessBar = ({ label, value }: { label: string, value: number }) => {
    const color = value <= 2 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : value === 3 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    return (
      <div className="flex items-center gap-3">
        <span className="text-[8px] text-zinc-500 w-12 text-right font-black tracking-widest uppercase">{label}</span>
        <div className="flex gap-1 flex-1">{[1, 2, 3, 4, 5].map((level) => (<div key={level} className={`h-1.5 flex-1 rounded-[2px] transition-colors duration-300 ${level <= value ? color : 'bg-zinc-800'}`}></div>))}</div>
      </div>
    );
  };

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group w-full hover-lift">
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 border-b border-zinc-800/60 pb-5 relative z-10">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3"><div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]"></div> Squad Readiness</h3>
          <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] mt-1.5 uppercase">Monitorização Biométrica de Prontidão</p>
        </div>
        <button onClick={onOpenDailySync} className="bg-zinc-900 border border-zinc-800 text-emerald-400 px-5 py-2.5 rounded-xl text-[9px] font-black hover:bg-emerald-600 hover:border-emerald-500 hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]">
          <Plus size={14} /> DAILY SYNC
        </button>
      </div>

      <div className={`grid gap-4 relative z-10 ${isStaff ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 md:max-w-md mx-auto'}`}>
        {(teamWellness || []).filter((p: any) => isStaff || String(p.puuid).toLowerCase() === String(currentUser?.puuid).toLowerCase()).map((p: any) => {
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
                  <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                        {p.photo && <img src={p.photo} className="w-10 h-10 rounded-lg border border-zinc-700 object-cover shrink-0 shadow-md group-hover/player:border-zinc-500 transition-colors" />}
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center gap-1.5 mb-1"><span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{String(p.role).replace(/jug/i, 'JNG')}</span></div>
                          <span className="text-sm font-black text-white break-words leading-tight block uppercase truncate drop-shadow-md">{p.name}</span>
                        </div>
                      </div>
                      <span className={`text-2xl font-black italic leading-none shrink-0 tracking-tighter ${isDanger ? 'text-red-400 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isOptimal ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`}>{p.score}%</span>
                  </div>
                  <div className="space-y-2 relative z-10"><WellnessBar label="SONO" value={p.sleep} /><WellnessBar label="MENTAL" value={p.mental} /><WellnessBar label="FÍSICO" value={p.physical} /></div>
              </div>
            );
        })}
      </div>

      {expandedWellnessId && wellnessChartData?.length > 0 && (
        <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-[20px] p-6 flex flex-col justify-center relative overflow-hidden mt-6 animate-fade-in-up shadow-inner group/chart">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-50 group-hover/chart:opacity-100 transition-all duration-500"></div>
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-5 border-b border-zinc-800/50 pb-4">
              <div>
                  <h4 className="text-[10px] text-emerald-400 font-black tracking-[0.2em] uppercase flex items-center gap-1.5">
                     <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> Evolução: {expandedPlayer?.name}
                  </h4>
                  <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">MONITORIZAÇÃO DE PRONTIDÃO VS PERFORMANCE</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 shadow-inner">
                    <button onClick={() => setExpandedChartMode('OVERVIEW')} className={`px-3 py-1.5 text-[8px] font-black rounded uppercase transition-all tracking-widest ${expandedChartMode === 'OVERVIEW' ? 'bg-zinc-800 text-white shadow-md border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>VISÃO GERAL</button>
                    <button onClick={() => setExpandedChartMode('BIO')} className={`px-3 py-1.5 text-[8px] font-black rounded uppercase transition-all tracking-widest ${expandedChartMode === 'BIO' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>BIOMETRIA</button>
                    <button onClick={() => setExpandedChartMode('TACTICAL')} className={`px-3 py-1.5 text-[8px] font-black rounded uppercase transition-all tracking-widest ${expandedChartMode === 'TACTICAL' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>TÁTICA</button>
                    <button onClick={() => setExpandedChartMode('CORRELATION')} className={`px-3 py-1.5 text-[8px] font-black rounded uppercase transition-all tracking-widest ${expandedChartMode === 'CORRELATION' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>CORRELAÇÃO</button>
                  </div>
                  <button onClick={() => setExpandedWellnessId(null)} className="text-zinc-500 hover:text-white bg-zinc-900 w-6 h-6 flex items-center justify-center rounded-lg border border-zinc-800"><X size={14}/></button>
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
  );
}