// lib/utils/formatters.tsx
import React from 'react';

export function getSafeTimestamp(dateString: any) {
  if (!dateString) return 0;
  const time = new Date(String(dateString).replace(' ', 'T')).getTime();
  return isNaN(time) ? 0 : time;
}

export const getDifficultyColor = (diff: any) => { 
  const safeDiff = String(diff || '').toUpperCase();
  switch (safeDiff) { 
    case 'STOMPAMOS': return 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.3)]'; 
    case 'MUITO FÁCIL': return 'bg-teal-400 text-white border-teal-300'; 
    case 'FÁCIL': return 'bg-lime-500 text-white border-lime-400'; 
    case 'CONTROLADO': return 'bg-yellow-400 text-white border-yellow-300'; 
    case 'DIFÍCIL': return 'bg-orange-400 text-white border-orange-300'; 
    case 'MT DIFÍCIL': return 'bg-red-500 text-white border-red-400'; 
    case 'STOMPADOS': return 'bg-red-800 text-white border-red-700 shadow-[0_0_10px_rgba(153,27,27,0.3)]'; 
    default: return 'bg-zinc-800 text-zinc-300 border-zinc-700'; 
  } 
};

export const formatDate = (dateString: string) => { 
  if (!dateString) return ''; 
  const p = dateString.split('-'); 
  return p.length >= 3 ? `${p[2]}/${p[1]}` : dateString; 
};

export const getChampImage = (champName: string) => {
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

export function getChampionCenteredUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${sanitized}_0.jpg`;
}

export const getScoreColor = (score: number | null) => {
  if (!score) return "text-zinc-600";
  if (score >= 90) return "text-purple-500"; 
  if (score >= 80) return "text-blue-500";     
  if (score >= 70) return "text-emerald-500"; 
  if (score >= 60) return "text-amber-500";  
  return "text-red-500";                                      
};

const ROLES_ORDER = ['top', 'jng', 'mid', 'adc', 'support'];

export function normalizeRole(lane: string | null): string {
  if (!lane) return 'unknown'; 
  const l = String(lane).toLowerCase().trim();
  if (l.includes('top')) return 'top';
  if (l.includes('jungle') || l.includes('jng') || l === 'jg' || l.includes('jug')) return 'jng';
  if (l.includes('mid')) return 'mid';
  if (l.includes('bot') || l.includes('adc')) return 'adc';
  if (l.includes('sup') || l.includes('utility')) return 'support';
  return 'unknown'; 
}

export function getRoleIcon(role: string, size: string = "w-4 h-4") {
  const basePath = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions";
  let iconName = "";
  const normalizedRole = normalizeRole(role); 
  switch (normalizedRole) {
    case 'top': iconName = "icon-position-top.png"; break;
    case 'jng': iconName = "icon-position-jungle.png"; break;
    case 'mid': iconName = "icon-position-middle.png"; break;
    case 'adc': iconName = "icon-position-bottom.png"; break; 
    case 'support': iconName = "icon-position-utility.png"; break;
    default: return <span className="text-[12px] font-black text-zinc-600">?</span>;
  }
  return <img src={`${basePath}/${iconName}`} alt={normalizedRole} className={`${size} object-contain brightness-200 opacity-80`} />;
}

export function sortPicks(picksArray: any[]) {
  return [...picksArray].sort((a, b) => {
    const roleA = normalizeRole(a.role || a.lane);
    const roleB = normalizeRole(b.role || b.lane);
    return ROLES_ORDER.indexOf(roleA) - ROLES_ORDER.indexOf(roleB);
  });
}

// ⚠️ ATENÇÃO AQUI: Como essa função não está mais dentro da página principal, 
// ela precisa receber o "teamsList" como parâmetro para saber onde procurar os logos.
export const getTeamLogo = (acronym: string, teamsList: any[] = []) => { 
  if (!teamsList || teamsList.length === 0) return null;
  const t = teamsList.find(t => String(t.acronym || '').toUpperCase() === String(acronym || '').toUpperCase()); 
  return t?.logo_url || null; 
};