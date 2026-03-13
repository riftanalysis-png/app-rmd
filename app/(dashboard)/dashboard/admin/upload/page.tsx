"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Papa from 'papaparse';
import { processMatchIntelligence } from '@/lib/services/analytics';

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const toNum = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanVal = val.toString().replace('%', '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanVal) || 0;
  };

  // --- MOTOR DE RATINGS (LANE, IMPACTO, CONVERSÃO, VISÃO) ---
  const calculateRatings = async (players: any[]) => {
    const { data: weights } = await supabase.from('lane_weights').select('*');
    const { data: bounds } = await supabase.from('lane_metrics_bounds').select('*');
    const localBounds = bounds || [];
    const updatedBounds: any[] = [];

    // 1. Cálculo de métricas derivadas e Diffs
    const playersWithDerived = players.map(p => {
      const opp = players.find(o => o.match_id === p.match_id && o.lane === p.lane && o.side !== p.side);
      const pi = p.cs_12, pj = opp?.cs_12 || pi;
      const ri = p.xp_12, rj = opp?.xp_12 || ri;
      const si = p.gold_12, sj = opp?.gold_12 || si;

      return {
        ...p,
        // Diffs
        cs_diff_at_12: pi - pj,
        gold_diff_at_12: si - sj,
        xp_diff_at_12: ri - rj,
        // Siglas locais para as fórmulas (Não vão para o banco)
        _ap: ((pi / (pi + pj || 1)) + (ri / (ri + rj || 1)) + (si / (si + sj || 1))) / 3, 
        _aq: p.dmg_percent / (p.gold_share || 1),
      };
    });

    // 2. Mapeamento de Siglas -> Colunas Reais
    const metricsMap: any = {
      ap: '_ap', p: 'cs_12', ar: 'cs_diff_at_12', as: 'gold_diff_at_12', at: 'xp_diff_at_12', l: 'deaths_at_12', ac: 'plates', al: 'vpm_at_12', am: 'kda_at_12',
      i: 'kda', k: 'kp', ae: 'taken_percent', ad: 'dmg_percent', aa: 'dmg_buildings', ab: 'dmg_objectives', v: 'dpm', an: 'cc_score',
      w: 'gpm', z: 'fpm', x: 'gold_efficiency', ao: 'gold_share', aq: '_aq',
      t: 'vspm', aj: 'wards_killed', ai: 'wards_placed', u: 'cw_placed'
    };

    // 3. Atualização de Bounds (Min-Max)
    const lanes = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
    lanes.forEach(lane => {
      const lanePlayers = playersWithDerived.filter(p => p.lane?.toUpperCase() === lane);
      Object.keys(metricsMap).forEach(mKey => {
        const field = metricsMap[mKey];
        const vals = lanePlayers.map(p => p[field]);
        if (vals.length === 0) return;
        const cMin = Math.min(...vals), cMax = Math.max(...vals);

        let b = localBounds.find(b => b.lane === lane && b.metric_name === mKey);
        if (!b) {
          updatedBounds.push({ lane, metric_name: mKey, min_val: cMin, max_val: cMax });
        } else if (cMin < b.min_val || cMax > b.max_val) {
          b.min_val = Math.min(b.min_val, cMin);
          b.max_val = Math.max(b.max_val, cMax);
          updatedBounds.push(b);
        }
      });
    });

    if (updatedBounds.length > 0) await supabase.from('lane_metrics_bounds').upsert(updatedBounds);

    // 4. Cálculo Final e Limpeza do Objeto
    return playersWithDerived.map(p => {
      const lane = p.lane?.toUpperCase();
      const lW = weights?.find(w => w.lane === lane);

      const calc = (keys: string[]) => {
        let sumW = 0, sumN = 0;
        keys.forEach(k => {
          const weight = toNum(lW?.[`w_${k}`]);
          if (weight === 0) return;
          const b = localBounds.find(b => b.lane === lane && b.metric_name === k);
          const val = p[metricsMap[k]];
          let norm = (!b || b.max_val === b.min_val) ? 0.5 : (val - b.min_val) / (b.max_val - b.min_val);
          if (k === 'l') norm = 1 - norm; // Inversão para mortes
          sumN += norm * weight;
          sumW += weight;
        });
        return Math.max(50, 50 + (50 * (sumN / (sumW || 1))));
      };

      // Remove as siglas temporárias antes de retornar para o banco não dar erro
      const { _ap, _aq, ...cleanPlayer } = p;

      return {
        ...cleanPlayer,
        lane_efficiency: _ap,
        dmg_gold_ratio: _aq,
        lane_rating: calc(['ap', 'p', 'ar', 'as', 'at', 'l', 'ac', 'al', 'am']),
        impact_rating: calc(['i', 'k', 'ae', 'ad', 'aa', 'ab', 'v', 'an']),
        conversion_rating: calc(['w', 'z', 'x', 'ao', 'aq']),
        vision_rating: calc(['t', 'aj', 'ai', 'u'])
      };
    });
  };

  const mapCsvToDb = (row: any, tableName: string) => {
    if (tableName === 'player_stats_detailed') {
      return {
        match_id: row['Match ID'],
        summoner_name: row['Summoner Name'],
        puuid: row['PUUID'],
        game_start_time: row['Game Start Time'],
        patch: row['Patch'],
        team_acronym: row['Team Acronym'],
        side: row['Side'],
        lane: row['Lane'],
        champion: row['Champion'],
        kda: toNum(row['KDA']),
        kills: parseInt(row['Kills']) || 0,
        deaths: parseInt(row['Deaths']) || 0,
        deaths_at_12: parseInt(row['Deaths até 12min']) || 0,
        assists: parseInt(row['Assists']) || 0,
        result: row['Result'],
        cs_6: parseInt(row['CS 6']) || 0,
        cs_12: parseInt(row['CS 12']) || 0,
        cs_18: parseInt(row['CS 18']) || 0,
        xp_12: parseInt(row['XP 12']) || 0,
        gold_12: parseInt(row['Gold 12']) || 0,
        vspm: toNum(row['VSPM']),
        cw_placed: parseInt(row['CW Placed']) || 0,
        dpm: toNum(row['DPM']),
        gpm: toNum(row['GPM']),
        gold_efficiency: toNum(row['Gold Eff']),
        kp: toNum(row['KP']),
        fpm: toNum(row['FPM']),
        dmg_buildings: parseInt(row['Dmg Buildings']) || 0,
        dmg_objectives: parseInt(row['Dmg Obj']) || 0,
        plates: parseInt(row['Plates']) || 0,
        dmg_percent: toNum(row['Dmg %']),
        taken_percent: toNum(row['Taken %']),
        mitigated: toNum(row['Mitigated']),
        fb_assist: String(row['FB Assist']).toUpperCase() === 'TRUE',
        fb_kill: String(row['FB Kill']).toUpperCase() === 'TRUE',
        ft_assist: String(row['FT Assist']).toUpperCase() === 'TRUE',
        ft_kill: String(row['FT Kill']).toUpperCase() === 'TRUE',
        total_dmg: parseInt(row['Total Dmg']) || 0,
        total_taken: parseInt(row['Total Taken']) || 0,
        vision_score: parseInt(row['Vision']) || 0,
        wards_placed: parseInt(row['Wards P']) || 0,
        wards_killed: parseInt(row['Wards K']) || 0,
        total_gold: parseInt(row['Gold']) || 0,
        win: String(row['Win']).toLowerCase() === 'true',
        vpm_at_12: toNum(row['VPM@12']),
        kda_at_12: toNum(row['KDA@12']),
        cc_score: parseInt(row['CC Score']) || 0,
        gold_share: toNum(row['Gold Share'])
      };
    }
    // (Outros mapeamentos de Wards, Objetivos, Draft continuam aqui...)
    if (tableName === 'match_drafts') {
      return {
        match_id: row['Match ID'],
        team_acronym: row['Team Acronym'],
        tipo: row['Tipo'],
        side: row['Time'],
        jogador: row['Jogador'],
        champion: row['Campeão'] || row['Campeao'],
        sequence: parseInt(row['Sequence']) || 0
      };
    }
    if (tableName === 'match_objectives') {
      return {
        match_id: row['Match ID'],
        minuto: parseInt(row['Minuto']) || 0,
        team_acronym: row['Team Acronym'],
        objective_type: row['Objetivo'],
        subtype: row['Subtipo'],
        player_name: row['Jogador']
      };
    }
    if (tableName === 'match_wards') {
      return {
        match_id: row['Match ID'],
        player_name: row['Jogador'],
        team_acronym: row['Team Acronym'],
        minute: parseInt(row['Minuto']) || 0,
        type: row['Tipo'],
        ward_x: toNum(row['Ward X']),
        ward_y: toNum(row['Ward Y']),
        player_x: toNum(row['Player X']),
        player_y: toNum(row['Player Y'])
      };
    }
    return row;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, tableName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus(`SCANNEANDO ${file.name.toUpperCase()}...`);

    Papa.parse(file, {
      header: true, delimiter: ";", skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rawData = results.data as any[];
          const uniqueMatchIds = Array.from(new Set(rawData.map((r) => r['Match ID']))).filter(Boolean);

          // 1. SINCRONIZAÇÃO DE HIERARQUIA
          setStatus("SINCRONIZANDO SÉRIES E VENCEDORES...");
          for (const mId of uniqueMatchIds) {
            const seriesId = (mId as string).split('_')[0];
            const rowsOfMatch = rawData.filter(r => r['Match ID'] === mId);
            const baseRow = rowsOfMatch[0];
            let blueTag = rowsOfMatch.find(r => r['Side'] === 'Blue')?.['Team Acronym'];
            let redTag = rowsOfMatch.find(r => r['Side'] === 'Red')?.['Team Acronym'];
            let winnerSide = rowsOfMatch.find(r => String(r['Win']).toLowerCase() === 'true')?.['Side']?.toLowerCase();
            
            await supabase.from('series').upsert({ id: seriesId, description: blueTag && redTag ? `${blueTag} x ${redTag}` : `Série ${seriesId}` });
            await supabase.from('matches').upsert({
              id: mId, series_id: seriesId, blue_team_tag: blueTag || null, red_team_tag: redTag || null,
              winner_side: winnerSide || null, patch: baseRow?.['Patch']?.toString().replace(',', '.') || 'N/A',
              game_start_time: baseRow?.['Game Start Time'] || new Date().toISOString()
            });
          }

          // 2. MAPEAMENTO E RATINGS
          setStatus("PROCESSANDO MÉTRICAS E RATINGS...");
          let formattedData = rawData.map((row) => mapCsvToDb(row, tableName));

          if (tableName === 'player_stats_detailed') {
            setStatus("CALCULANDO RATINGS PRO...");
            formattedData = await calculateRatings(formattedData);
          }

          // 3. UPLOAD EM LOTE
          setStatus("INJETANDO DADOS NO DATABASE...");
          await supabase.from(tableName).delete().in('match_id', uniqueMatchIds);
          const { error } = await supabase.from(tableName).insert(formattedData);
          if (error) throw error;

          alert(`${file.name} PROCESSADO COM SUCESSO!`);
          setStatus("CONCLUÍDO.");
        } catch (err: any) {
          alert("ERRO: " + err.message);
        } finally {
          setLoading(false);
          setStatus("");
          if (e.target) e.target.value = "";
        }
      }
    });
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-10 font-black uppercase italic tracking-tighter pb-20">
      <header className="border-l-4 border-blue-500 pl-6">
        <h1 className="text-5xl text-white">DATA CONSOLE</h1>
        <p className="text-blue-400 text-[10px] tracking-[0.4em] mt-2 italic font-black">Sync Engine // Protocolo V6 Final</p>
      </header>
      
      {status && <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-blue-400 text-[10px] text-center animate-pulse italic">{status}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadCard title="Estatísticas" desc="Estatisticas.csv" onUp={(e: any) => handleFileUpload(e, 'player_stats_detailed')} load={loading} />
        <UploadCard title="Visão" desc="Wards.csv" onUp={(e: any) => handleFileUpload(e, 'match_wards')} load={loading} />
        <UploadCard title="Objetivos" desc="Objetivos.csv" onUp={(e: any) => handleFileUpload(e, 'match_objectives')} load={loading} />
        <UploadCard title="Draft" desc="Draft.csv" onUp={(e: any) => handleFileUpload(e, 'match_drafts')} load={loading} />
      </div>
    </div>
  );
}

function UploadCard({ title, desc, onUp, load }: any) {
  return (
    <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-[32px] hover:border-blue-500/30 transition-all group">
      <h3 className="font-black text-2xl text-white mb-1">{title}</h3>
      <p className="text-slate-600 text-[9px] mb-6 tracking-widest">{desc}</p>
      <input type="file" accept=".csv" disabled={load} onChange={onUp} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:bg-slate-800 file:text-white hover:file:bg-blue-600 cursor-pointer disabled:opacity-30 transition-all" />
    </div>
  );
}