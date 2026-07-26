// app/(dashboard)/players-v2/components/PowerRankings.tsx
import Link from 'next/link';
import { getRoleIcon, getScoreColor } from '@/lib/utils/formatters';
import { ROLES_ORDER, DEFAULT_AVATAR } from '../utils';

function ProgressBar({ label, value }: { label: string, value: number }) {
  const numValue = Math.round(value || 0);
  let colorClass = "bg-zinc-600";
  if (numValue >= 90) colorClass = "bg-purple-500";
  else if (numValue >= 80) colorClass = "bg-blue-500";
  else if (numValue >= 70) colorClass = "bg-emerald-500";
  else if (numValue >= 60) colorClass = "bg-amber-500";
  else if (numValue > 0) colorClass = "bg-red-500";

  return (
    <div className="flex flex-col w-full group/bar">
      <div className="flex justify-between items-end mb-1 px-0.5">
        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black text-white">{numValue}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-sm overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, numValue))}%` }} />
      </div>
    </div>
  );
}

export default function PowerRankings({ leaderboardTab, setLeaderboardTab, leaderboardPlayers, teamsList }: any) {
  return (
    <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b border-zinc-800 pb-6 shrink-0">
        <div>
          <h2 className="text-xl text-white font-black uppercase tracking-tight flex items-center gap-3">
            <span className="text-yellow-400">🏆</span> POWER RANKINGS
          </h2>
          <p className="text-[10px] text-zinc-500 tracking-widest font-bold mt-1 uppercase">Algoritmo de Eficiência Tática</p>
        </div>

        <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800 overflow-x-auto max-w-full custom-scrollbar">
          <button 
            onClick={() => setLeaderboardTab('GLOBAL')} 
            className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${leaderboardTab === 'GLOBAL' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            ★ GLOBAL
          </button>
          {ROLES_ORDER.map(role => (
            <button 
              key={role} 
              onClick={() => setLeaderboardTab(role.toUpperCase())} 
              className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${leaderboardTab === role.toUpperCase() ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {/* O getRoleIcon retorna a tag HTML real, usamos opacidade para estilizar em volta */}
              <span className="opacity-70">{getRoleIcon(role, "w-3 h-3")}</span> 
              {role.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {leaderboardPlayers.length === 0 ? (
          <div className="text-center py-20 text-zinc-600 text-xs tracking-widest font-bold uppercase">Nenhum operativo encontrado no filtro.</div>
        ) : (
          leaderboardPlayers.map((p: any, index: number) => {
            const isTop1 = index === 0;
            const team = teamsList.find((t: any) => t.acronym.toUpperCase() === p.team_acronym.toUpperCase());
            
            return (
              <Link 
                key={p.puuid} 
                href={`/dashboard/players/${p.puuid}`} 
                className={`flex flex-col md:flex-row items-center p-4 rounded-xl border transition-colors group relative overflow-hidden ${isTop1 ? 'bg-yellow-400/10 border-yellow-400/30 hover:border-yellow-400/60' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}
              >
                {isTop1 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400" />}
                
                <div className="flex w-full md:w-auto items-center justify-between md:justify-start mb-4 md:mb-0">
                  <span className={`text-2xl font-black w-12 text-center ${isTop1 ? 'text-yellow-400 drop-shadow-md' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}`}>
                    #{index + 1}
                  </span>
                  
                  <div className="flex items-center gap-4 flex-1 md:w-[220px] ml-2">
                    <img src={p.photo_url || DEFAULT_AVATAR} className={`w-12 h-12 object-cover rounded-lg border-2 ${isTop1 ? 'border-yellow-400/50' : 'border-zinc-800'}`} alt="" />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-base font-black uppercase tracking-tight truncate ${isTop1 ? 'text-yellow-400' : 'text-zinc-300 group-hover:text-white transition-colors'}`}>{p.nickname}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {team?.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3 object-contain" />}
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">{p.team_acronym}</span>
                        <span className="text-zinc-700">|</span>
                        {leaderboardTab === 'GLOBAL' && <span className="opacity-70">{getRoleIcon(String(p.primary_role), "w-2.5 h-2.5")}</span>}
                        <span className="text-[9px] font-bold text-zinc-600">{p.games_played}G</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full max-w-[500px] ml-auto mr-8 hidden md:grid grid-cols-4 gap-4 items-center">
                  <ProgressBar label="LANE" value={p.median_lane} />
                  <ProgressBar label="IMPACTO" value={p.median_impact} />
                  <ProgressBar label="CONV." value={p.median_conversion} />
                  <ProgressBar label="VISÃO" value={p.median_vision} />
                </div>

                <div className="flex flex-col items-end justify-center w-full md:w-20 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-zinc-800">
                  <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isTop1 ? 'text-yellow-400/70' : 'text-zinc-500'}`}>RATING</span>
                  <span className={`text-2xl font-black leading-none ${isTop1 ? 'text-yellow-400 drop-shadow-md' : getScoreColor(p.mvp_score)}`}>
                    {Math.round(p.mvp_score || 0)}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}