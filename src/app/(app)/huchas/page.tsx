'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import type { Hucha, Aportacion } from '@/lib/db/schema'

type HuchaConSaldo = Hucha & { aportaciones: Aportacion[]; saldo_actual: number }

const ICONOS_HUCHAS = ['🐷', '🎯', '✈️', '🏖️', '🚗', '🏠', '💍', '📱', '🎸', '🎓', '🏋️', '💊']
const COLORES_HUCHAS = [
  '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F0A500', '#6C5CE7', '#A29BFE',
]

function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

export default function HuchasPage() {
  const [huchas, setHuchas] = useState<HuchaConSaldo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState('#4ECDC4')
  const [icono, setIcono] = useState('🐷')
  const [fechaObjetivo, setFechaObjetivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargarHuchas() {
    const res = await fetch('/api/huchas')
    if (res.ok) {
      const data = await res.json()
      setHuchas(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarHuchas()
  }, [])

  function resetForm() {
    setNombre('')
    setObjetivo('')
    setDescripcion('')
    setColor('#4ECDC4')
    setIcono('🐷')
    setFechaObjetivo('')
  }

  async function handleCrearHucha(e: React.FormEvent) {
    e.preventDefault()
    const obj = parseFloat(objetivo)
    if (isNaN(obj) || obj <= 0) {
      toast.error('El objetivo debe ser mayor a 0')
      return
    }
    setGuardando(true)
    const res = await fetch('/api/huchas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        objetivo: obj,
        descripcion: descripcion || undefined,
        color,
        icono,
        fecha_objetivo: fechaObjetivo || null,
      }),
    })
    if (res.ok) {
      toast.success('Hucha creada')
      setDialogOpen(false)
      resetForm()
      cargarHuchas()
    } else {
      toast.error('Error al crear hucha')
    }
    setGuardando(false)
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar esta hucha y todas sus aportaciones?')) return
    const res = await fetch(`/api/huchas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Hucha eliminada')
      cargarHuchas()
    } else {
      toast.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Huchas</h1>
          <p className="text-muted-foreground text-sm">Objetivos de ahorro</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>+ Nueva hucha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva hucha</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrearHucha} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Vacaciones, Coche nuevo..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Objetivo (€)</Label>
                <Input
                  type="number"
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  placeholder="3000"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Verano en Italia..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha objetivo (opcional)</Label>
                <Input
                  type="date"
                  value={fechaObjetivo}
                  onChange={(e) => setFechaObjetivo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Icono</Label>
                <div className="grid grid-cols-6 gap-1">
                  {ICONOS_HUCHAS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={`text-2xl p-1 rounded hover:bg-muted ${
                        icono === i ? 'ring-2 ring-primary bg-muted' : ''
                      }`}
                      onClick={() => setIcono(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_HUCHAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full hover:scale-110 transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? 'Creando...' : 'Crear hucha'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {huchas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-5xl mb-4">🐷</p>
            <h2 className="text-xl font-semibold mb-2">Sin huchas aún</h2>
            <p className="text-muted-foreground mb-6">
              Crea tu primera hucha para empezar a ahorrar hacia un objetivo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {huchas.map((hucha) => {
            const progreso = Math.min((hucha.saldo_actual / hucha.objetivo) * 100, 100)
            const completada = progreso >= 100

            return (
              <Card key={hucha.id} className="overflow-hidden group">
                <div className="h-2" style={{ backgroundColor: hucha.color ?? '#4ECDC4' }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{hucha.icono}</span>
                      <div>
                        <CardTitle className="text-base">{hucha.nombre}</CardTitle>
                        {hucha.descripcion && (
                          <p className="text-xs text-muted-foreground">{hucha.descripcion}</p>
                        )}
                      </div>
                    </div>
                    {completada && (
                      <Badge className="bg-green-500">✓ Completada</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{formatEuro(hucha.saldo_actual)}</span>
                      <span className="text-muted-foreground">de {formatEuro(hucha.objetivo)}</span>
                    </div>
                    <Progress value={progreso} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {progreso.toFixed(1)}%
                    </p>
                  </div>

                  {hucha.fecha_objetivo && (
                    <p className="text-xs text-muted-foreground">
                      🗓️ Objetivo: {new Date(hucha.fecha_objetivo).toLocaleDateString('es-ES')}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {hucha.aportaciones.length} aportación{hucha.aportaciones.length !== 1 ? 'es' : ''}
                  </p>

                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/huchas/${hucha.id}`}>Ver detalle</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleEliminar(hucha.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
