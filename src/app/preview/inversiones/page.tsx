const positions = [
  { symbol: 'SFM', name: 'Sprouts Farmers Market', shares: '3 acciones', price: '72,31 $', value: '199,44 €', pnl: '+12,50 €', pct: '+6,7%', positive: true },
  { symbol: 'XPEL', name: 'XPEL, Inc.', shares: '8 acciones', price: '47,20 $', value: '348,80 €', pnl: '−9,34 €', pct: '−2,6%', positive: false },
  { symbol: 'DECK', name: 'Deckers Outdoor', shares: '2 acciones', price: '118,60 $', value: '218,72 €', pnl: '+18,06 €', pct: '+9,0%', positive: true },
]

function Metric({ title, value, detail, tone = 'neutral' }: { title: string; value: string; detail: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const valueColor = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-rose-400' : 'text-slate-100'
  return (
    <section className="rounded-lg border border-white/10 bg-[#151b25] p-4">
      <p className="text-[11px] font-medium text-slate-400">{title}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
    </section>
  )
}

export default function InvestmentPortfolioPreviewPage() {
  return (
    <main className="min-h-screen bg-[#0d1118] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vista previa local · datos ficticios</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Cartera de inversión</h1>
            <p className="mt-2 text-xs text-slate-400">Valor, resultados y evolución de tus posiciones.</p>
          </div>
          <div className="flex gap-2">
            <button className="h-8 rounded-md border border-white/15 px-3 text-[11px] font-medium text-slate-300" type="button">Actualizar precios</button>
            <button className="h-8 rounded-md bg-[#d3d7d0] px-3 text-[11px] font-medium text-slate-900" type="button">Registrar operación</button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del portfolio">
          <Metric title="Valor actual" value="18.680,73 €" detail="15 posiciones · EUR" />
          <Metric title="Efectivo disponible" value="1.380,81 €" detail="Total equivalente en EUR · incluye USD" />
          <Metric title="Resultado abierto" value="+1.278,22 €" detail="Posiciones actuales · +7,3%" tone="positive" />
          <Metric title="Resultado realizado" value="993,12 €" detail="Ventas realizadas − comisiones e impuestos" tone="positive" />
        </div>

        <section className="mt-5 overflow-hidden rounded-lg border border-slate-200/80 bg-[#f7f5ef] text-slate-900">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Posiciones / 3 activos</p>
              <h2 className="text-base font-semibold">Tu cartera</h2>
              <p className="mt-1 text-[10px] text-slate-500">Valor, ganancia o pérdida y rentabilidad.</p>
            </div>
            <div className="flex gap-2">
              <input aria-label="Buscar activo" placeholder="Buscar activo" className="h-8 w-36 rounded-md border border-slate-200 bg-white px-2.5 text-[10px] outline-none" />
              <button className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-[10px] text-slate-600" type="button">Todos⌄</button>
              <button className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-[10px] text-slate-600" type="button">Mayor valor⌄</button>
            </div>
          </header>

          <div className="grid gap-1.5 p-3 lg:hidden">
            {positions.map((position) => (
              <article key={position.symbol} className="rounded-lg border border-slate-200/80 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{position.name}</h3>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{position.symbol} · Acción · Interactive Brokers</p>
                    <p className="mt-1 text-[10px] text-slate-400">{position.shares}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[9px] font-medium text-slate-400">VALOR ACTUAL</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{position.value}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-y border-slate-200/80 py-2.5">
                  <div className="self-center">
                    <p className="text-[9px] font-medium text-slate-400">PRECIO ACTUAL</p>
                    <p className="mt-1 text-xs font-semibold tabular-nums text-slate-700">{position.price}</p>
                  </div>
                  <div className={`rounded-md px-2 py-1.5 text-right ${position.positive ? 'bg-emerald-50/70' : 'bg-rose-50/70'}`}>
                    <p className={`text-[9px] font-medium uppercase tracking-[0.04em] ${position.positive ? 'text-emerald-800' : 'text-rose-800'}`}>{position.positive ? 'Ganancia abierta' : 'Pérdida abierta'}</p>
                    <p className={`mt-0.5 text-[13px] font-semibold tabular-nums ${position.positive ? 'text-emerald-800' : 'text-rose-800'}`}>{position.pnl}</p>
                    <p className={`mt-0.5 text-[10px] font-medium tabular-nums ${position.positive ? 'text-emerald-700' : 'text-rose-700'}`}>{position.pct}</p>
                  </div>
                </div>
                <div className="flex justify-between gap-3 pt-2 text-[10px] text-slate-400"><span>Desde 11 sept 2026</span><span>Total histórico: {position.pnl} · {position.pct}</span></div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-400"><tr><th className="px-5 py-3 font-semibold">Activo</th><th className="px-3 py-3 font-semibold">Tipo / custodia</th><th className="px-3 py-3 text-right font-semibold">Precio</th><th className="px-3 py-3 text-right font-semibold">Valor actual</th><th className="px-3 py-3 text-right font-semibold">Ganancia / pérdida</th><th className="px-5 py-3 font-semibold">Antigüedad</th></tr></thead>
              <tbody>{positions.map((position) => <tr key={position.symbol} className="border-b border-slate-100 last:border-0 hover:bg-white/70"><td className="px-5 py-3"><span className="font-semibold">{position.name}</span><span className="ml-2 text-[9px] text-slate-400">{position.symbol}</span></td><td className="px-3 py-3 text-slate-500">Acción · Interactive Brokers</td><td className="px-3 py-3 text-right font-medium tabular-nums">{position.price}</td><td className="px-3 py-3 text-right font-medium tabular-nums">{position.value}</td><td className={`px-3 py-3 text-right font-semibold tabular-nums ${position.positive ? 'text-emerald-700' : 'text-rose-700'}`}>{position.pnl} · {position.pct}</td><td className="px-5 py-3 text-slate-500">Desde 11 sept 2026</td></tr>)}</tbody>
            </table>
          </div>
          <footer className="border-t border-slate-200 px-4 py-3 text-[10px] text-slate-400 sm:px-5">Los importes y activos de esta vista son ficticios y solo sirven para revisar el diseño.</footer>
        </section>
      </div>
    </main>
  )
}
