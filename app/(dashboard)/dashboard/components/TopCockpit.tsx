"use client";

import { Users, Settings, Target, Axe, Leaf, Zap, Crosshair, Shield } from 'lucide-react';

export default function TopCockpit({ currentUser, squadConfig, myTeamTag, isStaff, myStats }: any) {
  // Cores dinâmicas para a barra de intensidade
  const getIntensityTheme = (intensity: number) => {
    if (intensity < 40) return { text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]', border: 'border-emerald-500/30' };
    if (intensity < 75) return { text: 'text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]', border: 'border-amber-500/30' };
    return { text: 'text-red-400', bg: 'bg-red-500', shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]', border: 'border-red-500/30' };
  };

  const intensity = squadConfig?.intensity || 70;
  const theme = getIntensityTheme(intensity);

  // Helper para ícones de Lane
  const getRoleIcon = (role: string) => {
    const r = String(role || '').toLowerCase();
    if (r.includes('top')) return <Axe size={14} className="text-zinc-400" />;
    if (r.includes('jun') || r.includes('jgl')) return <Leaf size={14} className="text-emerald-400" />;
    if (r.includes('mid')) return <Zap size={14} className="text-blue-400" />;
    if (r.includes('adc') || r.includes('bot')) return <Crosshair size={14} className="text-red-400" />;
    if (r.includes('sup')) return <Shield size={14} className="text-amber-400" />;
    return <Target size={14} className="text-zinc-400" />;
  };

  // Helper para o sistema de Notas (Ranks S, A, B, C)
  const renderGrade = (score: number) => {
    if (score >= 90) return <span className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] font-black">S</span>;
    if (score >= 80) return <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] font-black">A</span>;
    if (score >= 70) return <span className="text-amber-400 font-black">B</span>;
    return <span className="text-red-400 font-black">C</span>;
  };

  return (
    <div className="animate-fade-in-up bg-[#0a0a0a] border border-zinc-800/80 rounded-[32px] p-5 md:p-6 flex flex-col xl:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden mt-6">
      
      {/* BACKGROUND EFFECTS */}
      {(!isStaff && myStats?.bestChamp) ? (
         // Se for jogador e tiver um campeão, coloca a Splash Art cinematográfica no fundo
         <>
           <div className="absolute inset-0 bg-cover bg-[center_top_-50px] opacity-25 mix-blend-luminosity scale-105" style={{ backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${myStats.bestChamp}_0.jpg)` }}></div>
           <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent"></div>
           <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
         </>
      ) : (
         // Background padrão cibernético para Staff
         <>
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.1),transparent_50%)] pointer-events-none"></div>
         </>
      )}
      
      {/* 1. PERFIL (ID CARD TÁTICO) */}
      <div className="flex items-center gap-5 w-full xl:w-auto relative z-10 min-w-[280px]">
         <div className="relative shrink-0">
            <div className={`p-0.5 rounded-2xl bg-gradient-to-b ${isStaff ? 'from-blue-600 to-zinc-900' : 'from-emerald-600 to-zinc-900'} shadow-lg`}>
               <div className="w-16 h-16 rounded-[14px] bg-zinc-950 overflow-hidden border-2 border-zinc-950 relative group">
                  <img src={currentUser?.photo || 'https://via.placeholder.com/150'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Profile" />
                  <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay"></div>
               </div>
            </div>
            <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 ${isStaff ? 'bg-blue-600' : 'bg-emerald-600'} text-white font-black text-[7px] px-2 py-0.5 rounded border border-white/20 shadow-lg uppercase tracking-widest z-10`}>
              {isStaff ? 'STAFF' : 'ROSTER'}
            </div>
         </div>

         <div className="flex flex-col justify-center flex-1">
            <div className="flex items-center gap-2 mb-1.5 mt-1">
               {getRoleIcon(currentUser?.role)}
               <h2 className="text-2xl font-black text-white uppercase tracking-tight truncate drop-shadow-md leading-none">
                 {currentUser?.name || 'USER_NAME'}
               </h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
               <span className={`text-[8px] px-2.5 py-1 rounded-md border font-black tracking-widest uppercase shadow-sm ${isStaff ? 'bg-blue-950/30 text-blue-400 border-blue-500/30' : 'bg-zinc-900/80 text-emerald-400 border-emerald-500/30 backdrop-blur-sm'}`}>
                 {currentUser?.role || 'ANALISTA'}
               </span>
               <span className="bg-zinc-900/80 backdrop-blur-sm text-zinc-300 border-zinc-700 text-[8px] px-2.5 py-1 rounded-md border uppercase font-black tracking-widest shadow-sm">
                 {myTeamTag || 'TEAM'}
               </span>

               <div className="flex gap-1.5 ml-2">
                 <button className="text-zinc-500 hover:text-white bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 hover:border-zinc-600 w-6 h-6 flex items-center justify-center rounded transition-all shadow-sm">
                   <Settings size={10} />
                 </button>
                 {isStaff && (
                    <button className="text-blue-400 hover:text-white bg-blue-950/30 border border-blue-900/50 hover:bg-blue-600 hover:border-blue-500 px-2 h-6 flex items-center justify-center rounded transition-all shadow-sm gap-1.5">
                       <Users size={10} /> <span className="text-[7px] font-black tracking-widest uppercase">Elenco</span>
                    </button>
                 )}
               </div>
            </div>
         </div>
      </div>

      {/* 2. STATS DO JOGADOR NO PERÍODO FILTRADO */}
      {!isStaff && myStats && (
         <div className="flex-1 flex items-center gap-4 px-6 relative z-10 w-full xl:w-auto mt-4 xl:mt-0 xl:border-l border-zinc-800/60 pl-8 overflow-hidden">
            
            {/* Box do Melhor Campeão */}
            <div className="flex items-center gap-3 bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 p-2 pr-4 rounded-xl shadow-inner shrink-0">
               <img src={`https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${myStats.bestChamp}.png`} onError={(e) => e.currentTarget.src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'} className="w-10 h-10 rounded-lg border border-zinc-700 shadow-sm" alt="Best Champ" />
               <div className="flex flex-col">
                  <span className="text-[7px] text-zinc-400 font-black uppercase tracking-widest">Pick Principal</span>
                  <span className="text-xs font-black text-white uppercase drop-shadow-sm">{myStats.bestChamp}</span>
               </div>
            </div>

            {/* KPIs do Jogador (LANE, IMPACTO, CONVERSÃO, VISÃO, OVERALL) */}
            <div className="flex gap-4 md:gap-5 ml-2 overflow-x-auto custom-scrollbar pb-1">
               <div className="flex flex-col gap-1 items-center shrink-0">
                  <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Lane Dom.</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-base font-black text-white leading-none">{myStats.lane || 0}</span>
                     <span className="text-[9px]">{renderGrade(myStats.lane)}</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1 items-center shrink-0">
                  <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Impacto</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-base font-black text-white leading-none">{myStats.impact || 0}</span>
                     <span className="text-[9px]">{renderGrade(myStats.impact)}</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1 items-center shrink-0">
                  <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Conversão</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-base font-black text-white leading-none">{myStats.conversion || 0}</span>
                     <span className="text-[9px]">{renderGrade(myStats.conversion)}</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1 items-center shrink-0">
                  <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Visão</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-base font-black text-white leading-none">{myStats.vision || 0}</span>
                     <span className="text-[9px]">{renderGrade(myStats.vision)}</span>
                  </div>
               </div>
               
               {/* OVERALL DESTACADO */}
               <div className="flex flex-col gap-1 items-center shrink-0 pl-4 md:pl-5 border-l border-zinc-800/60">
                  <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">Overall</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-xl font-black text-white leading-none">{myStats.overall || 0}</span>
                     <span className="text-[11px]">{renderGrade(myStats.overall)}</span>
                  </div>
               </div>
            </div>
         </div>
      )}

      {isStaff && <div className="flex-1 hidden xl:block"></div>}

      {/* 3. PAINEL DE MISSÃO (DIRETRIZ DA STAFF) */}
      <div className="flex items-stretch w-full xl:w-[420px] shrink-0 relative z-10 bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-800/80 shadow-inner overflow-hidden group">
         <div className={`w-1.5 h-full ${theme.bg} shadow-[0_0_15px_rgba(255,255,255,0.1)]`}></div>
         
         <div className="flex flex-col flex-1 p-4 relative">
            <div className="flex justify-between items-start mb-2">
               <div className="flex items-center gap-2">
                 <div className="relative flex h-2 w-2 items-center justify-center">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${theme.bg} opacity-75`}></span>
                   <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${theme.bg}`}></span>
                 </div>
                 <span className="text-[8px] text-zinc-400 font-black tracking-[0.2em] uppercase">Status da Diretriz</span>
               </div>
               
               <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded border bg-zinc-950 ${theme.text} ${theme.border}`}>
                 {squadConfig?.load || 'NORMAL'}
               </span>
            </div>
            
            <div className="flex items-center gap-2 mb-3 mt-1">
              <Target size={14} className="text-zinc-500 shrink-0" />
              <span className="text-white text-xs font-black uppercase tracking-tight truncate leading-tight">
                {squadConfig?.directive || 'FOCO EM FUNDAMENTOS & EARLY GAME'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="h-1.5 flex-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                  <div className={`h-full ${theme.bg} transition-all duration-1000 ease-out ${theme.shadow} relative`} style={{ width: `${intensity}%` }}>
                     <div className="absolute top-0 right-0 w-4 h-full bg-white/30 blur-[1px]"></div>
                  </div>
               </div>
               <span className={`text-[10px] font-black ${theme.text} w-6 text-right`}>{intensity}%</span>
            </div>
         </div>
      </div>

    </div>
  );
}