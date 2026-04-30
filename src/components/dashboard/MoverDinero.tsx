// Editado: 2026-04-08 — Componente para mover dinero entre categorías
// Crea una deuda pendiente que se arrastra al mes siguiente
// Ejemplo: Muevo 150€ del Ahorro a Gastos → me queda como deuda hacia Ahorro
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

// Props del componente: snapshots actuales, id del registro, y callback al guardar
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

export function MoverDinero({ registroId, snapshots, ingresoBruto, onGuardado }: Props) {
  const [open, setOpen] = useState(false)
  const [origen, setOrigen] = useState('')      // De dónde saco el dinero (ej: Ahorro)
  const [destino, setDestino] = useState('')     // A dónde lo meto (ej: Gastos fijos)
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const montoNum = parseFloat(monto) || 0
  const snapOrigen = snapshots.find((s) => s.categoria_nombre === origen)
  const snapDestino = snapshots.find((s) => s.categoria_nombre === destino)

  // Reseteamos el formulario
  function resetForm() {
    setOrigen('')
    setDestino('')
    setMonto('')
    setMotivo('')
  }

  // Guardar: 1) registrar desviación pendiente, 2) actualizar snapshots
  async function handleGuardar() {
    if (!origen || !destino || montoNum <= 0) {
      toast.error('Completa todos los campos')
      return
    }
    if (origen === destino) {
      toast.error('Origen y destino deben ser diferentes')
      return
    }

    setGuardando(true)

    try {
      // 1. Registrar como desviación PENDIENTE (saldada = false) — genera deuda
      const resDesv = await fetch('/api/desviaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registro_id: registroId,
          categoria_origen: origen,
          categoria_destino: destino,
          monto: montoNum,
          motivo: motivo || `Movimiento: ${formatEuro(montoNum)} de ${origen} a ${destino}`,
          etiqueta: 'movimiento_manual',
        }),
      })

      if (!resDesv.ok) {
        const err = await resDesv.json()
        toast.error(err.error || 'Error al registrar movimiento')
        setGuardando(false)
        return
      }

      // 2. Actualizar snapshots — mover monto entre categorías
      const nuevosSnaps = snapshots.map((snap) => {
        if (snap.categoria_nombre === origen) {
          // Categoría origen: pierde dinero
          const nuevoMonto = Math.round((snap.monto_calculado - montoNum) * 100) / 100
          return {
            id: snap.id,
            monto_calculado: nuevoMonto,
            porcentaje: snap.porcentaje,
          }
        }
        if (snap.categoria_nombre === destino) {
          // Categoría destino: gana dinero
          const nuevoMonto = Math.round((snap.monto_calculado + montoNum) * 100) / 100
          return {
            id: snap.id,
            monto_calculado: nuevoMonto,
            porcentaje: snap.porcentaje,
          }
        }
        // Las demás no cambian
        return {
          id: snap.id,
          monto_calculado: snap.monto_calculado,
          porcentaje: snap.porcentaje,
        }
      })

      // Llamar al reajustar para actualizar los snapshots (sin crear otra desviación interna)
      const resReajuste = await fetch(`/api/ingresos/${registroId}/reajustar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshots: nuevosSnaps,
          motivo: `Movimiento: ${formatEuro(montoNum)} de ${origen} a ${destino}`,
          // No crear desviación adicional desde reajustar, ya la creamos arriba
          skipDesviacion: true,
        }),
      })

      if (resReajuste.ok) {
        toast.success(`Movido ${formatEuro(montoNum)} de ${origen} a ${destino}. Queda como deuda pendiente.`)
        resetForm()
        setOpen(false)
        onGuardado()
      } else {
        toast.error('Error al actualizar distribución')
      }
    } catch {
      toast.error('Error de conexión')
    }

    setGuardando(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>💸</span> Mover dinero
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover dinero entre categorías</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Mueve dinero de una categoría a otra. Quedará registrado como <strong>deuda pendiente</strong> para el mes siguiente.
        </p>

        <div className="space-y-4 mt-2">
          {/* De dónde sale */}
          <div className="space-y-2">
            <Label>Sacar dinero de:</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger>
                <SelectValue placeholder="¿De dónde sacas?" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.categoria_nombre}>
                    {s.icono} {s.categoria_nombre} — {formatEuro(s.monto_calculado)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* A dónde va */}
          <div className="space-y-2">
            <Label>Meter dinero en:</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="¿A dónde va?" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.filter((s) => s.categoria_nombre !== origen).map((s) => (
                  <SelectItem key={s.id} value={s.categoria_nombre}>
                    {s.icono} {s.categoria_nombre} — {formatEuro(s.monto_calculado)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuánto */}
          <div className="space-y-2">
            <Label>Cuánto (€)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="150"
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>¿Para qué? (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Necesito cubrir gastos extra este mes..."
              rows={2}
            />
          </div>

          {/* Vista previa */}
          {montoNum > 0 && origen && destino && snapOrigen && snapDestino && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
              <p className="font-medium">📊 Vista previa:</p>
              <div className="flex justify-between">
                <span>{snapOrigen.icono} {origen}</span>
                <span>
                  <span className="text-muted-foreground line-through text-xs mr-1">{formatEuro(snapOrigen.monto_calculado)}</span>
                  <span className="text-red-500 font-medium">{formatEuro(snapOrigen.monto_calculado - montoNum)}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{snapDestino.icono} {destino}</span>
                <span>
                  <span className="text-muted-foreground line-through text-xs mr-1">{formatEuro(snapDestino.monto_calculado)}</span>
                  <span className="text-green-600 font-medium">{formatEuro(snapDestino.monto_calculado + montoNum)}</span>
                </span>
              </div>
              <div className="border-t pt-2 text-xs text-orange-600 dark:text-orange-400">
                ⚠️ Esto genera una deuda de {formatEuro(montoNum)} hacia <strong>{origen}</strong> que se recordará el mes siguiente.
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { resetForm(); setOpen(false) }}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={guardando || montoNum <= 0 || !origen || !destino}
            >
              {guardando ? 'Guardando...' : 'Mover dinero'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
