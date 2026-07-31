import { CalendarIcon, ChevronLeft, ChevronRight, Edit2, Trash2, Shield } from 'lucide-react';

// 1. Adicionamos currentDate e setCurrentDate nas props
export default function AgendaCalendar({ 
  calendarGrid, 
  isStaff, 
  onDayClick, 
  onEditEvent, 
  onDeleteEvent,
  currentDate,    // NOVO
  setCurrentDate  // NOVO
}: any) {
  
  // 2. REMOVEMOS a linha abaixo, pois agora vem do pai!
  // const [currentDate, setCurrentDate] = useState(new Date());

  const CalendarEventItem = ({ ev, isStaff, onEdit, onDelete }: any) => {
    const isScrim = ev.type === 'SCRIM';
    const isTryout = ev.type === 'TRYOUT';
    
    const bgClass = ev.isPast 
        ? (isTryout ? 'bg-fuchsia-950/20 border-fuchsia-900/40 hover:bg-fuchsia-900/40' : isScrim ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-900/40' : 'bg-blue-950/20 border-blue-900/40 hover:bg-blue-900/40')
        : (isTryout ? 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/20' : isScrim ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20');
    
    const textClass = isTryout ? 'text-fuchsia-400' : isScrim ? 'text-amber-500' : 'text-blue-400';

    return (
       <div onClick={(e) => { if(!ev.isAuto && isStaff) onEdit(e, ev); else e.stopPropagation(); }} className={`p-2 rounded-lg flex items-center gap-2.5 border ${bgClass} transition-colors w-full cursor-pointer overflow-hidden shrink-0 group/item hover:border-zinc-500`}>
          {ev.logo ? (
             <img src={ev.logo} className="w-8 h-8 object-contain drop-shadow-lg shrink-0 bg-black/40 rounded p-0.5 border border-zinc-800" alt={ev.opp} />
          ) : (
             <div className="w-8 h-8 rounded bg-black/40 border border-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-500 shrink-0"><Shield size={14} /></div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <div className="flex justify-between items-center">
                 <span className={`text-[10px] font-black ${textClass} uppercase truncate group-hover/item:text-white transition-colors pr-2`}>{ev.opp}</span>
                 <span className="text-[8px] text-zinc-400 font-bold tracking-widest">{ev.time}</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                 <span className="text-[8px] font-bold text-zinc-500 uppercase">{ev.type}</span>
                 <span className={`text-[9px] font-black uppercase leading-none ${ev.isPast ? (ev.isWin ? 'text-emerald-500' : ev.resultText.includes('D') ? 'text-zinc-400' : 'text-red-500') : 'text-zinc-300'}`}>
                    {ev.isPast ? ev.resultText : ev.mode}
                 </span>
              </div>
              {isStaff && !ev.isAuto && (
                 <div className="flex gap-1.5 mt-1.5 border-t border-zinc-800/40 pt-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(e, ev); }} className="flex-1 flex justify-center items-center py-1 bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition-colors border border-blue-500/20 hover:border-blue-500">
                       <Edit2 size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(ev); }} className="flex-1 flex justify-center items-center py-1 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors border border-red-500/20 hover:border-red-500">
                       <Trash2 size={10} />
                    </button>
                 </div>
              )}
          </div>
       </div>
    );
  };

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl flex flex-col shrink-0 hover-lift h-full min-h-[450px]">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <h3 className="text-[10px] text-zinc-300 font-black tracking-[0.2em] uppercase flex items-center gap-2">
          <CalendarIcon size={14} className="text-blue-500" /> Agenda - {currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1.5">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all"><ChevronLeft size={12} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white font-black text-[8px] uppercase tracking-widest">HOJE</button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all"><ChevronRight size={12} /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
        {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={`hdr-${i}`} className="text-center text-[9px] text-zinc-500 font-black mb-1 uppercase tracking-widest">{d}</div>)}
        
        {calendarGrid.map((cell: any, idx: number) => {
           if (cell.isGhost) {
               return (
                   <div key={`ghost-${idx}`} className="flex flex-col items-center justify-center min-h-[50px] rounded-lg border border-transparent bg-zinc-900/10 opacity-40 grayscale pointer-events-none">
                       <span className="text-[10px] font-black text-zinc-600">{cell.day}</span>
                   </div>
               );
           }

           let borderClass = 'border-transparent bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-800/80';
           if (cell.isToday) borderClass = 'border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_10px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20';

           return (
             <div key={cell.dateStr} onClick={() => onDayClick(cell.dateStr)} className={`relative flex flex-col items-center justify-center min-h-[50px] rounded-lg border transition-all duration-300 group/day cursor-pointer ${borderClass}`}>
                <span className={`text-[10px] font-black z-10 transition-colors ${cell.isToday ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-200'}`}>{cell.day}</span>
                
                {cell.events.length > 0 && (
                   <div className="flex gap-0.5 mt-0.5 z-10">
                      {cell.events.slice(0, 3).map((ev: any, i: number) => {
                         let dotColor = ev.type === 'TRYOUT' ? 'bg-fuchsia-500' : ev.type === 'SCRIM' ? 'bg-amber-500' : 'bg-blue-500';
                         if (ev.isPast) {
                             dotColor = ev.isWin ? 'bg-emerald-500' : ev.resultText.includes('D') ? 'bg-zinc-500' : 'bg-red-500';
                         }
                         return <div key={i} className={`w-1 h-1 rounded-full ${dotColor}`} />
                      })}
                   </div>
                )}

                {cell.events.length > 0 && (
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl rounded-xl z-[100] opacity-0 pointer-events-none group-hover/day:opacity-100 group-hover/day:pointer-events-auto transition-all duration-300 delay-300 group-hover/day:delay-0 p-2 flex flex-col gap-1.5 transform translate-y-2 group-hover/day:translate-y-0 after:content-[''] after:absolute after:w-full after:h-6 after:-bottom-6 after:left-0">
                      <div className="flex justify-between items-center px-1 border-b border-zinc-800 pb-1.5 mb-0.5">
                         <span className="text-[9px] font-black text-white tracking-widest">DIA {cell.day}</span>
                         <span className="text-[7px] text-zinc-400 font-bold uppercase">{cell.events.length} Eventos</span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                         {cell.events.map((ev: any) => (
                            <CalendarEventItem key={ev.id} ev={ev} isStaff={isStaff} onEdit={onEditEvent} onDelete={onDeleteEvent} />
                         ))}
                      </div>
                   </div>
                )}
             </div>
           )
        })}
      </div>
    </div>
  );
}