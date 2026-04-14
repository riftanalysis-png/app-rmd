"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const DDRAGON_VERSION = '16.5.1';

// Triturador de strings para cruzar dados de views diferentes
function normalizeChampName(name: string | null): string {
  if (!name) return 'unknown';
  let n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'wukong') return 'monkeyking';
  if (n === 'renataglasc') return 'renata';
  if (n.includes('nunu')) return 'nunu';
  return n;
}

function normalizeRole(lane: string | null): string {
  if (!lane) return 'unknown';
  const l = lane.toLowerCase().trim();
  if (l.includes('top')) return 'top';
  if (l.includes('jungle') || l.includes('jng') || l.includes('jug') || l === 'jg') return 'jungle';
  if (l.includes('mid')) return 'mid';
  if (l.includes('bot') || l.includes('adc') || l.includes('bottom')) return 'adc';
  if (l.includes('sup') || l.includes('utility') || l.includes('spt')) return 'support';
  return 'unknown'; 
}

const getRoleIcon = (role: string) => {
  const normalized = normalizeRole(role);
  const mapping: Record<string, string> = {
    top: 'top', jungle: 'jungle', mid: 'middle', adc: 'bottom', support: 'utility'
  };
  const key = mapping[normalized] || 'middle';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${key}.png`;
};

const getObjectiveIcon = (key: string) => {
  const base = 'https://raw.communitydragon.org/latest/game/assets/ux/announcements/';
  const k = String(key || '').toLowerCase();

  if (k.includes('baron') || k.includes('nashor') || k.includes('barão')) return `${base}baron_circle.png`;
  if (k.includes('herald') || k.includes('arauto') || k.includes('rift') || k.includes('harold')) return `${base}sruriftherald_circle.png`;
  if (k.includes('grub') || k.includes('horde') || k.includes('larva')) return `${base}sru_voidgrub_circle.png`;
  if (k.includes('fire') || k.includes('infernal')) return `${base}dragon_circle_fire.png`;
  if (k.includes('water') || k.includes('ocean')) return `${base}dragon_circle_water.png`;
  if (k.includes('earth') || k.includes('mountain')) return `${base}dragon_circle_earth.png`;
  if (k.includes('air') || k.includes('cloud')) return `${base}dragon_circle_air.png`;
  if (k.includes('hextech')) return `${base}dragon_circle_hextech.png`;
  if (k.includes('chemtech')) return `${base}dragon_circle_chemtech.png`;
  
  return `${base}dragon_circle.png`; 
};

interface SelectedChampProps { name: string; lane: string; }

const MathSafe = (val: any) => Number(val) || 0;

const weightedAvg = (accAvg: any, accCount: any, currAvg: any, currCount: any) => {
  const v1 = MathSafe(accAvg); const w1 = MathSafe(accCount);
  const v2 = MathSafe(currAvg); const w2 = MathSafe(currCount);
  const total = w1 + w2;
  if (total === 0) return 0;
  return ((v1 * w1) + (v2 * w2)) / total;
};

export default function MetaWarRoom() {
  const [data, setData] = useState({ tiers: [], matchups: [], draft: [], bans: [], synergies: [], globalObjectives: [], goldStats: [] });
  
  const [globalTournament, setGlobalTournament] = useState("ALL");
  const [globalSplit, setGlobalSplit] = useState("ALL");

  const [viewMode, setViewMode] = useState<'CHAMPIONS' | 'OBJECTIVES'>('CHAMPIONS');
  const [championView, setChampionView] = useState<'TIER_LIST' | 'TRUST_INDEX' | 'META_MATRIX'>('TIER_LIST');
  const [selectedChamp, setSelectedChamp] = useState<SelectedChampProps | null>(null);
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'MATCHUPS' | 'SYNERGIES'>('DRAFT');
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState<string>('ALL');
  const [minGames, setMinGames] = useState<number>(5);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const buildQuery = (viewName: string) => {
         // A MÁGICA ESTÁ AQUI: .limit(50000) para forçar o download do banco inteiro
         let q = supabase.from(viewName).select('*').limit(50000); 
         
         if (globalTournament !== 'ALL') q = q.eq('game_type', globalTournament);
         if (globalSplit !== 'ALL') q = q.eq('split', globalSplit);
         return q;
      };

      const [t, m, d, b, s, gobj, gold] = await Promise.all([
        buildQuery('view_champion_tier_list_by_lane').order('power_score', { ascending: false }),
        buildQuery('view_champion_matchups_detailed'),
        buildQuery('view_meta_global_draft'),
        buildQuery('view_champion_ban_stats'),
        buildQuery('view_champion_synergies'),
        buildQuery('view_global_objective_impact'),
        supabase.from('objective_gold_efficiency').select('*') 
      ]);

      const aggTiers = Array.from((t.data || []).reduce((acc, curr) => {
          const lane = normalizeRole(curr.lane);
          const key = `${normalizeChampName(curr.champion)}_${lane}`;
          const pScore = MathSafe(curr.power_score);
          const tPicks = MathSafe(curr.total_picks);

          if (!acc.has(key)) acc.set(key, { ...curr, lane, power_score: pScore, total_picks: tPicks });
          else {
              const ex = acc.get(key);
              ex.power_score = weightedAvg(ex.power_score, ex.total_picks, pScore, tPicks);
              ex.total_picks += tPicks;
          }
          return acc;
      }, new Map()).values());

      const aggMatchups = Array.from((m.data || []).reduce((acc, curr) => {
          const lane = normalizeRole(curr.lane);
          const opponent = curr.opponent || 'Unknown';
          const key = `${normalizeChampName(curr.champion)}_${lane}_${normalizeChampName(opponent)}`;
          
          if (!acc.has(key)) acc.set(key, { ...curr, opponent, lane, total_matchups: MathSafe(curr.total_matchups) });
          else {
              const ex = acc.get(key);
              ex.win_rate = weightedAvg(ex.win_rate, ex.total_matchups, curr.win_rate, curr.total_matchups);
              ex.avg_kda_12 = weightedAvg(ex.avg_kda_12, ex.total_matchups, curr.avg_kda_12, curr.total_matchups);
              ex.avg_gold_diff_12 = weightedAvg(ex.avg_gold_diff_12, ex.total_matchups, curr.avg_gold_diff_12, curr.total_matchups);
              ex.avg_xp_diff_12 = weightedAvg(ex.avg_xp_diff_12, ex.total_matchups, curr.avg_xp_diff_12, curr.total_matchups);
              ex.avg_cs_diff_12 = weightedAvg(ex.avg_cs_diff_12, ex.total_matchups, curr.avg_cs_diff_12, curr.total_matchups);
              ex.avg_deaths_12 = weightedAvg(ex.avg_deaths_12, ex.total_matchups, curr.avg_deaths_12, curr.total_matchups);
              ex.total_matchups += MathSafe(curr.total_matchups);
          }
          return acc;
      }, new Map()).values());

      const aggDrafts = Array.from((d.data || []).reduce((acc, curr) => {
          const lane = normalizeRole(curr.lane);
          const dbSide = String(curr.side || '').toLowerCase();
          const key = `${normalizeChampName(curr.champion)}_${lane}_${dbSide}_${curr.sequence}`;
          if (!acc.has(key)) acc.set(key, { ...curr, lane, total_picks: MathSafe(curr.total_picks) });
          else {
              const ex = acc.get(key);
              ex.win_rate = weightedAvg(ex.win_rate, ex.total_picks, curr.win_rate, curr.total_picks);
              ex.total_picks += MathSafe(curr.total_picks);
          }
          return acc;
      }, new Map()).values());

      const aggBans = Array.from((b.data || []).reduce((acc, curr) => {
          const key = normalizeChampName(curr.champion);
          if (!acc.has(key)) acc.set(key, { ...curr, total_bans: MathSafe(curr.total_bans), blue_bans: MathSafe(curr.blue_bans), red_bans: MathSafe(curr.red_bans) });
          else {
              const ex = acc.get(key);
              ex.total_bans += MathSafe(curr.total_bans);
              ex.blue_bans += MathSafe(curr.blue_bans);
              ex.red_bans += MathSafe(curr.red_bans);
          }
          return acc;
      }, new Map()).values());

      const aggSynergies = Array.from((s.data || []).reduce((acc, curr) => {
          const lane = normalizeRole(curr.lane);
          const aLane = normalizeRole(curr.ally_lane);
          const ally = curr.ally || 'Unknown';
          const key = `${normalizeChampName(curr.champion)}_${lane}_${normalizeChampName(ally)}_${aLane}`;
          
          if (!acc.has(key)) acc.set(key, { ...curr, ally, lane, ally_lane: aLane, total_games: MathSafe(curr.total_games) });
          else {
              const ex = acc.get(key);
              ex.win_rate = weightedAvg(ex.win_rate, ex.total_games, curr.win_rate, curr.total_games);
              ex.total_games += MathSafe(curr.total_games);
          }
          return acc;
      }, new Map()).values());

      const aggObjectives = Array.from((gobj.data || []).reduce((acc, curr) => {
          const type = String(curr.objective_type || '').trim().toUpperCase();
          const sub = String(curr.subtype || '').trim().toUpperCase();
          const key = `${type}_${sub}`; 
          
          if (!acc.has(key)) acc.set(key, { ...curr, win_rate: MathSafe(curr.win_rate), times_achieved: MathSafe(curr.times_achieved) });
          else {
              const ex = acc.get(key);
              ex.win_rate = weightedAvg(ex.win_rate, ex.times_achieved, curr.win_rate, curr.times_achieved);
              ex.times_achieved += MathSafe(curr.times_achieved);
          }
          return acc;
      }, new Map()).values());

      setData({ 
        tiers: aggTiers as any, 
        matchups: aggMatchups as any, 
        draft: aggDrafts as any, 
        bans: aggBans as any, 
        synergies: aggSynergies as any, 
        globalObjectives: aggObjectives as any,
        goldStats: gold.data || []
      });
      setLoading(false);
    }
    fetchData();
  }, [globalTournament, globalSplit]);

  const filteredTiers = useMemo(() => {
    const target = normalizeRole(activeLane);
    const list = data.tiers.filter((c: any) => (activeLane === 'ALL' || normalizeRole(c.lane) === target) && c.total_picks >= minGames);
    list.sort((a: any, b: any) => b.power_score - a.power_score);

    const total = list.length;
    if (total === 0) return { S: [], A: [], B: [], C: [] };

    const sCount = Math.max(1, Math.ceil(total * 0.05));
    const aCount = Math.max(1, Math.ceil(total * 0.15));
    const bCount = Math.max(1, Math.ceil(total * 0.30));

    return {
      S: list.slice(0, sCount),
      A: list.slice(sCount, sCount + aCount),
      B: list.slice(sCount + aCount, sCount + aCount + bCount),
      C: list.slice(sCount + aCount + bCount)
    };
  }, [data.tiers, activeLane, minGames]);

  const trustIndexList = useMemo(() => {
    const target = normalizeRole(activeLane);
    const baseMin = Math.max(10, minGames);
    const list = data.tiers.filter((c: any) => (activeLane === 'ALL' || normalizeRole(c.lane) === target) && c.total_picks >= baseMin);

    return list.map((c: any) => {
      const trust_score = c.power_score * Math.log10(c.total_picks + 1);
      return { ...c, trust_score };
    }).sort((a: any, b: any) => b.trust_score - a.trust_score).slice(0, 20); 
  }, [data.tiers, activeLane, minGames]);

  const metaMatrix = useMemo(() => {
    const target = normalizeRole(activeLane);
    const list = data.tiers.filter((c: any) => (activeLane === 'ALL' || normalizeRole(c.lane) === target) && c.total_picks >= minGames);

    if (list.length === 0) return { op: [], sleeper: [], trap: [], weak: [] };

    const sortedPicks = [...list].sort((a, b) => a.total_picks - b.total_picks);
    const sortedScores = [...list].sort((a, b) => a.power_score - b.power_score);

    const midPick = sortedPicks[Math.floor(list.length / 2)]?.total_picks || 0;
    const midScore = sortedScores[Math.floor(list.length / 2)]?.power_score || 0;

    return {
       op: list.filter(c => c.total_picks >= midPick && c.power_score >= midScore).sort((a, b) => b.power_score - a.power_score),
       sleeper: list.filter(c => c.total_picks < midPick && c.power_score >= midScore).sort((a, b) => b.power_score - a.power_score),
       trap: list.filter(c => c.total_picks >= midPick && c.power_score < midScore).sort((a, b) => a.total_picks - b.total_picks), 
       weak: list.filter(c => c.total_picks < midPick && c.power_score < midScore).sort((a, b) => a.power_score - b.power_score)
    };
  }, [data.tiers, activeLane, minGames]);

  // CORREÇÃO: Limpando a sujeira e voltando ao clássico Blue/Red com B1-B5 cravado
  const champDraft = useMemo(() => {
    if (!selectedChamp) return { blue: [], red: [] };
    const cName = normalizeChampName(selectedChamp.name);
    
    const rawDraft = data.draft.filter((x: any) => normalizeChampName(x.champion) === cName);
    const laneDraft = rawDraft.filter((x: any) => normalizeRole(x.lane) === normalizeRole(selectedChamp.lane));
    const draftToUse = laneDraft.length > 0 ? laneDraft : rawDraft;

    // Filtro IMPLACÁVEL: Se não for de 7 a 20, joga no lixo para não aparecer "P0"
    const validDrafts = draftToUse.filter((d: any) => [7, 8, 9, 10, 11, 12, 17, 18, 19, 20].includes(Number(d.sequence)));

    const seqMap: Record<number, { label: string, isBlue: boolean }> = {
      7: { label: 'B1', isBlue: true }, 10: { label: 'B2', isBlue: true }, 11: { label: 'B3', isBlue: true }, 18: { label: 'B4', isBlue: true }, 19: { label: 'B5', isBlue: true },
      8: { label: 'R1', isBlue: false }, 9: { label: 'R2', isBlue: false }, 12: { label: 'R3', isBlue: false }, 17: { label: 'R4', isBlue: false }, 20: { label: 'R5', isBlue: false }
    };

    const aggregated = validDrafts.reduce((acc: any, d: any) => {
      const seq = Number(d.sequence);
      const mapped = seqMap[seq];
      
      if (!acc[mapped.label]) {
        acc[mapped.label] = { ...d, safeLabel: mapped.label, isBlue: mapped.isBlue, sequence: seq, total_picks: MathSafe(d.total_picks), win_rate: MathSafe(d.win_rate) };
      } else {
        acc[mapped.label].win_rate = weightedAvg(acc[mapped.label].win_rate, acc[mapped.label].total_picks, d.win_rate, d.total_picks);
        acc[mapped.label].total_picks += MathSafe(d.total_picks);
      }
      return acc;
    }, {});

    const cleanDraft = Object.values(aggregated);

    return {
      blue: cleanDraft.filter((d: any) => d.isBlue).sort((a: any, b: any) => a.sequence - b.sequence),
      red: cleanDraft.filter((d: any) => !d.isBlue).sort((a: any, b: any) => a.sequence - b.sequence)
    };
  }, [selectedChamp, data.draft]);

  const champMatchups = useMemo(() => {
    if (!selectedChamp) return [];
    const cName = normalizeChampName(selectedChamp.name);
    const cLane = normalizeRole(selectedChamp.lane);

    let matches = data.matchups.filter((m: any) =>
       normalizeChampName(m.champion) === cName && normalizeRole(m.lane) === cLane
    );

    if (matches.length === 0) {
       matches = data.matchups.filter((m: any) => normalizeChampName(m.champion) === cName);
    }

    return matches.sort((a: any, b: any) => b.total_matchups - a.total_matchups);
  }, [selectedChamp, data.matchups]);

  const champSynergies = useMemo(() => {
    if (!selectedChamp) return [];
    const cName = normalizeChampName(selectedChamp.name);
    const cLane = normalizeRole(selectedChamp.lane);

    let syns = data.synergies.filter((s: any) =>
       normalizeChampName(s.champion) === cName && normalizeRole(s.lane) === cLane
    );

    if (syns.length === 0) {
       syns = data.synergies.filter((s: any) => normalizeChampName(s.champion) === cName);
    }

    return syns.sort((a: any, b: any) => b.win_rate !== a.win_rate ? b.win_rate - a.win_rate : b.total_games - a.total_games).slice(0, 15);
  }, [selectedChamp, data.synergies]);

  const champBans = useMemo(() => {
    if (!selectedChamp) return null;
    const cName = normalizeChampName(selectedChamp.name);
    return data.bans.find((b: any) => normalizeChampName(b.champion) === cName);
  }, [selectedChamp, data.bans]);

  const pickProfile = useMemo(() => {
    if (!selectedChamp) return null;
    const allDrafts = [...champDraft.blue, ...champDraft.red];
    let blindPicks = 0; let counterPicks = 0; 
    
    allDrafts.forEach((d: any) => {
      const seq = d.sequence;
      if ([7, 8, 9, 10, 11].includes(seq)) blindPicks += d.total_picks;
      else if ([12, 17, 18, 19, 20].includes(seq)) counterPicks += d.total_picks;
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
      { key: 'herald', terms: ['herald', 'arauto', 'rift', 'harold'] },
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
      const nameMatch = matcher.terms.some(term => String(row.objective_name).toLowerCase().includes(term) || String(row.category).toLowerCase().includes(term));
      const stackMatch = matcher.stacks ? row.stacks === matcher.stacks : true;
      const stackMatchFallback = (iconKey === 'grubs_3' && row.stacks >= 3);
      return nameMatch && (stackMatch || stackMatchFallback);
    });
  };

  const getObjSafe = (keywords: string[], excludeKeyword?: string) => {
    const obj = data.globalObjectives.find((row: any) => {
       const t = String(row.objective_type || row.objective_name || '').toLowerCase();
       const s = String(row.subtype || row.icon_key || '').toLowerCase();
       const combined = `${t} ${s}`;
       
       if (excludeKeyword && combined.includes(excludeKeyword.toLowerCase())) return false;
       return keywords.some(kw => combined.includes(kw));
    });

    if (!obj) return null;
    const delta = MathSafe(obj.win_rate) - 50;
    const iconKey = keywords[0]; 
    const goldInfo = findGoldValue(iconKey, data.goldStats);
    
    return { ...obj, delta, isTrap: delta < 0, gold: goldInfo?.gold_value_team, icon_key: iconKey };
  };
  
  const heraldData = getObjSafe(['herald', 'arauto', 'riftharold', 'harold', 'riftherald']);
  const bBase = getObjSafe(['baron', 'nashor', 'barão'], 'counts');
  const baronData = bBase ? {
     ...bBase,
     elements: [1, 2, 3, 4, 5].map(num => {
        const obj = data.globalObjectives.find((row: any) => 
           String(row.objective_type).toUpperCase() === 'BARON_COUNTS' &&
           String(row.subtype).toLowerCase() === `barons_${num}`
        );
        if (!obj) return null;
        return { 
          key: `barons_${num}`, 
          label: `${num} BARÃO${num > 1 ? 'S' : ''}`, 
          color: 'text-purple-400', 
          win_rate: MathSafe(obj.win_rate), 
          count: MathSafe(obj.times_achieved) 
        };
     }).filter(Boolean)
  } : null;
  
  const fDrakeBase = getObjSafe(['dragon1']);
  const firstDragonData = fDrakeBase ? {
     ...fDrakeBase,
     elements: [
       { key: 'fire', label: 'Fogo', color: 'text-red-400' },
       { key: 'water', label: 'Água', color: 'text-blue-400' },
       { key: 'earth', label: 'Montanha', color: 'text-amber-600' },
       { key: 'air', label: 'Nuvens', color: 'text-cyan-200' },
       { key: 'hextech', label: 'Hextech', color: 'text-purple-400' },
       { key: 'chemtech', label: 'Quimtec', color: 'text-emerald-400' }
     ].map(el => {
        const obj = data.globalObjectives.find((row: any) => 
           String(row.objective_type).toUpperCase() === 'FIRST_DRAGON_ELEMENT' &&
           (String(row.subtype).toLowerCase().includes(el.key) || String(row.subtype).toLowerCase().includes(el.label.toLowerCase()) || String(row.subtype).toLowerCase().includes('infernal') || String(row.subtype).toLowerCase().includes('ocean'))
        );
        if (!obj) return null;
        return { ...el, win_rate: MathSafe(obj.win_rate), count: MathSafe(obj.times_achieved) };
     }).filter(Boolean).sort((a: any, b: any) => b.win_rate - a.win_rate)
  } : null;
  
  const getGrubs = () => {
    return [1, 2, 3, 4, 5, 6].map(num => {
      const obj = getObjSafe([`grubs_${num}`]);
      if (!obj) return null;
      return {
         ...obj,
         objective_name: `${num} VASTILARVA${num > 1 ? 'S' : ''}`,
         icon_key: `grubs_${num}`
      };
    }).filter(Boolean);
  };
  const grubsData = getGrubs();

  const getGenericSoul = () => {
     const allSouls = data.globalObjectives.filter((row: any) => {
         const t = String(row.objective_type || row.objective_name || '').toLowerCase();
         const s = String(row.subtype || row.icon_key || '').toLowerCase();
         return t.includes('soul') || s.includes('soul') || t.includes('alma') || s.includes('alma');
     });
     
     if (allSouls.length === 0) return null;

     const totalAchieved = allSouls.reduce((acc: number, curr: any) => acc + MathSafe(curr.times_achieved), 0);
     const avgWr = allSouls.reduce((acc: number, curr: any) => acc + (MathSafe(curr.win_rate) * MathSafe(curr.times_achieved)), 0) / (totalAchieved || 1);
     const delta = avgWr - 50;

     return {
        objective_name: 'ALMA DO DRAGÃO GERAL',
        icon_key: 'soul',
        times_achieved: totalAchieved,
        win_rate: avgWr,
        delta,
        isTrap: delta < 0,
        gold: findGoldValue('soul', data.goldStats)?.gold_value_team || 0
     };
  };
  const soulData = getGenericSoul();
  
  const elementalData = [
    { key: 'fire', terms: ['fire', 'infernal'] },
    { key: 'water', terms: ['water', 'ocean'] },
    { key: 'earth', terms: ['earth', 'mountain'] },
    { key: 'air', terms: ['air', 'cloud'] },
    { key: 'hextech', terms: ['hextech'] },
    { key: 'chemtech', terms: ['chemtech', 'quimtec'] }
  ].map(elem => {
     
     const baseDrake = data.globalObjectives.find((row: any) => {
        const t = String(row.objective_type || row.objective_name || '').toLowerCase();
        const s = String(row.subtype || row.icon_key || '').toLowerCase();
        const combined = `${t} ${s}`;
        
        const isDragon = combined.includes('dragon') || combined.includes('dragão');
        const isSoul = combined.includes('soul') || combined.includes('alma');
        const hasElement = elem.terms.some(term => combined.includes(term));
        
        return isDragon && !isSoul && hasElement;
     });

     if (!baseDrake) return null;
     
     const soulDrakObj = data.globalObjectives.find((row: any) => {
        const t = String(row.objective_type || row.objective_name || '').toLowerCase();
        const s = String(row.subtype || row.icon_key || '').toLowerCase();
        const combined = `${t} ${s}`;
        
        const isSoul = combined.includes('soul') || combined.includes('alma');
        const hasElement = elem.terms.some(term => combined.includes(term));
        
        return isSoul && hasElement;
     });

     const delta = MathSafe(baseDrake.win_rate) - 50;
     const drakeGold = findGoldValue(elem.key, data.goldStats)?.gold_value_team;
     
     const soulGoldInfo = findGoldValue(`${elem.key}_soul`, data.goldStats);
     const soulStat = {
       win_rate: soulDrakObj ? MathSafe(soulDrakObj.win_rate) : 0,
       times_achieved: soulDrakObj ? MathSafe(soulDrakObj.times_achieved) : 0,
       delta: soulDrakObj ? MathSafe(soulDrakObj.win_rate) - 50 : 0,
       isTrap: soulDrakObj ? (MathSafe(soulDrakObj.win_rate) - 50 < 0) : false,
       gold: soulGoldInfo?.gold_value_team || null,
       hasData: !!soulDrakObj
     };

     return { 
       ...baseDrake, 
       objective_name: `DRAGÃO ${elem.key.toUpperCase()}`,
       icon_key: elem.key, 
       delta, 
       isTrap: delta < 0, 
       gold: drakeGold,
       soulStat 
     };
  }).filter(Boolean).sort((a: any, b: any) => b.win_rate - a.win_rate);

  if (loading && data.tiers.length === 0) return <div className="flex items-center justify-center h-screen text-purple-500 font-black text-2xl animate-pulse italic uppercase tracking-[0.2em]">RMD ANALYTICS: INICIANDO PROTOCOLOS...</div>;

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 p-4 md:p-8 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="flex flex-wrap items-center justify-between gap-6 mb-12 border-b border-white/5 pb-6 sticky top-0 bg-[#121212]/95 backdrop-blur-xl z-50 pt-4 -mx-4 px-4 md:-mx-8 md:px-8">
        
        <div className="flex flex-col border-l-4 border-purple-500 pl-4 justify-center shrink-0">
          <h1 className="text-3xl lg:text-4xl leading-none text-white">META WAR ROOM</h1>
          <p className="text-purple-400 text-[9px] tracking-[0.4em] mt-1">High Fidelity Scouting</p>
        </div>
        
        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-6 flex-1">
          
          <div className="flex gap-4 items-center bg-transparent shrink-0">
             <TournamentSelector value={globalTournament} onChange={setGlobalTournament} />
             <SplitSelector value={globalSplit} onChange={setGlobalSplit} />
          </div>

          {viewMode === 'CHAMPIONS' && !selectedChamp && (
            <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-right-4 shrink-0">
              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 items-center shadow-inner">
                 {[1, 5, 10, 20].map(n => <button key={n} onClick={() => setMinGames(n)} className={`w-8 h-8 rounded-xl text-[10px] transition-all ${minGames === n ? 'bg-white text-black shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}>{n}</button>)}
              </div>
              <div className="flex bg-black/30 p-1 rounded-3xl border border-white/5 shadow-inner items-center">
                {['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUP'].map(l => (
                  <button key={l} onClick={() => {setActiveLane(l); setSelectedChamp(null);}} className={`px-3 py-2 rounded-2xl text-[9px] flex items-center gap-1.5 transition-all ${activeLane === l ? 'bg-slate-800 text-white shadow-md border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}>
                    {l !== 'ALL' && <img src={getRoleIcon(l)} className="w-3.5 h-3.5 brightness-200" alt="" />}
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex bg-black/50 p-1.5 rounded-3xl border border-white/5 shadow-2xl shrink-0 xl:ml-auto">
            <button onClick={() => {setViewMode('CHAMPIONS'); setSelectedChamp(null);}} className={`px-6 py-2.5 rounded-2xl text-[10px] tracking-widest transition-all ${viewMode === 'CHAMPIONS' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              CHAMPION META
            </button>
            <button onClick={() => {setViewMode('OBJECTIVES'); setSelectedChamp(null);}} className={`px-6 py-2.5 rounded-2xl text-[10px] tracking-widest transition-all ${viewMode === 'OBJECTIVES' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              MACRO INTEL
            </button>
          </div>

        </div>
      </header>

      {/* VIEW: MACRO OBJECTIVES (MANTIDA INTACTA) */}
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
              {baronData && <EnderHeroCard obj={baronData} title="BARÃO NASHOR" accent="purple" subElements={baronData.elements} />}
              {soulData && <EnderHeroCard obj={soulData} title={soulData.objective_name} accent="red" />}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
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
                          <p className={`text-3xl font-black italic leading-none ${obj.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{Math.round(obj.win_rate)}%</p>
                          {obj.gold && <GoldBadge gold={obj.gold} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`grid grid-cols-1 ${heraldData && firstDragonData ? 'md:grid-cols-2' : ''} gap-8 shrink-0`}>
                {heraldData && <CompactMacroCard obj={heraldData} title="ARAUTO DO VALE" />}
                {firstDragonData && <CompactMacroCard obj={firstDragonData} title="PRIMEIRO DRAGÃO" subElements={firstDragonData.elements} />}
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
                                 <p className={`text-xl font-black italic leading-none ${obj.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{Math.round(obj.win_rate)}%</p>
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
                                    <p className={`text-xl font-black italic leading-none ${obj.soulStat.isTrap ? 'text-orange-400' : 'text-emerald-400'}`}>{Math.round(obj.soulStat.win_rate)}%</p>
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

      {/* VIEW: CHAMPION META */}
      {viewMode === 'CHAMPIONS' && (
        <div className="animate-in fade-in duration-500">
          
          {!selectedChamp && (
            <>
              {/* LENS SELECTOR SUB-MENU */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-8">
                <button onClick={() => setChampionView('TIER_LIST')} className={`px-5 py-2.5 rounded-xl text-[9px] tracking-[0.2em] transition-all border ${championView === 'TIER_LIST' ? 'bg-purple-600/20 text-purple-400 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'}`}>
                  PERCENTILE TIER LIST
                </button>
                <button onClick={() => setChampionView('TRUST_INDEX')} className={`px-5 py-2.5 rounded-xl text-[9px] tracking-[0.2em] transition-all border ${championView === 'TRUST_INDEX' ? 'bg-blue-600/20 text-blue-400 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'}`}>
                  TRUST INDEX (BLINDS)
                </button>
                <button onClick={() => setChampionView('META_MATRIX')} className={`px-5 py-2.5 rounded-xl text-[9px] tracking-[0.2em] transition-all border ${championView === 'META_MATRIX' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'}`}>
                  META MATRIX
                </button>
              </div>

              {/* LENS 1: TIER LIST */}
              {championView === 'TIER_LIST' && (
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
                        )) : <p className="text-[9px] text-slate-800 flex items-center font-black">AMOSTRAGEM INSUFICIENTE PARA O CORTE</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LENS 2: TRUST INDEX */}
              {championView === 'TRUST_INDEX' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                  {trustIndexList.length > 0 ? trustIndexList.map((c: any, idx: number) => (
                    <button 
                      key={`${c.champion}-${c.lane}`} 
                      onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }}
                      className="bg-slate-950/50 border border-slate-800 p-5 rounded-[24px] hover:border-blue-500/50 hover:bg-slate-900 transition-all text-left flex items-center gap-5 group"
                    >
                      <div className="relative shrink-0">
                        <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-14 h-14 rounded-2xl border border-slate-700 group-hover:border-blue-500 transition-all" alt="" />
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-blue-400">
                          #{idx + 1}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-1">
                          <p className="text-xl text-white italic leading-none">{c.champion}</p>
                          <img src={getRoleIcon(c.lane)} className="w-3.5 h-3.5 brightness-200 opacity-50" alt="" />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                           <p className="text-[9px] text-slate-500 tracking-widest">{c.total_picks} JOGOS</p>
                           <p className="text-[12px] text-blue-400 font-mono">{Math.round(c.power_score)} SC</p>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="col-span-full py-20 text-center border border-dashed border-slate-800 rounded-3xl text-slate-600 text-[10px] tracking-widest">
                      AMOSTRAGEM DE JOGOS INSUFICIENTE PARA ESTABELECER CONFIANÇA MATEMÁTICA.
                    </div>
                  )}
                </div>
              )}

              {/* LENS 3: META MATRIX */}
              {championView === 'META_MATRIX' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* OP (Top-Right) */}
                  <div className="bg-emerald-950/10 border border-emerald-900/30 p-6 rounded-[32px]">
                    <div className="flex justify-between items-center mb-6 border-b border-emerald-900/30 pb-4">
                       <h3 className="text-2xl text-emerald-500 italic">PILARES OP</h3>
                       <p className="text-[8px] text-emerald-600/50 tracking-widest">ALTA PRESENÇA • ALTO SCORE</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {metaMatrix.op.length > 0 ? metaMatrix.op.map((c: any) => (
                        <button key={`${c.champion}-${c.lane}`} onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }} className="relative hover:scale-105 transition-transform">
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-12 h-12 rounded-xl border border-emerald-700/50" alt="" />
                        </button>
                      )) : <p className="text-[9px] text-emerald-800">VAZIO</p>}
                    </div>
                  </div>

                  {/* SLEEPER (Top-Left) */}
                  <div className="bg-purple-950/10 border border-purple-900/30 p-6 rounded-[32px]">
                    <div className="flex justify-between items-center mb-6 border-b border-purple-900/30 pb-4">
                       <h3 className="text-2xl text-purple-400 italic">SLEEPERS / POCKETS</h3>
                       <p className="text-[8px] text-purple-600/50 tracking-widest">BAIXA PRESENÇA • ALTO SCORE</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {metaMatrix.sleeper.length > 0 ? metaMatrix.sleeper.map((c: any) => (
                        <button key={`${c.champion}-${c.lane}`} onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }} className="relative hover:scale-105 transition-transform">
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-12 h-12 rounded-xl border border-purple-700/50" alt="" />
                        </button>
                      )) : <p className="text-[9px] text-purple-800">VAZIO</p>}
                    </div>
                  </div>

                  {/* WEAK (Bottom-Left) */}
                  <div className="bg-slate-900/20 border border-slate-800/50 p-6 rounded-[32px]">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-800/50 pb-4">
                       <h3 className="text-2xl text-slate-500 italic">WEAK / OUT OF META</h3>
                       <p className="text-[8px] text-slate-600/50 tracking-widest">BAIXA PRESENÇA • BAIXO SCORE</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {metaMatrix.weak.length > 0 ? metaMatrix.weak.map((c: any) => (
                        <button key={`${c.champion}-${c.lane}`} onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }} className="relative hover:scale-105 transition-transform opacity-50 hover:opacity-100">
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-10 h-10 rounded-xl border border-slate-700/50 grayscale hover:grayscale-0" alt="" />
                        </button>
                      )) : <p className="text-[9px] text-slate-800">VAZIO</p>}
                    </div>
                  </div>

                  {/* TRAPS (Bottom-Right) */}
                  <div className="bg-orange-950/10 border border-orange-900/30 p-6 rounded-[32px]">
                    <div className="flex justify-between items-center mb-6 border-b border-orange-900/30 pb-4">
                       <h3 className="text-2xl text-orange-500 italic">TRAPS / OVERRATED</h3>
                       <p className="text-[8px] text-orange-600/50 tracking-widest">ALTA PRESENÇA • BAIXO SCORE</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {metaMatrix.trap.length > 0 ? metaMatrix.trap.map((c: any) => (
                        <button key={`${c.champion}-${c.lane}`} onClick={() => { setSelectedChamp({ name: c.champion, lane: c.lane }); setActiveTab('DRAFT'); }} className="relative hover:scale-105 transition-transform">
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.champion}.png`} className="w-12 h-12 rounded-xl border border-orange-700/50" alt="" />
                        </button>
                      )) : <p className="text-[9px] text-orange-800">VAZIO</p>}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

          {/* PERFIL DO CAMPEÃO */}
          {selectedChamp && pickProfile && (
            <div className="bg-slate-900/40 border border-purple-500/20 rounded-[48px] p-8 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
              
              <button onClick={() => setSelectedChamp(null)} className="mb-8 flex items-center gap-2 text-[10px] text-slate-400 hover:text-white uppercase tracking-widest transition-colors bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700 hover:border-slate-500 w-max">
                <span className="text-lg leading-none mb-0.5">←</span> VOLTAR PARA LENTES
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
                      {champMatchups.map((m: any, idx: number) => (
                        <div key={`${m.opponent}-${idx}`} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[32px] hover:border-purple-500/30 transition-all shadow-xl">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-4 text-white">
                              {m.opponent !== 'Unknown' ? (
                                <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${m.opponent}.png`} className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700" alt="" />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-[10px] text-slate-500">?</div>
                              )}
                              <div><p className="text-lg font-black italic leading-none">{m.opponent}</p><p className={`text-[10px] font-black mt-1 ${m.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(m.win_rate)}% WR</p></div>
                            </div>
                            <div className="text-right text-purple-400 font-black italic"><p className="text-[7px] text-slate-600 uppercase">KDA @12</p><p className="text-xl">{Number(m.avg_kda_12 || 0).toFixed(1)}</p></div>
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
                      {champSynergies.map((s: any, idx: number) => (
                        <div key={`${s.ally}-${s.ally_lane}-${idx}`} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[32px] hover:border-blue-500/30 transition-all shadow-xl flex items-center justify-between">
                          <div className="flex items-center gap-4 text-white">
                            <div className="relative">
                              {s.ally !== 'Unknown' ? (
                                <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${s.ally}.png`} className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700" alt="" />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl shadow-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-[10px] text-slate-500">?</div>
                              )}
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
                            <p className={`text-2xl font-black italic ${s.win_rate >= 50 ? 'text-blue-400' : 'text-slate-500'}`}>{Math.round(s.win_rate)}%</p>
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
// COMPONENTES AUXILIARES (MANTIDOS INTACTOS)
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
  const numDelta = Number(delta) || 0;
  const isPos = numDelta >= 0;
  return (
    <div className={`flex items-baseline gap-1 border px-2 py-0.5 rounded-md shadow-sm ${isPos ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
      <span className="text-[8px] uppercase tracking-widest">Δ</span>
      <span className="text-[10px] font-mono leading-none">{isPos ? '+' : ''}{numDelta.toFixed(1)}%</span>
    </div>
  )
}

function EnderHeroCard({ obj, title, accent, subElements }: { obj: any, title: string, accent: string, subElements?: any[] }) {
  const isHigh = obj.win_rate >= 60;
  const isLow = obj.win_rate < 50;
  const ringColor = accent === 'purple' ? 'hover:ring-purple-500/40' : 'hover:ring-red-500/40';

  return (
    <div className={`bg-slate-900/40 border border-slate-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group transition-all ${ringColor} flex flex-col h-full`}>
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

      <div className="flex items-end justify-between relative z-10 mt-auto">
        <div>
          <p className={`text-7xl font-black italic leading-none ${isHigh ? 'text-emerald-400' : isLow ? 'text-orange-400' : 'text-blue-400'}`}>{Math.round(obj.win_rate)}%</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Win Rate Absoluto</p>
        </div>
        <div className="pb-2">
          <ImpactDeltaBadge delta={obj.delta} />
        </div>
      </div>

       {subElements && subElements.length > 0 && (
         <div className="mt-6 pt-5 border-t border-slate-800/50 relative z-10">
           <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-3">WR POR QUANTIDADE DE BARÕES NO JOGO</p>
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
             {subElements.map(el => (
               <div key={el.key} className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-800/60">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${el.color}`}>{el.label}</span>
                  <div className="text-right leading-none">
                    <p className="text-[11px] text-white font-mono italic font-black">{Math.round(el.win_rate)}%</p>
                    <p className="text-[7px] text-slate-500 mt-0.5">{el.count}x</p>
                  </div>
               </div>
             ))}
           </div>
         </div>
       )}
    </div>
  );
}

