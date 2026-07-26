"use client";

import { useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { Brain } from 'lucide-react';

interface SquadPerformanceProps {
  radarData: any[]; // Aqui virão os dados da View vw_dashboard_radar_stats
  myTeamTag: string;
}

export default function SquadPerformanceRadar({ radarData, myTeamTag }: SquadPerformanceProps) {
  // O estado de comparação fica isolado apenas neste componente!
  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[380px]">
      <div className="flex justify-between items-start mb-2 shrink-0 border-b border-zinc-800/60 pb-3 z-10">
        <div>
          <h3 className="text-[12px] font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Brain size={14} className="text-purple-500" /> Squad Performance
          </h3>
          <p className="text-[8px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Impacto Tático</p>
        </div>
        
        <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5 shadow-inner">
          <button 
            onClick={() => setRadarCompareMode('OFFICIAL_VS_SCRIM')} 
            className={`px-2 py-1 text-[7px] font-black rounded transition-all tracking-widest uppercase ${radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            OFF VS SCR
          </button>
          <button 
            onClick={() => setRadarCompareMode('US_VS_OPP')} 
            className={`px-2 py-1 text-[7px] font-black rounded transition-all tracking-widest uppercase ${radarCompareMode === 'US_VS_OPP' ? 'bg-red-600/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            RMD VS OPP
          </button>
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
              strokeWidth={3} 
              fill="#3b82f6" 
              fillOpacity={0.2} 
            />
            <Radar 
              name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
              dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
              stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
              strokeWidth={3} 
              fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
              fillOpacity={0.2}
            />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px', fontWeight: 'bold' }} />
            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}