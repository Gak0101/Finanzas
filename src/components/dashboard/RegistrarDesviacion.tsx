// Editado: 2026-03-30 — Componente simplificado para reajustar distribución
// El usuario elige una categoría, pone el monto real, y el resto se recalcula solo
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SnapshotCategoria } from '@/lib/db/schema'

// Props del componente
interface Props {
  registroId: number
  snapshots: SnapshotCategoria[]
  ingresoBruto: number
  onGuardado: () => void
}

// Formatea un número como moneda en euros
function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

export function RegistrarDesviacion({ registroId, snapshots, ingresoBruto, onGuardado }: Props) {
  const [open, setOpen] = useState(false)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [montoReal, setMontoReal] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Snapshot de la categoría seleccionada
  const snapSeleccionado = snapshots.find((s) => s.categoria_nombre === categoriaSeleccionada)
  const montoNum = parseFloat(montoReal) || 0

  // Diferencia entre lo asignado y lo real
  const diferencia = snapSeleccionado ? montoNum - snapSeleccionado.monto_calculado : 0

  // Recalcular el resto de categorías proporcionalmente
  // Si Ahorro sube 280€, las demás bajan 280€ repartido según su peso
  function calcularNuevosSnaps() {
    if (!snapSeleccionado || montoNum <= 0) return null

    // Montos de las categorías que NO están seleccionadas
    const otrasSnaps = snapshots.filter((s) => s.id !== snapSeleccionado.id)
    const totalOtras = otrasSnaps.reduce((s, snap) => s + snap.monto_calculado, 0)

    if (totalOtras <= 0 || diferencia === 0) return null

    // El resto disponible tras asignar el monto real a la categoría seleccionada
    const restoDisponible = ingresoBruto - montoNum

    // Repartir proporcionalmente entre las demás
    return snapshots.map((snap) => {
      if (snap.id === snapSeleccionado.id) {
        return {
          ...snap,
          monto_calculado: Math.round(montoNum * 100) / 100,
          porcentaje: Math.round((montoNum / ingresoBruto) * 10000) / 100,
        }
      }
      // Peso proporcional de esta categoría respecto a las otras
      const peso = snap.monto_calculado / totalOtras
      const nuevoMonto = Math.round(restoDisponible * peso * 100) / 100
      return {
        ...snap,
        monto_calculado: nuevoMonto,
        porcentaje: Math.round((nuevoMonto / ingresoBruto) * 10000) / 100,
      }
    })
  }

  const nuevosSnaps = calcularNuevosSnaps()

  // Guardar el reajuste
  async function handleGuardar() {
    if (!nuevosSnaps) return
    setGuardando(true)

    const res = await fetch(`/api/ingresos/${registroId}/reajustar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshots: nuevosSnaps.map((s) => ({
          id: s.id,
          monto_calculado: s.monto_calculado,
          porcentaje: s.porcentaje,
        })),
        motivo: `Reajuste: ${categoriaSeleccionada} → ${formatEuro(montoNum)}`,
      }),
    })

    if (res.ok) {
      toast.success('Distribución reajustada')
      setCategoriaSeleccionada('')
      setMontoReal('')
      setOpen(false)
      onGuardado()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Error al reajustar')
    }
    setGuardando(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>⚙️</span> Reajustar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reajustar distribución</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cambia el monto real de una categoría y el resto se recalcula proporcionalmente.
        </p>

        <div className="space-y-4 mt-2">
          {/* Paso 1: Elegir categoría */}
          <div className="space-y-2">
            <Label>¿Qué categoría quieres ajustar?</Label>
            <Select value={categoriaSeleccionada} onValueChange={(val) => {
              setCategoriaSeleccionada(val)
              // Pre-rellenar con el monto actual
              const snap = snapshots.find((s) => s.categoria_nombre === val)
              if (snap) setMontoReal(String(snap.monto_calculado))
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.categoria_nombre}>
                    {s.icono} {s.categoria_nombre} — {formatEuro(s.monto_calculado)} ({s.porcentaje}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paso 2: Monto real */}
          {categoriaSeleccionada && (
            <div className="space-y-2">
              <Label>Monto real (€)</Label>
              <Input
                type="number"
                value={montoReal}
                onChange={(e) => setMontoReal(e.target.value)}
                placeholder="580"
                min="0"
                step="0.01"
                autoFocus
              />
              {snapSeleccionado && montoNum > 0 && diferencia !== 0 && (
                <p className="text-xs">
                  Asignado: {formatEuro(snapSeleccionado.monto_calculado)} →{' '}
                  <span className={diferencia > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                    {diferencia > 0 ? '+' : ''}{formatEuro(diferencia)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Vista previa del reajuste */}
          {nuevosSnaps && diferencia !== 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">📊 Nueva distribución:</p>
              {nuevosSnaps.map((snap) => {
                const original = snapshots.find((s) => s.id === snap.id)
                const cambio = original ? snap.monto_calculado - original.monto_calculado : 0
                const cambiado = Math.abs(cambio) > 0.01

                return (
                  <div key={snap.id} className="flex items-center justify-between text-sm">
                    <span className={cambiado ? 'font-medium' : 'text-muted-foreground'}>
                      {snap.icono ?? '💰'} {snap.categoria_nombre}
                    </span>
                    <div className="text-right">
                      {cambiado ? (
                        <>
                          <span className="text-muted-foreground line-through text-xs mr-2">
                            {formatEuro(original!.monto_calculado)}
                          </span>
                          <span className={cambio > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                            {formatEuro(snap.monto_calculado)}
                          </span>
                        </>
                      ) : (
                        <span>{formatEuro(snap.monto_calculado)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="border-t pt-1 flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>{formatEuro(nuevosSnaps.reduce((s, snap) => s + snap.monto_calculado, 0))}</span>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={guardando || !nuevosSnaps || diferencia === 0}
            >
              {guardando ? 'Guardando...' : 'Guardar reajuste'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
