import { supabase } from '@/lib/supabase/client';

const ROLE_WEIGHTS: Record<string, any> = {
  top: {
    lane: { lane_efficiency: 0.15, cs_12: 0.05, cs_diff_12: 0.15, xp_diff_12: 0.20, gold_diff_12: 0.15, deaths_12: 0.10, plates_taken: 0.15, vision_per_min: 0.0, kda_12: 0.05 },
    impact: { kda: 0.05, kill_participation: 0.10, damage_taken_percent: 0.25, damage_dealt_percent: 0.15, damage_buildings: 0.30, damage_objectives: 0.0, damage_per_minute: 0.10, cc_score: 0.05 },
    conversion: { gold_per_min: 0.20, farm_per_min: 0.20, gold_efficiency: 0.20, gold_share_percent: 0.15, damage_gold_ratio: 0.25 },
    vision: { vision_per_min: 0.25, wards_killed: 0.10, wards_placed: 0.40, control_wards_placed: 0.25 }
  },
  jungle: {
    lane: { lane_efficiency: 0.10, cs_12: 0.05, cs_diff_12: 0.05, xp_diff_12: 0.20, gold_diff_12: 0.25, deaths_12: 0.20, plates_taken: 0.05, vision_per_min: 0.0, kda_12: 0.10 },
    impact: { kda: 0.10, kill_participation: 0.20, damage_taken_percent: 0.15, damage_dealt_percent: 0.10, damage_buildings: 0.05, damage_objectives: 0.30, damage_per_minute: 0.05, cc_score: 0.05 },
    conversion: { gold_per_min: 0.25, farm_per_min: 0.25, gold_efficiency: 0.15, gold_share_percent: 0.10, damage_gold_ratio: 0.25 },
    vision: { vision_per_min: 0.25, wards_killed: 0.30, wards_placed: 0.20, control_wards_placed: 0.25 }
  },
  mid: {
    lane: { lane_efficiency: 0.15, cs_12: 0.10, cs_diff_12: 0.15, xp_diff_12: 0.15, gold_diff_12: 0.15, deaths_12: 0.10, plates_taken: 0.10, vision_per_min: 0.05, kda_12: 0.05 },
    impact: { kda: 0.10, kill_participation: 0.15, damage_taken_percent: 0.05, damage_dealt_percent: 0.25, damage_buildings: 0.10, damage_objectives: 0.05, damage_per_minute: 0.25, cc_score: 0.05 },
    conversion: { gold_per_min: 0.20, farm_per_min: 0.20, gold_efficiency: 0.15, gold_share_percent: 0.15, damage_gold_ratio: 0.30 },
    vision: { vision_per_min: 0.25, wards_killed: 0.20, wards_placed: 0.35, control_wards_placed: 0.20 }
  },
  adc: {
    lane: { lane_efficiency: 0.15, cs_12: 0.15, cs_diff_12: 0.20, xp_diff_12: 0.05, gold_diff_12: 0.20, deaths_12: 0.10, plates_taken: 0.15, vision_per_min: 0.0, kda_12: 0.0 },
    impact: { kda: 0.10, kill_participation: 0.10, damage_taken_percent: 0.0, damage_dealt_percent: 0.30, damage_buildings: 0.15, damage_objectives: 0.10, damage_per_minute: 0.25, cc_score: 0.0 },
    conversion: { gold_per_min: 0.25, farm_per_min: 0.25, gold_efficiency: 0.10, gold_share_percent: 0.10, damage_gold_ratio: 0.30 },
    vision: { vision_per_min: 0.20, wards_killed: 0.15, wards_placed: 0.50, control_wards_placed: 0.15 }
  },
  support: {
    lane: { lane_efficiency: 0.10, cs_12: 0.0, cs_diff_12: 0.0, xp_diff_12: 0.15, gold_diff_12: 0.15, deaths_12: 0.25, plates_taken: 0.10, vision_per_min: 0.20, kda_12: 0.05 },
    impact: { kda: 0.10, kill_participation: 0.30, damage_taken_percent: 0.10, damage_dealt_percent: 0.05, damage_buildings: 0.0, damage_objectives: 0.0, damage_per_minute: 0.05, cc_score: 0.40 },
    conversion: { gold_per_min: 0.10, farm_per_min: 0.0, gold_efficiency: 0.40, gold_share_percent: 0.30, damage_gold_ratio: 0.20 },
    vision: { vision_per_min: 0.30, wards_killed: 0.20, wards_placed: 0.20, control_wards_placed: 0.30 }
  }
};

function normalizeRole(lane: string): string {
  const l = lane?.toLowerCase() || '';
  if (l.includes('top') || l === 'afk') return 'top';
  if (l.includes('jungle') || l.includes('jng')) return 'jungle';
  if (l.includes('mid') || l.includes('middle')) return 'mid';
  if (l.includes('bot') || l.includes('adc') || l.includes('bottom')) return 'adc';
  if (l.includes('sup') || l.includes('utility')) return 'support';
  return 'mid'; 
}

