"use client";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';

const DDRAGON_VERSION = '16.5.1';

const laneMap: Record<string, string> = {
  'SUP': 'support', 'SUPPORT': 'support', 'MID': 'mid', 
  'ADC': 'adc', 'TOP': 'top', 'JUNGLE': 'jungle'
};

const getRoleIcon = (role: string) => {
  const mapping: Record<string, string> = {
    top: 'top', jungle: 'jungle', mid: 'middle', adc: 'bottom', support: 'utility'
  };
  const key = mapping[role?.toLowerCase()] || 'middle';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${key}.png`;
};

const getObjectiveIcon = (key: string) => {
  const base = 'https://raw.communitydragon.org/latest/game/assets/ux/announcements/';
  const map: Record<string, string> = {
    baron: 'baron_circle.png', dragon: 'dragon_circle.png', soul: 'dragon_circle.png', 
    air: 'dragon_circle_air.png', chemtech: 'dragon_circle_chemtech.png', earth: 'dragon_circle_earth.png',
    fire: 'dragon_circle_fire.png', hextech: 'dragon_circle_hextech.png', water: 'dragon_circle_water.png',
    grubs_1: 'sru_voidgrub_circle.png', grubs_2: 'sru_voidgrub_circle.png', grubs_3: 'sru_voidgrub_circle.png',
    herald: 'sruriftherald_circle.png'
  };
  return `${base}${map[key] || 'dragon_circle.png'}`;
};

interface SelectedChampProps { name: string; lane: string; }

export default function MetaWarRoom() {
  const [data, setData] = useState({ tiers: [], matchups: [], draft: [], bans: [], synergies: [], globalObjectives: [], goldStats: [] });
  
  const [viewMode, setViewMode] = useState<'CHAMPIONS' | 'OBJECTIVES'>('CHAMPIONS');
  const [selectedChamp, setSelectedChamp] = useState<SelectedChampProps | null>(null);
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'MATCHUPS' | 'SYNERGIES'>('DRAFT');
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState<string>('ALL');
  const [minGames, setMinGames] = useState<number>(5);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [t, m, d, b, s, gobj, gold] = await Promise.all([
        supabase.from('view_champion_tier_list_by_lane').select('*').order('power_score', { ascending: false }),
        supabase.from('view_champion_matchups_detailed').select('*'),
        supabase.from('view_meta_global_draft').select('*'),
        supabase.from('view_champion_ban_stats').select('*'),
        supabase.from('view_champion_synergies').select('*'),
        supabase.from('view_global_objective_impact').select('*'),
        supabase.from('objective_gold_efficiency').select('*') 
      ]);
      setData({ 
        tiers: t.data || [], matchups: m.data || [], draft: d.data || [], 
        bans: b.data || [], synergies: s.data || [], globalObjectives: gobj.data || [],
        goldStats: gold.data || []
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredTiers = useMemo(() => {
    const target = laneMap[activeLane] || activeLane.toLowerCase();
    const list = data.tiers.filter((c: any) => (activeLane === 'ALL' || c.lane === target) && c.total_picks >= minGames);
    return {
      S: list.filter((c: any) => c.power_score >= 75),
      A: list.filter((c: any) => c.power_score >= 60 && c.power_score < 75),
      B: list.filter((c: any) => c.power_score >= 45 && c.power_score < 60),
      C: list.filter((c: any) => c.power_score < 45),
    };
  }, [data.tiers, activeLane, minGames]);

  const champDraft = useMemo(() => {
    if (!selectedChamp) return { blue: [], red: [] };
    const rawDraft = data.draft.filter((x: any) => x.champion === selectedChamp.name && x.lane === selectedChamp.lane);
    
    const seqMap: Record<number, { label: string, side: string }> = {
      7: { label: 'B1', side: 'blue' }, 8: { label: 'R1', side: 'red' }, 9: { label: 'R2', side: 'red' },
      10: { label: 'B2', side: 'blue' }, 11: { label: 'B3', side: 'blue' }, 12: { label: 'R3', side: 'red' },
      17: { label: 'R4', side: 'red' }, 18: { label: 'B4', side: 'blue' }, 19: { label: 'B5', side: 'blue' },
      20: { label: 'R5', side: 'red' }
    };

    const cleanDraft = rawDraft.map((d: any) => {
      const strictInfo = seqMap[d.sequence];
      return { ...d, safeLabel: strictInfo?.label || 'PICK', safeSide: strictInfo?.side || 'unknown' };
    });

    return {
      blue: cleanDraft.filter(d => d.safeSide === 'blue').sort((a, b) => a.sequence - b.sequence),
      red: cleanDraft.filter(d => d.safeSide === 'red').sort((a, b) => a.sequence - b.sequence)
    };
  }, [selectedChamp, data.draft]);

  const champMatchups = useMemo(() => {
    if (!selectedChamp) return [];
    return data.matchups.filter((m: any) => m.champion === selectedChamp.name && m.lane === selectedChamp.lane)
      .sort((a: any, b: any) => b.total_matchups - a.total_matchups);
  }, [selectedChamp, data.matchups]);

  const champSynergies = useMemo(() => {
    if (!selectedChamp) return [];
    return data.synergies.filter((s: any) => s.champion === selectedChamp.name && s.lane === selectedChamp.lane && s.total_games > 1)
      .sort((a: any, b: any) => b.win_rate !== a.win_rate ? b.win_rate - a.win_rate : b.total_games - a.total_games).slice(0, 10);
  }, [selectedChamp, data.synergies]);

  const champBans = useMemo(() => {
    if (!selectedChamp) return null;
    return data.bans.find((b: any) => b.champion === selectedChamp.name);
  }, [selectedChamp, data.bans]);

  const pickProfile = useMemo(() => {
    if (!selectedChamp) return null;
    const allDrafts = [...champDraft.blue, ...champDraft.red];
    let blindPicks = 0; let counterPicks = 0; 
    allDrafts.forEach((d: any) => {
      if ([7, 8, 9, 10, 11].includes(d.sequence)) blindPicks += d.total_picks;
      if ([12, 17, 18, 19, 20].includes(d.sequence)) counterPicks += d.total_picks;
    });
    const totalPicks = blindPicks + counterPicks;
    let pickIdentity = "FLEX PICK"; let pickColor = "text-slate-400 border-slate-600 bg-slate-800/50";
    if (totalPicks > 0) {
      if (blindPicks / totalPicks >= 0.6) { pickIdentity = "SAFE BLIND"; pickColor = "text-blue-400 border-blue-500/50 bg-blue-500/10"; } 
      else if (counterPicks / totalPicks >= 0.6) { pickIdentity = "STRICT COUNTER"; pickColor = "text-red-400 border-red-500/50 bg-red-500/10"; }
    }
    return { pickIdentity, pickColor };
  }, [selectedChamp, champDraft]);

  const findGoldValue = (iconKey: string, dbData: any[]) => {
    if (!dbData || dbData.length === 0) return null;
    const matchers = [
      { key: 'baron', terms: ['baron', 'nashor', 'barão'] },
      { key: 'herald', terms: ['herald', 'arauto', 'rift'] },
      { key: 'soul', terms: ['soul', 'alma'] },
      { key: 'dragon', terms: ['dragon', 'dragão'], stacks: 1 },
      { key: 'grubs_1', terms: ['grub', 'larva', 'horde'], stacks: 1 },
      { key: 'grubs_2', terms: ['grub', 'larva', 'horde'], stacks: 2 },
      { key: 'grubs_3', terms: ['grub', 'larva', 'horde'], stacks: 3 },
      { key: 'fire', terms: ['infernal', 'fire', 'fogo'], stacks: 1 },
      { key: 'water', terms: ['ocean', 'water', 'água'], stacks: 1 },
      { key: 'earth', terms: ['mountain', 'earth', 'terra'], stacks: 1 },
      { key: 'air', terms: ['cloud', 'air', 'vento', 'ar'], stacks: 1 },
      { key: 'hextech', terms: ['hextech'], stacks: 1 },
      { key: 'chemtech', terms: ['chemtech', 'quimtec'], stacks: 1 },
      { key: 'fire_soul', terms: ['infernal'], stacks: 4 },
      { key: 'water_soul', terms: ['ocean'], stacks: 4 },
      { key: 'earth_soul', terms: ['mountain'], stacks: 4 },
      { key: 'air_soul', terms: ['cloud'], stacks: 4 },
      { key: 'hextech_soul', terms: ['hextech'], stacks: 4 },
      { key: 'chemtech_soul', terms: ['chemtech'], stacks: 4 }
    ];

    const matcher = matchers.find(m => m.key === iconKey);
    if (!matcher) return null;

    return dbData.find(row => {
      const nameMatch = matcher.terms.some(term => row.objective_name?.toLowerCase().includes(term) || row.category?.toLowerCase().includes(term));
      const stackMatch = matcher.stacks ? row.stacks === matcher.stacks : true;
      const stackMatchFallback = (iconKey === 'grubs_3' && row.stacks >= 3);
      return nameMatch && (stackMatch || stackMatchFallback);
    });
  };

  const getObj = (key: string) => {
    const obj = data.globalObjectives.find((o: any) => o.icon_key === key);
    if (!obj) return null;
    const delta = obj.win_rate - 50;
    const goldInfo = findGoldValue(key, data.goldStats);
    
    return { ...obj, delta, isTrap: delta < 0, gold: goldInfo?.gold_value_team };
  };
  
  const baronData = getObj('baron');
  const soulData = getObj('soul');
  const heraldData = getObj('herald');
  const firstDragonData = getObj('dragon');
  const grubsData = [getObj('grubs_1'), getObj('grubs_2'), getObj('grubs_3')].filter(Boolean);
  
  const elementalData = ['fire', 'water', 'earth', 'air', 'hextech', 'chemtech']
    .map(key => {
       const baseDrake = getObj(key);
       if (!baseDrake) return null;
       
       const soulDrakObj = data.globalObjectives.find((o: any) => o.icon_key === `${key}_soul`);
       const soulGoldInfo = findGoldValue(`${key}_soul`, data.goldStats);
       
       const soulStat = {
          win_rate: soulDrakObj ? soulDrakObj.win_rate : 0,
          times_achieved: soulDrakObj ? soulDrakObj.times_achieved : 0,
          delta: soulDrakObj ? soulDrakObj.win_rate - 50 : 0,
          isTrap: soulDrakObj ? (soulDrakObj.win_rate - 50 < 0) : false,
          gold: soulGoldInfo?.gold_value_team || null,
          hasData: !!soulDrakObj
       };

       return { ...baseDrake, soulStat };
    }).filter(Boolean).sort((a: any, b: any) => b.win_rate - a.win_rate);

  if (loading) return <div className="flex items-center justify-center h-screen text-purple-500 font-black text-2xl animate-pulse italic uppercase tracking-[0.2em]">RMD ANALYTICS: INICIANDO PROTOCOLOS...</div>;

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 p-4 md:p-8 font-black uppercase italic tracking-tighter pb-20">
      
      {/* HEADER CORRIGIDO: Flexbox Dinâmico (Evita esmagar os filtros na direita) */}
      <header className="flex flex-col xl:flex-row items-center justify-between gap-6 mb-12 border-b border-white/5 pb-6 sticky top-0 bg-[#121212]/95 backdrop-blur-xl z-50 pt-4 -mx-4 px-4 md:-mx-8 md:px-8">
        
        {/* Lado Esquerdo: Título (Usa flex-1 para empurrar o centro) */}
        <div className="flex-1 flex justify-start w-full xl:w-auto">
          <div className="flex flex-col border-l-4 border-purple-500 pl-4 justify-center">
            <h1 className="text-3xl lg:text-4xl leading-none text-white">META WAR ROOM</h1>
            <p className="text-purple-400 text-[9px] tracking-[0.4em] mt-1">High Fidelity Scouting</p>
          </div>
        </div>
        
        {/* Lado Central: Chave Seletora (shrink-0 garante que não seja esmagada) */}
        <div className="shrink-0 flex justify-center w-full xl:w-auto">
          <div className="flex bg-black/50 p-1.5 rounded-3xl border border-white/5 shadow-2xl">
            <button onClick={() => {setViewMode('CHAMPIONS'); setSelectedChamp(null);}} className={`px-6 py-2.5 rounded-2xl text-[10px] tracking-widest transition-all ${viewMode === 'CHAMPIONS' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              CHAMPION META
            </button>
            <button onClick={() => {setViewMode('OBJECTIVES'); setSelectedChamp(null);}} className={`px-6 py-2.5 rounded-2xl text-[10px] tracking-widest transition-all ${viewMode === 'OBJECTIVES' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              MACRO INTEL
            </button>
          </div>
        </div>

        {/* Lado Direito: Filtros (flex-1 para equilibrar a balança, wrap para evitar estouro) */}
        <div className="flex-1 flex justify-center xl:justify-end w-full min-h-[44px]">
          {viewMode === 'CHAMPIONS' && !selectedChamp && (
            <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-right-4">
              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 items-center shadow-inner">
                 {[1, 5, 10].map(n => <button key={n} onClick={() => setMinGames(n)} className={`w-8 h-8 rounded-xl text-[10px] transition-all ${minGames === n ? 'bg-white text-black shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}>{n}</button>)}
              </div>
              <div className="flex bg-black/30 p-1 rounded-3xl border border-white/5 shadow-inner items-center">
                {['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUP'].map(l => (
                  <button key={l} onClick={() => {setActiveLane(l); setSelectedChamp(null);}} className={`px-3 py-2 rounded-2xl text-[9px] flex items-center gap-1.5 transition-all ${activeLane === l ? 'bg-slate-800 text-white shadow-md border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}>
                    {l !== 'ALL' && <img src={getRoleIcon(laneMap[l] || l)} className="w-3.5 h-3.5 brightness-200" alt="" />}
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =========================================
          ABA MACRO INTEL
      ========================================= */}
      {viewMode === 'OBJECTIVES' && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-[1300px] mx-auto space-y-12">
          
          <div className="mb-12 border-l-2 border-purple-500 pl-6">
            <h2 className="text-4xl text-white italic leading-none">OBJECTIVE IMPACT DELTA (Δ)</h2>
            <p className="text-[10px] text-slate-400 tracking-[0.2em] mt-2 uppercase max-w-2xl leading-relaxed">
              O "Impact Delta" cruza a flutuação matemática de vitória com a **Eficiência de Ouro Bruta** (Hidden Gold) concedida globalmente ao time e aos jogadores por capturar o objetivo.
            </p>
          </div>

          {(baronData || soulData) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {baronData && <EnderHeroCard obj={baronData} title="BARÃO NASHOR" accent="purple" />}
              {soulData && <EnderHeroCard obj={soulData} title="ALMA DO DRAGÃO (GERAL)" accent="red" />}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-7 flex flex-col gap-8">
              {grubsData.length > 0 && (
                <div className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8 shadow-xl relative overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-900 via-purple-500 to-transparent"></div>
                  
                  <div className="flex items-center gap-4 mb-10">
                    <img src={getObjectiveIcon('grubs_1')} className="w-12 h-12 rounded-full shadow-lg border border-slate-700 bg-slate-950" alt="" />
                    <div>
                      <h3 className="text-2xl text-white italic leading-none">THE HORDE INVESTMENT</h3>
                      <p className="text-[9px] text-slate-500 tracking-[0.2em] mt-1 uppercase">Curva de retorno Ouro vs Win Rate em Vastilarvas</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 relative">
                    <div className="hidden sm:block absolute top-[40%] left-10 right-10 h-0.5 bg-slate-800 z-0"></div>
                    
                    {grubsData.map((obj: any, idx: number) => (
                      <div key={idx} className="flex-1 bg-slate-950/90 border border-slate-800/80 p-5 rounded-[24px] relative z-10 flex flex-col justify-between hover:border-slate-600 transition-colors shadow-lg">
                        <div className="flex justify-between items-start mb-6">
                           <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 bg-slate-900 text-sm ${obj.isTrap ? 'border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'}`}>
                             {obj.isTrap ? '!' : '✓'}
                           </div>
                           <div className="flex flex-col items-end">
                              <ImpactDeltaBadge delta={obj.delta} />
                           </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-white tracking-widest mb-1 leading-tight">{obj.objective_name}</p>
                          <p className={`text-3xl font-black italic leading-none ${obj.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{obj.win_rate}%</p>
                          {obj.gold && <GoldBadge gold={obj.gold} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`grid grid-cols-1 ${heraldData && firstDragonData ? 'md:grid-cols-2' : ''} gap-8 shrink-0`}>
                {heraldData && <CompactMacroCard obj={heraldData} title="ARAUTO DO VALE" />}
                {firstDragonData && <CompactMacroCard obj={firstDragonData} title="PRIMEIRO DRAGÃO" />}
              </div>
            </div>

            <div className="lg:col-span-5 relative">
              {elementalData.length > 0 && (
                <div className="lg:absolute inset-0 bg-slate-900/30 border border-slate-800 rounded-[32px] p-8 shadow-xl flex flex-col h-[700px] lg:h-auto">
                  <div className="shrink-0 mb-6 border-b border-slate-800/80 pb-6">
                    <h3 className="text-2xl text-white italic mb-2">ELEMENTAL TIER LIST</h3>
                    <p className="text-[9px] text-slate-500 tracking-[0.2em] uppercase">Acompanhamento do Buff Unitário ao Cenário de Alma</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 min-h-0">
                    <div className="space-y-6 pb-6">
                      {elementalData.map((obj: any, idx: number) => (
                        <div key={idx} className="group relative bg-slate-950/50 p-6 rounded-[24px] border border-slate-800/40 hover:border-slate-700 transition-all shadow-sm">
                          
                          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 translate-x-2 group-hover:translate-x-0">
                             <div className="bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 p-4 rounded-2xl shadow-2xl min-w-[220px]">
                                <p className="text-[9px] text-purple-400 uppercase tracking-[0.3em] mb-4 border-b border-purple-500/20 pb-2 text-center">GOLD EFFICIENCY</p>
                                
                                <div className="mb-3">
                                  <p className="text-[9px] text-slate-400 text-left mb-1.5 pl-1 tracking-widest">DRAGÃO INDIVIDUAL</p>
                                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                                    <span className="text-[8px] text-slate-500 tracking-widest">TEAM / PLAYER</span>
                                    <span className="text-[10px] text-yellow-500 font-mono font-black">
                                      {obj.gold ? `+${obj.gold}G / +${Math.round(obj.gold / 5)}G` : 'N/A'}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-[9px] text-slate-400 text-left mb-1.5 pl-1 tracking-widest">ALMA DO DRAGÃO</p>
                                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                                    <span className="text-[8px] text-slate-500 tracking-widest">TEAM / PLAYER</span>
                                    <span className="text-[10px] text-orange-500 font-mono font-black">
                                      {obj.soulStat?.gold ? `+${obj.soulStat.gold}G / +${Math.round(obj.soulStat.gold / 5)}G` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center gap-4 relative z-10 mb-4">
                            <span className="text-[10px] text-slate-600 w-3 text-center font-mono">{idx + 1}</span>
                            <img src={getObjectiveIcon(obj.icon_key)} className="w-12 h-12 rounded-full bg-slate-950 border border-slate-700 shadow-md group-hover:scale-105 transition-transform shrink-0" alt="" />
                            
                            <div className="flex-1 flex flex-col gap-1.5 pr-2">
                              <div className="flex justify-between items-end">
                                 <div>
                                   <p className="text-[12px] text-white tracking-widest leading-none">{obj.objective_name}</p>
                                   <p className="text-[7px] text-slate-500 font-mono mt-1 uppercase tracking-widest">ABATE INDIVIDUAL • EM {obj.times_achieved}x</p>
                                 </div>
                                 <p className={`text-xl font-black italic leading-none ${obj.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{obj.win_rate}%</p>
                              </div>
                              
                              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex relative shadow-inner border border-slate-800/50">
                                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600 z-20 opacity-50"></div>
                                <div 
                                  className={`h-full ${obj.isTrap ? 'bg-orange-500' : 'bg-emerald-500'} transition-all duration-1000 relative shadow-[0_0_8px_currentColor]`} 
                                  style={{ width: `${Math.min(obj.win_rate, 100)}%` }}
                                >
                                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/40"></div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {obj.soulStat && (
                            <div className="ml-[3.7rem] pt-3 border-t border-slate-800/50 flex flex-col gap-1.5 pr-2">
                               <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-[10px] text-red-400 tracking-widest leading-none flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span>
                                      ALMA DO DRAGÃO
                                    </p>
                                    <p className="text-[7px] text-slate-500 font-mono mt-1 uppercase tracking-widest">
                                      {obj.soulStat.hasData ? `SOUL CONDITION • EM ${obj.soulStat.times_achieved}x` : 'SEM OCORRÊNCIAS REGISTRADAS'}
                                    </p>
                                  </div>
                                  {obj.soulStat.hasData ? (
                                    <p className={`text-xl font-black italic leading-none ${obj.soulStat.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{obj.soulStat.win_rate}%</p>
                                  ) : (
                                    <p className="text-sm font-black italic leading-none text-slate-600">N/A</p>
                                  )}
                               </div>
                               
                               <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex relative shadow-inner border border-slate-800/50">
                                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600 z-20 opacity-50"></div>
                                  <div 
                                    className={`h-full ${!obj.soulStat.hasData ? 'bg-slate-700' : obj.soulStat.isTrap ? 'bg-orange-500' : 'bg-emerald-500'} transition-all duration-1000 relative shadow-[0_0_8px_currentColor]`} 
                                    style={{ width: `${Math.min(obj.soulStat.win_rate, 100)}%` }}
                                  >
                                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/40"></div>
                                  </div>
                               </div>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          TELA DE CHAMPION META
      ========================================= */}
      {viewMode === 'CHAMPIONS' && (
        <div className="animate-in fade-in duration-500">
          
          {!selectedChamp && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              {Object.entries(filteredTiers).map(([tier, list]) => (
                <div key={tier} className="flex gap-4 items-stretch group/tier">
                  <div className={`w-20 flex items-center justify-center rounded-[24px] text-3xl font-black italic shadow-xl bg-slate-900 border border-slate-800 ${tier === 'S' ? 'text-red-600' : tier === 'A' ? 'text-orange-500' : tier === 'B' ? 'text-yellow-500' : 'text-emerald-500'}`}>{tier}</div>
                  <div className="flex-1 bg-slate-900/10 border border-slate-800/40 rounded-[28px] p-5 flex flex-wrap gap-5 font-black italic">
                    {list.length > 0 ? list.map((c: any) => (
                      <button 
                        key={`${c.champion}-${c.lane}`} 
                        onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }} 
                        className="relative transition-all hover:scale-110 active:scale-95"
                      >
                        <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-16 h-16 rounded-2xl border-2 border-slate-800 hover:border-purple-500 transition-all shadow-xl" alt="" />
                        <div className="absolute -top-2 -right-2 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xl">
                          {activeLane === 'ALL' && <img src={getRoleIcon(c.lane)} className="w-2.5 h-2.5 brightness-200 opacity-70" alt="" />}
                          <span className="text-[8px] text-purple-400 font-black">{c.total_picks}</span>
                        </div>
                      </button>
                    )) : <p className="text-[9px] text-slate-800 flex items-center font-black">AMOSTRAGEM INSUFICIENTE</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedChamp && pickProfile && (
            <div className="bg-slate-900/40 border border-purple-500/20 rounded-[48px] p-8 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
              
              <button onClick={() => setSelectedChamp(null)} className="mb-8 flex items-center gap-2 text-[10px] text-slate-400 hover:text-white uppercase tracking-widest transition-colors bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700 hover:border-slate-500 w-max">
                <span className="text-lg leading-none mb-0.5">←</span> VOLTAR PARA TIER LIST
              </button>

              <div className="flex flex-col xl:flex-row gap-12">
                <div className="flex flex-col items-center xl:border-r border-slate-800 pr-12 min-w-[260px]">
                  <div className="relative mb-4">
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp.name}.png`} className="w-32 h-32 rounded-[40px] border-4 border-purple-500 shadow-2xl object-cover" alt="" />
                    <div className="absolute -bottom-2 -right-2 bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-xl">
                       <img src={getRoleIcon(selectedChamp.lane)} className="w-6 h-6 brightness-200" alt={selectedChamp.lane} />
                    </div>
                  </div>
                  <h2 className="text-4xl leading-none mt-2 text-white italic text-center">{selectedChamp.name}</h2>
                  <p className="text-purple-400 text-[10px] tracking-[0.3em] uppercase mb-4 text-center">{selectedChamp.lane}</p>
                  <div className="flex flex-col gap-2 w-full mb-8">
                    <div className={`text-[9px] text-center tracking-[0.2em] border px-3 py-1.5 rounded-lg ${pickProfile.pickColor}`}>{pickProfile.pickIdentity}</div>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <button onClick={() => setActiveTab('DRAFT')} className={`w-full py-3 rounded-2xl text-[10px] border transition-all ${activeTab === 'DRAFT' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>DRAFT INTEL</button>
                    <button onClick={() => setActiveTab('MATCHUPS')} className={`w-full py-3 rounded-2xl text-[10px] border transition-all ${activeTab === 'MATCHUPS' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>MATCHUPS @12</button>
                    <button onClick={() => setActiveTab('SYNERGIES')} className={`w-full py-3 rounded-2xl text-[10px] border transition-all ${activeTab === 'SYNERGIES' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>ALLIES / DUOS</button>
                  </div>
                </div>

                <div className="flex-1">
                  
                  {activeTab === 'DRAFT' && (
                    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
                      {champBans && champBans.total_bans > 0 && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-[32px] p-6 shadow-xl flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Total Bans Global</p>
                            <p className="text-3xl font-black text-white italic">{champBans.total_bans}</p>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-[8px] text-blue-500 uppercase tracking-widest">Alvo Blue Side</p>
                              <div className="flex items-baseline gap-2 justify-end">
                                <p className="text-xl font-black text-blue-400 italic">{champBans.blue_bans}</p>
                                <p className="text-[10px] text-slate-500 font-mono">({Math.round((champBans.blue_bans / champBans.total_bans) * 100)}%)</p>
                              </div>
                            </div>
                            <div className="w-px h-10 bg-slate-800"></div>
                            <div className="text-left">
                              <p className="text-[8px] text-red-500 uppercase tracking-widest">Alvo Red Side</p>
                              <div className="flex items-baseline gap-2">
                                <p className="text-xl font-black text-red-400 italic">{champBans.red_bans}</p>
                                <p className="text-[10px] text-slate-500 font-mono">({Math.round((champBans.red_bans / champBans.total_bans) * 100)}%)</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <DraftSide title="BLUE SIDE SEQUENCE" data={champDraft.blue} side="blue" />
                        <DraftSide title="RED SIDE SEQUENCE" data={champDraft.red} side="red" />
                      </div>
                    </div>
                  )}

                  {activeTab === 'MATCHUPS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
                      {champMatchups.map((m: any) => (
                        <div key={m.opponent} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[32px] hover:border-purple-500/30 transition-all shadow-xl">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-4 text-white">
                              <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${m.opponent}.png`} className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700" alt="" />
                              <div><p className="text-lg font-black italic leading-none">{m.opponent}</p><p className={`text-[10px] font-black mt-1 ${m.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{m.win_rate}% WR</p></div>
                            </div>
                            <div className="text-right text-purple-400 font-black italic"><p className="text-[7px] text-slate-600 uppercase">KDA @12</p><p className="text-xl">{m.avg_kda_12}</p></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <MatchupStat label="GOLD DIFF" val={m.avg_gold_diff_12} isDiff />
                            <MatchupStat label="XP DIFF" val={m.avg_xp_diff_12} isDiff color="text-blue-400" />
                            <MatchupStat label="CS DIFF" val={m.avg_cs_diff_12} isDiff color="text-orange-400" />
                            <MatchupStat label="DEATHS @12" val={m.avg_deaths_12} color="text-red-500" isBadHigh />
                          </div>
                          <div className="mt-4 text-center"><p className="text-[8px] text-slate-600 tracking-widest font-mono">AMOSTRA: <span className="text-slate-400">{m.total_matchups}X</span></p></div>
                        </div>
                      ))}
                      {champMatchups.length === 0 && <p className="col-span-full text-center text-slate-500 italic mt-10">Amostragem de matchups insuficiente.</p>}
                    </div>
                  )}

                  {activeTab === 'SYNERGIES' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
                      {champSynergies.map((s: any) => (
                        <div key={`${s.ally}-${s.ally_lane}`} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[32px] hover:border-blue-500/30 transition-all shadow-xl flex items-center justify-between">
                          <div className="flex items-center gap-4 text-white">
                            <div className="relative">
                              <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${s.ally}.png`} className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700" alt="" />
                              <div className="absolute -bottom-1 -right-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                                 <img src={getRoleIcon(s.ally_lane)} className="w-3.5 h-3.5 brightness-200" alt="" />
                              </div>
                            </div>
                            <div>
                              <p className="text-lg font-black italic leading-none mb-1">{s.ally}</p>
                              <p className="text-[8px] text-slate-500 tracking-widest uppercase">{s.total_games} JOGOS DUO</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-black italic ${s.win_rate >= 50 ? 'text-blue-400' : 'text-slate-500'}`}>{s.win_rate}%</p>
                            <p className="text-[7px] text-slate-600 uppercase">Win Rate</p>
                          </div>
                        </div>
                      ))}
                      {champSynergies.length === 0 && <p className="col-span-full text-center text-slate-500 italic mt-10">Amostragem de sinergias insuficiente.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// -----------------------------------------------------
// COMPONENTES AUXILIARES
// -----------------------------------------------------

function GoldBadge({ gold }: { gold: number | string }) {
  const perPlayer = typeof gold === 'number' ? Math.round(gold / 5) : 0;
  return (
    <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-md mt-3 shadow-inner">
       <span className="text-[10px] text-yellow-500 font-black">💰 +{gold}G</span>
       <span className="text-[7px] text-yellow-600/70 uppercase">({perPlayer}G/Player)</span>
    </div>
  );
}

function ImpactDeltaBadge({ delta }: { delta: number }) {
  const isPos = delta >= 0;
  return (
    <div className={`flex items-baseline gap-1 border px-2 py-0.5 rounded-md shadow-sm ${isPos ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
      <span className="text-[8px] uppercase tracking-widest">Δ</span>
      <span className="text-[10px] font-mono leading-none">{isPos ? '+' : ''}{delta.toFixed(1)}%</span>
    </div>
  )
}

function EnderHeroCard({ obj, title, accent }: { obj: any, title: string, accent: string }) {
  const isHigh = obj.win_rate >= 60;
  const isLow = obj.win_rate < 50;
  const ringColor = accent === 'purple' ? 'hover:ring-purple-500/40' : 'hover:ring-red-500/40';

  return (
    <div className={`bg-slate-900/40 border border-slate-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group transition-all ${ringColor}`}>
      <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:opacity-[0.15] transition-opacity pointer-events-none">
         <img src={getObjectiveIcon(obj.icon_key)} className="w-64 h-64 grayscale" alt="" />
      </div>
      
      <div className="flex items-start justify-between relative z-10 mb-8">
        <div>
          <h3 className="text-2xl text-white italic tracking-widest mb-1">{title}</h3>
          <p className="text-[9px] text-slate-500 font-mono uppercase">CONQUISTADOS EM {obj.times_achieved} JOGOS</p>
          {obj.gold && <GoldBadge gold={obj.gold} />}
        </div>
        <img src={getObjectiveIcon(obj.icon_key)} className="w-16 h-16 rounded-full shadow-xl border border-slate-700 bg-slate-950" alt="" />
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div>
          <p className={`text-7xl font-black italic leading-none ${isHigh ? 'text-emerald-400' : isLow ? 'text-orange-400' : 'text-blue-400'}`}>{obj.win_rate}%</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Win Rate Absoluto</p>
        </div>
        <div className="pb-2">
          <ImpactDeltaBadge delta={obj.delta} />
        </div>
      </div>
    </div>
  );
}

function CompactMacroCard({ obj, title }: { obj: any, title: string }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-[32px] flex flex-col justify-between shadow-xl hover:bg-slate-800/40 transition-colors h-full">
       <div className="flex items-start gap-4 mb-6">
         <img src={getObjectiveIcon(obj.icon_key)} className="w-12 h-12 rounded-full border border-slate-700 bg-slate-950 shadow-inner shrink-0" alt="" />
         <div>
           <p className="text-[12px] text-white tracking-widest mb-0.5">{title}</p>
           <p className="text-[8px] text-slate-500 font-mono uppercase">EM {obj.times_achieved} JOGOS</p>
           {obj.gold && <div className="mt-1"><GoldBadge gold={obj.gold} /></div>}
         </div>
       </div>
       <div className="flex items-end justify-between">
         <div>
           <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Impact Delta</p>
           <ImpactDeltaBadge delta={obj.delta} />
         </div>
         <div className="text-right">
           <p className={`text-4xl font-black italic leading-none ${obj.win_rate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{obj.win_rate}%</p>
           <p className="text-[8px] text-slate-600 uppercase tracking-widest mt-1">Win Rate</p>
         </div>
       </div>
    </div>
  );
}

function DraftSide({ title, data, side }: any) {
  const isBlue = side === 'blue';
  const cTitle = isBlue ? 'text-blue-500 border-blue-500/20' : 'text-red-500 border-red-500/20 text-right';
  const cRow = isBlue ? 'bg-blue-900/10 border-blue-500/10 hover:bg-blue-900/20' : 'bg-red-900/10 border-red-500/10 hover:bg-red-900/20 flex-row-reverse';
  const cBadge = isBlue ? 'bg-blue-600/20 text-blue-400' : 'bg-red-600/20 text-red-400 flex-row-reverse';

  return (
    <div className="space-y-4">
      <p className={`text-[10px] tracking-widest border-b pb-2 font-black italic ${cTitle}`}>{title}</p>
      <div className="grid grid-cols-1 gap-2">
        {data.length > 0 ? data.map((d: any, i: number) => (
          <div key={i} className={`p-4 rounded-2xl flex justify-between items-center text-white transition-all font-black italic shadow-sm border ${cRow}`}>
            <div className={`flex items-center gap-4 ${isBlue ? '' : 'flex-row-reverse'}`}>
              <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm shadow-inner ${cBadge}`}>{d.safeLabel}</span>
              <p className="text-[9px] text-slate-500 uppercase">{d.total_picks} JOGOS</p>
            </div>
            <p className={`text-2xl ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</p>
          </div>
        )) : <p className={`text-[9px] text-slate-700 italic py-2 ${isBlue ? '' : 'text-right'}`}>SEM DADOS NO LADO {isBlue ? 'AZUL' : 'VERMELHO'}</p>}
      </div>
    </div>
  );
}

function MatchupStat({ label, val, isDiff = false, color = "text-white", isBadHigh = false }: any) {
  const isPos = Number(val) > 0;
  let finalColor = color;
  if (isDiff) { finalColor = isPos ? 'text-blue-400' : 'text-red-500'; }
  else if (isBadHigh) { finalColor = Number(val) >= 1 ? "text-red-500" : "text-emerald-400"; }

  return (
    <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800 text-center transition-all hover:bg-slate-800/40 font-black italic">
      <p className="text-[7px] text-slate-600 uppercase mb-1">{label}</p>
      <p className={`text-[12px] font-mono ${finalColor}`}>{isDiff && isPos ? '+' : ''}{val}</p>
    </div>
  );
}