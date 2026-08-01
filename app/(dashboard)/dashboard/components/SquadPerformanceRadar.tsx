"use client";

import { useState, useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';

interface SquadPerformanceProps {
  radarData: any[]; 
  myTeamTag: string;
}

export default function SquadPerformanceRadar({ radarData, myTeamTag }: SquadPerformanceProps) {
  const [radarCompareMode, setRadarCompareMode] = useState<'OFFICIAL_VS_SCRIM' | 'US_VS_OPP'>('OFFICIAL_VS_SCRIM');

  // LÓGICA DE INSIGHT: Calcula automaticamente onde está o maior gap (positivo ou negativo)
  const biggestGap = useMemo(() => {
    if (!radarData || radarData.length === 0) return null;

    const key1 = radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag;
    const key2 = radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes';

    let maxDiff = 0;
    let worstDiff = 0;
    let bestSubject = '';
    let worstSubject = '';

    radarData.forEach(item => {
      const val1 = Number(item[key1]) || 0;
      const val2 = Number(item[key2]) || 0;
      const diff = val1 - val2;

      if (diff > maxDiff) { maxDiff = diff; bestSubject = item.subject; }
      if (diff < worstDiff) { worstDiff = diff; worstSubject = item.subject; }
    });

    // Se estivermos comparando Oficial vs Scrim, uma queda no Oficial é o "Pior" cenário
    // Se for RMD vs Oponentes, estar atrás do oponente é o "Pior" cenário
    const hasWarning = worstDiff < -5; // Só avisa se a diferença for maior que 5 pontos
    const hasHighlight = maxDiff > 5;

    return { hasWarning, hasHighlight, maxDiff, worstDiff, bestSubject, worstSubject, key1, key2 };
  }, [radarData, radarCompareMode, myTeamTag]);

  // TOOLTIP CUSTOMIZADO COM CÁLCULO DE DELTA
  const CustomRadarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length >= 2) {
      const val1 = payload[0].value;
      const val2 = payload[1].value;
      const diff = val1 - val2;
      const isFirstLeading = diff >= 0;

      return (
        <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-4 rounded-xl shadow-2xl min-w-[180px] flex flex-col gap-3">
          <span className="text-[12px] font-black text-white uppercase border-b border-zinc-800 pb-2 mb-1 tracking-[0.15em] text-center">{label}</span>
          
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center text-[11px] font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full ring-2 ring-zinc-900" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
                  <span className="text-zinc-400 uppercase tracking-widest">{entry.name}:</span>
                </div>
                <span className="font-black drop-shadow-sm text-[12px]" style={{ color: entry.color }}>
                  {entry.value} <span className="text-[8px] opacity-60 ml-0.5">PTS</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-3 border-t border-zinc-800/60 flex justify-between items-center bg-zinc-900/30 p-2 rounded-lg">
             <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Delta:</span>
             <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
               diff === 0 ? 'bg-zinc-900 text-zinc-400 border-zinc-800' :
               isFirstLeading ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
             }`}>
                {diff === 0 ? 'EQUILÍBRIO' : `${diff > 0 ? '+' : ''}${diff} PTS`}
             </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden group flex flex-col h-[400px] hover-lift">
      <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
      
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
      
      <div className="flex-1 w-full min-h-0 relative z-10 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#d4d4d8', fontSize: 10, fontWeight: '900' }} tickFormatter={(val) => String(val).toUpperCase()} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            
            {/* Aplicação do drop-shadow para o efeito NEON */}
            <Radar 
              name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} 
              dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Oficial' : myTeamTag} 
              stroke="#3b82f6" 
              strokeWidth={3} 
              fill="#3b82f6" 
              fillOpacity={0.2}
              activeDot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
              style={{ filter: 'drop-shadow(0px 0px 8px rgba(59,130,246,0.5))' }}
            />
            <Radar 
              name={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
              dataKey={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'Scrim' : 'Oponentes'} 
              stroke={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
              strokeWidth={3} 
              fill={radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444"} 
              fillOpacity={0.2}
              activeDot={{ r: 5, fill: '#fff', stroke: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? "#f59e0b" : "#ef4444", strokeWidth: 2 }}
              style={{ filter: radarCompareMode === 'OFFICIAL_VS_SCRIM' ? 'drop-shadow(0px 0px 8px rgba(245,158,11,0.5))' : 'drop-shadow(0px 0px 8px rgba(239,68,68,0.5))' }}
            />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold' }} />
            <Tooltip cursor={false} wrapperStyle={{ zIndex: 9999, outline: 'none' }} content={<CustomRadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* RODAPÉ DINÂMICO DE INSIGHTS */}
      {biggestGap && (
        <div className="mt-2 pt-3 border-t border-zinc-800/60 shrink-0 flex items-center justify-between px-1">
          {biggestGap.hasHighlight ? (
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <div>
                 <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block leading-none mb-0.5">Maior Vantagem</span>
                 <span className="text-[11px] font-black text-white uppercase">{biggestGap.bestSubject} <span className="text-emerald-400 ml-1">+{biggestGap.maxDiff}</span></span>
              </div>
            </div>
          ) : <div />}

          {biggestGap.hasWarning ? (
            <div className="flex items-center gap-2 text-right">
              <div>
                 <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block leading-none mb-0.5">Ponto Crítico</span>
                 <span className="text-[11px] font-black text-white uppercase"><span className="text-red-400 mr-1">{biggestGap.worstDiff}</span> {biggestGap.worstSubject}</span>
              </div>
              <AlertTriangle size={14} className="text-red-500" />
            </div>
          ) : <div />}
        </div>
      )}
    </div>
  );
}