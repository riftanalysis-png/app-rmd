export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Resumo da Temporada</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
          <p className="text-slate-400 text-sm">Partidas Analisadas</p>
          <p className="text-3xl font-bold mt-2 text-blue-400">0</p>
        </div>
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
          <p className="text-slate-400 text-sm">Winrate Geral</p>
          <p className="text-3xl font-bold mt-2 text-green-400">0%</p>
        </div>
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
          <p className="text-slate-400 text-sm">Jogadores Ativos</p>
          <p className="text-3xl font-bold mt-2 text-purple-400">10</p>
        </div>
      </div>
    </div>
  );
}