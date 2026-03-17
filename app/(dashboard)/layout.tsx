"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Variáveis dinâmicas inicializadas vazias/loading para evitar piscar o nome antigo
  const [userName, setUserName] = useState("CARREGANDO...");
  const [userRole, setUserRole] = useState("...");

  // Função que busca o usuário real do banco de dados ao carregar a página
  useEffect(() => {
    async function fetchActiveUser() {
      // Pega a sessão ativa do Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Busca na tabela 'profiles' usando o ID do usuário logado
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single();
          
        if (profile) {
          setUserName(profile.full_name || "JOGADOR DESCONHECIDO");
          setUserRole(profile.role || "JOGADOR");
        } else {
          // Fallback de segurança buscando do metadata caso a tabela falhe
          setUserName(session.user.user_metadata?.full_name || "JOGADOR DESCONHECIDO");
          setUserRole(session.user.user_metadata?.role || "JOGADOR");
        }
      } else {
        // Se estiver em modo de teste local sem login
        setUserName("MODO DESENVOLVEDOR");
        setUserRole("ANALISTA");
      }
    }
    
    fetchActiveUser();
  }, []);

  return (
    <div className="flex w-full h-full p-2 gap-2">
      
      {/* =========================================
         BARRA LATERAL (SIDEBAR - SPOTIFY STYLE)
      ========================================= */}
      <aside className="w-[80px] xl:w-[280px] flex flex-col gap-2 shrink-0 transition-all duration-300 relative z-20">
        
        {/* Ilha 1: Navegação Principal */}
        <nav className="bg-[#121212] rounded-xl p-4 flex flex-col gap-4 relative">
          
          <Link href="/dashboard" className="flex items-center justify-center mb-6 xl:mb-8 mt-2 relative group cursor-pointer">
            <div className="absolute w-16 h-16 xl:w-32 xl:h-32 bg-purple-600/20 rounded-full blur-2xl group-hover:bg-purple-500/30 transition-all duration-500"></div>
            <img 
              src="https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/90/RMD_Gaminglogo_square.png" 
              alt="RMD Gaming Logo" 
              className="w-12 h-12 xl:w-24 xl:h-24 object-contain shrink-0 relative z-10 drop-shadow-[0_0_25px_rgba(168,85,247,0.3)] group-hover:scale-105 transition-transform duration-500"
            />
          </Link>

          {/* Links Principais */}
          <ul className="flex flex-col gap-2 relative z-10">
            <li>
              <Link href="/dashboard" className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors group ${pathname === '/dashboard' ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                <HomeIcon className={`w-6 h-6 group-hover:scale-105 transition-transform ${pathname === '/dashboard' ? 'text-purple-500' : ''}`} />
                <span className="hidden xl:block font-bold text-sm tracking-wide uppercase italic">Início</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/matches" className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors group ${pathname.includes('/dashboard/matches') ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                <FolderIcon className={`w-6 h-6 group-hover:scale-105 transition-transform ${pathname.includes('/dashboard/matches') ? 'text-purple-500' : ''}`} />
                <span className="hidden xl:block font-bold text-sm tracking-wide uppercase italic">Partidas</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/players" className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors group ${pathname.includes('/dashboard/players') ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                <FolderIcon className={`w-6 h-6 group-hover:scale-105 transition-transform ${pathname.includes('/dashboard/players') ? 'text-purple-500' : ''}`} />
                <span className="hidden xl:block font-bold text-sm tracking-wide uppercase italic">Jogadores</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/meta" className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors group ${pathname.includes('/dashboard/meta') ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                <TargetIcon className={`w-6 h-6 group-hover:scale-105 transition-transform ${pathname.includes('/dashboard/meta') ? 'text-purple-500' : ''}`} />
                <span className="hidden xl:block font-bold text-sm tracking-wide uppercase italic">Intel / Meta Game</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Ilha 2: Ferramentas de Sistema */}
        <div className="bg-[#121212] rounded-xl p-4 flex-1 flex flex-col gap-4 overflow-hidden relative z-10">
          <div className="flex items-center justify-between px-2 text-slate-400 hover:text-white transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <LibraryIcon className="w-6 h-6 group-hover:scale-105 transition-transform" />
              <span className="hidden xl:block font-bold text-sm tracking-wide uppercase italic">Sistema</span>
            </div>
            <PlusIcon className="w-4 h-4 hidden xl:block opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar mt-2 pr-2 space-y-3">
             {/* PROTEÇÃO DE STAFF PARA AS FUNÇÕES DE ADMINISTRAÇÃO */}
             {['analista', 'treinador', 'diretor'].includes(userRole.toLowerCase()) && (
                <>
                  <SidebarItem 
                    title="Aprovar Usuários" 
                    subtitle="Administração" 
                    isAction 
                    href="/dashboard/admin/users" 
                    isActive={pathname.includes('/dashboard/admin/users')}
                  />
                  <SidebarItem 
                    title="Subir CSV" 
                    subtitle="(GRID.GG)" 
                    isAction 
                    href="/dashboard/admin/upload" 
                    isActive={pathname.includes('/dashboard/admin/upload')} 
                  />
                  {/* NOVO BOTÃO DE CONFIGURAÇÃO - APENAS ANALISTA */}
                  {userRole.toLowerCase() === 'analista' && (
                    <SidebarItem 
                      title="Configurações" 
                      subtitle="Sistema Global" 
                      isAction 
                      icon={SettingsIcon}
                      href="/dashboard/admin/config" 
                      isActive={pathname.includes('/dashboard/admin/config')} 
                    />
                  )}
                </>
             )}
          </div>
          
          {/* Assinatura / User Info no rodapé - DINÂMICO E PUXANDO DO BANCO */}
          <div className="mt-auto border-t border-slate-800 pt-4 hidden xl:block">
             <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black italic truncate">{userName}</p>
             <p className="text-[10px] text-purple-400 font-mono mt-1">{userRole.toUpperCase()}</p>
          </div>
        </div>
        
      </aside>

      {/* =========================================
         CONTEÚDO PRINCIPAL (MAIN ISLAND)
      ========================================= */}
      <main className="flex-1 bg-[#121212] rounded-xl overflow-y-auto custom-scrollbar relative border border-white/5 z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none h-64 z-0"></div>
        <div className="relative z-10 w-full h-full">
           {children}
        </div>
      </main>

    </div>
  );
}

// -----------------------------------------------------
// COMPONENTES AUXILIARES PARA A SIDEBAR
// -----------------------------------------------------

function SidebarItem({ title, subtitle, isAction = false, href, isActive = false, icon: Icon = FolderIcon }: any) {
  const content = (
    <div className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
      <div className={`w-12 h-12 rounded-md flex items-center justify-center shrink-0 border transition-colors ${isActive ? 'bg-slate-800 border-purple-500' : 'bg-slate-800/80 border-slate-700'}`}>
        <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-purple-400' : isAction ? 'text-purple-500/70 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-white'}`} />
      </div>
      <div className="hidden xl:flex flex-col truncate">
        <p className={`text-[11px] font-black uppercase italic truncate transition-colors ${isActive ? 'text-white' : isAction ? 'text-purple-400 group-hover:text-purple-300' : 'text-slate-200 group-hover:text-white'}`}>{title}</p>
        <p className="text-[9px] text-slate-500 font-mono truncate">{subtitle}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// --- ÍCONES SVG ---

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>
    </svg>
  );
}

function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}