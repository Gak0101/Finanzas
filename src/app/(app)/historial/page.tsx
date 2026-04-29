// Editado: 2026-04-08 — Añadida sección de movimientos entre categorías (desviaciones)
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { RegistroMensual, SnapshotCategoria, Desviacion } from '@/lib/db/schema'

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

type RegistroConSnapshots = RegistroMensual & { snapshots: SnapshotCategoria[] }
type Tab = 'ingresos' | 'movimientos'
type ResumenMensual = {
  key: string
  anio: number
  mes: number
  total: number
  saldadas: number
  pendientes: number
  count: number
}

export default function HistorialPage() {
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [desviaciones, setDesviaciones] = useState<Desviacion[]>([])
  const [loading, setLoading] = useState(true)
  const [anioFiltro, setAnioFiltro] = useState<number | 'todos'>('todos')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('ingresos')

  useEffect(() => {
    Promise.all([
      fetch('/api/historial').then((r) => r.json()),
      fetch('/api/desviaciones').then((r) => r.json()),
    ]).then(([historialData, desviacionesData]) => {
      setRegistros(historialData)
      setDesviaciones(Array.isArray(desviacionesData) ? desviacionesData : [])
      setLoading(false)
    })
  }, [])

  const aniosDisponibles = [...new Set(registros.map((r) => r.anio))].sort((a, b) => b - a)
  const registrosFiltrados =
    anioFiltro === 'todos' ? registros : registros.filter((r) => r.anio === anioFiltro)

  const datosGrafico = [...registrosFiltrados]
    .sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))
    .map((r) => ({
      label: `${MESES_CORTO[r.mes - 1]} ${r.anio !== new Date().getFullYear() ? String(r.anio).slice(2) : ''}`,
      ingreso: r.ingreso_bruto,
    }))

  // Mapa id → registro para saber en qué mes se saldó cada deuda
  const registroMap = new Map(registros.map((r) => [r.id, r]))
  const movimientosFiltrados = desviaciones.filter((d) => {
    if (anioFiltro === 'todos') return true
    const registro = registroMap.get(d.registro_id)
    return registro?.anio === anioFiltro
  })
  const pendientesCount = movimientosFiltrados.filter((d) => !d.saldada).length
  const resumenMovimientos = movimientosFiltrados.reduce(
    (acc, d) => {
      acc.total += d.monto
      acc.count += 1
      if (d.saldada) acc.saldadas += d.monto
      else acc.pendientes += d.monto
      return acc
    },
    { total: 0, saldadas: 0, pendientes: 0, count: 0 }
  )
  const resumenPorMes = Object.values(
    movimientosFiltrados.reduce<Record<string, ResumenMensual>>((acc, d) => {
      const registro = registroMap.get(d.registro_id)
      if (!registro) return acc

      const key = `${registro.anio}-${registro.mes}`
      if (!acc[key]) {
        acc[key] = {
          key,
          anio: registro.anio,
          mes: registro.mes,
          total: 0,
          saldadas: 0,
          pendientes: 0,
          count: 0,
        }
      }

      acc[key].total += d.monto
      acc[key].count += 1
      if (d.saldada) acc[key].saldadas += d.monto
      else acc[key].pendientes += d.monto
      return acc
    }, {})
  ).sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-32" />
        <div className="h-48 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabecera con filtro de año */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial</h1>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded-md text-sm transition-colors ${anioFiltro === 'todos' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            onClick={() => setAnioFiltro('todos')}
          >
            Todos
          </button>
          {aniosDisponibles.map((anio) => (
            <button
              key={anio}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${anioFiltro === anio ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              onClick={() => setAnioFiltro(anio)}
            >
              {anio}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('ingresos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'ingresos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          📊 Ingresos por mes
        </button>
        <button
          onClick={() => setTab('movimientos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${tab === 'movimientos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          💸 Movimientos
          {pendientesCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {pendientesCount}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Ingresos ── */}
      {tab === 'ingresos' && (
        <>
          {registros.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <p className="text-5xl mb-4">📅</p>
                <h2 className="text-xl font-semibold mb-2">Sin historial aún</h2>
                <p className="text-muted-foreground">Registra tus ingresos mensuales para ver la evolución aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {datosGrafico.length > 1 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Evolución de ingresos</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={datosGrafico} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                        <Tooltip formatter={(val) => [formatEuro(Number(val)), 'Ingreso']} />
                        <Bar dataKey="ingreso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {registrosFiltrados.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Promedio mensual</p>
                    <p className="font-bold">{formatEuro(registrosFiltrados.reduce((a, r) => a + r.ingreso_bruto, 0) / registrosFiltrados.length)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Mejor mes</p>
                    <p className="font-bold">{formatEuro(Math.max(...registrosFiltrados.map((r) => r.ingreso_bruto)))}</p>
                  </CardContent></Card>
                  <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total registrado</p>
                    <p className="font-bold">{formatEuro(registrosFiltrados.reduce((a, r) => a + r.ingreso_bruto, 0))}</p>
                  </CardContent></Card>
                </div>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Registros detallados</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {registrosFiltrados.map((r) => (
                      <div key={r.id}>
                        <button
                          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{MESES[r.mes - 1]} {r.anio}</p>
                            {r.notas && <p className="text-xs text-muted-foreground">{r.notas}</p>}
                          </div>
                          <p className="text-lg font-bold">{formatEuro(r.ingreso_bruto)}</p>
                          <Badge variant="outline" className="text-xs">{r.snapshots.length} cat.</Badge>
                          <span className="text-muted-foreground text-sm">{expandido === r.id ? '▲' : '▼'}</span>
                        </button>

                        {expandido === r.id && (
                          <div className="px-6 pb-4 bg-muted/20">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                              {r.snapshots.map((snap) => (
                                <div key={snap.id} className="flex items-center gap-2 p-2 rounded bg-background">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: snap.color }} />
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground truncate">{snap.icono} {snap.categoria_nombre}</p>
                                    <p className="text-sm font-medium">{formatEuro(snap.monto_calculado)}</p>
                                    <p className="text-xs text-muted-foreground">{snap.porcentaje}%</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── TAB: Movimientos ── */}
      {tab === 'movimientos' && (
        <div className="space-y-4">
          {movimientosFiltrados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <p className="text-5xl mb-4">💸</p>
                <h2 className="text-xl font-semibold mb-2">Sin movimientos para este filtro</h2>
                <p className="text-muted-foreground">
                  No hay desviaciones para el filtro actual.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Movimientos</p>
                    <p className="font-bold text-lg">{resumenMovimientos.count}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total movido</p>
                    <p className="font-bold text-lg">{formatEuro(resumenMovimientos.total)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Saldado</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">
                      {formatEuro(resumenMovimientos.saldadas)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Pendiente</p>
                    <p className="font-bold text-lg text-red-600 dark:text-red-400">
                      {formatEuro(resumenMovimientos.pendientes)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {resumenPorMes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumen por mes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {resumenPorMes.slice(-6).reverse().map((item) => (
                      <div
                        key={item.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{MESES[item.mes - 1]} {item.anio}</p>
                          <p className="text-xs text-muted-foreground">{item.count} movimiento{item.count !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatEuro(item.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            Pendiente {formatEuro(item.pendientes)} · Saldado {formatEuro(item.saldadas)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Banner de pendientes */}
              {pendientesCount > 0 && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
                  <CardContent className="py-3">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                      ⏳ {pendientesCount} deuda{pendientesCount > 1 ? 's' : ''} pendiente{pendientesCount > 1 ? 's' : ''} — se ajustarán al meter la nómina del próximo mes
                    </p>
                    {movimientosFiltrados.filter((d) => !d.saldada).map((d) => (
                      <p key={d.id} className="text-xs text-red-600 dark:text-red-400 mt-1">
                        • {formatEuro(d.monto)} de <strong>{d.categoria_origen}</strong> → <strong>{d.categoria_destino}</strong>
                        {d.motivo && <span className="opacity-70"> — {d.motivo}</span>}
                      </p>
                    ))}
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                      Total pendiente: {formatEuro(movimientosFiltrados.filter((d) => !d.saldada).reduce((s, d) => s + d.monto, 0))}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Lista completa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Todos los movimientos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {movimientosFiltrados.map((d) => {
                      const registroOrigen = registroMap.get(d.registro_id)
                      const registroSaldado = d.saldada_en_registro_id ? registroMap.get(d.saldada_en_registro_id) : null

                      return (
                        <div key={d.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1 text-sm">
                                <span className="font-semibold text-red-500">-{formatEuro(d.monto)}</span>
                                <span className="text-muted-foreground">de</span>
                                <span className="font-medium">{d.categoria_origen}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-semibold text-green-600">{d.categoria_destino}</span>
                              </div>

                              {d.motivo && (
                                <p className="text-xs text-muted-foreground mt-1">📝 {d.motivo}</p>
                              )}

                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                <span>
                                  📅 {formatFecha(d.created_at)}
                                  {registroOrigen && (
                                    <span className="ml-1 opacity-70">({MESES[registroOrigen.mes - 1]} {registroOrigen.anio})</span>
                                  )}
                                </span>
                                {d.saldada && registroSaldado && (
                                  <span className="text-green-600 dark:text-green-400">
                                    ✅ Saldada en {MESES[registroSaldado.mes - 1]} {registroSaldado.anio}
                                  </span>
                                )}
                                {d.saldada && !registroSaldado && (
                                  <span className="text-green-600 dark:text-green-400">✅ Saldada</span>
                                )}
                              </div>
                            </div>

                            <Badge
                              variant={d.saldada ? 'default' : 'destructive'}
                              className="shrink-0 text-xs"
                            >
                              {d.saldada ? '✅ Saldada' : '⏳ Pendiente'}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
