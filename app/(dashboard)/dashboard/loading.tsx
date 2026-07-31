import { Crosshair } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* 1. Estilos embutidos para garantir a animação suave da barra sem mexer no Tailwind Config */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes load-bar {
          0% { width: 0%; }
          15% { width: 25%; }
          50% { width: 65%; }
          75% { width: 85%; }
          100% { width: 100%; }
        }
        .animate-load-bar {
          animation: load-bar 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes scanline {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        .animate-scan {
          animation: scanline 4s linear infinite;
        }
      `}} />

      {/* 2. Fundo Tático com Grade (Grid) e Efeito Vignette */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0a0a_70%)]"></div>
      
      {/* 3. Linha de Scanner descendo a tela discretamente */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="w-full h-12 bg-blue-500/5 blur-2xl animate-scan"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">
        
        {/* Ícone Tecnológico com Aros Girando */}
        <div className="relative flex items-center justify-center mb-10">
          <div className="absolute w-20 h-20 border border-blue-500/20 rounded-full animate-[spin_4s_linear_infinite]"></div>
          <div className="absolute w-24 h-24 border border-dashed border-zinc-700/50 rounded-full animate-[spin_6s_linear_infinite_reverse]"></div>
          
          <div className="bg-zinc-950 p-4 rounded-full border border-zinc-800 shadow-[0_0_30px_rgba(37,99,235,0.15)] relative">
            <Crosshair size={28} className="text-blue-500" />
            <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Textos de Loading */}
        <h2 className="text-white font-black uppercase tracking-[0.3em] text-sm mb-2 drop-shadow-md">
          Acessando Sistema
        </h2>
        <p className="text-blue-400/60 font-bold text-[9px] uppercase tracking-[0.2em] mb-10 h-4">
          Decriptando inteligência tática...
        </p>

        {/* A BARRA DE CARREGAMENTO */}
        <div className="w-full">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Inicialização</span>
            <span className="text-[9px] text-blue-500 font-black tracking-widest animate-pulse">PROCESSANDO</span>
          </div>
          
          {/* Container da barra */}
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80 p-[1px] shadow-inner">
            {/* O "Fill" (preenchimento) da barra */}
            <div className="h-full bg-blue-600 rounded-full animate-load-bar shadow-[0_0_15px_rgba(37,99,235,0.8)] relative">
                {/* O reflexo/brilho na ponta da barra */}
                <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/60 blur-[1px]"></div>
            </div>
          </div>
        </div>
        
        {/* Bolinhas de delay em baixo */}
        <div className="mt-10 flex gap-1.5 opacity-50">
            <div className="w-1 h-1 bg-zinc-500 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-zinc-500 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '300ms' }}></div>
            <div className="w-1 h-1 bg-zinc-500 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '600ms' }}></div>
        </div>

      </div>
    </div>
  );
}