"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erro ao entrar: " + error.message);
    } else {
      // Usar router.push é melhor que window.location para manter o estado do Next
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-4">
      <div className="p-8 bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-bold mb-2 text-center text-blue-400">LoL Hub</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">Acesse o painel de análise tática.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email</label>
            <input 
              required
              type="email" 
              placeholder="seu@email.com"
              className="w-full p-3 bg-slate-900 rounded border border-slate-700 focus:border-blue-500 outline-none transition text-white"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Senha</label>
            <input 
              required
              type="password" 
              placeholder="••••••••"
              className="w-full p-3 bg-slate-900 rounded border border-slate-700 focus:border-blue-500 outline-none transition text-white"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded font-bold transition mt-4 disabled:opacity-50 text-white"
          >
            {loading ? "Autenticando..." : "Entrar no Painel"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ainda não tem acesso? <Link href="/register" className="text-blue-400 hover:underline">Solicitar conta</Link>
        </p>
      </div>
    </div>
  );
}