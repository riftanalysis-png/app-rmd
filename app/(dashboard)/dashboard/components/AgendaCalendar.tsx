import { useState, useMemo } from 'react';
import { 
  CalendarIcon, ChevronLeft, ChevronRight, Edit2, Trash2, Shield, 
  Target, Swords, Trophy, CalendarDays, CalendarRange, Clock, Inbox, Plus
} from 'lucide-react';

export default function AgendaCalendar({ 
  calendarGrid, isStaff, onDayClick, onEditEvent, onDeleteEvent, 
  currentDate, setCurrentDate, teamStatsRaw, opponentStatsData, myTeamTag 
}: any) {
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'DAY'>('MONTH');

  // --- NAVEGAÇÃO INTELIGENTE ---
  const navigate = (dir: 1 | -1) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') {
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + dir);
    }
    if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() + (dir * 7));
    if (viewMode === 'DAY') newDate.setDate(newDate.getDate() + dir);
    setCurrentDate(newDate);
  };

  const visibleGrid = useMemo(() => {
    if (viewMode === 'MONTH') return calendarGrid;
    const currentStr = currentDate.toISOString().split('T')[0];
    const idx = calendarGrid.findIndex((c: any) => c.dateStr === currentStr);
    
    if (viewMode === 'WEEK') {
      if (idx === -1) return calendarGrid.slice(0, 7); 
      const startOfWeek = Math.floor(idx / 7) * 7;
      return calendarGrid.slice(startOfWeek, startOfWeek + 7);
    }
    if (viewMode === 'DAY') return calendarGrid.filter((c: any) => c.dateStr === currentStr);
    return calendarGrid;
  }, [calendarGrid, viewMode, currentDate]);

  const periodStats = useMemo(() => {
    let scrims = 0; let ofcs = 0; let tryouts = 0;
    visibleGrid.forEach((cell: any) => {
      if(!cell.isGhost) {
        cell.events.forEach((ev: any) => {
          if (ev.type === 'SCRIM') scrims++; else if (ev.type === 'TRYOUT') tryouts++; else ofcs++;
        });
      }
    });
    return { scrims, ofcs, tryouts };
  }, [visibleGrid]);

  const headerDateText = useMemo(() => {
    if (viewMode === 'MONTH') return currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    if (viewMode === 'WEEK') return `Semana de ${currentDate.getDate()} de ${currentDate.toLocaleDateString('pt-PT', { month: 'short' })}`;
    return currentDate.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
  }, [currentDate, viewMode]);

  // --- SUBCOMPONENTE DE EVENTO (Usado no Tooltip e na Visão Diária) ---
  const CalendarEventItem = ({ ev, isStaff, onEdit, onDelete, isDayView = false }: any) => {
    const isScrim = ev.type === 'SCRIM';
    const isTryout = ev.type === 'TRYOUT';
    
    const bgClass = ev.isPast 
        ? (isTryout ? 'bg-fuchsia-950/20 border-fuchsia-900/40 hover:bg-fuchsia-900/40' : isScrim ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-900/40' : 'bg-blue-950/20 border-blue-900/40 hover:bg-blue-900/40')
        : (isTryout ? 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/20' : isScrim ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20');
    
    const textClass = isTryout ? 'text-fuchsia-400' : isScrim ? 'text-amber-500' : 'text-blue-400';
    const Icon = isTryout ? Target : isScrim ? Swords : Trophy;

    // --- LÓGICA DE DADOS ANALÍTICOS (Visão Diária) ---
    const h2h = opponentStatsData?.find((s: any) => s.opponent === ev.opp);
    let avgLane = 0, avgImp = 0, avgConv = 0, avgVis = 0;
    let hasStats = false;

    if (isDayView && ev.isPast && ev.isAuto && ev.games && teamStatsRaw) {
        const matchIds = ev.games.map((g:any) => g.match_id || g.id);
        const myStats = teamStatsRaw.filter((s:any) => matchIds.includes(s.match_id) && String(s.team_acronym).toUpperCase().includes(myTeamTag));
        if (myStats.length > 0) {
            hasStats = true;
            avgLane = Math.round(myStats.reduce((a:number,b:any)=>a+Number(b.avg_lane),0)/myStats.length);
            avgImp = Math.round(myStats.reduce((a:number,b:any)=>a+Number(b.avg_impact),0)/myStats.length);
            avgConv = Math.round(myStats.reduce((a:number,b:any)=>a+Number(b.avg_conversion),0)/myStats.length);
            avgVis = Math.round(myStats.reduce((a:number,b:any)=>a+Number(b.avg_vision),0)/myStats.length);
        }
    }

    const StatBox = ({ label, val }: { label: string, val: number }) => (
       <div className="flex flex-col items-center justify-center bg-black/40 border border-zinc-800 rounded-lg py-1.5 px-2">
          <span className="text-[8px] text-zinc-500 font-bold uppercase mb-0.5">{label}</span>
          <span className={`text-xs font-black ${val >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{val}</span>
       </div>
    );

    return (
       <div onClick={(e) => { if(!ev.isAuto && isStaff) onEdit(e, ev); else e.stopPropagation(); }} className={`p-3 rounded-xl flex flex-col border ${bgClass} transition-all duration-300 w-full cursor-pointer overflow-hidden shrink-0 group/item hover:border-zinc-500 ${isDayView ? 'hover:-translate-y-1 hover:shadow-lg' : ''}`}>
          
          <div className="flex items-center gap-3 w-full">
            {ev.logo ? (
               <img src={ev.logo} className={`${isDayView ? 'w-14 h-14' : 'w-8 h-8'} object-contain drop-shadow-lg shrink-0 bg-black/40 rounded-lg p-1 border border-zinc-800`} alt={ev.opp} />
            ) : (
               <div className={`${isDayView ? 'w-14 h-14 text-sm' : 'w-8 h-8 text-[9px]'} rounded-lg bg-black/40 border border-zinc-700 flex items-center justify-center font-black text-zinc-500 shrink-0`}><Shield size={isDayView ? 24 : 14} /></div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-1.5">
                      <Icon size={isDayView ? 16 : 10} className={textClass} />
                      <span className={`${isDayView ? 'text-sm' : 'text-[10px]'} font-black ${textClass} uppercase truncate group-hover/item:text-white transition-colors pr-2`}>{ev.opp}</span>
                   </div>
                   <span className={`${isDayView ? 'text-xs' : 'text-[8px]'} text-zinc-400 font-bold tracking-widest bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-700/50`}>{ev.time}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                   <span className={`${isDayView ? 'text-[10px]' : 'text-[8px]'} font-bold text-zinc-500 uppercase tracking-widest`}>{ev.type}</span>
                   <span className={`${isDayView ? 'text-xs px-2 py-1 bg-black/20 rounded border border-zinc-800/40' : 'text-[9px]'} font-black uppercase leading-none ${ev.isPast ? (ev.isWin ? 'text-emerald-500' : ev.resultText.includes('D') ? 'text-zinc-400' : 'text-red-500') : 'text-zinc-300'}`}>
                      {ev.isPast ? ev.resultText : ev.mode}
                   </span>
                </div>
            </div>
          </div>

          {/* --- INFORMAÇÕES EXTRAS DA VISÃO DIÁRIA --- */}
          {isDayView && ev.isPast && ev.isAuto && hasStats && (
              <div className="mt-3 pt-3 border-t border-zinc-800/50 grid grid-cols-4 gap-2">
                 <StatBox label="LANE" val={avgLane} />
                 <StatBox label="IMPACT" val={avgImp} />
                 <StatBox label="CONV" val={avgConv} />
                 <StatBox label="VISION" val={avgVis} />
              </div>
          )}
          {isDayView && ev.isPast && !ev.isAuto && (
              <div className="mt-3 pt-3 border-t border-zinc-800/50 flex gap-6">
                 <div>
                    <span className="block text-[8px] text-zinc-500 font-bold uppercase">Dificuldade</span>
                    <span className="text-[10px] font-black text-white">{ev.rawScrim?.difficulty || 'N/A'}</span>
                 </div>
                 <div>
                    <span className="block text-[8px] text-zinc-500 font-bold uppercase">Comp Testada</span>
                    <span className="text-[10px] font-black text-white">{ev.rawScrim?.comp_tested || 'N/A'}</span>
                 </div>
              </div>
          )}
          {isDayView && !ev.isPast && (
              <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center gap-2">
                  <Target size={14} className="text-zinc-500" />
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">Background vs {ev.opp}:</span>
                  {h2h && h2h.total > 0 ? (
                     <div className="flex items-center gap-1.5 ml-1">
                        <span className={`text-[11px] font-black ${h2h.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{h2h.winRate}% WR</span>
                        <span className="text-[9px] font-bold text-zinc-400">({h2h.wins}W - {h2h.losses}L)</span>
                     </div>
                  ) : (
                     <span className="text-[10px] font-black text-blue-400 ml-1">Primeiro Confronto Registrado</span>
                  )}
              </div>
          )}

          {/* Botões de Ação só aparecem no Hover */}
          {isStaff && !ev.isAuto && (
             <div className="flex gap-2 mt-3 border-t border-zinc-800/40 pt-3 opacity-0 h-0 overflow-hidden group-hover/item:opacity-100 group-hover/item:h-auto transition-all duration-300">
                <button onClick={(e) => { e.stopPropagation(); onEdit(e, ev); }} className="flex-1 flex justify-center items-center py-1.5 bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-md transition-colors border border-blue-500/20 hover:border-blue-500">
                   <Edit2 size={12} /> <span className="text-[9px] font-bold uppercase ml-1.5 tracking-wider hidden sm:block">Editar</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(ev); }} className="flex-1 flex justify-center items-center py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-md transition-colors border border-red-500/20 hover:border-red-500">
                   <Trash2 size={12} /> <span className="text-[9px] font-bold uppercase ml-1.5 tracking-wider hidden sm:block">Apagar</span>
                </button>
             </div>
          )}
       </div>
    );
  };

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl flex flex-col shrink-0 h-full min-h-[450px]">
      
      {/* HEADER: Navegação e Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <div>
           <h3 className="text-xs text-zinc-300 font-black tracking-[0.2em] uppercase flex items-center gap-2 mb-2 capitalize-first">
             <CalendarIcon size={16} className="text-blue-500" /> Agenda - {headerDateText}
           </h3>
           <div className="flex gap-2 mt-2">
              {periodStats.ofcs > 0 && <span className="text-[9px] font-black tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">{periodStats.ofcs} OFICIAIS</span>}
              {periodStats.scrims > 0 && <span className="text-[9px] font-black tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{periodStats.scrims} SCRIMS</span>}
              {periodStats.tryouts > 0 && <span className="text-[9px] font-black tracking-widest text-fuchsia-400 bg-fuchsia-500/10 px-2 py-1 rounded border border-fuchsia-500/20">{periodStats.tryouts} TRYOUTS</span>}
              {(periodStats.ofcs === 0 && periodStats.scrims === 0 && periodStats.tryouts === 0) && <span className="text-[9px] font-black tracking-widest text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">DIA/PERÍODO LIVRE</span>}
           </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Controles de Visão */}
           <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
             <button onClick={() => setViewMode('MONTH')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'MONTH' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="Mensal"><CalendarDays size={14} /></button>
             <button onClick={() => setViewMode('WEEK')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'WEEK' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="Semanal"><CalendarRange size={14} /></button>
             <button onClick={() => setViewMode('DAY')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'DAY' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="Diária"><Clock size={14} /></button>
           </div>
           
           {/* Controles de Navegação */}
           <div className="flex gap-1.5">
             <button onClick={() => navigate(-1)} className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all"><ChevronLeft size={14} /></button>
             <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white font-black text-[9px] uppercase tracking-widest">HOJE</button>
             <button onClick={() => navigate(1)} className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-all"><ChevronRight size={14} /></button>
           </div>
        </div>
      </div>
      
      {/* CORPO DO CALENDÁRIO */}
      {viewMode === 'DAY' ? (
         // --- VISÃO DIÁRIA (TIMELINE) ---
         <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2">
            {visibleGrid[0]?.events.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-12 animate-[fadeIn_0.5s_ease-out]">
                  <Inbox size={48} className="mb-4 opacity-50" />
                  <p className="text-sm font-bold uppercase tracking-widest mb-1 text-zinc-400">Nenhum evento agendado</p>
                  <p className="text-[10px] uppercase tracking-wider">Aproveitem o dia livre para VOD Review ou descanso!</p>
                  {isStaff && (
                     <button onClick={() => onDayClick(visibleGrid[0].dateStr)} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <Plus size={14} /> Adicionar Evento
                     </button>
                  )}
               </div>
            ) : (
               <div className="space-y-4 pt-2 pb-6">
                  {isStaff && (
                     <div className="flex justify-end mb-2">
                        <button onClick={() => onDayClick(visibleGrid[0].dateStr)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg font-black text-[9px] uppercase tracking-widest transition-colors">
                           <Plus size={12} /> Novo Evento Aqui
                        </button>
                     </div>
                  )}
                  {visibleGrid[0]?.events.map((ev: any) => (
                     <CalendarEventItem key={ev.id} ev={ev} isStaff={isStaff} onEdit={onEditEvent} onDelete={onDeleteEvent} isDayView={true} />
                  ))}
               </div>
            )}
         </div>
      ) : viewMode === 'WEEK' ? (
         // --- VISÃO SEMANAL (Kanban Style) ---
         <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4 pr-1">
           {['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map((d, i) => <div key={`hdr-${i}`} className="text-center text-[9px] text-zinc-500 font-black mb-1 uppercase tracking-widest">{d}</div>)}
           
           {visibleGrid.map((cell: any) => {
              let bgBorderClass = 'border-transparent bg-zinc-900/30 hover:border-zinc-700';
              if (cell.isToday) bgBorderClass = 'border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_10px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20';

              return (
                <div key={cell.dateStr} onClick={() => onDayClick(cell.dateStr)} className={`relative flex flex-col p-2 min-h-[300px] rounded-[16px] border transition-all cursor-pointer group ${bgBorderClass}`}>
                   <span className={`text-[12px] font-black text-center mb-4 ${cell.isToday ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{cell.day}</span>
                   
                   <div className="flex flex-col gap-2 flex-1">
                      {cell.events.map((ev: any) => {
                         const dotColor = ev.type === 'TRYOUT' ? 'text-fuchsia-400' : ev.type === 'SCRIM' ? 'text-amber-500' : 'text-blue-400';
                         return (
                            <div key={ev.id} onClick={(e) => { e.stopPropagation(); if (isStaff) onEditEvent(e, ev); }} className="flex flex-col items-center p-2.5 bg-black/50 border border-zinc-800/80 rounded-xl hover:border-zinc-500 transition-all shadow-sm w-full">
                               
                               {/* 1. TOPO: Apenas a Logo (Centralizada) */}
                               <div className="mb-2 flex justify-center w-full">
                                  {ev.logo ? (
                                     <img src={ev.logo} className="w-8 h-8 object-contain bg-zinc-900 rounded-lg p-0.5 border border-zinc-700/80 shrink-0" alt="logo"/>
                                  ) : (
                                     <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shrink-0">
                                        <Shield size={18} className="text-zinc-500"/>
                                     </div>
                                  )}
                               </div>
                               
                               {/* 2. MEIO: Nome da Equipe e Horário (Centralizados) */}
                               <div className="flex flex-col items-center gap-1.5 w-full">
                                  <span className={`text-[11px] font-black uppercase text-center w-full leading-none ${dotColor}`}>{ev.opp}</span>
                                  <span className="text-[9px] font-black bg-zinc-900/80 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700/50 text-center">
                                     {ev.time}
                                  </span>
                               </div>
                               
                               {/* 3. RODAPÉ: Tipo de jogo e Placar (Centralizados, sem truncate para não cortar) */}
                               <div className="flex flex-col items-center mt-2.5 pt-2 border-t border-zinc-800/50 gap-1 w-full">
                                  <span className="text-[7px] font-bold text-zinc-500 uppercase leading-none text-center">{ev.type}</span>
                                  <span className={`text-[9px] font-black uppercase text-center leading-none ${ev.isPast ? (ev.isWin ? 'text-emerald-500' : ev.resultText.includes('D') ? 'text-zinc-400' : 'text-red-500') : 'text-zinc-400'}`}>
                                     {ev.isPast ? ev.resultText : ev.mode}
                                  </span>
                               </div>

                            </div>
                         )
                      })}
                   </div>
                </div>
              )
           })}
         </div>
      ) : (
      
         // --- VISÃO MENSAL (GRID com pontinhos) ---
         <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
           {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={`hdr-${i}`} className="text-center text-[9px] text-zinc-500 font-black mb-2 uppercase tracking-widest">{d}</div>)}
           
           {visibleGrid.map((cell: any, idx: number) => {
              if (cell.isGhost) {
                  return (
                      <div key={`ghost-${idx}`} className="flex flex-col items-center justify-center min-h-[50px] rounded-lg border border-transparent bg-zinc-900/10 opacity-40 grayscale pointer-events-none">
                          <span className="text-[10px] font-black text-zinc-600">{cell.day}</span>
                      </div>
                  );
              }

              let bgBorderClass = 'border-transparent bg-zinc-900/30 hover:bg-zinc-800/80 hover:border-zinc-600';
              if (cell.isToday) bgBorderClass = 'border-blue-500/50 bg-blue-500/10 shadow-[inset_0_0_10px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20';

              return (
                <div key={cell.dateStr} onClick={() => onDayClick(cell.dateStr)} className={`relative flex flex-col items-center justify-center min-h-[60px] rounded-lg border transition-all duration-300 group/day cursor-pointer ${bgBorderClass}`}>
                   <span className={`text-[11px] font-black z-10 transition-colors ${cell.isToday ? 'text-blue-400' : 'text-zinc-500 group-hover/day:text-zinc-200'}`}>{cell.day}</span>
                   
                   {cell.events.length > 0 && (
                      <div className="flex gap-1 mt-1 z-10">
                         {cell.events.slice(0, 3).map((ev: any, i: number) => {
                            let dotColor = ev.type === 'TRYOUT' ? 'bg-fuchsia-500' : ev.type === 'SCRIM' ? 'bg-amber-500' : 'bg-blue-500';
                            if (ev.isPast) dotColor = ev.isWin ? 'bg-emerald-500' : ev.resultText.includes('D') ? 'bg-zinc-500' : 'bg-red-500';
                            return <div key={i} className={`w-1.5 h-1.5 rounded-full shadow-sm ${dotColor}`} />
                         })}
                         {cell.events.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" title="Mais eventos..." />}
                      </div>
                   )}

                   {cell.events.length > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[240px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl rounded-xl z-[200] opacity-0 invisible group-hover/day:opacity-100 group-hover/day:visible transition-all duration-150 delay-0 group-hover/day:delay-300 p-2 flex flex-col gap-1.5 transform translate-y-2 group-hover/day:translate-y-0 cursor-default after:content-[''] after:absolute after:w-full after:h-6 after:-bottom-6 after:left-0">
                         <div className="flex justify-between items-center px-2 pt-1 border-b border-zinc-800 pb-2 mb-1">
                            <span className="text-[10px] font-black text-white tracking-widest">DIA {cell.day}</span>
                            <span className="text-[8px] text-zinc-400 font-bold uppercase bg-zinc-900 px-2 py-0.5 rounded">{cell.events.length} Evento{cell.events.length > 1 ? 's' : ''}</span>
                         </div>
                         <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
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
      )}
    </div>
  );
}