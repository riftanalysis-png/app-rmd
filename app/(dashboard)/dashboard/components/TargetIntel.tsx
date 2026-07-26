"use client";

import { Target, Swords, Zap, Flame, Hourglass, Crosshair, Shield } from 'lucide-react';

// --- FUNÇÕES UTILITÁRIAS EMBUTIDAS ---
const getChampImage = (champName: string) => {
  if (!champName) return '';
  let name = String(champName).trim().replace(/['\s.]/g, '');
  const specialCases: Record<string, string> = {
    "wukong": "MonkeyKing", "renataglasc": "Renata", "ksante": "KSante",
    "jarvaniv": "JarvanIV", "drmundo": "DrMundo", "tahmkench": "TahmKench",
    "leesin": "LeeSin", "masteryi": "MasterYi", "missfortune": "MissFortune",
    "xinzhao": "XinZhao", "twistedfate": "TwistedFate", "kogmaw": "KogMaw",
    "aurelionsol": "AurelionSol", "reksai": "RekSai", "kaisa": "Kaisa", "chogath": "Chogath"
  };
  const rawLower = name.toLowerCase();
  name = specialCases[rawLower] ? specialCases[rawLower] : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return `https://ddragon.leagueoflegends.com/cdn/14.5.1/img/champion/${name}.png`;
};

function getChampionCenteredUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg';
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${sanitized}_0.jpg`;
}

export default function TargetIntel({ nextTargetIntel, currentTargetH2H, onOpenTargetDrafts, teamsList }: any) {
  if (!nextTargetIntel) return null;

  // A função agora acessa o 'teamsList' que vem via Props perfeitamente!
  const getTeamLogo = (acronym: string) => {
    const t = teamsList?.find((t: any) => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase());
    return t?.logo_url || null;
  };

  return (
    <div className="bg-[#121214] border border-zinc-800/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden hover-lift flex flex-col h-[450px] group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-4 border-b border-zinc-800/60 pb-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
            {getTeamLogo(nextTargetIntel.team) ? (
              <img src={getTeamLogo(nextTargetIntel.team)!} className="w-10 h-10 object-contain shrink-0 bg-zinc-900 p-1 rounded-lg border border-zinc-800" alt={nextTargetIntel.team} />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-600">{nextTargetIntel.team.substring(0,3)}</div>
            )}
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                  <Target size={14} className="text-red-500 animate-pulse" /> Target Intel
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[8px] text-zinc-400 font-bold tracking-widest uppercase">OP: {nextTargetIntel.team}</p>
                  {currentTargetH2H && (
                    <>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                        <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                          <span className="text-zinc-500">H2H:</span>
                          <span className="text-emerald-400">{currentTargetH2H.wins}W</span>
                          <span className="text-zinc-600">-</span>
                          <span className="text-red-400">{currentTargetH2H.losses}L</span>
                        </div>
                    </>
                  )}
              </div>
            </div>
        </div>
        
        {nextTargetIntel.team !== 'SEM ALVO' && onOpenTargetDrafts && (
            <button onClick={onOpenTargetDrafts} className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5">
              <Swords size={10} /> DRAFTS
            </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between overflow-hidden z-10 mt-1">
        {nextTargetIntel.team !== 'SEM ALVO' ? (
          <>
            <div className="flex flex-col shrink-0">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Zap size={12} className="text-red-500" /> WIN CONS & ALVOS</p>
              <div className="flex flex-row items-stretch gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">

                <ul className="flex-1 flex flex-col justify-center gap-2.5">
                  {nextTargetIntel.winConditions?.filter((wc: any) => wc.type !== 'pressure').length > 0 ?
                    nextTargetIntel.winConditions.filter((wc: any) => wc.type !== 'pressure').map((wc: any, i: number) => (
                    <li key={i} className="text-xs text-zinc-300 font-bold flex flex-col justify-center leading-snug">
                      {wc.type === 'wr' && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]"></div> Blue WR: {wc.blue}%</div>
                            <span className="text-zinc-700 font-black px-1 text-sm">|</span>
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]"></div> Red WR: {wc.red}%</div>
                        </div>
                      )}
                      {wc.type === 'early' && <div className="flex items-center gap-2"><Flame size={15} className="text-orange-500" /> {wc.text}</div>}
                      {wc.type === 'scaling' && <div className="flex items-center gap-2"><Hourglass size={15} className="text-blue-400" /> {wc.text}</div>}
                      
                      {wc.type === 'macro' && (
                        <div className="flex items-center gap-5 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/60 mt-1.5 w-fit shadow-inner">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-zinc-500 font-black tracking-[0.15em] uppercase mb-0.5">AVG 1º Drake</span>
                              <span className="text-xs text-orange-400 font-black">{wc.drakeTime} min</span>
                            </div>
                            <div className="w-px h-6 bg-zinc-800/80"></div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-zinc-500 font-black tracking-[0.15em] uppercase mb-0.5">AVG 1º Grubs</span>
                              <span className="text-xs text-purple-400 font-black">{wc.grubsTime} min</span>
                            </div>
                        </div>
                      )}

                      {wc.type === 'empty' && <span className="text-[10px] text-zinc-600 uppercase">{wc.text}</span>}
                    </li>
                  )) : (
                    <li className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center py-2">Sem dados registados</li>
                  )}
                </ul>

                {nextTargetIntel.winConditions?.find((wc: any) => wc.type === 'pressure') && (
                  <div className="w-[180px] shrink-0 border-l border-zinc-800/60 pl-5 flex flex-col justify-center">
                      {(() => {
                        const target = nextTargetIntel.winConditions.find((wc: any) => wc.type === 'pressure');
                        const p = target.player;
                        return (
                            <>
                              <div className="flex items-center gap-3 mb-2.5 relative group/carry cursor-help">
                                  <div className="relative shrink-0">
                                    <img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.nickname}&background=18181b&color=ef4444`} className="w-10 h-10 rounded-full border-2 border-red-500/50 object-cover shadow-md group-hover/carry:border-red-400 transition-colors" alt={p.nickname} />
                                    <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 shadow-sm"><Crosshair size={10} className="text-white"/></div>
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-white font-black text-xs uppercase tracking-tight leading-none truncate block group-hover/carry:text-red-400 transition-colors">{p.nickname}</span>
                                    <span className="text-red-400 font-bold text-[8px] tracking-widest uppercase mt-0.5">{String(p.primary_role).replace(/jug/i, 'JNG')}</span>
                                  </div>
                                  
                                  {p.topChamps && p.topChamps.length > 0 && (
                                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-zinc-950/95 backdrop-blur-md border border-zinc-700 p-2.5 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/carry:opacity-100 group-hover/carry:pointer-events-auto transition-all duration-300 z-[999] flex flex-col items-center w-max transform translate-y-2 group-hover/carry:translate-y-0">
                                        <span className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1.5 border-b border-zinc-800 pb-1 w-full text-center flex items-center gap-1"><Flame size={10}/> Best Picks</span>
                                        <div className="flex gap-2">
                                           {p.topChamps.map((c: string, idx: number) => (
                                              <img key={idx} src={getChampImage(c)} className="w-8 h-8 rounded-lg border border-zinc-700 object-cover hover:border-red-500 transition-colors" alt={c} title={c} />
                                           ))}
                                        </div>
                                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-950 border-b border-r border-zinc-700 rotate-45"></div>
                                     </div>
                                  )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                                  <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Lane</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_lane || 0)}</span></div>
                                  <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Impacto</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_impact || 0)}</span></div>
                                  <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Visão</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_vision || 0)}</span></div>
                                  <div className="flex flex-col"><span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">Conv.</span><span className="text-[10px] font-black text-emerald-400">{Math.round(p.median_conversion || 0)}</span></div>
                              </div>
                            </>
                        )
                      })()}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 mt-3 relative z-10">
              {/* PRIORITY PICKS - BENTO BANNERS */}
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 flex flex-col gap-2 shadow-inner">
                <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 pl-1 flex items-center gap-1.5"><Target size={10}/> PRIORITY PICKS</p>
                <div className="flex flex-col gap-2">
                  {nextTargetIntel.topPicks?.length > 0 ? nextTargetIntel.topPicks.map((champ: any, i: number) => (
                      <div key={i} className="group relative h-[46px] rounded-lg border border-blue-900/30 bg-blue-900/10 overflow-hidden flex items-center shadow-sm hover:border-blue-500/50 transition-all cursor-default">
                        <div className="absolute inset-0 w-full h-full">
                            <img src={getChampionCenteredUrl(champ.name)} className="w-full h-full object-cover object-[center_20%] opacity-50 transition-transform duration-500 group-hover:scale-110" alt="" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/70 to-transparent" />
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500 z-20" />
                        <div className="relative z-20 flex w-full items-center justify-between px-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-blue-400 uppercase w-3 drop-shadow-md">B{i+1}</span>
                              <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-white uppercase tracking-tight drop-shadow-md">{champ.name}</span>
                                    {champ.isBlind && <span className="bg-amber-500 text-white text-[6px] px-1 py-0.5 rounded font-black tracking-widest shadow-sm">BLIND</span>}
                                    {champ.isFlex && <span className="bg-purple-500 text-white text-[6px] px-1 py-0.5 rounded font-black tracking-widest shadow-sm">FLEX</span>}
                                  </div>
                                  <div className="flex items-center gap-2 text-[8px] font-bold mt-1">
                                    <span className={champ.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{champ.winRate}% WR</span>
                                    <span className="text-zinc-600">|</span>
                                    <span className="text-zinc-300 uppercase tracking-widest">{champ.roles.join(', ').replace(/jug/i, 'JNG')}</span>
                                  </div>
                              </div>
                            </div>
                        </div>
                      </div>
                  )) : <span className="text-[9px] text-zinc-600 font-bold uppercase p-2">Sem Dados</span>}
                </div>
              </div>

              {/* MUST BANS - BENTO BANNERS */}
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 flex flex-col gap-2 shadow-inner">
                <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.2em] mb-1 pl-1 flex items-center gap-1.5"><Shield size={10}/> MUST BANS</p>
                <div className="flex flex-col gap-2">
                  {nextTargetIntel.topBans?.length > 0 ? nextTargetIntel.topBans.map((champ: any, i: number) => (
                      <div key={i} className="group relative h-[46px] rounded-lg border border-red-900/30 bg-red-900/10 overflow-hidden flex items-center shadow-sm hover:border-red-500/50 transition-all cursor-default">
                        <div className="absolute inset-0 w-full h-full">
                            <img src={getChampionCenteredUrl(champ.name)} className="w-full h-full object-cover object-[center_20%] opacity-30 grayscale transition-all duration-500 group-hover:scale-110 group-hover:grayscale-0" alt="" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/70 to-transparent" />
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500 z-20" />
                        <div className="relative z-20 flex w-full items-center justify-between px-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black text-red-500 uppercase w-5 line-through decoration-red-500">BAN</span>
                              <span className="text-xs font-black text-zinc-400 group-hover:text-white uppercase tracking-tight line-through decoration-red-500/50 transition-colors drop-shadow-md">{champ.name}</span>
                            </div>
                        </div>
                      </div>
                  )) : <span className="text-[9px] text-zinc-600 font-bold uppercase p-2">Sem Dados</span>}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
            <Shield size={36} className="mb-3 text-zinc-600 opacity-50" />
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Aguardando Próxima Operação</p>
          </div>
        )}
      </div>
    </div>
  );
}