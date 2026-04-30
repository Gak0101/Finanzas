'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Categoria } from '@/lib/db/schema'

const ICONOS_PRESET = [
  '🏠', '🛒', '🚗', '🎮', '💰', '📦', '💊', '✈️', '🍽️',
  '👕', '📚', '🏋️', '🎵', '💻', '🐾', '🎁', '🔧', '💡',
]

interface Props {
  categoria?: Categoria | null
  coloresPreset: string[]
  totalActual?: number
  onGuardar: (datos: { nombre: string; porcentaje: number; color: string; icono: string }) => void
  onCancelar: () => void
}

export function FormCategoria({ categoria, coloresPreset, totalActual = 0, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [porcentaje, setPorcentaje] = useState(String(categoria?.porcentaje ?? ''))
  const [color, setColor] = useState(categoria?.color ?? '#6366f1')
  const [icono, setIcono] = useState(categoria?.icono ?? '💰')
  const [error, setError] = useState('')

  const pct = parseFloat(porcentaje)
  const totalSinActual = categoria ? totalActual - (categoria.porcentaje ?? 0) : totalActual
  const restante = Number.isFinite(pct) ? 100 - totalSinActual - pct : 100 - totalSinActual

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('El porcentaje debe ser entre 0.1 y 100')
      return
    }

    if (totalSinActual + pct > 100) {
      setError(`El total no puede superar 100%. Te quedarían ${(100 - totalSinActual).toFixed(1)}% disponibles.`)
      return
    }

    onGuardar({ nombre: nombre.trim(), porcentaje: pct, color, icono })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Alimentación, Ocio, Ahorro..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Porcentaje (%)</Label>
        <Input
          type="number"
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
          placeholder="20"
          min="0.1"
          max="100"
          step="0.1"
          required
        />
        {porcentaje && !isNaN(pct) && (
          <p className={`text-xs ${restante >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
            {restante >= 0
              ? `Quedan ${restante.toFixed(1)}% por asignar al resto de categorías.`
              : `Te pasas en ${Math.abs(restante).toFixed(1)}%.`}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Icono</Label>
        <div className="grid grid-cols-9 gap-1">
          {ICONOS_PRESET.map((i) => (
            <button
              key={i}
              type="button"
              className={`text-xl p-1 rounded hover:bg-muted transition-colors ${
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
          {coloresPreset.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0"
              title="Color personalizado"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm text-muted-foreground">{color}</span>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit">
          {categoria ? 'Actualizar' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  )
}
