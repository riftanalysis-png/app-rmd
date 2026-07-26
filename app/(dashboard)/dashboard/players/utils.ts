// app/(dashboard)/players-v2/utils.ts
import { normalizeRole } from '@/lib/utils/formatters';

export const DDRAGON_VERSION = '16.1.1'; 
export const ROLES_ORDER = ['top', 'jng', 'mid', 'adc', 'support'];
export const MAP_OFFSET = 3.5; 
export const MAP_SCALE = 93;   
export const GAME_MAX = 15000; 
export const DEFAULT_AVATAR = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";

export const SEQUENCE_LABELS: { [key: number]: string } = {
  1: 'bb1', 2: 'rb1', 3: 'bb2', 4: 'rb2', 5: 'bb3', 6: 'rb3',
  7: 'b1', 8: 'r1', 9: 'r2', 10: 'b2', 11: 'b3', 12: 'r3',
  13: 'rb4', 14: 'bb4', 15: 'rb5', 16: 'bb5',
  17: 'r4', 18: 'b4', 19: 'b5', 20: 'r5'
};

export const OBJECTIVE_LABELS: { [key: string]: string } = {
  'lvl1': '🔥 LEVEL 1 (0-1:00)',
  'dragon1': 'Dragão 1', 'horde': 'Vastilarvas', 'dragon2': 'Dragão 2', 'riftherald': 'Arauto',
  'dragon3': 'Dragão 3', 'dragon4': 'Dragão 4', 'BARON_NASHOR': 'Barão Nashor', 'dragon5': 'Ancião/D5'
};

const BASE_ICON_URL = "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons";
const BASE_ANNOUNCE_URL = "https://raw.communitydragon.org/latest/game/assets/ux/announcements";

export const OBJECTIVE_ASSETS: { [key: string]: { icon: string, hover: string } } = {
  'lvl1': { icon: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/3340.png`, hover: '' },
  'dragon1': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon2': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon3': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon4': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/dragon_circle.png` },
  'dragon5': { icon: `${BASE_ICON_URL}/dragon.png`, hover: `${BASE_ANNOUNCE_URL}/elder_circle.png` },
  'horde': { icon: `${BASE_ICON_URL}/grub.png`, hover: `${BASE_ANNOUNCE_URL}/sru_voidgrub_circle.png` },
  'riftherald': { icon: `${BASE_ICON_URL}/riftherald.png`, hover: `${BASE_ANNOUNCE_URL}/sruriftherald_circle.png` },
  'BARON_NASHOR': { icon: `${BASE_ICON_URL}/baron.png`, hover: `${BASE_ANNOUNCE_URL}/baron_circle.png` },
};

export const ORDERED_OBJECTIVES = ['lvl1', 'dragon1', 'horde', 'dragon2', 'riftherald', 'dragon3', 'dragon4', 'BARON_NASHOR', 'dragon5'];

export function normalizeTournamentScope(rawName: string | null): string {
  const name = String(rawName || '').toUpperCase();
  if (name.includes('SCRIM')) return 'SCRIM';
  if (name.includes('CBLOL') && (name.includes('ACADEMY') || name.includes('DESAFIANTE'))) return 'CIRCUITO DESAFIANTE';
  if (name.includes('CIRCUITO DESAFIANTE') || name.includes('LIGA IGNIS')) return 'CIRCUITO DESAFIANTE';
  if (name.includes('LCK') && (name.includes('CHALLENGERS') || name.includes(' CL'))) return 'LCK CHALLENGERS';
  if (name.includes('LCS') && (name.includes('CHALLENGERS') || name.includes('NACL'))) return 'LCS CHALLENGERS';
  if (name.includes('EMEA') && name.includes('MASTERS')) return 'EMEA MASTERS';
  
  if (name.includes('CBLOL') && name.includes('CUP')) return 'CBLOL CUP';
  if (name.includes('LCK') && name.includes('CUP')) return 'LCK CUP';
  if (name.includes('LCS') && name.includes('CUP')) return 'LCS CUP';
  if (name.includes('LEC') && name.includes('CUP')) return 'LEC CUP';

  if (name.includes('CBLOL')) return 'CBLOL';
  if (name.includes('LCK')) return 'LCK';
  if (name.includes('LCS')) return 'LCS';
  if (name.includes('LEC')) return 'LEC';
  if (name.includes('LPL')) return 'LPL';

  if (name.includes('EWC') && (name.includes('QUALIFIER') || name.includes('CLOSED') || name.includes('OPEN') || name.includes('CQ'))) return 'EWC QUALIFIER';
  if (name.includes('EWC') || name.includes('ESPORTS WORLD CUP')) return 'EWC';
  if (name.includes('WORLD CUP') || name.includes('COPA DO MUNDO') || name.includes('NATIONS')) return 'WORLD CUP';
  if (name.includes('AMERICAS CUP')) return 'AMERICAS CUP';
  if (name.includes('FIRST STAND')) return 'FIRST STAND';
  if (name.includes('MSI') || name.includes('MID SEASON')) return 'MSI';
  if (name.includes('WORLDS') || name.includes('MUNDIAL')) return 'MUNDIAL';

  return 'OUTRO';
}

export function formatTime(decimal: number) {
  if (isNaN(decimal) || decimal === null) return "00:00";
  const mins = Math.floor(decimal);
  const secs = Math.round((decimal - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function normalizeChampName(name: string | null): string {
  if (!name) return 'unknown';
  let n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'wukong') return 'monkeyking';
  if (n === 'renataglasc') return 'renata';
  if (n.includes('nunu')) return 'nunu';
  return n;
}

export function sortPlayersByRole(playersArray: any[]) {
  return [...playersArray].sort((a, b) => {
    const roleA = normalizeRole(a.primary_role);
    const roleB = normalizeRole(b.primary_role);
    return ROLES_ORDER.indexOf(roleA) - ROLES_ORDER.indexOf(roleB);
  });
}

// Mantemos essas duas aqui pois elas usam o DDRAGON_VERSION 16.1.1 específico desta página
export function getChampionImageUrl(championName: string | null) {
  if (!championName || championName === '777') return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
  let sanitized = championName.replace(/['\s\.]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${sanitized}.png`;
}

export function getChampionSplashUrl(championName: string | null) {
  if (!championName || championName === '777' || String(championName).toLowerCase() === 'none' || String(championName).toLowerCase() === 'unknown') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/-1/-1.jpg'; 
  }
  let sanitized = String(championName).replace(/['\s\.,]/g, '');
  if (sanitized.toLowerCase() === 'wukong') sanitized = 'MonkeyKing';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sanitized}_0.jpg`;
}