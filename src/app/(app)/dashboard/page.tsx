'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DonutChart } from '@/components/dashboard/DonutChart'
import Link from 'next/link'
import type { RegistroMensual, SnapshotCategoria, Hucha, Aportacion } from '@/lib/db/schema'

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

type RegistroConSnapshots = RegistroMensual & { snapshots: SnapshotCategoria[] }
type HuchaConSaldo = Hucha & { aportaciones: Aportacion[]; saldo_actual: number }

export default function DashboardPage() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [huchas, setHuchas] = useState<HuchaConSaldo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ingresos').then((r) => r.json()),
      fetch('/api/huchas').then((r) => r.json()),
    ]).then(([ingresos, huchasData]) => {
      setRegistros(ingresos)
      setHuchas(huchasData)
      setLoading(false)
    })
  }, [])

  const registroActual = registros.find((r) => r.anio === anio && r.mes === mes)
  const huchasActivas = huchas.filter((h) => h.activa && h.saldo_actual < h.objetivo)

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

      {registroActual ? (
        <>
          {/* Tarjeta principal de ingreso */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingreso de {MESES[mes - 1]} {anio}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{formatEuro(registroActual.ingreso_bruto)}</p>
              {registroActual.notas && (
                <p className="text-sm text-muted-foreground mt-2">{registroActual.notas}</p>
              )}
            </CardContent>
          </Card>

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

      {/* Huchas activas en progreso */}
      {huchasActivas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Huchas en progreso</h2>
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
