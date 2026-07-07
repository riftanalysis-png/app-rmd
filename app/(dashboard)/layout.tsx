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
  
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [teamLogo, setTeamLogo] = useState("https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/90/RMD_Gaminglogo_square.png");
  
  // Estados de Controle da Sidebar e Telas
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Carrega a preferência de tamanho guardada no navegador do usuário
  useEffect(() => {
    setIsClient(true);
    const savedState = localStorage.getItem('rmd_sidebar_state');
    if (savedState !== null) {
      setIsSidebarOpen(JSON.parse(savedState));
    }
  }, []);

  useEffect(() => {
    async function fetchAppLayoutData() {
      try {
        // 1. Busca os dados do usuário autenticado
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role, photo_url')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            setUserName(profile.full_name || "JOGADOR DESCONHECIDO");
            setUserRole(profile.role || "JOGADOR");
            setUserPhoto(profile.photo_url || "");
          } else {
            setUserName(session.user.user_metadata?.full_name || "JOGADOR DESCONHECIDO");
            setUserRole(session.user.user_metadata?.role || "JOGADOR");
          }
        } else {
          setUserName("MODO DESENVOLVEDOR");
          setUserRole("ANALISTA");
        }

        // 2. Busca a logo do time dinamicamente com base nas configurações
        const { data: config } = await supabase.from('squad_config').select('my_team_tag').limit(1).maybeSingle();
        if (config && config.my_team_tag) {
           const { data: teamData } = await supabase.from('teams').select('logo_url').eq('acronym', config.my_team_tag.toUpperCase()).maybeSingle();
           if (teamData && teamData.logo_url) {
              setTeamLogo(teamData.logo_url);
           }
        }

      } catch (error) {
        console.error("Erro ao carregar dados da Sidebar:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAppLayoutData();
  }, []);

  // Controla o clique salvando a escolha no cache
  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    if (isClient) {
      localStorage.setItem('rmd_sidebar_state', JSON.stringify(newState));
    }
  };

  // Fecha o menu mobile automaticamente ao trocar de página
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex w-full h-screen p-2 gap-2 bg-zinc-950 overflow-hidden relative font-sans">
      
      {/* SCRIPT OVERLAY: Fundo escuro quando o menu mobile está aberto */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
        />
      )}

      {/* =========================================
         BARRA LATERAL (SIDEBAR COLLAPSIBLE & RESPONSIVE)
      ========================================= */}
      <aside 
        className={`fixed md:relative top-2 bottom-2 left-2 md:top-0 md:bottom-0 md:left-0 z-50 md:z-20 flex flex-col gap-2 shrink-0 transition-all duration-300 h-[calc(100vh-16px)] md:h-full bg-zinc-950 md:bg-transparent
          ${isSidebarOpen ? 'w-[240px] xl:w-[280px]' : 'w-[80px]'} 
          ${isMobileMenuOpen ? 'translate-x-0 w-[260px]' : '-translate-x-[calc(100%+16px)] md:translate-x-0'}
        `}
      >
        {/* BOTÃO FLUTUANTE DE TOGGLE (OCULTO NO MOBILE) */}
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-50 shadow-md"
          title={isSidebarOpen ? "Recolher Menu" : "Expandir Menu"}
        >
          {isSidebarOpen ? <ChevronLeftIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </button>

        {/* Ilha 1: Navegação Principal */}
        <nav className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-4 flex flex-col gap-4 relative shadow-sm shrink-0 items-center w-full">
          
          <Link href="/dashboard" className="flex items-center justify-center mb-4 mt-2 relative group cursor-pointer w-full">
            <div className={`absolute bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500 ${(isSidebarOpen || isMobileMenuOpen) ? 'w-24 h-24' : 'w-12 h-12'}`}></div>
            <img 
              src={teamLogo} 
              alt="Team Logo" 
              className={`object-contain shrink-0 relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-all duration-500 ${(isSidebarOpen || isMobileMenuOpen) ? 'w-20 h-20 xl:w-24 xl:h-24' : 'w-10 h-10'}`}
            />
          </Link>

          {/* Links Principais */}
          <ul className="flex flex-col gap-1.5 relative z-10 w-full">
            {[
              { href: '/dashboard', label: 'Início', icon: HomeIcon, exact: true },
              { href: '/dashboard/matches', label: 'Partidas', icon: GamepadIcon },
              { href: '/dashboard/players', label: 'Jogadores', icon: UsersIcon },
              { href: '/dashboard/meta', label: 'Intel / Meta', icon: TargetIcon },
              { href: '/dashboard/comparison', label: 'Comparação', icon: CompareIcon },
            ].map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.includes(item.href);
              const showText = isSidebarOpen || isMobileMenuOpen;
              return (
                <li key={item.href} className="relative">
                  {/* TRILHO INDICADOR */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-blue-500 rounded-r-md transition-all duration-300 ${isActive ? 'h-3/4 opacity-100' : 'h-0 opacity-0 group-hover:h-1/2 group-hover:opacity-50'}`}></div>
                  
                  <Link 
                    href={item.href} 
                    title={!showText ? item.label : undefined} 
                    className={`flex items-center rounded-lg transition-all group ${showText ? 'px-4 py-3 justify-start' : 'p-3 justify-center'} ${isActive ? 'bg-zinc-800/80 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'}`}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 group-hover:scale-105 transition-transform ${isActive ? 'text-blue-400' : ''}`} />
                    <span className={`font-bold text-xs tracking-widest uppercase overflow-hidden whitespace-nowrap transition-all duration-300 ${showText ? 'w-auto opacity-100 ml-4' : 'w-0 opacity-0 ml-0'}`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Ilha 2: Ferramentas de Sistema */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl p-4 flex-1 flex flex-col gap-4 overflow-hidden relative z-10 shadow-sm min-h-0 w-full">
          <div className={`flex items-center text-zinc-400 hover:text-white transition-colors cursor-pointer group shrink-0 ${(isSidebarOpen || isMobileMenuOpen) ? 'justify-between px-3' : 'justify-center'}`}>
            <div className="flex items-center gap-4">
              <LibraryIcon className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" />
              <span className={`font-bold text-xs tracking-widest uppercase overflow-hidden whitespace-nowrap transition-all duration-300 ${(isSidebarOpen || isMobileMenuOpen) ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>Sistema</span>
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && <PlusIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar mt-2 pr-2 space-y-2 w-full">
             {['analista', 'treinador', 'diretor'].includes(userRole.toLowerCase()) && (
                <>
                  <SidebarItem 
                    title="Aprovar Usuários" 
                    subtitle="Administração" 
                    isAction 
                    icon={UserCheckIcon}
                    href="/dashboard/admin/users" 
                    isActive={pathname.includes('/dashboard/admin/users')}
                    isOpen={isSidebarOpen || isMobileMenuOpen}
                  />
                  <SidebarItem 
                    title="Subir CSV" 
                    subtitle="(GRID.GG)" 
                    isAction 
                    icon={UploadIcon}
                    href="/dashboard/admin/upload" 
                    isActive={pathname.includes('/dashboard/admin/upload')} 
                    isOpen={isSidebarOpen || isMobileMenuOpen}
                  />
                  {userRole.toLowerCase() === 'analista' && (
                    <SidebarItem 
                      title="Configurações" 
                      subtitle="Sistema Global" 
                      isAction 
                      icon={SettingsIcon}
                      href="/dashboard/admin/config" 
                      isActive={pathname.includes('/dashboard/admin/config')} 
                      isOpen={isSidebarOpen || isMobileMenuOpen}
                    />
                  )}
                </>
             )}
          </div>
          
          {/* Assinatura / User Info no rodapé */}
          <div className={`mt-auto transition-all duration-300 flex items-center ${(isSidebarOpen || isMobileMenuOpen) ? 'border-t border-zinc-800/80 pt-4 justify-start' : 'pt-2 justify-center'} min-h-[60px] shrink-0 w-full`}>
            {isLoading ? (
              <div className={`animate-pulse flex flex-col gap-2 ${(isSidebarOpen || isMobileMenuOpen) ? 'w-full' : 'w-8 items-center'}`}>
                <div className={`h-3 bg-zinc-800 rounded ${(isSidebarOpen || isMobileMenuOpen) ? 'w-3/4' : 'w-8 h-8 rounded-full'}`}></div>
                {(isSidebarOpen || isMobileMenuOpen) && <div className="h-2 bg-zinc-800/50 rounded w-1/2"></div>}
              </div>
            ) : (
              (isSidebarOpen || isMobileMenuOpen) ? (
                <div className="animate-fade-in-up overflow-hidden flex items-center gap-3 w-full">
                  {userPhoto ? (
                     <img src={userPhoto} alt={userName} className="w-9 h-9 rounded-lg object-cover border border-zinc-700 shrink-0" />
                  ) : (
                     <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                        <span className="text-xs font-black text-blue-400">{userName.charAt(0).toUpperCase()}</span>
                     </div>
                  )}
                  <div className="flex flex-col min-w-0">
                     <p className="text-[10px] text-zinc-300 uppercase tracking-widest font-black truncate">{userName}</p>
                     <div className="flex items-center gap-1.5 mt-0.5">
                       <span className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)] shrink-0"></span>
                       <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wider truncate">{userRole}</p>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 animate-fade-in-up group relative cursor-help overflow-hidden">
                  {userPhoto ? (
                     <img src={userPhoto} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                     <span className="text-xs font-black text-blue-400">{userName.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute left-full ml-3 bg-zinc-900 text-white text-[10px] font-bold px-3 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-zinc-700">
                    {userName} ({userRole})
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        
      </aside>

      {/* =========================================
         CONTEÚDO PRINCIPAL (COM TOP BAR MOBILE INTEGRADA)
      ========================================= */}
      <div className="flex-1 flex flex-col gap-2 h-full min-w-0">
        
        {/* HEADER EXCLUSIVO PARA TELAS MOBILE */}
        <header className="md:hidden flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800/50 rounded-xl shrink-0 w-full shadow-sm">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <img 
            src={teamLogo} 
            alt="Logo" 
            className="w-8 h-8 object-contain"
          />
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 overflow-hidden">
             {userPhoto ? (
                <img src={userPhoto} alt={userName} className="w-full h-full object-cover" />
             ) : (
                <span className="text-xs font-black text-blue-400">{userName.charAt(0).toUpperCase()}</span>
             )}
          </div>
        </header>

        {/* CONTAINER DO DASHBOARD */}
        <main className="flex-1 bg-zinc-950 rounded-xl overflow-y-auto custom-scrollbar relative border border-zinc-800/50 z-10 shadow-lg h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 to-transparent pointer-events-none h-64 z-0"></div>
          <div className="relative z-10 w-full min-h-full">
             {children}
          </div>
        </main>
      </div>

    </div>
  );
}

// -----------------------------------------------------
// COMPONENTES AUXILIARES PARA A SIDEBAR
// -----------------------------------------------------

function SidebarItem({ title, subtitle, isAction = false, href, isActive = false, icon: Icon = FolderIcon, isOpen = true }: any) {
  const content = (
    <div className={`relative flex items-center p-2 rounded-lg cursor-pointer transition-all group ${isActive ? 'bg-zinc-800/80 shadow-sm' : 'hover:bg-zinc-800/40'} ${isOpen ? 'gap-3 justify-start' : 'justify-center'}`} title={!isOpen ? title : undefined}>
      
      {/* TRILHO INDICADOR DAS ARRUMADORES */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-blue-500 rounded-r-md transition-all duration-300 ${isActive ? 'h-3/4 opacity-100' : 'h-0 opacity-0 group-hover:h-1/2 group-hover:opacity-50'}`}></div>

      <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 border transition-colors ${isActive ? 'bg-zinc-900 border-blue-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
        <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : isAction ? 'text-zinc-500 group-hover:text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
      </div>
      <div className={`flex flex-col truncate transition-all duration-300 overflow-hidden whitespace-nowrap ${isOpen ? 'w-auto opacity-100 ml-1' : 'w-0 opacity-0 ml-0'}`}>
        <p className={`text-[10px] font-black uppercase truncate transition-colors tracking-wide ${isActive ? 'text-white' : isAction ? 'text-zinc-400 group-hover:text-blue-300' : 'text-zinc-400 group-hover:text-white'}`}>{title}</p>
        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest truncate mt-0.5">{subtitle}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}

// --- ÍCONES SVG ---
function ChevronLeftIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <polyline points="15 18 9 12 15 6"></polyline> </svg> ); }
function ChevronRightIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <polyline points="9 18 15 12 9 6"></polyline> </svg> ); }
function MenuIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <line x1="3" y1="12" x2="21" y2="12"></line> <line x1="3" y1="6" x2="21" y2="6"></line> <line x1="3" y1="18" x2="21" y2="18"></line> </svg> ); }

function HomeIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline> </svg> ); }
function TargetIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle> </svg> ); }
function LibraryIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line> </svg> ); }
function PlusIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line> </svg> ); }
function CompareIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <circle cx="18" cy="18" r="3"></circle> <circle cx="6" cy="6" r="3"></circle> <path d="M13 6h3a2 2 0 0 1 2 2v7"></path> <path d="M11 18H8a2 2 0 0 1-2-2V9"></path> </svg> ); }
function GamepadIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <line x1="6" y1="12" x2="10" y2="12"></line> <line x1="8" y1="10" x2="8" y2="14"></line> <line x1="15" y1="13" x2="15.01" y2="13"></line> <line x1="18" y1="11" x2="18.01" y2="11"></line> <rect x="2" y="6" width="20" height="12" rx="2"></rect> </svg> ); }
function UsersIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path> <circle cx="9" cy="7" r="4"></circle> <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path> <path d="M16 3.13a4 4 0 0 1 0 7.75"></path> </svg> ); }
function UserCheckIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path> <circle cx="8.5" cy="7" r="4"></circle> <polyline points="17 11 19 13 23 9"></polyline> </svg> ); }
function UploadIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path> <polyline points="17 8 12 3 7 8"></polyline> <line x1="12" y1="3" x2="12" y2="15"></line> </svg> ); }
function SettingsIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <circle cx="12" cy="12" r="3"></circle> <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path> </svg> ); }
function FolderIcon({ className }: { className?: string }) { return ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}> <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path> </svg> ); }