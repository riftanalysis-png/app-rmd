"use client";
import { useProfile } from '@/lib/hooks/useProfile';
import Link from 'next/navigation'; // Certifique-se de usar next/link ou o router do navigation
import NextLink from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile();

  if (loading) return <div className="bg-slate-900 h-screen text-white flex items-center justify-center font-black italic uppercase tracking-widest animate-pulse">RMD Analytics: Operacionalizando...</div>;

  if (!profile?.is_approved) {
    return (
      <div className="bg-slate-900 h-screen text-white flex flex-col items-center justify-center p-6 text-center font-black uppercase italic">
        <h1 className="text-2xl text-red-400">Acesso Pendente</h1>
        <p className="text-slate-400 mt-2">Sua conta ainda não foi aprovada pelo Analista Chefe.</p>
        <NextLink href="/login" className="mt-4 text-blue-400 underline">Voltar</NextLink>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-black uppercase italic tracking-tighter">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col shadow-2xl relative z-50">
        
        {/* NOME DO APP COMO BOTÃO HOME */}
        <NextLink href="/dashboard" className="group">
          <h2 className="text-2xl text-blue-500 mb-8 tracking-tighter transition-all group-hover:text-blue-400 group-active:scale-95">
            RMD Analytics
            <div className="h-0.5 w-0 group-hover:w-full bg-blue-500 transition-all duration-300"></div>
          </h2>
        </NextLink>
        
        <nav className="flex-1 space-y-2">
          <NextLink href="/dashboard" className="block p-3 hover:bg-slate-800 rounded transition text-[10px]">Início</NextLink>
          <NextLink href="/dashboard/matches" className="block p-3 hover:bg-slate-800 rounded transition text-[10px]">Partidas</NextLink>
          <NextLink href="/dashboard/players" className="block p-3 hover:bg-slate-800 rounded transition text-[10px]">Jogadores</NextLink>
          
          {/* BOTÃO INTEL / META GAME */}
          <NextLink 
            href="/dashboard/meta" 
            className="flex items-center gap-2 p-3 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 rounded transition text-[10px] text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.05)] group"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 group-hover:animate-ping"></div>
            Intel / Meta Game
          </NextLink>
          
          {/* GESTÃO ANALÍTICA */}
          {profile.role === 'analista' && (
            <div className="pt-4 mt-4 border-t border-slate-800">
              <p className="text-[8px] text-slate-500 mb-2 uppercase font-bold px-3 tracking-[0.2em]">SISTEMA</p>
              <NextLink href="/dashboard/admin/users" className="block p-3 hover:bg-slate-800 rounded text-yellow-500 transition text-[10px]">Aprovar Usuários</NextLink>
              <NextLink href="/dashboard/admin/upload" className="block p-3 hover:bg-slate-800 rounded text-green-500 transition text-[10px]">Subir CSV (Grid.gg)</NextLink>
            </div>
          )}
        </nav>

        <div className="pt-6 border-t border-slate-800">
          <p className="text-[10px] font-medium leading-none">{profile.full_name}</p>
          <p className="text-[8px] text-slate-500 mt-1 tracking-widest">{profile.role}</p>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-8 overflow-y-auto bg-[#06090f]">
        {children}
      </main>
    </div>
  );
}