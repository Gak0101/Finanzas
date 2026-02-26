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
import type { RegistroMensual, SnapshotCategoria } from '@/lib/db/schema'

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(val)
}

type RegistroConSnapshots = RegistroMensual & { snapshots: SnapshotCategoria[] }

export default function HistorialPage() {
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [loading, setLoading] = useState(true)
  const [anioFiltro, setAnioFiltro] = useState<number | 'todos'>('todos')
  const [expandido, setExpandido] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/historial')
      .then((r) => r.json())
      .then((data) => {
        setRegistros(data)
        setLoading(false)
      })
  }, [])

  const aniosDisponibles = [...new Set(registros.map((r) => r.anio))].sort((a, b) => b - a)

  const registrosFiltrados =
    anioFiltro === 'todos' ? registros : registros.filter((r) => r.anio === anioFiltro)

  // Datos para el gráfico de barras (ordenados cronológicamente)
  const datosGrafico = [...registrosFiltrados]
    .sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio
      return a.mes - b.mes
    })
    .map((r) => ({
      label: `${MESES_CORTO[r.mes - 1]} ${r.anio !== new Date().getFullYear() ? String(r.anio).slice(2) : ''}`,
      ingreso: r.ingreso_bruto,
    }))

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial</h1>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              anioFiltro === 'todos'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
            onClick={() => setAnioFiltro('todos')}
          >
            Todos
          </button>
          {aniosDisponibles.map((anio) => (
            <button
              key={anio}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                anioFiltro === anio
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              onClick={() => setAnioFiltro(anio)}
            >
              {anio}
            </button>
          ))}
        </div>
      </div>

      {registros.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-5xl mb-4">📅</p>
            <h2 className="text-xl font-semibold mb-2">Sin historial aún</h2>
            <p className="text-muted-foreground">
              Registra tus ingresos mensuales para ver la evolución aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gráfico de barras */}
          {datosGrafico.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolución de ingresos</CardTitle>
              </CardHeader>
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

          {/* Estadísticas rápidas */}
          {registrosFiltrados.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Promedio mensual</p>
                  <p className="font-bold">
                    {formatEuro(
                      registrosFiltrados.reduce((a, r) => a + r.ingreso_bruto, 0) /
                        registrosFiltrados.length
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Mejor mes</p>
                  <p className="font-bold">
                    {formatEuro(Math.max(...registrosFiltrados.map((r) => r.ingreso_bruto)))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total registrado</p>
                  <p className="font-bold">
                    {formatEuro(registrosFiltrados.reduce((a, r) => a + r.ingreso_bruto, 0))}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabla de registros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registros detallados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {registrosFiltrados.map((r) => (
                  <div key={r.id}>
                    <button
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {MESES[r.mes - 1]} {r.anio}
                        </p>
                        {r.notas && (
                          <p className="text-xs text-muted-foreground">{r.notas}</p>
                        )}
                      </div>
                      <p className="text-lg font-bold">{formatEuro(r.ingreso_bruto)}</p>
                      <Badge variant="outline" className="text-xs">
                        {r.snapshots.length} cat.
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {expandido === r.id ? '▲' : '▼'}
                      </span>
                    </button>

                    {expandido === r.id && (
                      <div className="px-6 pb-4 bg-muted/20">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                          {r.snapshots.map((snap) => (
                            <div
                              key={snap.id}
                              className="flex items-center gap-2 p-2 rounded bg-background"
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: snap.color }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">
                                  {snap.icono} {snap.categoria_nombre}
                                </p>
                                <p className="text-sm font-medium">
                                  {formatEuro(snap.monto_calculado)}
                                </p>
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
    </div>
  )
}
