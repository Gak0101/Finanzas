'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Hucha, Aportacion } from '@/lib/db/schema'

type HuchaConSaldo = Hucha & { aportaciones: Aportacion[]; saldo_actual: number }

function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

export default function HuchaDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const [hucha, setHucha] = useState<HuchaConSaldo | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form aportación
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notasAportacion, setNotasAportacion] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargarHucha() {
    const res = await fetch(`/api/huchas/${id}`)
    if (res.ok) {
      const data = await res.json()
      setHucha(data)
    } else {
      toast.error('Hucha no encontrada')
      router.push('/huchas')
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarHucha()
  }, [id])

  async function handleAportacion(e: React.FormEvent) {
    e.preventDefault()
    const cant = parseFloat(cantidad)
    if (isNaN(cant) || cant === 0) {
      toast.error('La cantidad no puede ser 0')
      return
    }
    setGuardando(true)
    const res = await fetch(`/api/huchas/${id}/aportaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cantidad: cant,
        fecha,
        notas: notasAportacion || undefined,
      }),
    })
    if (res.ok) {
      toast.success('Aportación registrada')
      setDialogOpen(false)
      setCantidad('')
      setNotasAportacion('')
      setFecha(new Date().toISOString().split('T')[0])
      cargarHucha()
    } else {
      toast.error('Error al registrar aportación')
    }
    setGuardando(false)
  }

  async function handleEliminarAportacion(aportacionId: number) {
    if (!confirm('¿Eliminar esta aportación?')) return
    const res = await fetch(
      `/api/huchas/${id}/aportaciones?aportacion_id=${aportacionId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      toast.success('Aportación eliminada')
      cargarHucha()
    } else {
      toast.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!hucha) return null

  const progreso = Math.min((hucha.saldo_actual / hucha.objetivo) * 100, 100)
  const completada = progreso >= 100

  // Datos para el gráfico de evolución del saldo
  const aportacionesOrdenadas = [...hucha.aportaciones].sort(
    (a, b) => a.fecha.localeCompare(b.fecha)
  )
  let saldoAcumulado = 0
  const datosGrafico = aportacionesOrdenadas.map((ap) => {
    saldoAcumulado += ap.cantidad
    return {
      fecha: ap.fecha,
      saldo: Math.round(saldoAcumulado * 100) / 100,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/huchas">← Volver</Link>
        </Button>
      </div>

      {/* Info de la hucha */}
      <Card className="overflow-hidden">
        <div className="h-2" style={{ backgroundColor: hucha.color ?? '#4ECDC4' }} />
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{hucha.icono}</span>
            <div>
              <CardTitle className="text-xl">{hucha.nombre}</CardTitle>
              {hucha.descripcion && (
                <p className="text-muted-foreground text-sm">{hucha.descripcion}</p>
              )}
            </div>
            {completada && <Badge className="bg-green-500 ml-auto">✓ Completada</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-3xl font-bold">{formatEuro(hucha.saldo_actual)}</span>
              <span className="text-muted-foreground self-end">
                de {formatEuro(hucha.objetivo)}
              </span>
            </div>
            <Progress value={progreso} className="h-3" />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">{progreso.toFixed(1)}% completado</span>
              <span className="text-muted-foreground">
                Faltan {formatEuro(Math.max(hucha.objetivo - hucha.saldo_actual, 0))}
              </span>
            </div>
          </div>

          {hucha.fecha_objetivo && (
            <p className="text-sm text-muted-foreground">
              🗓️ Fecha objetivo: {new Date(hucha.fecha_objetivo).toLocaleDateString('es-ES')}
            </p>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ Añadir aportación</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva aportación</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAportacion} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cantidad (€)</Label>
                  <Input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="150.00 (negativo para retirada)"
                    step="0.01"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa cantidad negativa para registrar una retirada
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    value={notasAportacion}
                    onChange={(e) => setNotasAportacion(e.target.value)}
                    placeholder="Paga extra enero..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Añadir aportación'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Gráfico de evolución */}
      {datosGrafico.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    const [y, m, d] = v.split('-')
                    return `${d}/${m}`
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(val) => [formatEuro(Number(val)), 'Saldo']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke={hucha.color ?? '#4ECDC4'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Historial de aportaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aportaciones ({hucha.aportaciones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hucha.aportaciones.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No hay aportaciones aún. Añade la primera.
            </p>
          ) : (
            <div className="space-y-2">
              {[...hucha.aportaciones]
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map((ap, i) => (
                  <div key={ap.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 py-2 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              ap.cantidad >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {ap.cantidad >= 0 ? '+' : ''}{formatEuro(ap.cantidad)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(ap.fecha).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        {ap.notas && (
                          <p className="text-xs text-muted-foreground">{ap.notas}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => handleEliminarAportacion(ap.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