function CompactMacroCard({ obj, title, subElements }: { obj: any, title: string, subElements?: any[] }) {
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
           <p className={`text-4xl font-black italic leading-none ${obj.win_rate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{Math.round(obj.win_rate)}%</p>
           <p className="text-[8px] text-slate-600 uppercase tracking-widest mt-1">Win Rate Geral</p>
         </div>
       </div>

       {subElements && subElements.length > 0 && (
         <div className="mt-6 pt-5 border-t border-slate-800/50">
           <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-3">WR POR ELEMENTO (1º DRAGÃO)</p>
           <div className="grid grid-cols-2 gap-2">
             {subElements.map(el => (
               <div key={el.key} className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-800/60">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${el.color}`}>{el.label}</span>
                  <div className="text-right leading-none">
                    <p className="text-[11px] text-white font-mono italic font-black">{Math.round(el.win_rate)}%</p>
                    <p className="text-[7px] text-slate-500 mt-0.5">{el.count}x</p>
                  </div>
               </div>
             ))}
           </div>
         </div>
       )}
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
            <p className={`text-2xl ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(d.win_rate)}%</p>
          </div>
        )) : <p className={`text-[9px] text-slate-700 italic py-2 ${isBlue ? '' : 'text-right'}`}>SEM DADOS NO DRAFT</p>}
      </div>
    </div>
  );
}

function MatchupStat({ label, val, isDiff = false, color = "text-white", isBadHigh = false }: any) {
  const numVal = Number(val || 0);
  const isPos = numVal > 0;
  let finalColor = color;
  if (isDiff) { finalColor = isPos ? 'text-blue-400' : 'text-red-500'; }
  else if (isBadHigh) { finalColor = numVal >= 1 ? "text-red-500" : "text-emerald-400"; }

  return (
    <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800 text-center transition-all hover:bg-slate-800/40 font-black italic">
      <p className="text-[7px] text-slate-600 uppercase mb-1">{label}</p>
      <p className={`text-[12px] font-mono ${finalColor}`}>{isDiff && isPos ? '+' : ''}{numVal.toFixed(1)}</p>
    </div>
  );
}

function TournamentSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const options = [
    { id: 'ALL', label: 'TODOS OS CAMPEONATOS' },
    { id: 'AMERICAS_CUP', label: 'AMERICAS CUP' },
    { id: 'CBLOL', label: 'CBLOL' },
    { id: 'CIRCUITO_DESAFIANTE', label: 'CIRCUITO DESAFIANTE' },
    { id: 'EMEA_MASTERS', label: 'EMEA MASTERS' },
    { id: 'FIRST_STAND', label: 'FIRST STAND' },
    { id: 'LCK', label: 'LCK' },
    { id: 'LCS', label: 'LCS' },
    { id: 'LEC', label: 'LEC' },
    { id: 'LPL', label: 'LPL' },
    { id: 'MSI', label: 'MSI' },
    { id: 'MUNDIAL', label: 'MUNDIAL' },
    { id: 'SCRIM', label: 'SCRIMS' }
  ];

  const currentLabel = options.find(o => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[7px] text-slate-500 tracking-[0.2em] uppercase mb-1.5 ml-2 font-black">Campeonato</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-[#121212] border border-white/5 px-5 py-3.5 rounded-[16px] flex items-center justify-between gap-4 min-w-[240px] hover:border-purple-500/40 transition-all shadow-lg text-[10px] text-white font-black italic uppercase group"
      >
        <span className="flex-1 text-left text-purple-400 group-hover:drop-shadow-[0_0_5px_rgba(168,85,247,0.5)] transition-all">{currentLabel}</span>
        <span className={`text-[8px] text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] max-h-[320px] overflow-y-auto custom-scrollbar backdrop-blur-xl">
          {options.map(opt => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-5 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === opt.id ? 'bg-purple-500/10' : ''}`}
            >
              <span className={`text-[10px] font-black italic uppercase ${value === opt.id ? 'text-purple-400' : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", click); 
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const options = [
    { id: 'ALL', label: 'ANO INTEIRO' },
    { id: 'SPLIT 1', label: 'SPLIT 1' },
    { id: 'SPLIT 2', label: 'SPLIT 2' },
    { id: 'SPLIT 3', label: 'SPLIT 3' }
  ];

  const currentLabel = options.find(o => o.id === value)?.label || value;

  return (
    <div className="relative flex flex-col z-[9999]" ref={ref}>
      <label className="text-[7px] text-slate-500 tracking-[0.2em] uppercase mb-1.5 ml-2 font-black">Timeline</label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-[#121212] border border-white/5 px-5 py-3.5 rounded-[16px] flex items-center justify-between gap-4 min-w-[140px] hover:border-blue-500/40 transition-all shadow-lg text-[10px] text-white font-black italic uppercase group"
      >
        <span className="flex-1 text-left text-blue-400 group-hover:drop-shadow-[0_0_5px_rgba(59,130,246,0.5)] transition-all">{currentLabel}</span>
        <span className={`text-[8px] text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {options.map(opt => (
            <button 
              key={opt.id} 
              onClick={() => { onChange(opt.id); setIsOpen(false); }} 
              className={`w-full flex items-center px-5 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${value === opt.id ? 'bg-blue-500/10' : ''}`}
            >
              <span className={`text-[10px] font-black italic uppercase ${value === opt.id ? 'text-blue-400' : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}