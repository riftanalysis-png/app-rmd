"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Feedback Visual Integrado
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Cria o usuário no sistema de Autenticação
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        // Redireciona para o Login após confirmar (se houver confirmação de email habilitada)
        emailRedirectTo: `${window.location.origin}/Login`,
      }
    });

    if (error) {
      setErrorMsg("Erro no cadastro: " + error.message);
      setLoading(false);
    } else {
      setSuccessMsg("Solicitação enviada! Redirecionando...");
      // Redireciona suavemente após 2 segundos
      setTimeout(() => {
         router.push('/Login');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambiental de Fundo (Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      <div className="w-full max-w-md bg-[#121214] border border-zinc-800/80 rounded-[32px] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative animate-[fadeInUp_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]">
        
        {/* Barra superior de destaque */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-blue-500"></div>

        <div className="text-center mb-10 mt-2">
          <h1 className="text-4xl font-black text-white uppercase tracking-tight leading-none mb-2">
            SCOUTING <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]">HUB</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase mt-3">
            Solicitação de Credenciais
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5 relative z-10">
          
          {/* Mensagens de Feedback */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-widest p-3.5 rounded-xl text-center shadow-inner">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest p-3.5 rounded-xl text-center shadow-inner">
              {successMsg}
            </div>
          )}

          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">Nome de Operativo</label>
            <input 
              required
              type="text" 
              placeholder="Ex: Pedro Silva"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner uppercase text-xs"
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">E-mail Operacional</label>
            <input 
              required
              type="email" 
              placeholder="id@squad.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner uppercase text-xs"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 ml-1">Código de Segurança (Senha)</label>
            <input 
              required
              type="password" 
              placeholder="••••••••"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-blue-500 transition-colors shadow-inner text-sm tracking-widest"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="pt-4">
            <button 
              disabled={loading || !!successMsg}
              type="submit"
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? "Processando Cadastro..." : "Solicitar Acesso"}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center border-t border-zinc-800/60 pt-6">
          <p className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">
            Já possui acesso? <Link href="/Login" className="text-blue-400 hover:text-blue-300 transition-colors">Iniciar Sessão</Link>
          </p>
        </div>
      </div>
    </div>
  );
}