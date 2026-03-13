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

export default function MetaWarRoom() {
  const [data, setData] = useState({ tiers: [], matchups: [], draft: [] });
  const [selectedChamp, setSelectedChamp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'MATCHUPS'>('DRAFT');
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState<string>('ALL');
  const [minGames, setMinGames] = useState<number>(5);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [t, m, d] = await Promise.all([
        supabase.from('view_champion_tier_list_by_lane').select('*').order('power_score', { ascending: false }),
        supabase.from('view_champion_matchups_detailed').select('*'),
        supabase.from('view_meta_global_draft').select('*')
      ]);
      setData({ tiers: t.data || [], matchups: m.data || [], draft: d.data || [] });
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredTiers = useMemo(() => {
    const target = laneMap[activeLane] || activeLane.toLowerCase();
    const list = data.tiers.filter(c => (activeLane === 'ALL' || c.lane === target) && c.total_picks >= minGames);
    return {
      S: list.filter(c => c.power_score >= 75),
      A: list.filter(c => c.power_score >= 60 && c.power_score < 75),
      B: list.filter(c => c.power_score >= 45 && c.power_score < 60),
      C: list.filter(c => c.power_score < 45),
    };
  }, [data.tiers, activeLane, minGames]);

  const champDraft = useMemo(() => {
    if (!selectedChamp) return { blue: [], red: [] };
    const d = data.draft.filter(x => x.champion === selectedChamp);
    return {
      blue: d.filter(x => x.side === 'blue').sort((a,b) => a.sequence - b.sequence),
      red: d.filter(x => x.side === 'red').sort((a,b) => a.sequence - b.sequence)
    };
  }, [selectedChamp, data.draft]);

  const champMatchups = useMemo(() => {
    if (!selectedChamp) return [];
    const target = laneMap[activeLane] || activeLane.toLowerCase();
    return data.matchups.filter(m => 
      m.champion === selectedChamp && (activeLane === 'ALL' || m.lane === target)
    ).sort((a,b) => b.total_matchups - a.total_matchups);
  }, [selectedChamp, data.matchups, activeLane]);

  if (loading) return <div className="p-20 text-purple-500 font-black text-center animate-pulse italic uppercase tracking-[0.2em]">RMD ANALYTICS: CALIBRANDO PROTOCOLOS...</div>;

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 p-4 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="flex flex-col lg:flex-row justify-between items-end gap-6 border-l-4 border-purple-500 pl-6 mb-10 text-white">
        <div><h1 className="text-5xl leading-none">META WAR ROOM</h1><p className="text-purple-400 text-[10px] tracking-[0.4em] mt-1">High Fidelity Scouting Protocol</p></div>
        <div className="flex gap-4">
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-800 backdrop-blur-md">
             {[1, 5, 10].map(n => <button key={n} onClick={() => setMinGames(n)} className={`w-8 h-8 rounded-xl text-[10px] transition-all ${minGames === n ? 'bg-white text-black shadow-lg scale-105' : 'text-slate-500'}`}>{n}</button>)}
          </div>
          <div className="flex bg-slate-900/40 p-1.5 rounded-3xl border border-slate-800 shadow-2xl">
            {['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUP'].map(l => (
              <button key={l} onClick={() => {setActiveLane(l); setSelectedChamp(null);}} className={`px-5 py-2.5 rounded-2xl text-[9px] flex items-center gap-2 transition-all ${activeLane === l ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {l !== 'ALL' && <img src={getRoleIcon(laneMap[l] || l)} className="w-3.5 h-3.5 brightness-200" alt="" />}
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      {selectedChamp && (
        <div className="bg-slate-900/40 border border-purple-500/20 rounded-[48px] p-8 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top duration-500">
          <div className="flex flex-col xl:flex-row gap-12">
            <div className="flex flex-col items-center xl:border-r border-slate-800 pr-12 min-w-[240px]">
              <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp}.png`} className="w-32 h-32 rounded-[40px] border-4 border-purple-500 mb-4 shadow-2xl" alt="" />
              <h2 className="text-4xl leading-none mb-6 text-white italic text-center">{selectedChamp}</h2>
              <div className="flex flex-col gap-2 w-full mb-6">
                <button onClick={() => setActiveTab('DRAFT')} className={`w-full py-3 rounded-2xl text-[10px] border transition-all ${activeTab === 'DRAFT' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'border-slate-800 text-slate-500'}`}>DRAFT INTEL</button>
                <button onClick={() => setActiveTab('MATCHUPS')} className={`w-full py-3 rounded-2xl text-[10px] border transition-all ${activeTab === 'MATCHUPS' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'border-slate-800 text-slate-500'}`}>MATCHUPS @12</button>
              </div>
              <button onClick={() => setSelectedChamp(null)} className="text-[9px] text-slate-600 hover:text-white uppercase tracking-widest transition-colors">FECHAR ANÁLISE ×</button>
            </div>

            <div className="flex-1">
              {activeTab === 'DRAFT' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <DraftSide title="BLUE SIDE PICKS" data={champDraft.blue} color="blue" />
                  <DraftSide title="RED SIDE PICKS" data={champDraft.red} color="red" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {champMatchups.map(m => (
                    <div key={m.opponent} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[32px] hover:border-purple-500/30 transition-all shadow-xl">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-4 text-white">
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${m.opponent}.png`} className="w-12 h-12 rounded-2xl shadow-xl" alt="" />
                          <div><p className="text-lg font-black italic leading-none">{m.opponent}</p><p className={`text-[10px] font-black mt-1 ${m.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{m.win_rate}% WR</p></div>
                        </div>
                        <div className="text-right text-purple-400 font-black italic"><p className="text-[7px] text-slate-600 uppercase">KDA @12</p><p className="text-xl">{m.avg_kda_12}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <MatchupStat label="GOLD DIFF" val={m.avg_gold_diff_12} isDiff />
                        <MatchupStat label="XP DIFF" val={m.avg_xp_diff_12} isDiff color="text-blue-400" />
                        <MatchupStat label="CS DIFF" val={m.avg_cs_diff_12} isDiff color="text-orange-400" />
                        <MatchupStat label="VSPM @12" val={m.avg_vspm_12} color="text-yellow-500" />
                        
                        {/* INCLUSÃO DA MÉTRICA DE MORTES */}
                        <MatchupStat label="DEATHS @12" val={m.avg_deaths_12} color="text-red-500" isBadHigh />
                        
                        <div className="bg-slate-900/40 p-3 rounded-2xl border border-white/5 flex flex-col justify-center items-center font-black italic"><p className="text-[7px] text-slate-600 uppercase mb-1">Amostra</p><p className="text-[10px] text-white">{m.total_matchups}X</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(filteredTiers).map(([tier, list]) => (
          <div key={tier} className="flex gap-4 items-stretch group/tier">
            <div className={`w-20 flex items-center justify-center rounded-[24px] text-3xl font-black italic shadow-xl bg-slate-900 border border-slate-800 ${tier === 'S' ? 'text-red-600' : tier === 'A' ? 'text-orange-500' : tier === 'B' ? 'text-yellow-500' : 'text-emerald-500'}`}>{tier}</div>
            <div className="flex-1 bg-slate-900/10 border border-slate-800/40 rounded-[28px] p-5 flex flex-wrap gap-5 font-black italic">
              {list.length > 0 ? list.map(c => (
                <button key={`${c.champion}-${c.lane}`} onClick={() => { setSelectedChamp(c.champion); setActiveTab('DRAFT'); }} className={`relative transition-all hover:scale-110 active:scale-95 ${selectedChamp === c.champion ? 'scale-110' : ''}`}>
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className={`w-16 h-16 rounded-2xl border-2 transition-all shadow-2xl ${selectedChamp === c.champion ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.5)]' : 'border-slate-800'}`} alt="" />
                  <div className="absolute -top-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-lg text-[8px] text-purple-400 shadow-2xl">{c.total_picks}</div>
                </button>
              )) : <p className="text-[9px] text-slate-800 flex items-center font-black">AMSTRAGEM INSUFICIENTE</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftSide({ title, data, color }: any) {
  const c = color === 'blue' ? 'blue' : 'red';
  return (
    <div className="space-y-4">
      <p className={`text-${c}-500 text-[10px] tracking-widest border-b border-${c}-500/20 pb-2 font-black italic`}>{title}</p>
      <div className="grid grid-cols-1 gap-2">
        {data.length > 0 ? data.map((d: any, i: number) => (
          <div key={i} className={`bg-${c}-600/5 border border-${c}-500/10 p-4 rounded-2xl flex justify-between items-center text-white transition-all hover:bg-${c}-600/10 font-black italic`}>
            <div className="flex items-center gap-4"><span className={`w-10 h-10 flex items-center justify-center bg-${c}-600/20 rounded-xl text-${c}-400 text-sm`}>{d.draft_label}</span><p className="text-[9px] text-slate-500 uppercase">{d.total_picks} JOGOS</p></div>
            <p className={`text-2xl ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</p>
          </div>
        )) : <p className="text-[9px] text-slate-700 italic">SEM HISTÓRICO GLOBAL</p>}
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
    <div className="bg-slate-900/40 p-3 rounded-2xl border border-white/5 text-center transition-all hover:bg-slate-800/40 font-black italic">
      <p className="text-[7px] text-slate-600 uppercase mb-1">{label}</p>
      <p className={`text-[12px] font-mono ${finalColor}`}>{isDiff && isPos ? '+' : ''}{val}</p>
    </div>
  );
}