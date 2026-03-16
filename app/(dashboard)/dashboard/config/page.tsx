"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'TEAMS' | 'PLAYERS'>('TEAMS');

  // Dados do Banco
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  // Estados dos Formulários
  const [teamForm, setTeamForm] = useState({ acronym: '', name: '', logo_url: '' });
  const [isEditingTeam, setIsEditingTeam] = useState(false);

  const [playerForm, setPlayerForm] = useState({ puuid: '', nickname: '', team_acronym: '', primary_role: 'TOP', photo_url: '' });
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [oldPuuid, setOldPuuid] = useState(''); // Guarda o PUUID antigo para caso de edição (já que é PK)

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [t, p] = await Promise.all([
      supabase.from('teams').select('*').order('acronym'),
      supabase.from('players').select('*').order('team_acronym')
    ]);
    if (t.data) setTeams(t.data);
    if (p.data) setPlayers(p.data);
    setLoading(false);
  }

  // ==========================================
  // HANDLERS: TIMES
  // ==========================================
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { 
        acronym: teamForm.acronym.toUpperCase(), 
        name: teamForm.name.toUpperCase(), 
        logo_url: teamForm.logo_url 
      };

      if (isEditingTeam) {
        await supabase.from('teams').update(payload).eq('acronym', payload.acronym);
      } else {
        await supabase.from('teams').insert([payload]);
      }
      
      setTeamForm({ acronym: '', name: '', logo_url: '' });
      setIsEditingTeam(false);
      await fetchData();
    } catch (err: any) {
      alert("Erro ao salvar time: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeam = (team: any) => {
    setTeamForm(team);
    setIsEditingTeam(true);
  };

  const handleDeleteTeam = async (acronym: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar a equipe ${acronym}?`)) return;
    await supabase.from('teams').delete().eq('acronym', acronym);
    await fetchData();
  };

  // ==========================================
  // HANDLERS: JOGADORES
  // ==========================================
  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Se não enviou PUUID, gera um temporário
      let finalPuuid = playerForm.puuid.trim();
      if (!finalPuuid) {
        finalPuuid = `PENDING-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      }

      const payload = {
        puuid: finalPuuid,
        nickname: playerForm.nickname,
        team_acronym: playerForm.team_acronym.toUpperCase(),
        primary_role: playerForm.primary_role.toLowerCase(),
        photo_url: playerForm.photo_url
      };

      if (isEditingPlayer) {
        // Se o PUUID mudou (ou estamos atualizando), precisamos apagar o antigo e inserir o novo pois PUUID costuma ser a Primary Key
        if (oldPuuid !== payload.puuid) {
           await supabase.from('players').delete().eq('puuid', oldPuuid);
           await supabase.from('players').insert([payload]);
        } else {
           await supabase.from('players').update(payload).eq('puuid', payload.puuid);
        }
      } else {
        await supabase.from('players').insert([payload]);
      }

      setPlayerForm({ puuid: '', nickname: '', team_acronym: '', primary_role: 'TOP', photo_url: '' });
      setIsEditingPlayer(false);
      setOldPuuid('');
      await fetchData();
    } catch (err: any) {
      alert("Erro ao salvar jogador: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlayer = (player: any) => {
    setPlayerForm({
      puuid: player.puuid,
      nickname: player.nickname,
      team_acronym: player.team_acronym,
      primary_role: player.primary_role.toUpperCase(),
      photo_url: player.photo_url || ''
    });
    setOldPuuid(player.puuid);
    setIsEditingPlayer(true);
  };

  const handleDeletePlayer = async (puuid: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar este jogador?`)) return;
    await supabase.from('players').delete().eq('puuid', puuid);
    await fetchData();
  };

  // ==========================================
  // AUTO-DISCOVERY PUUID MÁGICO
  // ==========================================
  const handleSyncPuuid = async (player: any) => {
    setLoading(true);
    try {
      // Procura na tabela detalhada uma partida com esse nick e essa tag
      const { data, error } = await supabase
        .from('player_stats_detailed')
        .select('puuid')
        .ilike('summoner_name', `%${player.nickname}%`)
        .ilike('team_acronym', player.team_acronym)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.puuid) {
         // Encontrou! Substitui o jogador na tabela apagando o PENDING e salvando o Oficial
         const newPayload = { ...player, puuid: data.puuid };
         await supabase.from('players').delete().eq('puuid', player.puuid);
         await supabase.from('players').insert([newPayload]);
         alert(`PUUID Sincronizado com sucesso para ${player.nickname}!`);
         await fetchData();
      } else {
         alert(`Nenhuma partida encontrada para ${player.nickname} (${player.team_acronym}) ainda. Tente novamente após subir um CSV de campeonato com ele.`);
      }
    } catch (err: any) {
      alert("Erro na sincronização: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && teams.length === 0) return <div className="flex items-center justify-center h-screen text-blue-500 font-black italic animate-pulse tracking-widest">// CARREGANDO SISTEMA DE CONFIGURAÇÃO...</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-10 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="border-l-4 border-yellow-500 pl-6 mb-10">
        <h1 className="text-4xl text-white leading-none">SYSTEM <span className="text-yellow-500">CONFIG</span></h1>
        <p className="text-slate-400 text-[10px] tracking-[0.4em] mt-2">GERENCIAMENTO DE TEAMS E ROSTERS</p>
      </header>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex bg-black/40 p-1.5 rounded-3xl border border-white/5 shadow-2xl w-max mb-8">
        <button onClick={() => setActiveTab('TEAMS')} className={`px-8 py-3 rounded-2xl text-xs tracking-widest transition-all ${activeTab === 'TEAMS' ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
          GERENCIAR TEAMS
        </button>
        <button onClick={() => setActiveTab('PLAYERS')} className={`px-8 py-3 rounded-2xl text-xs tracking-widest transition-all ${activeTab === 'PLAYERS' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
          GERENCIAR PLAYERS
        </button>
      </div>

      {/* =========================================
          ABA 1: TIMES
      ========================================= */}
      {activeTab === 'TEAMS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* FORMULÁRIO DE TIMES */}
          <div className="lg:col-span-4 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl h-fit">
            <h2 className="text-2xl text-white mb-6">{isEditingTeam ? 'EDITAR TIME' : 'CADASTRAR TIME'}</h2>
            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Tag do Time (Acronym)</label>
                <input type="text" required disabled={isEditingTeam} placeholder="Ex: RMD" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic uppercase disabled:opacity-50" value={teamForm.acronym} onChange={e => setTeamForm({...teamForm, acronym: e.target.value})} />
                {isEditingTeam && <p className="text-[8px] text-red-400 mt-1 ml-2">A Tag não pode ser alterada após a criação.</p>}
              </div>
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Nome Completo</label>
                <input type="text" required placeholder="Ex: RMD Gaming" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic uppercase" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 ml-2">URL da Logo</label>
                <input type="url" placeholder="https://..." className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-yellow-500 outline-none transition-all font-black italic" value={teamForm.logo_url} onChange={e => setTeamForm({...teamForm, logo_url: e.target.value})} />
              </div>
              
              <div className="pt-4 flex gap-3">
                {isEditingTeam && <button type="button" onClick={() => {setIsEditingTeam(false); setTeamForm({acronym: '', name: '', logo_url: ''});}} className="px-6 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-[10px]">CANCELAR</button>}
                <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-yellow-500 text-black rounded-2xl hover:bg-yellow-400 transition-all font-black uppercase tracking-widest shadow-lg disabled:opacity-50">
                  {saving ? 'SALVANDO...' : isEditingTeam ? 'ATUALIZAR' : 'CADASTRAR'}
                </button>
              </div>
            </form>
          </div>

          {/* LISTA DE TIMES */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl">
              <h3 className="text-xl text-white mb-6">DATABASE DE TIMES ({teams.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                {teams.map(team => (
                  <div key={team.acronym} className="bg-slate-900/50 border border-slate-800 p-4 rounded-[24px] flex items-center gap-4 group hover:border-yellow-500/50 transition-colors">
                    {team.logo_url ? (
                      <img src={team.logo_url} className="w-12 h-12 object-contain bg-black rounded-xl border border-white/10 p-1 shrink-0" alt="" />
                    ) : (
                      <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex items-center justify-center text-slate-600 shrink-0">?</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{team.name}</p>
                      <p className="text-[10px] text-yellow-500 tracking-widest">{team.acronym}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => handleEditTeam(team)} className="w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white">✏️</button>
                      <button onClick={() => handleDeleteTeam(team.acronym)} className="w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500 hover:text-white">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          ABA 2: JOGADORES
      ========================================= */}
      {activeTab === 'PLAYERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* FORMULÁRIO DE JOGADORES */}
          <div className="lg:col-span-4 bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl h-fit">
            <h2 className="text-2xl text-white mb-6">{isEditingPlayer ? 'EDITAR JOGADOR' : 'CADASTRAR JOGADOR'}</h2>
            <form onSubmit={handleSavePlayer} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 ml-2">PUUID (Deixe vazio para Auto-Discovery)</label>
                <input type="text" placeholder="Ex: 8cec1523-b3b6..." className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic text-[10px]" value={playerForm.puuid} onChange={e => setPlayerForm({...playerForm, puuid: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 ml-2">Nickname (Exato do Jogo)</label>
                  <input type="text" required placeholder="Ex: Chovy" className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic" value={playerForm.nickname} onChange={e => setPlayerForm({...playerForm, nickname: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 ml-2">Time Atual</label>
                  <select required className="w-full bg-black border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" value={playerForm.team_acronym} onChange={e => setPlayerForm({...playerForm, team_acronym: e.target.value})}>
                    <option value="" disabled>SELECIONE...</option>
                    {teams.map(t => <option key={t.acronym} value={t.acronym}>{t.acronym}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 ml-2">Role Principal</label>
                  <select required className="w-full bg-black border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" value={playerForm.primary_role} onChange={e => setPlayerForm({...playerForm, primary_role: e.target.value})}>
                    <option value="TOP">TOP</option><option value="JUNGLE">JUNGLE</option><option value="MID">MID</option><option value="ADC">ADC</option><option value="SUPPORT">SUPPORT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Foto de Perfil (URL Opcional)</label>
                <input type="url" placeholder="https://..." className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-black italic text-xs" value={playerForm.photo_url} onChange={e => setPlayerForm({...playerForm, photo_url: e.target.value})} />
              </div>
              
              <div className="pt-4 flex gap-3">
                {isEditingPlayer && <button type="button" onClick={() => {setIsEditingPlayer(false); setPlayerForm({puuid: '', nickname: '', team_acronym: '', primary_role: 'TOP', photo_url: ''}); setOldPuuid('');}} className="px-6 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-[10px]">CANCELAR</button>}
                <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all font-black uppercase tracking-widest shadow-lg disabled:opacity-50">
                  {saving ? 'SALVANDO...' : isEditingPlayer ? 'ATUALIZAR' : 'CADASTRAR'}
                </button>
              </div>
            </form>
          </div>

          {/* LISTA DE JOGADORES */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl">
              <h3 className="text-xl text-white mb-6">ROSTER GLOBAL ({players.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[700px] custom-scrollbar pr-2">
                {players.map(player => {
                  const isPending = player.puuid.startsWith('PENDING-');
                  
                  return (
                    <div key={player.puuid} className={`bg-slate-900/50 border p-4 rounded-[24px] flex flex-col gap-4 group transition-colors relative ${isPending ? 'border-orange-500/30 hover:border-orange-500/60' : 'border-slate-800 hover:border-blue-500/50'}`}>
                      
                      {isPending && <div className="absolute -top-2 -right-2 bg-orange-600 text-white text-[7px] px-2 py-0.5 rounded-md tracking-widest shadow-lg animate-pulse">SEM PUUID</div>}

                      <div className="flex items-center gap-3">
                        {player.photo_url ? (
                          <img src={player.photo_url} className="w-10 h-10 object-cover bg-black rounded-xl border border-white/10 shrink-0" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-black rounded-xl border border-white/10 flex items-center justify-center text-slate-600 shrink-0 text-xs">👤</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate leading-none mb-1">{player.nickname}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-widest">{player.team_acronym}</span>
                            <span className="text-[8px] text-blue-400 uppercase tracking-widest">{player.primary_role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <button onClick={() => handleEditPlayer(player)} className="flex-1 py-2 bg-white/5 text-white text-[9px] rounded-xl hover:bg-blue-600 transition-colors">EDITAR</button>
                        <button onClick={() => handleDeletePlayer(player.puuid)} className="px-4 py-2 bg-white/5 text-red-400 text-[9px] rounded-xl hover:bg-red-600 hover:text-white transition-colors">🗑️</button>
                        
                        {/* BOTÃO MÁGICO DE SYNC SE NÃO TIVER PUUID OFICIAL */}
                        {isPending && (
                          <button onClick={() => handleSyncPuuid(player)} disabled={loading} title="Varrer BD para achar PUUID" className="px-4 py-2 bg-orange-500/20 text-orange-400 text-[10px] rounded-xl hover:bg-orange-500 hover:text-black transition-colors disabled:opacity-50">
                            📡
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}