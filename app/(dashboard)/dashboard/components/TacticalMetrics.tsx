"use client";

import { Brain, Activity, Zap } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend as RadarLegend, Tooltip as RadarTooltip, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

export default function TacticalMetrics({ myTeamTag, radarData, efficiencyData, earlyGameSnowball, radarCompareMode, setRadarCompareMode, teamsList }: any) {

  const getTeamLogo = (acronym: string) => { 
      const t = teamsList?.find((t: any) => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
      return t?.logo_url || null; 
  };

  function CustomRadarTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length >= 2) {
      const val1 = payload[0].value;
      const val2 = payload[1].value;
      const diff = val1 - val2;
      const isFirstLeading = diff >= 0;
      return (
        <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[160px] flex flex-col gap-2.5">
          <span className="text-[11px] font-black text-white uppercase border-b border-zinc-800 pb-1.5 mb-1 tracking-[0.15em] text-center">{label}</span>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-6">
      
      {/* 1. RADAR GIGANTE */}
      <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
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
              
              <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.2} activeDot={{ r: 6, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(59,130,246,0.6))' }} />
              <Radar name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} strokeWidth={3} fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} fillOpacity={0.2} activeDot={{ r: 6, fill: '#fff', stroke: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444", strokeWidth: 3 }} style={{ filter: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'drop-shadow(0px 0px 8px rgba(245,158,11,0.6))' : 'drop-shadow(0px 0px 8px rgba(239,68,68,0.6))' }} />
              
              <RadarLegend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px', fontWeight: 'bold' }} />
              <RadarTooltip cursor={false} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomRadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. EFICIÊNCIA DE SCRIMS */}
      <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="flex items-center justify-between mb-2 z-10 shrink-0 border-b border-zinc-800/60 pb-3">
          <div>
            <h3 className="text-[12px] text-white font-black uppercase flex items-center gap-1.5"><Activity size={14} className="text-emerald-500" /> Eficiência de Scrims</h3>
            <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Dificuldade vs Nível do Oponente</p>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0 mt-3 z-10">
          {efficiencyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fill: '#d4d4d8', fontSize: 10, fontWeight: '900' }} tickFormatter={(val) => String(val).toUpperCase()} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomEfficiencyTooltip />} />
                  <Bar dataKey="STOMPADOS" stackId="a" fill="#7f1d1d" maxBarSize={40} />
                  <Bar dataKey="MT DIFÍCIL" stackId="a" fill="#dc2626" maxBarSize={40} />
                  <Bar dataKey="DIFÍCIL" stackId="a" fill="#f87171" maxBarSize={40} />
                  <Bar dataKey="CONTROLADO" stackId="a" fill="#52525b" maxBarSize={40} />
                  <Bar dataKey="FÁCIL" stackId="a" fill="#60a5fa" maxBarSize={40} />
                  <Bar dataKey="MUITO FÁCIL" stackId="a" fill="#2563eb" maxBarSize={40} />
                  <Bar dataKey="STOMPAMOS" stackId="a" fill="#1e3a8a" maxBarSize={40} radius={[4, 4, 0, 0]} style={{ filter: 'drop-shadow(0px -4px 6px rgba(59,130,246,0.3))' }} />
                </BarChart>
              </ResponsiveContainer>
          ) : (
             <div className="flex items-center justify-center h-full text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Sem Dados</div>
          )}
        </div>
      </div>

      {/* 3. EARLY GAME MOMENTUM */}
      <div className="animate-fade-in-up lg:col-span-4 bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px] hover-lift">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent_80%)]" />
        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="flex items-center justify-between mb-4 z-10 shrink-0 border-b border-zinc-800/60 pb-3">
          <div>
            <h3 className="text-[12px] text-white font-black uppercase tracking-tight flex items-center gap-1.5"><Zap size={14} className="text-amber-500" /> Early Game Momentum</h3>
            <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Diferencial de Ouro aos 12 Minutos</p>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0 mt-2 z-10">
          {earlyGameSnowball?.length > 0 ? (
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
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomEarlyGameTooltip />} />
                
                <Bar dataKey="goldDiff" maxBarSize={40}>
                  {earlyGameSnowball.map((entry: any, index: number) => {
                    const isPos = entry.goldDiff >= 0;
                    return <Cell key={`cell-${index}`} fill={isPos ? '#3b82f6' : '#ef4444'} radius={[4, 4, 0, 0] as any} style={{ filter: isPos ? 'drop-shadow(0px 0px 8px rgba(59,130,246,0.5))' : 'drop-shadow(0px 0px 8px rgba(239,68,68,0.5))' }} />
                  })}
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
  );
}