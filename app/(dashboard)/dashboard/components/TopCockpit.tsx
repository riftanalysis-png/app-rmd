import { Users } from 'lucide-react';

export default function TopCockpit({ currentUser, squadConfig, myTeamTag, isStaff, myStats }: any) {
  // A lógica de UI de theme/cores baseada no squadConfig fica isolada aqui
  const intensityTheme = squadConfig.intensity < 40 ? { text: 'text-emerald-400', bg: 'bg-emerald-500' } : squadConfig.intensity < 75 ? { text: 'text-amber-400', bg: 'bg-amber-500' } : { text: 'text-red-400', bg: 'bg-red-500' };

  return (
    <div className="animate-fade-in-up bg-[#121214] border border-zinc-800/80 rounded-[24px] p-4 md:p-6 flex flex-col xl:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden mt-6">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-50 pointer-events-none"></div>
      
      {/* 1. PERFIL */}
      <div className="flex items-center gap-5 w-full xl:w-auto relative z-10">
         <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-xl bg-zinc-900 border-2 border-zinc-700 overflow-hidden shadow-md">
               <img src={currentUser?.photo} className="w-full h-full object-cover" alt="Profile" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white font-black text-[7px] px-1.5 py-0.5 rounded shadow-lg uppercase tracking-widest">{isStaff ? 'STAFF' : 'ROSTER'}</div>
         </div>
         <div className="flex flex-col justify-center flex-1">
            <div className="flex items-center gap-3 mb-0.5">
               <h2 className="text-xl font-black text-white uppercase tracking-tight truncate drop-shadow-md">{currentUser?.name}</h2>
               <button className="text-[8px] font-bold text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 px-2 py-1 rounded transition-colors uppercase tracking-widest">EDITAR</button>
               {isStaff && (
                  <button className="ml-2 text-[8px] font-black text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 px-2.5 py-1 rounded transition-all uppercase flex items-center gap-1.5 shadow-sm">
                     <Users size={10} /> ELENCO
                  </button>
               )}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
               <span className="bg-blue-600 border-blue-500 text-white text-[9px] px-3 py-1.5 rounded-lg border uppercase font-black tracking-widest leading-none shadow-sm">{currentUser?.role}</span>
               <span className="bg-zinc-800 text-zinc-300 border-zinc-700 text-white text-[9px] px-3 py-1.5 rounded-lg border uppercase font-black tracking-widest leading-none shadow-sm">{myTeamTag}</span>
            </div>
         </div>
      </div>

      {/* 2. STATS (Mostra apenas se não for staff, usando seu código original do MiniStatBar) */}
      {!isStaff && myStats && (
         <div className="hidden md:flex flex-1 items-center gap-6 px-6 border-x border-zinc-800/60 relative z-10">
            {/* Seu código original do myStats.lane, myStats.impact... */}
         </div>
      )}

      {/* 3. DIRETRIZ DA STAFF */}
      <div className="flex items-center gap-4 w-full xl:w-[350px] shrink-0 relative z-10 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50">
         <div className={`w-1 h-full rounded-full ${intensityTheme.bg}`}></div>
         <div className="flex flex-col flex-1">
            <div className="flex justify-between items-end mb-1">
               <span className="text-[8px] text-zinc-500 font-black tracking-widest uppercase">DIRETRIZ DA STAFF</span>
               <span className={`text-[8px] font-black uppercase tracking-widest ${intensityTheme.text}`}>{squadConfig?.load || 'NORMAL'}</span>
            </div>
            <span className="text-white text-[11px] font-black uppercase tracking-tight truncate leading-tight mb-1.5">{squadConfig?.directive || 'FUNDAMENTALS & SCRIMS'}</span>
            <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
               <div className={`h-full ${intensityTheme.bg} transition-all duration-1000 ease-out`} style={{ width: `${squadConfig?.intensity || 70}%` }}></div>
            </div>
         </div>
      </div>
    </div>
  );
}