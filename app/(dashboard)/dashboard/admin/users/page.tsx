"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Controle do Modal de Edição (Adicionado account_status)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ 
    id: '', full_name: '', role: 'jogador', is_approved: false, puuid: '', account_status: 'pendente'
  });

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);

    // HEARTBEAT DA LUZINHA VERDE ONLINE MANTIDO AQUI
    const updateMyPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id);
      }
    };
    updateMyPresence();
    const pingInterval = setInterval(updateMyPresence, 4 * 60 * 1000); 

    return () => {
      clearInterval(interval);
      clearInterval(pingInterval);
    };
  }, []);

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      // Puxando o account_status novo do banco
      .select('id, full_name, role, is_approved, puuid, last_seen, account_status')
      .order('last_seen', { ascending: false });

    if (!error && data) {
      setUsers(data);
    } else if (error) {
      console.error("Erro ao buscar usuários:", error);
    }
    setLoading(false);
  }

  // --- HANDLERS ---
  const handleEditClick = (user: any) => {
    // Se o usuário é antigo e não tem account_status ainda, deduzimos pelo is_approved
    const defaultStatus = user.is_approved ? 'aprovado' : 'pendente';
    
    setEditForm({
      id: user.id,
      full_name: user.full_name || '',
      role: (user.role || 'jogador').toLowerCase(),
      is_approved: !!user.is_approved,
      puuid: user.puuid || '',
      account_status: user.account_status || defaultStatus
    });
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          role: editForm.role.toLowerCase(),
          account_status: editForm.account_status,
          // Atualizamos a chave booleana antiga automaticamente para não quebrar a arquitetura do banco
          is_approved: editForm.account_status === 'aprovado', 
          puuid: editForm.puuid
        })
        .eq('id', editForm.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      console.error("Erro ao atualizar usuário:", err);
      alert("Erro ao salvar no banco: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- HELPERS ÚNICOS DE STATUS E TEMPO ---
  const isUserOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastSeenDate) / (1000 * 60);
    return diffMinutes < 5;
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "NUNCA ACESSOU";
    const lastSeenDate = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const diffSeconds = Math.floor((now - lastSeenDate) / 1000);
    
    if (diffSeconds < 60) return "AGORA MESMO";
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `HÁ ${diffMinutes} MINUTO${diffMinutes > 1 ? 'S' : ''}`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `HÁ ${diffHours} HORA${diffHours > 1 ? 'S' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "ONTEM";
    return `HÁ ${diffDays} DIAS`;
  };

  if (loading) return <div className="flex items-center justify-center h-[80vh] text-emerald-500 font-black italic animate-pulse tracking-widest text-xs uppercase">// CARREGANDO DIRETÓRIO DE USUÁRIOS...</div>;

  // Lógica corrigida da Notificação: Conta APENAS quem tem status explicitamente pendente
  const pendingCount = users.filter(u => u.account_status === 'pendente' || (!u.account_status && !u.is_approved)).length;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-10 font-black uppercase italic tracking-tighter pb-20">
      
      <header className="border-l-4 border-emerald-500 pl-6 mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl text-white leading-none not-italic">USER <span className="text-emerald-500">MANAGEMENT</span></h1>
          <p className="text-slate-400 text-[10px] tracking-[0.4em] mt-2 not-italic">CONTROLE DE ACESSO E HIERARQUIA DO SISTEMA</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-xl text-amber-400 text-xs tracking-widest animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {pendingCount} PENDENTE{pendingCount > 1 ? 'S' : ''} DE APROVAÇÃO
          </div>
        )}
      </header>

      {/* LISTA DE USUÁRIOS */}
      <div className="bg-[#121212] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-900 to-emerald-500"></div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-y-3 min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-[9px] text-slate-500 tracking-[0.2em] uppercase">
                <th className="px-4 pb-2">OPERATIVE / NOME</th>
                <th className="px-4 pb-2 text-center">CARGO</th>
                <th className="px-4 pb-2 text-center">STATUS DA CONTA</th>
                <th className="px-4 pb-2 text-center">ATIVIDADE (ONLINE)</th>
                <th className="px-4 pb-2 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const online = isUserOnline(user.last_seen);
                // Define o status real a ser mostrado
                const visualStatus = user.account_status || (user.is_approved ? 'aprovado' : 'pendente');
                
                return (
                  <tr key={user.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all group relative">
                    <td className="p-4 rounded-l-2xl">
                      <div className="flex flex-col">
                        <span className="text-white text-lg font-black tracking-tighter leading-none">{user.full_name || 'NOME PENDENTE'}</span>
                        <span className="text-blue-400 text-[8px] tracking-widest mt-1 opacity-50 font-mono normal-case">
                          PUUID: {user.puuid ? user.puuid.substring(0, 15) + '...' : 'NÃO VINCULADO'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      <span className={`text-[9px] px-2.5 py-1 rounded border tracking-widest uppercase ${
                        user.role === 'analista' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        user.role === 'treinador' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        user.role === 'diretor' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {user.role || 'JOGADOR'}
                      </span>
                    </td>
                    
                    <td className="p-4 text-center">
                      {visualStatus === 'aprovado' && <span className="text-[9px] px-3 py-1.5 rounded-lg border tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/30">✓ APROVADO</span>}
                      {visualStatus === 'bloqueado' && <span className="text-[9px] px-3 py-1.5 rounded-lg border tracking-widest uppercase bg-red-500/10 text-red-400 border-red-500/30"> BLOQUEADO</span>}
                      {visualStatus === 'pendente' && <span className="text-[9px] px-3 py-1.5 rounded-lg border tracking-widest uppercase bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse">⏳ PENDENTE</span>}
                    </td>
                    
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="relative flex items-center justify-center">
                          {online && <div className="absolute w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-40"></div>}
                          <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-600'}`}></div>
                        </div>
                        <div className="flex flex-col items-start w-20">
                           <span className={`text-[10px] leading-none ${online ? 'text-emerald-400' : 'text-slate-400'}`}>
                             {online ? 'ONLINE' : 'OFFLINE'}
                           </span>
                           <span className="text-[7px] text-slate-500 tracking-widest mt-0.5 normal-case truncate w-full text-left">
                             {formatLastSeen(user.last_seen)}
                           </span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-right rounded-r-2xl">
                      <button 
                        onClick={() => handleEditClick(user)} 
                        className="text-[9px] bg-white/5 hover:bg-emerald-600 text-white border border-white/10 px-4 py-2 rounded-xl transition-all tracking-widest shadow-lg"
                      >
                        EDITAR ACESSO
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-[10px] text-slate-600">NENHUM USUÁRIO REGISTRADO NO BANCO DE DADOS.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          MODAL DE EDIÇÃO DE USUÁRIO
      ========================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveChanges} className="w-full max-w-lg bg-[#121212] border border-emerald-500/20 rounded-[40px] p-8 md:p-10 space-y-6 shadow-[0_0_100px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-900 to-emerald-500"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-3xl italic leading-none font-black text-white">EDIT USER</h2>
              <p className="text-[10px] text-slate-500 tracking-[0.3em] mt-2">PERMISSÕES E VÍNCULOS</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all font-black italic uppercase" 
                  value={editForm.full_name} 
                  onChange={e => setEditForm({...editForm, full_name: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="text-[10px] text-slate-500 ml-2">Hierarquia / Cargo</label>
                <select 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" 
                  value={editForm.role} 
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                >
                  <option value="jogador">JOGADOR</option>
                  <option value="analista">ANALISTA</option>
                  <option value="treinador">TREINADOR</option>
                  <option value="diretor">DIRETOR</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 ml-2">Status da Conta</label>
                <select 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all font-black italic uppercase appearance-none cursor-pointer" 
                  value={editForm.account_status} 
                  onChange={e => setEditForm({...editForm, account_status: e.target.value})}
                >
                  <option value="pendente">⏳ PENDENTE (Aguardando)</option>
                  <option value="aprovado">✓ APROVADO (Acesso Livre)</option>
                  <option value="bloqueado">⛔ BLOQUEADO (Sem Acesso)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 ml-2">PUUID Vinculado (Opcional se for Staff)</label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all font-black italic text-[10px]" 
                  value={editForm.puuid} 
                  placeholder="Cole o PUUID exato do jogador aqui"
                  onChange={e => setEditForm({...editForm, puuid: e.target.value})} 
                />
                <p className="text-[8px] text-slate-600 mt-1 ml-2 normal-case">Crucial para que os jogadores vejam apenas seus próprios dados no Dashboard Pessoal.</p>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-white/5">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-8 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-xs">CANCELAR</button>
              <button type="submit" disabled={saving} className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-500 transition-all font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50">
                {saving ? 'SALVANDO...' : 'SALVAR PERMISSÕES'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}