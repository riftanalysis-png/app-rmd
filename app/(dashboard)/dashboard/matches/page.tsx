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

  // LÓGICA DE PLACAR: Agrupa partidas por série e soma vitórias
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
          scoreA: 0,
          scoreB: 0
        };
      }
      groups[sId].games.push(m);
      if (m.winner_side === 'blue') groups[sId].scoreA++;
      else if (m.winner_side === 'red') groups[sId].scoreB++;
    });

    // Ordenação reversa por ID (como não temos data, usamos a ordem alfabética/numérica do ID)
    return Object.values(groups).sort((a: any, b: any) => String(b.id).localeCompare(String(a.id)));
  }, [matches]);

  const handleProcessAnalytics = async (matchId: string) => {
    setProcessingId(matchId);
    try { await processMatchIntelligence(matchId); } 
    catch (err: any) { alert("ERRO: " + err.message); } 
    finally { setProcessingId(null); }
  };

  const handleBatchProcess = async () => {
    if (!confirm(`DESEJA RECALCULAR TODAS AS ${matches.length} PARTIDAS?`)) return;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: matches.length });
    
    for (let i = 0; i < matches.length; i++) {
      try { await processMatchIntelligence(matches[i].match_id); } catch (e) {}
      setBatchProgress({ current: i + 1, total: matches.length });
    }
    
    setIsBatchProcessing(false);
    fetchMatches();
  };

  if (loading) return <div className="p-20 text-blue-500 font-black text-center animate-pulse italic uppercase">RMD ANALYTICS: AUDITANDO HISTÓRICO DE SÉRIES...</div>;

  return (
    <div className="max-w-[1300px] mx-auto space-y-8 p-6 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="flex flex-col lg:flex-row justify-between items-end gap-6 border-l-4 border-blue-600 pl-6 mb-12 text-white">
        <div>
          <h1 className="text-5xl leading-none">AUDITORIA DE SÉRIES</h1>
          <p className="text-blue-400 text-[10px] tracking-[0.4em] mt-2 italic font-black">Sync Protocol Active // Scoreboard Intel</p>
        </div>
        <button 
          onClick={handleBatchProcess}
          disabled={isBatchProcessing || matches.length === 0}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-[0_0_25px_rgba(37,99,235,0.3)] text-[10px]"
        >
          {isBatchProcessing ? `SYNCING ${batchProgress.current}/${batchProgress.total}` : "⚡ RECALCULAR TUDO"}
        </button>
      </header>

      <div className="space-y-6">
        {groupedSeries.map((series: any) => (
          <div key={series.id} className="bg-slate-900/30 border border-slate-800 rounded-[48px] overflow-hidden backdrop-blur-md transition-all hover:border-blue-500/30 shadow-2xl">
            
            <div onClick={() => setExpandedSeries(expandedSeries === series.id ? null : series.id)} className="p-10 flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-12 flex-1 justify-center">
                <div className="flex flex-col items-center gap-3 w-32">
                  <div className="w-20 h-20 bg-slate-950/50 rounded-full flex items-center justify-center border border-slate-800 overflow-hidden shadow-inner">
                    {series.teamA.logo ? <img src={series.teamA.logo} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform" alt="" /> : <span className="text-[10px] text-slate-700">{series.teamA.tag}</span>}
                  </div>
                  <span className="text-[10px] text-slate-500 tracking-widest">{series.teamA.tag}</span>
                </div>
                
                <div className="flex flex-col items-center px-12 border-x border-slate-800/50">
                  <div className="text-6xl font-black italic tracking-tighter text-white flex items-center gap-8">
                    <span className={series.scoreA > series.scoreB ? "text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-slate-500"}>{series.scoreA}</span>
                    <span className="text-slate-800 text-2xl">VS</span>
                    <span className={series.scoreB > series.scoreA ? "text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-slate-500"}>{series.scoreB}</span>
                  </div>
                  <span className="text-[9px] text-slate-600 mt-4 tracking-[0.3em] font-black">{series.description}</span>
                </div>

                <div className="flex flex-col items-center gap-3 w-32">
                  <div className="w-20 h-20 bg-slate-950/50 rounded-full flex items-center justify-center border border-slate-800 overflow-hidden shadow-inner">
                    {series.teamB.logo ? <img src={series.teamB.logo} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform" alt="" /> : <span className="text-[10px] text-slate-700">{series.teamB.tag}</span>}
                  </div>
                  <span className="text-[10px] text-slate-500 tracking-widest">{series.teamB.tag}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 pr-4">
                <span className="text-blue-600 text-[9px] font-black group-hover:text-white transition-colors">
                  {expandedSeries === series.id ? 'FECHAR ↑' : 'GAMES ↓'}
                </span>
              </div>
            </div>

            {expandedSeries === series.id && (
              <div className="bg-slate-950/60 border-t border-slate-800 p-10 animate-in slide-in-from-top duration-500">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-600 tracking-widest italic uppercase">
                    <tr><th className="pb-6">MATCH ID</th><th className="pb-6">WINNER</th><th className="pb-6 text-right">PROTOCOLO</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {series.games.map((game: any) => (
                      <tr key={game.match_id} className="group hover:bg-white/5 transition-all">
                        <td className="py-6 font-mono text-blue-400 text-sm italic">{game.match_id.substring(0, 30)}...</td>
                        <td className="py-6">
                          <span className={`px-4 py-1 rounded-2xl text-[10px] border font-black ${game.winner_side === 'blue' ? 'border-blue-500/40 text-blue-400 bg-blue-500/5' : 'border-red-500/40 text-red-400 bg-red-500/5'}`}>
                            {game.winner_side === 'blue' ? series.teamA.tag : series.teamB.tag} VENCEU
                          </span>
                        </td>
                        <td className="py-6 text-right space-x-6">
                          <button onClick={() => handleProcessAnalytics(game.match_id)} disabled={processingId === game.match_id} className={`text-[10px] font-black ${processingId === game.match_id ? 'text-purple-400 animate-pulse' : 'text-slate-600 hover:text-white transition-colors'}`}>{processingId === game.match_id ? "SYNCING..." : "RECALC"}</button>
                          <Link href={`/dashboard/matches/${game.match_id}`} className="text-[10px] text-blue-500 hover:text-blue-300 uppercase italic">DETALHES →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}