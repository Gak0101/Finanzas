'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
      toast.error('Error al guardar')
    }
  }

  if (loading) {
    return (
      <div className="-mx-4 -my-6 min-h-screen bg-[#0d1118] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-6">
          <div className="h-20 max-w-xl rounded-xl bg-[#151b25]" />
          <div className="h-48 rounded-2xl bg-[#151b25]" />
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-52 rounded-xl bg-[#151b25]" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#0d1118] text-slate-100 sm:p-2 lg:p-4">
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-7 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Presupuesto / distribución</p>
            <h1 className="text-4xl font-medium tracking-[-0.06em] text-slate-50 sm:text-5xl">
              Cada euro, <span className="text-[#c8f56a]">con intención.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Define las reglas que organizan tus ingresos y ajusta cada porcentaje cuando cambien tus prioridades.
            </p>
          </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
              <Button className="bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={handleNueva}>
                <Plus />Nueva categoría
              </Button>
          </DialogTrigger>
            <DialogContent className="border-white/10 bg-[#151b25] text-slate-100">
            <DialogHeader>
                <DialogTitle className="tracking-[-0.04em]">
                {editando ? 'Editar categoría' : 'Nueva categoría'}
              </DialogTitle>
            </DialogHeader>
            <FormCategoria
              categoria={editando}
              coloresPreset={COLORES_PRESET}
              totalActual={totalPorcentaje}
              onGuardar={handleGuardar}
              onCancelar={() => {
                setDialogOpen(false)
                setEditando(null)
              }}
            />
          </DialogContent>
        </Dialog>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#151b25] shadow-[0_18px_45px_rgba(0,0,0,.24)]" aria-label="Estado de la distribución">
          <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.5fr)]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    <Layers3 className="h-3.5 w-3.5 text-[#c8f56a]" />
                    Distribución activa
                  </div>
                  <p className="mt-4 text-5xl font-semibold tracking-[-0.07em] tabular-nums text-slate-50">
                    {totalPorcentaje.toFixed(1)}<span className="ml-1 text-2xl text-slate-500">%</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">de un máximo del 100%</p>
                </div>
                <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  totalOk
                    ? 'border-[#c8f56a]/30 bg-[#c8f56a]/10 text-[#c8f56a]'
                    : 'border-[#e58b8d]/30 bg-[#e58b8d]/10 text-[#f3a5a7]'
                }`}>
                  {totalOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {totalOk
                    ? 'Distribución equilibrada'
                    : totalPorcentaje > 100
                    ? `${(totalPorcentaje - 100).toFixed(1)}% por encima`
                    : `${(100 - totalPorcentaje).toFixed(1)}% por asignar`}
                </div>
              </div>
              <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-[#0d1118]">
                {categorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="h-full min-w-[2px] transition-[width]"
                    style={{ width: `${Math.min(cat.porcentaje, 100)}%`, backgroundColor: cat.color }}
                    title={`${cat.nombre}: ${cat.porcentaje}%`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {categorias.map((cat) => (
                  <span key={cat.id} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nombre}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between border-t border-white/10 bg-[#111821] p-6 lg:border-l lg:border-t-0 sm:p-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Estructura</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] tabular-nums text-[#c8f56a]">{categorias.length}</p>
                <p className="mt-1 text-xs text-slate-400">{categorias.length === 1 ? 'categoría activa' : 'categorías activas'}</p>
              </div>
              <p className="mt-8 text-[10px] leading-relaxed text-slate-500">
                Los porcentajes se aplican automáticamente a cada ingreso mensual.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Reglas de reparto</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-100">Tus categorías</h2>
            </div>
            <span className="text-[10px] text-slate-500">Editar o eliminar en cualquier momento</span>
          </div>

          {categorias.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#151b25] px-6 py-16 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#c8f56a]/10 text-2xl">🏷️</div>
              <h3 className="mt-5 text-lg font-semibold">Aún no hay categorías</h3>
              <p className="mt-2 text-sm text-slate-500">Crea la primera regla para empezar a distribuir tus ingresos.</p>
              <Button className="mt-6 bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={handleNueva}>
                <Plus />Crear categoría
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {categorias.map((cat, index) => (
                <article
                  key={cat.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#151b25] p-5 shadow-[0_14px_34px_rgba(0,0,0,.18)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:p-6"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: cat.color }} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-2xl"
                        style={{ backgroundColor: `${cat.color}18`, borderColor: `${cat.color}45` }}
                      >
                        {cat.icono}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
                          Categoría {String(index + 1).padStart(2, '0')}
                        </p>
                        <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.03em] text-slate-100">{cat.nombre}</h3>
                      </div>
                    </div>
                    <p className="shrink-0 text-3xl font-semibold tracking-[-0.06em] tabular-nums text-slate-50">
                      {cat.porcentaje}<span className="ml-0.5 text-sm text-slate-500">%</span>
                    </p>
                  </div>

                  <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-[#0d1118]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(cat.porcentaje, 100)}%`, backgroundColor: cat.color }} />
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-[10px] text-slate-500">Aplicado al próximo ingreso</span>
                    <div className="flex items-center gap-1.5">
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-slate-400 hover:bg-white/10 hover:text-slate-100"
                      onClick={() => handleEditar(cat)}
                        aria-label={`Editar ${cat.nombre}`}
                        title={`Editar ${cat.nombre}`}
                    >
                        <Pencil />
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-slate-500 hover:bg-[#e58b8d]/10 hover:text-[#f3a5a7]"
                      onClick={() => handleEliminar(cat.id)}
                        aria-label={`Eliminar ${cat.nombre}`}
                        title={`Eliminar ${cat.nombre}`}
                    >
                        <Trash2 />
                    </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
