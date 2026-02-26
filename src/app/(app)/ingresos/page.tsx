'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { RegistroMensual, SnapshotCategoria } from '@/lib/db/schema'

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

export default function IngresosPage() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ingresoBruto, setIngresoBruto] = useState('')
  const [notas, setNotas] = useState('')
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  async function cargarRegistros() {
    const res = await fetch('/api/ingresos')
    if (res.ok) {
      const data = await res.json()
      setRegistros(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarRegistros()
  }, [])

  const registroExistente = registros.find((r) => r.anio === anio && r.mes === mes)

  function handleEditar(registro: RegistroConSnapshots) {
    setAnio(registro.anio)
    setMes(registro.mes)
    setIngresoBruto(String(registro.ingreso_bruto))
    setNotas(registro.notas ?? '')
    setEditandoId(registro.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este registro mensual?')) return
    const res = await fetch(`/api/ingresos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Registro eliminado')
      if (editandoId === id) {
        setEditandoId(null)
        setIngresoBruto('')
        setNotas('')
      }
      cargarRegistros()
    } else {
      toast.error('Error al eliminar')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const importe = parseFloat(ingresoBruto)
    if (isNaN(importe) || importe <= 0) {
      toast.error('Ingresa un importe válido')
      return
    }

    setGuardando(true)

    const url = editandoId ? `/api/ingresos/${editandoId}` : '/api/ingresos'
    const method = editandoId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anio,
        mes,
        ingreso_bruto: importe,
        notas: notas || undefined,
      }),
    })

    if (res.ok) {
      toast.success(editandoId ? 'Ingreso actualizado' : 'Ingreso registrado')
      setEditandoId(null)
      setIngresoBruto('')
      setNotas('')
      cargarRegistros()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Error al guardar')
    }

    setGuardando(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ingresos</h1>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editandoId ? 'Editar ingreso' : 'Registrar ingreso mensual'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mes</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={mes}
                  onChange={(e) => setMes(parseInt(e.target.value))}
                  disabled={!!editandoId}
                >
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Input
                  type="number"
                  value={anio}
                  onChange={(e) => setAnio(parseInt(e.target.value))}
                  min={2020}
                  max={2030}
                  disabled={!!editandoId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ingreso bruto (€)</Label>
              <Input
                type="number"
                value={ingresoBruto}
                onChange={(e) => setIngresoBruto(e.target.value)}
                placeholder="2500.00"
                min="0.01"
                step="0.01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Paga extra, mes con bonus..."
                rows={2}
              />
            </div>

            {registroExistente && !editandoId && (
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-sm text-yellow-800 dark:text-yellow-200">
                Ya existe un registro para {MESES[mes - 1]} {anio}.
                Pulsa en "Editar" en la lista inferior para modificarlo.
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={guardando || (!!registroExistente && !editandoId)}
              >
                {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Registrar ingreso'}
              </Button>
              {editandoId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditandoId(null)
                    setIngresoBruto('')
                    setNotas('')
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de registros */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Registros</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : registros.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No hay registros aún. Registra tu primer ingreso.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {registros.map((r) => (
              <Card key={r.id} className="group">
                <CardContent className="py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">
                        {MESES[r.mes - 1]} {r.anio}
                      </p>
                      {r.notas && (
                        <p className="text-xs text-muted-foreground">{r.notas}</p>
                      )}
                    </div>
                    <p className="text-lg font-bold">{formatEuro(r.ingreso_bruto)}</p>
                    <Badge variant="outline">{r.snapshots.length} categorías</Badge>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditar(r)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleEliminar(r.id)}
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
    </div>
  )
}
