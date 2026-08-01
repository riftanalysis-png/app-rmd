import { useState, useEffect } from 'react';
import { Plus, Swords, Edit2, Shield } from 'lucide-react';
// Certifique-se de exportar essas funções no seu arquivo de utils!
import { formatDate, getTeamLogo } from '@/lib/utils/formatters';

// Função interna para aplicar a mesma paleta Neon dos gráficos
const getNeonDiffClasses = (diff: string) => {
  switch(diff.toUpperCase().trim()) {
    case 'STOMPAMOS': return 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30';
    case 'MUITO FÁCIL': return 'bg-sky-950/40 text-sky-400 border-sky-500/30';
    case 'FÁCIL': return 'bg-indigo-950/40 text-indigo-400 border-indigo-500/30';
    case 'CONTROLADO': return 'bg-violet-950/40 text-violet-400 border-violet-500/30';
    case 'DIFÍCIL': return 'bg-rose-950/40 text-rose-400 border-rose-500/30';
    case 'MT DIFÍCIL': return 'bg-red-950/40 text-red-400 border-red-500/30';
    case 'STOMPADOS': return 'bg-rose-950/40 text-rose-600 border-rose-700/30'; 
    default: return 'bg-zinc-900 text-zinc-500 border-zinc-800';
  }
};

