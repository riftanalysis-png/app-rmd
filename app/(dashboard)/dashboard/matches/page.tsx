"use client";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { processMatchIntelligence } from '@/lib/services/analytics';
import Link from 'next/link';

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { fetchMatches(); }, []);

  async function fetchMatches() {
    setLoading(true);
    const { data } = await supabase.from('view_matches_with_teams').select('*');
    if (data) setMatches(data);
    setLoading(false);
  }

  const groupedSeries = useMemo(() => {
    const groups: { [key: string]: any } = {};
    matches.forEach(m => {
      const sId = m.series_id || `solo-${m.match_id}`;
      if (!groups[sId]) {
        groups[sId] = {
          id: sId,
          description: m.series_description,
          games: [],
          teamA: { tag: m.blue_tag || '?', logo: m.blue_logo },
          teamB: { tag: m.red_tag || '?', logo: m.red_logo },
          scoreA: 0, scoreB: 0
        };
      }
      groups[sId].games.push(m);
      if (m.winner_side === 'blue') groups[sId].scoreA++;
      else if (m.winner_side === 'red') groups[sId].scoreB++;
    });
    return Object.values(groups).sort((a: any, b: any) => String(b.id).localeCompare(String(a.id)));
  }, [matches]);

  // CÁLCULO DE WINRATE POR LADO
  const stats = useMemo(() => {
    const total = matches.length;
    const blueWins = matches.filter(m => m.winner_side === 'blue').length;
    const redWins = matches.filter(m => m.winner_side === 'red').length;
    return {
      totalSeries: groupedSeries.length,
      totalGames: total,
      blueWR: total ? Math.round((blueWins / total) * 100) : 0,
      redWR: total ? Math.round((redWins / total) * 100) : 0
    };
  }, [groupedSeries, matches]);

  const handleProcessAnalytics = async (match_id: string) => {
    setProcessingId(match_id);
    try { await processMatchIntelligence(match_id); } 
    catch (err: any) { alert("ERRO: " + err.message); } 
    finally { setProcessingId(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh]">
      <p className="text-blue-500 font-black italic animate-pulse tracking-widest text-xs">// DECRYPTING_MATCH_HISTORY_...</p>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 font-black uppercase italic tracking-tighter pb-20">
      
      {/* HEADER COM GRÁFICO DE ROSCA */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
        <div className="border-l-2 border-blue-500 pl-4">
          <h1 className="text-3xl text-white leading-none">AUDITORIA DE SÉRIES</h1>
          <p className="text-[9px] text-slate-500 tracking-[0.3em] mt-1">SISTEMA DE MONITORAMENTO TÁTICO</p>
        </div>

        <div className="flex gap-4 md:gap-6 flex-wrap items-center">
          <StatBox label="Séries" value={stats.totalSeries} />
          <StatBox label="Jogos" value={stats.totalGames} />
          
          {/* GRÁFICO DE ROSCA: SIDE BIAS */}
          <div className="flex items-center bg-white/[0.02] border border-white/5 px-6 py-3 rounded-2xl gap-5">
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {/* Red Side (Fundo) */}
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-red-500/20" strokeWidth="3.5" />
                {/* Red Side (Valor) */}
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-red-500" strokeWidth="3.5" 
                  strokeDasharray={`${stats.redWR}, 100`} />
                {/* Blue Side (Valor - Sobreposto) */}
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-blue-500" strokeWidth="3.5" 
                  strokeDasharray={`${stats.blueWR}, 100`} strokeDashoffset="0" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-6 h-6 bg-[#121212] rounded-full"></div>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[8px] text-slate-600 tracking-widest uppercase mb-1">Side Bias WR%</span>
              <div className="flex gap-3 items-center">
                <span className="text-blue-500 text-sm font-black tracking-tighter">{stats.blueWR}% B</span>
                <span className="text-slate-800 text-[10px]">/</span>
                <span className="text-red-500 text-sm font-black tracking-tighter">{stats.redWR}% R</span>
              </div>
            </div>
          </div>
          
          <button 
            disabled={isBatchProcessing}
            className="px-6 py-3 bg-blue-600/10 border border-blue-500/30 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[10px] tracking-widest self-center"
          >
            {isBatchProcessing ? "PROCESSANDO..." : "RECALCULAR TUDO"}
          </button>
        </div>
      </header>

      {/* GRID DE SÉRIES */}
      <div className="grid grid-cols-1 gap-4">
        {groupedSeries.map((series: any) => (
          <div key={series.id} className="bg-[#121212] border border-white/5 rounded-2xl hover:border-white/10 transition-all shadow-lg group relative">
            
            <div 
              onClick={() => setExpandedSeries(expandedSeries === series.id ? null : series.id)} 
              className="p-5 md:p-6 flex items-center gap-6 cursor-pointer relative z-10"
            >
              <div className={`w-1 h-12 rounded-full ${series.scoreA > series.scoreB ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-800'}`}></div>

              {/* Lado A */}
              <div className="flex items-center gap-4 w-32 justify-end">
                <span className={`text-xs ${series.scoreA > series.scoreB ? 'text-white' : 'text-slate-500'}`}>{series.teamA.tag}</span>
                <div className="relative w-10 h-10 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                  <div className="absolute inset-0 bg-white/5 blur-sm rounded-full"></div>
                  {series.teamA.logo && <img src={series.teamA.logo} className="w-full h-full object-contain relative z-10" alt="" />}
                </div>
              </div>

              {/* Placar Central */}
              <div className="flex flex-col items-center min-w-[120px]">
                <div className="flex items-center gap-4 text-2xl font-black">
                  <span className={series.scoreA > series.scoreB ? 'text-blue-500' : 'text-slate-600'}>{series.scoreA}</span>
                  <span className="text-slate-800 text-xs">X</span>
                  <span className={series.scoreB > series.scoreA ? 'text-blue-500' : 'text-slate-600'}>{series.scoreB}</span>
                </div>
                <span className="text-[8px] text-slate-600 tracking-widest mt-1">{series.description}</span>
              </div>

              {/* Lado B */}
              <div className="flex items-center gap-4 w-32">
                <div className="relative w-10 h-10 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                  <div className="absolute inset-0 bg-white/5 blur-sm rounded-full"></div>
                  {series.teamB.logo && <img src={series.teamB.logo} className="w-full h-full object-contain relative z-10" alt="" />}
                </div>
                <span className={`text-xs ${series.scoreB > series.scoreA ? 'text-white' : 'text-slate-500'}`}>{series.teamB.tag}</span>
              </div>

              {/* TIMELINE COM LOGO NO TOOLTIP */}
              <div className="hidden xl:flex items-center gap-2 flex-1 px-10">
                {series.games.map((g: any, i: number) => {
                  const isBlueWinner = g.winner_side === 'blue';
                  const winner = isBlueWinner ? series.teamA : series.teamB;
                  
                  return (
                    <div key={i} className="group/bar relative flex-1 h-1.5 cursor-help">
                      <div className={`w-full h-full rounded-full transition-all duration-300 ${isBlueWinner ? 'bg-blue-500/40 group-hover/bar:bg-blue-500' : 'bg-red-500/40 group-hover/bar:bg-red-500'}`}></div>
                      
                      {/* TOOLTIP GIGANTE COM Z-INDEX MÁXIMO */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,1)] opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-all duration-300 z-[9999] min-w-[180px] backdrop-blur-xl scale-90 group-hover/bar:scale-100">
                         <div className="flex flex-col items-center">
                            <p className="text-[7px] text-slate-500 tracking-[0.4em] mb-3 font-mono border-b border-white/5 w-full pb-2">DATA_STREAM_G0{i + 1}</p>
                            <div className="flex items-center gap-3 mb-2">
                               <div className="relative w-8 h-8 flex items-center justify-center">
                                  <div className="absolute inset-0 bg-white/10 blur-md rounded-full"></div>
                                  <img src={winner.logo} className="w-6 h-6 object-contain relative z-10" alt="" />
                               </div>
                               <div className="text-left">
                                  <p className={`text-[12px] leading-none font-black italic ${isBlueWinner ? 'text-blue-400' : 'text-red-400'}`}>{winner.tag}</p>
                                  <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-tighter">Side: {g.winner_side}</p>
                               </div>
                            </div>
                            <div className="w-full bg-white/5 h-[1px] my-2"></div>
                            <p className="text-[9px] text-emerald-400 font-black">VICTORY_CONFIRMED</p>
                         </div>
                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[8px] border-x-transparent border-t-[8px] border-t-white/10"></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex-none">
                 <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center group-hover:bg-white/5 transition-colors">
                   <span className="text-[10px] text-slate-600">{expandedSeries === series.id ? '▲' : '▼'}</span>
                 </div>
              </div>
            </div>

            {/* EXPANSÃO */}
            {expandedSeries === series.id && (
              <div className="bg-black/20 border-t border-white/5 p-4 md:p-6 animate-in slide-in-from-top-2 duration-300 rounded-b-2xl overflow-hidden">
                <div className="grid grid-cols-1 gap-2">
                  {series.games.map((game: any) => (
                    <div key={game.match_id} className="flex flex-wrap items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-600 font-mono">PROTOCOL_ID</span>
                        <span className="text-[11px] text-blue-400 font-mono truncate max-w-[200px]">{game.match_id}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-slate-600 mb-1">UNIT_RESULT</span>
                        <span className={`px-3 py-1 rounded-md text-[9px] border font-black ${game.winner_side === 'blue' ? 'border-blue-500/20 text-blue-400 bg-blue-500/5' : 'border-red-500/20 text-red-400 bg-red-500/5'}`}>
                          {game.winner_side === 'blue' ? series.teamA.tag : series.teamB.tag} WIN
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => handleProcessAnalytics(game.match_id)} className="text-[9px] text-slate-500 hover:text-white transition-colors font-bold uppercase">SYNC</button>
                        <Link href={`/dashboard/matches/${game.match_id}`} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white border border-white/5 transition-all">FULL REPORT →</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="flex flex-col bg-white/[0.02] border border-white/5 px-5 py-3 rounded-2xl min-w-[100px]">
      <span className="text-[8px] text-slate-600 tracking-widest mb-1 uppercase">{label}</span>
      <span className={`text-xl font-black italic ${color}`}>{value}</span>
    </div>
  );
}