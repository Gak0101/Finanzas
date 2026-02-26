'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormCategoria } from '@/components/categorias/FormCategoria'
import type { Categoria } from '@/lib/db/schema'

const COLORES_PRESET = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4',
  '#84cc16', '#f59e0b',
]

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)

  const totalPorcentaje = categorias.reduce((acc, c) => acc + c.porcentaje, 0)
  const totalOk = Math.abs(totalPorcentaje - 100) < 0.01

  async function cargarCategorias() {
    const res = await fetch('/api/categorias')
    if (res.ok) {
      const data = await res.json()
      setCategorias(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarCategorias()
  }, [])

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar esta categoría?')) return
    const res = await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Categoría eliminada')
      cargarCategorias()
    } else {
      toast.error('Error al eliminar')
    }
  }

  function handleEditar(cat: Categoria) {
    setEditando(cat)
    setDialogOpen(true)
  }

  function handleNueva() {
    setEditando(null)
    setDialogOpen(true)
  }

  async function handleGuardar(datos: {
    nombre: string
    porcentaje: number
    color: string
    icono: string
  }) {
    const url = editando ? `/api/categorias/${editando.id}` : '/api/categorias'
    const method = editando ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, orden: editando?.orden ?? categorias.length }),
    })

    if (res.ok) {
      toast.success(editando ? 'Categoría actualizada' : 'Categoría creada')
      setDialogOpen(false)
      setEditando(null)
      cargarCategorias()
    } else {
      const err = await res.json()
      toast.error('Error al guardar')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-muted-foreground text-sm">
            Define cómo distribuir tus ingresos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNueva}>+ Nueva categoría</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editando ? 'Editar categoría' : 'Nueva categoría'}
              </DialogTitle>
            </DialogHeader>
            <FormCategoria
              categoria={editando}
              coloresPreset={COLORES_PRESET}
              onGuardar={handleGuardar}
              onCancelar={() => {
                setDialogOpen(false)
                setEditando(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Indicador de total */}
      <Card className={totalOk ? 'border-green-500' : 'border-destructive'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total asignado</span>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-2xl font-bold">
                  {totalPorcentaje.toFixed(1)}%
                </span>
                <span className="text-muted-foreground"> / 100%</span>
              </div>
              <Badge variant={totalOk ? 'default' : 'destructive'}>
                {totalOk
                  ? '✓ Correcto'
                  : totalPorcentaje > 100
                  ? `+${(totalPorcentaje - 100).toFixed(1)}% exceso`
                  : `${(100 - totalPorcentaje).toFixed(1)}% restante`}
              </Badge>
            </div>
          </div>
          {/* Barra visual */}
          <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalOk ? 'bg-green-500' : totalPorcentaje > 100 ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(totalPorcentaje, 100)}%` }}
            />
          </div>
          {/* Segmentos de colores */}
          {categorias.length > 0 && (
            <div className="mt-2 h-2 rounded-full overflow-hidden flex">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    width: `${Math.min(cat.porcentaje, 100)}%`,
                    backgroundColor: cat.color,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de categorías */}
      {categorias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-muted-foreground">No tienes categorías aún.</p>
            <p className="text-sm text-muted-foreground">
              Crea tu primera categoría para empezar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {categorias.map((cat) => (
            <Card key={cat.id} className="group">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Color indicator */}
                  <div
                    className="w-4 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  {/* Icono */}
                  <span className="text-2xl">{cat.icono}</span>
                  {/* Nombre */}
                  <div className="flex-1">
                    <p className="font-medium">{cat.nombre}</p>
                  </div>
                  {/* Porcentaje */}
                  <Badge variant="outline" className="text-base font-bold px-3 py-1">
                    {cat.porcentaje}%
                  </Badge>
                  {/* Acciones */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditar(cat)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleEliminar(cat.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