export default function AdvancedLogs({ advancedScrims, isStaff, onOpenManualLog, onEditLog, teamsList }: any) {
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 20;

  useEffect(() => {
    setLogsPage(1);
  }, [advancedScrims]);

  const totalLogPages = Math.ceil((advancedScrims?.length || 0) / LOGS_PER_PAGE);
  const paginatedLogs = advancedScrims?.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE) || [];

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 shadow-2xl relative w-full overflow-hidden group hover-lift h-[500px] flex flex-col mt-6">
      <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-100 transition-all duration-500"></div>
      
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800/60 pb-4 shrink-0 z-10">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <div className="w-1.5 h-4 bg-zinc-400 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.4)] animate-pulse"></div> Advanced Logs
          </h3>
          <p className="text-[9px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">Histórico Detalhado de Operações</p>
        </div>
        {isStaff && (
          <button onClick={onOpenManualLog} className="bg-zinc-900 border border-zinc-800 text-white hover:bg-white hover:text-black px-4 py-2 rounded-lg text-[9px] font-black transition-all uppercase tracking-widest flex items-center gap-1">
            <Plus size={12} /> Log Manual
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar pr-2 z-10">
        <table className="w-full text-left border-separate border-spacing-y-2.5 min-w-[700px]">
           <thead className="sticky top-0 bg-[#121214]/95 backdrop-blur-md z-10 text-[8px] text-zinc-500 font-black tracking-[0.2em] uppercase">
             <tr>
                <th className="px-4 pb-2 border-b border-zinc-800/80">DATA / OPONENTE</th>
                <th className="px-4 pb-2 border-b border-zinc-800/80 text-center">RES / PLACAR</th>
                <th className="px-4 pb-2 border-b border-zinc-800/80 text-center">COMP TESTADA</th>
                <th className="px-4 pb-2 border-b border-zinc-800/80 text-center">DIFICULDADE (JOGO A JOGO)</th>
                <th className="px-4 pb-2 border-b border-zinc-800/80 text-center">REMAKES</th>
             </tr>
           </thead>
           <tbody>
              {paginatedLogs.length > 0 ? paginatedLogs.map((scrim: any) => (
                 <tr key={scrim.id} className={`transition-all duration-300 group/row text-[9px] cursor-default border border-zinc-800/30 ${scrim.isMission ? 'bg-blue-950/10 hover:bg-blue-900/20' : 'bg-zinc-900/30 hover:bg-zinc-800/60'}`}>
                    <td className="p-3 rounded-l-xl border-y border-l border-zinc-800/30">
                       <div className="flex items-center gap-3">
                          {getTeamLogo(scrim.opponent, teamsList) ? (
                            <img src={getTeamLogo(scrim.opponent, teamsList)!} className="w-8 h-8 object-contain shrink-0 bg-zinc-950 rounded-lg p-1 border border-zinc-800 drop-shadow-sm group-hover/row:border-zinc-600 transition-colors" />
                          ) : (
                            <div className="w-8 h-8 shrink-0 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-600 transition-colors">{scrim.opponent.substring(0,3)}</div>
                          )}
                          <div className="flex flex-col gap-0.5">
                             <span className={`${scrim.isMission ? 'text-blue-500' : 'text-blue-400'} font-bold tracking-[0.2em] uppercase transition-colors text-[8px]`}>{formatDate(scrim.date)}</span>
                             <span className="text-white text-sm font-black leading-none uppercase tracking-tight drop-shadow-sm">VS {scrim.opponent}</span>
                          </div>
                       </div>
                    </td>
                    <td className="p-3 text-center border-y border-zinc-800/30">
                       <div className="flex flex-col items-center gap-1">
                          <span className={`text-base font-black ${scrim.result === 'W' ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : scrim.result === 'L' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]' : scrim.result === 'AGEND.' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'text-zinc-400'}`}>{scrim.result}</span>
                          <span className={`font-black px-2 py-0.5 rounded border ${scrim.isMission ? 'bg-blue-950/50 text-blue-300 border-blue-900/50' : 'bg-zinc-950/80 text-white border-zinc-700'}`}>{scrim.score}</span>
                       </div>
                    </td>
                    <td className="p-3 text-center border-y border-zinc-800/30">
                       <div className="flex flex-col items-center gap-1">
                          <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 font-black tracking-widest text-[7px] uppercase">{scrim.mode}</span>
                          <span className="text-zinc-400 font-bold group-hover/row:text-white transition-colors">{scrim.comp}</span>
                       </div>
                    </td>
                    <td className="p-3 text-center border-y border-zinc-800/30">
                       {scrim.isMission ? (
                           <span className="px-2 py-1 rounded-md border font-black text-[8px] tracking-widest uppercase shadow-sm bg-zinc-900 text-zinc-500 border-zinc-800">
                             {scrim.difficulty}
                           </span>
                       ) : (
                           // LÓGICA NOVA: Divide a string de dificuldade pela vírgula e desenha J1, J2, J3...
                           <div className="flex flex-wrap items-center justify-center gap-1 max-w-[140px] mx-auto">
                              {String(scrim.difficulty || 'CONTROLADO').split(',').map((diff, index) => {
                                  const cleanDiff = diff.trim();
                                  // Limita o nome pra não quebrar a tabela (ex: STOMPAMOS vira STOMP)
                                  const shortDiff = cleanDiff.replace('MUITO', 'MT').replace('STOMPAMOS', 'STOMP.').replace('STOMPADOS', 'STOMP.');
                                  
                                  return (
                                    <span key={index} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border font-black text-[7px] tracking-widest uppercase shadow-sm ${getNeonDiffClasses(cleanDiff)}`} title={`Jogo ${index + 1}: ${cleanDiff}`}>
                                       <span className="opacity-50">J{index + 1}</span>
                                       <span>{shortDiff}</span>
                                    </span>
                                  )
                              })}
                           </div>
                       )}
                    </td>
                    <td className="p-3 text-center rounded-r-xl border-y border-r border-zinc-800/30 relative">
                       <span className={`font-black text-[9px] ${scrim.remakes > 0 ? 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]' : 'text-zinc-600'}`}>{scrim.remakes > 0 ? `${scrim.remakes} RMK` : '-'}</span>
                       
                       {isStaff && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-2 bg-zinc-900/95 backdrop-blur-sm p-1.5 rounded-lg border border-zinc-700 shadow-xl transition-all duration-300 translate-x-2 group-hover/row:translate-x-0">
                             <button onClick={() => onEditLog(scrim)} className="text-blue-400 hover:text-white px-2.5 py-1 bg-blue-500/10 hover:bg-blue-600 hover:border-blue-500 rounded font-black tracking-widest border border-transparent transition-all uppercase text-[7px] flex items-center gap-1">
                                <Edit2 size={10}/> {scrim.isMission ? 'LOGAR RESULTADO' : 'EDITAR'}
                             </button>
                          </div>
                       )}
                    </td>
                 </tr>
              )) : <tr><td colSpan={5} className="text-center py-10 text-[9px] font-black text-zinc-600 uppercase tracking-widest opacity-80">NENHUM REGISTO ENCONTRADO NO PERÍODO.</td></tr>}
           </tbody>
        </table>

        {totalLogPages > 1 && (
           <div className="flex justify-between items-center px-4 py-3 mt-2 border-t border-zinc-800/60 shrink-0">
             <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
               Página {logsPage} de {totalLogPages}
             </span>
             <div className="flex gap-2">
               <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg disabled:opacity-50 font-bold text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-colors">Anterior</button>
               <button onClick={() => setLogsPage(p => Math.min(totalLogPages, p + 1))} disabled={logsPage === totalLogPages} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg disabled:opacity-50 font-bold text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-colors">Próxima</button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}