function parsePercent(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.toString().replace(',', '.').replace('%', '')) / 100;
}

function normalize(val: number, min: number, max: number): number {
  if (!val || isNaN(val)) return 0;
  if (max === min || max === 0) return 0.5;
  let n = (val - min) / (max - min);
  return Math.max(0, Math.min(1, n));
}

export async function processMatchIntelligence(matchId: string) {
  const { data: players } = await supabase.from('player_stats_detailed').select('*').eq('match_id', matchId);
  const { data: boundsData } = await supabase.from('role_metrics_bounds').select('*');
  
  if (!players || players.length === 0) return;

  const updates = players.map(player => {
    const role = normalizeRole(player.lane);
    const bounds = boundsData?.find(b => b.role === role) || {};
    const opponent = players.find(p => normalizeRole(p.lane) === role && p.side !== player.side) || player;

    // Sincronizando com os nomes de colunas novos (cs_12, xp_12, gold_12)
    const p_i = player.cs_12 || 0; 
    const p_j = opponent.cs_12 || 0;
    const r_i = player.xp_12 || 0; 
    const r_j = opponent.xp_12 || 0;
    const s_i = player.gold_12 || 0; 
    const s_j = opponent.gold_12 || 0;

    const csRatio = (p_i + p_j) > 0 ? (p_i / (p_i + p_j)) : 0.5;
    const xpRatio = (r_i + r_j) > 0 ? (r_i / (r_i + r_j)) : 0.5;
    const goldRatio = (s_i + s_j) > 0 ? (s_i / (s_i + s_j)) : 0.5;
    const laneEff = (csRatio + xpRatio + goldRatio) / 3;

    const csd12 = p_i - p_j;
    const xpd12 = r_i - r_j;
    const gd12 = s_i - s_j;

    const teamDmgPct = parsePercent(player.damage_percent); 
    const goldSharePct = parsePercent(player.gold_share);
    const dmgGoldRatio = goldSharePct > 0 ? (teamDmgPct / goldSharePct) : 0;

    const w = ROLE_WEIGHTS[role];

    const calcScore = (metricsList: any, weightsObj: any) => {
      let weightedSum = 0;
      let sumWeights = 0;
      const inverseMetrics = ['deaths_12', 'damage_taken_percent']; 

      for (const [key, weight] of Object.entries(weightsObj)) {
        const wVal = weight as number;
        if (wVal === 0) continue;

        let rawVal = metricsList[key] || 0;
        let minBound = bounds[`min_${key}`] || 0;
        let maxBound = bounds[`max_${key}`] || (rawVal * 2 || 1);
        
        let nVal = normalize(rawVal, minBound, maxBound);
        if (inverseMetrics.includes(key)) nVal = 1 - nVal; 
        
        weightedSum += (nVal * wVal);
        sumWeights += wVal;
      }

      const finalNorm = sumWeights > 0 ? (weightedSum / sumWeights) : 0.5;
      return Math.max(50, 50 + 50 * finalNorm);
    };

    const laneMetrics = {
      lane_efficiency: laneEff,
      cs_12: p_i,
      cs_diff_12: csd12,
      xp_diff_12: xpd12,
      gold_diff_12: gd12,
      deaths_12: player.deaths_at_12 || 0, 
      plates_taken: player.plates_taken || 0,
      vision_per_min: player.vspm || 0,
      kda_12: player.kda_at_12 || 0 
    };

    const impactMetrics = {
      kda: player.kda || 0,
      kill_participation: parsePercent(player.kill_participation),
      damage_taken_percent: parsePercent(player.damage_taken_percent),
      damage_dealt_percent: teamDmgPct,
      damage_buildings: player.damage_buildings || 0,
      damage_objectives: player.damage_objectives || 0,
      damage_per_minute: player.damage_per_minute || 0,
      cc_score: player.cc_score || 0
    };

    const conversionMetrics = {
      gold_per_min: player.gold_per_min || 0,
      farm_per_min: player.farm_per_min || 0, 
      gold_efficiency: player.gold_efficiency || 0,
      gold_share_percent: goldSharePct,
      damage_gold_ratio: dmgGoldRatio
    };

    const visionMetrics = {
      vision_per_min: player.vspm || 0,
      wards_killed: player.wards_killed || 0,
      wards_placed: player.wards_placed || 0,
      control_wards_placed: player.control_wards_placed || 0
    };

    return {
      id: player.id,
      lane_efficiency: laneEff,
      cs_diff_12: csd12,
      xp_diff_12: xpd12,
      gold_diff_12: gd12,
      lane_rating: calcScore(laneMetrics, w.lane),
      impact_rating: calcScore(impactMetrics, w.impact),
      conversion_rating: calcScore(conversionMetrics, w.conversion),
      vision_rating: calcScore(visionMetrics, w.vision)
    };
  });

  for (const update of updates) {
    if (update) {
      await supabase.from('player_stats_detailed').update(update).eq('id', update.id);
    }
  }
}