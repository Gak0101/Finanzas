'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DonutChart } from '@/components/dashboard/DonutChart'
import Link from 'next/link'
import type { RegistroMensual, SnapshotCategoria, Hucha, Aportacion, Categoria } from '@/lib/db/schema'

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

function formatPct(val: number) {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

type RegistroConSnapshots = RegistroMensual & { snapshots: SnapshotCategoria[] }
type HuchaConSaldo = Hucha & { aportaciones: Aportacion[]; saldo_actual: number }

export default function DashboardPage() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [huchas, setHuchas] = useState<HuchaConSaldo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ingresos').then((r) => r.json()),
      fetch('/api/huchas').then((r) => r.json()),
      fetch('/api/categorias').then((r) => r.json()),
    ]).then(([ingresos, huchasData, catsData]) => {
      setRegistros(ingresos)
      setHuchas(huchasData)
      setCategorias(catsData)
      setLoading(false)
    })
  }, [])

  const registroActual = registros.find((r) => r.anio === anio && r.mes === mes)
  const huchasActivas = huchas.filter((h) => h.activa && h.saldo_actual < h.objetivo)

  // Mes anterior para comparativa
  const mesPrevNum = mes === 1 ? 12 : mes - 1
  const anioPrevNum = mes === 1 ? anio - 1 : anio
  const registroAnterior = registros.find((r) => r.anio === anioPrevNum && r.mes === mesPrevNum)

  // Diferencia vs mes anterior
  const diferenciaMes =
    registroActual && registroAnterior
      ? registroActual.ingreso_bruto - registroAnterior.ingreso_bruto
      : null

  const diferenciaPct =
    registroActual && registroAnterior && registroAnterior.ingreso_bruto > 0
      ? ((registroActual.ingreso_bruto - registroAnterior.ingreso_bruto) /
          registroAnterior.ingreso_bruto) *
        100
      : null

  // Tasa de ahorro: buscar la categoría cuyo nombre contenga "ahorro" (case-insensitive)
  const snapAhorro = registroActual?.snapshots.find((s) =>
    s.categoria_nombre.toLowerCase().includes('ahorro')
  )
  const tasaAhorro =
    registroActual && snapAhorro
      ? (snapAhorro.monto_calculado / registroActual.ingreso_bruto) * 100
      : null

  // Ingreso medio del año en curso (solo meses registrados)
  const registrosAnio = registros.filter((r) => r.anio === anio)
  const mediaAnio =
    registrosAnio.length > 0
      ? registrosAnio.reduce((s, r) => s + r.ingreso_bruto, 0) / registrosAnio.length
      : null

  // Mejor mes del año
  const mejorMes =
    registrosAnio.length > 0
      ? registrosAnio.reduce((best, r) =>
          r.ingreso_bruto > best.ingreso_bruto ? r : best
        )
      : null

  // Total ahorrado en huchas (saldo actual sumado)
  const totalHuchas = huchas
    .filter((h) => h.activa)
    .reduce((s, h) => s + h.saldo_actual, 0)

  // Detectar desync: si alguna categoría fue modificada DESPUÉS del último update del registro
  const hayDesync = (() => {
    if (!registroActual || categorias.length === 0) return false
    const registroFecha = registroActual.updated_at ?? registroActual.created_at ?? ''
    const maxCatFecha = categorias.reduce((max, cat) => {
      const f = cat.updated_at ?? cat.created_at ?? ''
      return f > max ? f : max
    }, '')
    return maxCatFecha > registroFecha
  })()

  function irMes(delta: number) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++ }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio-- }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selector de mes */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => irMes(-1)}>{'<'}</Button>
          <span className="font-medium min-w-32 text-center">
            {MESES[mes - 1]} {anio}
          </span>
          <Button variant="outline" size="sm" onClick={() => irMes(1)}>{'>'}</Button>
        </div>
      </div>

      {/* Aviso de desincronización de categorías */}
      {registroActual && hayDesync && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <span className="font-medium">Tus categorías han cambiado</span> — la distribución mostrada puede no estar actualizada.
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 text-yellow-800 dark:text-yellow-200 border-yellow-400">
            <Link href="/ingresos">Actualizar distribución →</Link>
          </Button>
        </div>
      )}

      {registroActual ? (
        <>
          {/* Fila superior: ingreso principal + métricas rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ingreso del mes */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ingreso {MESES[mes - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatEuro(registroActual.ingreso_bruto)}</p>
                {registroActual.notas && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{registroActual.notas}</p>
                )}
              </CardContent>
            </Card>

            {/* Comparativa mes anterior */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  vs {MESES[mesPrevNum - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {diferenciaMes !== null ? (
                  <>
                    <p
                      className={`text-2xl font-bold ${
                        diferenciaMes >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                      }`}
                    >
                      {diferenciaMes >= 0 ? '+' : ''}{formatEuro(diferenciaMes)}
                    </p>
                    {diferenciaPct !== null && (
                      <p className={`text-xs mt-1 ${diferenciaPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatPct(diferenciaPct)} respecto al mes anterior
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Sin datos del mes anterior</p>
                )}
              </CardContent>
            </Card>

            {/* Media del año */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Media {anio}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mediaAnio !== null ? (
                  <>
                    <p className="text-2xl font-bold">{formatEuro(mediaAnio)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {registrosAnio.length} mes{registrosAnio.length !== 1 ? 'es' : ''} registrado{registrosAnio.length !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Sin registros este año</p>
                )}
              </CardContent>
            </Card>

            {/* Tasa de ahorro o mejor mes */}
            {tasaAhorro !== null ? (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tasa de ahorro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {tasaAhorro.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatEuro(snapAhorro!.monto_calculado)} ahorrados este mes
                  </p>
                </CardContent>
              </Card>
            ) : mejorMes ? (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Mejor mes {anio}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatEuro(mejorMes.ingreso_bruto)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {MESES[mejorMes.mes - 1]}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Huchas activas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatEuro(totalHuchas)}</p>
                  <p className="text-xs text-muted-foreground mt-1">ahorrado en total</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Gráfico donut */}
          {registroActual.snapshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribución del ingreso</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  segmentos={registroActual.snapshots.map((s) => ({
                    nombre: s.categoria_nombre,
                    porcentaje: s.porcentaje,
                    monto: s.monto_calculado,
                    color: s.color,
                    icono: s.icono ?? '💰',
                  }))}
                  ingreso={registroActual.ingreso_bruto}
                />
              </CardContent>
            </Card>
          )}

          {/* Tarjetas por categoría */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Por categoría</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {registroActual.snapshots.map((snap) => (
                <Card key={snap.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: snap.color }} />
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{snap.icono ?? '💰'}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{snap.categoria_nombre}</p>
                        <Badge variant="outline" className="text-xs">{snap.porcentaje}%</Badge>
                      </div>
                    </div>
                    <p className="text-xl font-bold">{formatEuro(snap.monto_calculado)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Sin ingreso registrado */
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-5xl mb-4">💵</p>
            <h2 className="text-xl font-semibold mb-2">
              Sin ingreso registrado para {MESES[mes - 1]} {anio}
            </h2>
            <p className="text-muted-foreground mb-6">
              Registra tu ingreso mensual para ver la distribución por categorías.
            </p>
            <Button asChild>
              <Link href="/ingresos">Registrar ingreso</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumen huchas + total ahorrado */}
      {huchas.filter((h) => h.activa).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Huchas en progreso</h2>
              <p className="text-xs text-muted-foreground">
                Total ahorrado: <span className="font-medium text-foreground">{formatEuro(totalHuchas)}</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/huchas">Ver todas</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {huchasActivas.map((hucha) => {
              const progreso = Math.min((hucha.saldo_actual / hucha.objetivo) * 100, 100)
              return (
                <Link key={hucha.id} href={`/huchas/${hucha.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: hucha.color ?? '#4ECDC4' }} />
                    <CardContent className="py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{hucha.icono}</span>
                        <p className="font-medium text-sm truncate">{hucha.nombre}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatEuro(hucha.saldo_actual)}</span>
                          <span>{formatEuro(hucha.objetivo)}</span>
                        </div>
                        <Progress value={progreso} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">
                          {progreso.toFixed(1)}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
