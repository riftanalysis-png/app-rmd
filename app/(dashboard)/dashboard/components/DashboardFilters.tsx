// app/(dashboard)/dashboard-v2/components/DashboardFilters.tsx
"use client";

import { useState } from 'react';
import { ListFilter, ChevronDown } from 'lucide-react';

interface DashboardFiltersProps {
  matchType: string;
  setMatchType: (val: any) => void;
  selectedPeriod: string;
  setSelectedPeriod: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  splitOptions: any[];
}

export default function DashboardFilters({
  matchType, setMatchType,
  selectedPeriod, setSelectedPeriod,
  filterStartDate, setFilterStartDate,
  filterEndDate, setFilterEndDate,
  splitOptions
}: DashboardFiltersProps) {
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="animate-fade-in-up flex flex-wrap items-center justify-center gap-4 bg-zinc-950/80 backdrop-blur-xl p-2.5 rounded-2xl border border-zinc-800/80 shadow-lg max-w-fit mx-auto sticky top-4 z-[99]" style={{ opacity: 1 }}>
       {/* BOTÕES DE MATCH TYPE */}
       <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
         <button onClick={() => setMatchType('ALL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'ALL' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>AMBOS</button>
         <button onClick={() => setMatchType('OFICIAL')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'OFICIAL' ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>OFICIAL</button>
         <button onClick={() => setMatchType('SCRIM')} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matchType === 'SCRIM' ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>SCRIMS</button>
       </div>
       
       <div className="h-5 w-px bg-zinc-800 hidden md:block"></div>
       
       {/* DROPDOWN DE SPLITS */}
       <div className="relative">
          <div 
             onClick={() => setDropdownOpen(!isDropdownOpen)} 
             className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2 cursor-pointer transition-colors"
          >
             <ListFilter size={12} className="text-blue-500" />
             <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {splitOptions.find(o => o.value === selectedPeriod)?.label || selectedPeriod}
             </span>
             <ChevronDown size={14} className="text-zinc-500 ml-1" />
          </div>
          
          {isDropdownOpen && (
             <>
               <div className="fixed inset-0 z-[98]" onClick={() => setDropdownOpen(false)}></div>
               <div className="absolute top-[calc(100%+8px)] left-0 w-[200px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-[100]">
                  {splitOptions.map((opt) => (
                     <div 
                        key={opt.value} 
                        onClick={() => {
                           setSelectedPeriod(opt.value);
                           if (opt.value !== 'CUSTOM') {
                               setFilterStartDate(opt.start);
                               setFilterEndDate(opt.end);
                           }
                           setDropdownOpen(false);
                        }} 
                        className={`px-4 py-3 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-between ${selectedPeriod === opt.value ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                     >
                        {opt.label}
                        {selectedPeriod === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.8)]"></div>}
                     </div>
                  ))}
               </div>
             </>
          )}
       </div>

       {/* INPUTS DE DATA CUSTOMIZADA */}
       <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
          <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setSelectedPeriod('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
          <span className="text-zinc-600 text-[10px] font-black uppercase">ATÉ</span>
          <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setSelectedPeriod('CUSTOM'); }} className="bg-transparent text-[10px] font-bold text-zinc-300 outline-none focus:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
       </div>
    </div>
  );
}