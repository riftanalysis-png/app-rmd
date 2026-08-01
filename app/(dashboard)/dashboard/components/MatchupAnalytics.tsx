"use client";

import { useState } from 'react';
import { Swords, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, LabelList, Cell, PieChart, Pie } from 'recharts';

export default function MatchupAnalytics({ opponentStatsData, championshipStatsData, teamsList }: any) {
  const [oppChartMode, setOppChartMode] = useState<'COUNT' | 'RATE'>('COUNT');
  const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#64748b'];

  const getTeamLogo = (acronym: string) => { 
      const t = teamsList?.find((t: any) => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
      return t?.logo_url || null; 
  };

  // Tooltip customizada para Confrontos Diretos
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

  // Tooltip customizada para Distribuição de Ligas
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-6">
      <div className="lg:col-span-8 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 md:p-8 shadow-2xl relative flex flex-col min-h-[400px] overflow-hidden group hover-lift">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
          
          <div className="flex items-center justify-between mb-4 shrink-0 border-b border-zinc-800/60 pb-4 z-10">
            <div>
                <h3 className="text-[13px] font-black text-white uppercase tracking-tight flex items-center gap-2"><Swords size={16} className="text-amber-500" /> Confrontos Diretos</h3>
                <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Desempenho contra organizações</p>
            </div>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5 shadow-inner">
                <button onClick={() => setOppChartMode('COUNT')} className={`px-2.5 py-1 text-[8px] font-black rounded transition-all uppercase tracking-widest ${oppChartMode === 'COUNT' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>QTD JOGOS</button>
                <button onClick={() => setOppChartMode('RATE')} className={`px-2.5 py-1 text-[8px] font-black rounded transition-all uppercase tracking-widest ${oppChartMode === 'RATE' ? 'bg-amber-600/20 text-amber-500 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>WIN RATE</button>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-0 relative mt-1 z-10">
            {opponentStatsData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opponentStatsData} margin={{ top: 25, right: 20, left: -10, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                  
                  {/* Axis customizado trazendo as Logos de volta */}
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
                  <YAxis tick={{ fill: '#52525b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  
                  {/* Tooltip original customizado */}
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomMatchupTooltip />} />
                  
                  {oppChartMode === 'COUNT' && <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', bottom: -5 }} iconType="circle" />}
                  
                  {oppChartMode === 'COUNT' ? (
                    <>
                        <Bar dataKey="wins" name="Vitórias" stackId="a" fill="#10b981" maxBarSize={35} style={{ filter: 'drop-shadow(0px 0px 8px rgba(16,185,129,0.5))' }}>
                          <LabelList dataKey="wins" position="center" fill="#ffffff" fontSize={11} fontWeight="black" formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="losses" name="Derrotas" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={35} style={{ filter: 'drop-shadow(0px 0px 8px rgba(239,68,68,0.5))' }}>
                          <LabelList dataKey="losses" position="center" fill="#ffffff" fontSize={11} fontWeight="black" formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                    </>
                  ) : (
                    <Bar dataKey="winRate" name="Win Rate (%)" radius={[4, 4, 0, 0]} maxBarSize={45}>
                        <LabelList dataKey="winRate" position="top" fill="#a1a1aa" fontSize={10} fontWeight="black" formatter={(val: number) => `${val}%`} />
                        {opponentStatsData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.winRate >= 50 ? '#10b981' : '#ef4444'} style={{ filter: entry.winRate >= 50 ? 'drop-shadow(0px 0px 8px rgba(16,185,129,0.5))' : 'drop-shadow(0px 0px 8px rgba(239,68,68,0.5))' }} />
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

      <div className="lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 shadow-xl relative flex flex-col min-h-[400px] hover-lift">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
          <div className="flex items-center justify-between mb-2 border-b border-zinc-800/60 pb-3 shrink-0 z-10">
            <div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-tight">Distribuição de Ligas</h3>
                <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Oponentes por Campeonato/Região</p>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-0 relative flex flex-col z-10">
            {championshipStatsData?.length > 0 ? (
              <>
                <div className="h-[170px] w-full relative shrink-0 mt-2 z-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={championshipStatsData} innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value" stroke="#121214" strokeWidth={3} cornerRadius={6}>
                            {championshipStatsData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} style={{ filter: `drop-shadow(0px 0px 8px ${CHART_COLORS[index % CHART_COLORS.length]}80)` }} />
                            ))}
                        </Pie>
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomDonutTooltip totalGames={championshipStatsData.reduce((acc: number, curr: any) => acc + curr.value, 0)} />} />
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-black text-white leading-none tracking-tighter drop-shadow-md">
                        {championshipStatsData.reduce((acc: number, curr: any) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Jogos</span>
                  </div>
                </div>

                {/* NOVA LEGENDA EM FORMATO DE TAGS SEM SCROLLBAR */}
                <div className="w-full mt-6 flex flex-wrap justify-center content-start gap-2.5 relative z-10 pb-2">
                  {championshipStatsData.map((entry: any, index: number) => {
                      const total = championshipStatsData.reduce((acc: number, curr: any) => acc + curr.value, 0);
                      const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                      const color = CHART_COLORS[index % CHART_COLORS.length];
                      
                      return (
                        <div key={index} className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-300 px-3 py-1.5 rounded-xl cursor-default group shadow-sm hover:-translate-y-0.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-zinc-950 group-hover:ring-zinc-900 transition-all" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}></div>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-white transition-colors">{entry.name}</span>
                            
                            <div className="w-px h-3 bg-zinc-800 group-hover:bg-zinc-700 transition-colors mx-0.5"></div>
                            
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-black drop-shadow-sm" style={{ color: color }}>{pct}%</span>
                              <span className="text-[9px] font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">({entry.value})</span>
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
  );
}