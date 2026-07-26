// app/(dashboard)/players-v2/components/PlayerCard.tsx
import Link from 'next/link';
import { getRoleIcon, getScoreColor } from '@/lib/utils/formatters';
import { getChampionSplashUrl } from '../utils';

export function StatBadge({ label, value }: { label: string, value: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded bg-zinc-950/70 backdrop-blur-md border border-zinc-800/50 transition-colors shadow-inner">
      <span className="text-[7px] font-bold text-zinc-400 tracking-widest uppercase mb-0.5">{label}</span>
      <span className={`text-[11px] font-black drop-shadow-md ${getScoreColor(value)}`}>{value ? Math.round(value) : '-'}</span>
    </div>
  );
}

export default function PlayerCard({ player, teams, isAdmin, onEdit, isTeamMVP, mainChampion }: any) {
  const team = teams.find((t: any) => t.acronym.toUpperCase() === player.team_acronym.toUpperCase());
  const isGlobalMVP = player.is_mvp;
  const splashUrl = getChampionSplashUrl(mainChampion);
  
  let borderColor = 'border-zinc-800 hover:border-zinc-500';
  let nameColor = 'text-white';
  let foilClass = '';
  let badgeLabel = '';
  let badgeColor = '';
  
  if (isGlobalMVP) {
    borderColor = 'border-yellow-500/30 hover:border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.05)]';
    nameColor = 'text-yellow-400';
    foilClass = 'foil-stealth-royal';
    badgeLabel = 'SEASON MVP';
    badgeColor = 'bg-yellow-400 text-yellow-950';
  } else if (isTeamMVP) {
    borderColor = 'border-emerald-500/30 hover:border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]';
    nameColor = 'text-emerald-500';
    foilClass = 'foil-stealth-royal';
    badgeLabel = 'TEAM STAR';
    badgeColor = 'bg-emerald-500 text-emerald-950';
  }

  return (
    <div className="relative group h-[220px]">
      <style>{`
        .foil-stealth-royal {
          background-image: linear-gradient(110deg, transparent 0%, transparent 35%, rgba(255, 255, 255, 0.01) 40%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0.01) 60%, transparent 65%, transparent 100%), linear-gradient(to right, rgba(255, 245, 220, 0.015), rgba(255, 255, 255, 0.03), rgba(255, 245, 220, 0.015));
          background-size: 250% 100%, 100% 100%;
          animation: premium-sweep 14s linear infinite; 
          mix-blend-mode: color-dodge;
        }
        .foil-stealth-royal::after {
          content: ""; position: absolute; inset: 0;
          background-image: linear-gradient(45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015)), linear-gradient(-45deg, rgba(255,255,255,0.015) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.015) 75%, rgba(255,255,255,0.015));
          background-size: 4px 4px; mix-blend-mode: overlay; pointer-events: none; opacity: 0.7; 
        }
        @keyframes premium-sweep { 0% { background-position: 200% 0, 0% 0; } 100% { background-position: -100% 0, 0% 0; } }
        .clip-card { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%); }
      `}</style>
      
      {isAdmin && <button onClick={(e) => { e.preventDefault(); onEdit(); }} className="absolute -top-2 -right-2 z-50 bg-blue-600 hover:bg-blue-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs shadow-md">✏️</button>}
      
      {badgeLabel && (
        <div className={`absolute -top-2.5 left-4 z-40 ${badgeColor} text-[8px] font-black px-2.5 py-1 rounded shadow-lg tracking-widest`}>
          {badgeLabel}
        </div>
      )}

      <Link href={`/dashboard/players/${player.puuid}`} className={`bg-zinc-950 border transition-all duration-300 flex flex-col block h-full relative shadow-md clip-card group-hover:-translate-y-1 ${borderColor}`}>
        
        {mainChampion && (
          <div className="absolute inset-0 z-0 opacity-80 transition-transform duration-700 group-hover:scale-105">
            <img src={splashUrl} className="w-full h-full object-cover object-[center_20%]" alt="" />
          </div>
        )}
        
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent opacity-90" />
        
        {(isGlobalMVP || isTeamMVP) && (
          <div className={`absolute inset-0 z-10 pointer-events-none ${foilClass}`} />
        )}

        <div className="relative z-20 p-4 flex flex-col h-full">
          <div className="flex justify-between items-start mb-3">
            <div className={`relative p-0.5 rounded-lg transition-transform duration-300 ${isGlobalMVP ? 'bg-yellow-400' : isTeamMVP ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
              <div className="w-11 h-11 bg-zinc-900 rounded-md overflow-hidden flex items-center justify-center shadow-inner">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-zinc-600">{player.nickname?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-zinc-950 p-1 rounded border border-zinc-800 shadow-md">
                 {/* O seu getRoleIcon já retorna JSX <img> diretamente! Limpo e perfeito. */}
                 {getRoleIcon(String(player.primary_role), "w-2.5 h-2.5")}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5 mt-1">
               {team?.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4 object-contain opacity-90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />}
               <span className="text-[8px] font-bold text-white tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,1)] bg-black/40 px-1.5 rounded">{player.games_played} MATCHES</span>
            </div>
          </div>

          <h3 className={`text-[17px] font-black tracking-tight uppercase truncate drop-shadow-[0_2px_4px_rgba(0,0,0,1)] mt-auto ${nameColor}`}>
            {player.nickname}
          </h3>
          
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <StatBadge label="LANE" value={player.median_lane} />
            <StatBadge label="IMPACT" value={player.median_impact} />
            <StatBadge label="CONV" value={player.median_conversion} />
            <StatBadge label="VISION" value={player.median_vision} />
          </div>
        </div>
      </Link>
    </div>
  );
}