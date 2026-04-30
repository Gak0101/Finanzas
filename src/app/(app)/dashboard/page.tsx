// Editado: 2026-03-30 — Integración del sistema de desviaciones/deudas en dashboard
// Se añade: carga de desviaciones, banner de deudas pendientes, badges por categoría,
// botón registrar desviación, y sección de análisis inteligente
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { DonutChart } from '@/components/dashboard/DonutChart'
// Editado: 2026-04-08 — Import del componente MoverDinero para transferencias con deuda
import { MoverDinero } from '@/components/dashboard/MoverDinero'
import { FormCategoria } from '@/components/categorias/FormCategoria'
import Link from 'next/link'
import type { RegistroMensual, SnapshotCategoria, Hucha, Aportacion, Categoria, Desviacion } from '@/lib/db/schema'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLORES_PRESET = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4',
  '#84cc16', '#f59e0b',
]

// Formatea un número como moneda en euros
function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

// Formatea un porcentaje con signo
function formatPct(val: number) {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

type RegistroConSnapshots = RegistroMensual & { snapshots: SnapshotCategoria[] }
type HuchaConSaldo = Hucha & { aportaciones: Aportacion[]; saldo_actual: number }

// Tipo para el análisis inteligente de desviaciones
interface AnalisisData {
  analisis: Array<{
    categoria: string
    total_desviado: number
    num_desviaciones: number
    media_por_desviacion: number
  }>
  sugerencias: string[]
  total_historico: number
  num_total: number
}

// Tipo para las deudas pendientes
interface PendientesData {
  pendientes: Desviacion[]
  resumen: Record<string, { total: number; detalle: Desviacion[] }>
  total_deuda: number
}

type ResumenDeudaCategoria = {
  categoria: string
  prestado: number
  recibido: number
  movimientos: number
}

export default function DashboardPage() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [registros, setRegistros] = useState<RegistroConSnapshots[]>([])
  const [huchas, setHuchas] = useState<HuchaConSaldo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  // Editado: 2026-03-30 — Estados para desviaciones
  const [desviacionesMes, setDesviacionesMes] = useState<Desviacion[]>([])
  const [pendientes, setPendientes] = useState<PendientesData | null>(null)
  const [analisis, setAnalisis] = useState<AnalisisData | null>(null)
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null)
  const [dialogCategoriaOpen, setDialogCategoriaOpen] = useState(false)

  // Carga datos principales: ingresos, huchas, categorías
  function cargarDatos() {
    Promise.all([
      fetch('/api/ingresos').then((r) => r.json()),
      fetch('/api/huchas').then((r) => r.json()),
      fetch('/api/categorias').then((r) => r.json()),
      fetch('/api/desviaciones/pendientes').then((r) => r.json()),
    ]).then(([ingresos, huchasData, catsData, pendientesData]) => {
      setRegistros(ingresos)
      setHuchas(huchasData)
      setCategorias(catsData)
      setPendientes(pendientesData)
      setLoading(false)
    })
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const registroActual = registros.find((r) => r.anio === anio && r.mes === mes)
  const huchasActivas = huchas.filter((h) => h.activa && h.saldo_actual < h.objetivo)

  // Editado: 2026-03-30 — Cargar desviaciones del mes cuando cambia el registro
  useEffect(() => {
    if (registroActual) {
      fetch(`/api/desviaciones?registro_id=${registroActual.id}`)
        .then((r) => r.json())
        .then(setDesviacionesMes)
    } else {
      setDesviacionesMes([])
    }
  }, [registroActual?.id])

  // Mes anterior para comparativa
  const mesPrevNum = mes === 1 ? 12 : mes - 1
  const anioPrevNum = mes === 1 ? anio - 1 : anio
  const registroAnterior = registros.find((r) => r.anio === anioPrevNum && r.mes === mesPrevNum)

  // Diferencia vs mes anterior
  const diferenciaMes =
    registroActual && registroAnterior
      ? registroActual.ingreso_bruto - registroAnterior.ingreso_bruto
      : null

  const diferenciaPct =
    registroActual && registroAnterior && registroAnterior.ingreso_bruto > 0
      ? ((registroActual.ingreso_bruto - registroAnterior.ingreso_bruto) /
          registroAnterior.ingreso_bruto) *
        100
      : null

  // Tasa de ahorro: buscar la categoría cuyo nombre contenga "ahorro" (case-insensitive)
  const snapAhorro = registroActual?.snapshots.find((s) =>
    s.categoria_nombre.toLowerCase().includes('ahorro')
  )
  const ingresoDisponible = registroActual
    ? registroActual.snapshots.reduce((s, snap) => s + snap.monto_calculado, 0)
    : null
  const tasaAhorro =
    ingresoDisponible && snapAhorro
      ? (snapAhorro.monto_calculado / ingresoDisponible) * 100
      : null

  // Ingreso medio del año en curso (solo meses registrados)
  const registrosAnio = registros.filter((r) => r.anio === anio)
  const mediaAnio =
    registrosAnio.length > 0
      ? registrosAnio.reduce((s, r) => s + r.ingreso_bruto, 0) / registrosAnio.length
      : null

  // Mejor mes del año
  const mejorMes =
    registrosAnio.length > 0
      ? registrosAnio.reduce((best, r) =>
          r.ingreso_bruto > best.ingreso_bruto ? r : best
        )
      : null

  // Total ahorrado en huchas (saldo actual sumado)
  const totalHuchas = huchas
    .filter((h) => h.activa)
    .reduce((s, h) => s + h.saldo_actual, 0)

  // Detectar desync: si alguna categoría fue modificada DESPUÉS del último update del registro
  const hayDesync = (() => {
    if (!registroActual || categorias.length === 0) return false
    const registroFecha = registroActual.updated_at ?? registroActual.created_at ?? ''
    const maxCatFecha = categorias.reduce((max, cat) => {
      const f = cat.updated_at ?? cat.created_at ?? ''
      return f > max ? f : max
    }, '')
    return maxCatFecha > registroFecha
  })()

  // Editado: 2026-03-30 — Calcula deuda total de una categoría por sus desviaciones del mes
  // Retorna cuánto se desvió de esa categoría (negativo = prestó dinero)
  function getDeudaCategoria(nombreCategoria: string): number {
    let deuda = 0
    for (const d of desviacionesMes) {
      if (d.categoria_origen === nombreCategoria) {
        deuda -= d.monto // Prestó dinero → deuda negativa
      }
      if (d.categoria_destino === nombreCategoria) {
        deuda += d.monto // Recibió dinero → deuda positiva
      }
    }
    return deuda
  }

  const resumenDeudaPorCategoria = Object.values(
    desviacionesMes
      .filter((d) => !d.saldada)
      .reduce<Record<string, ResumenDeudaCategoria>>((acc, d) => {
      if (!acc[d.categoria_origen]) {
        acc[d.categoria_origen] = {
          categoria: d.categoria_origen,
          prestado: 0,
          recibido: 0,
          movimientos: 0,
        }
      }
      if (!acc[d.categoria_destino]) {
        acc[d.categoria_destino] = {
          categoria: d.categoria_destino,
          prestado: 0,
          recibido: 0,
          movimientos: 0,
        }
      }

      acc[d.categoria_origen].prestado += d.monto
      acc[d.categoria_origen].movimientos += 1
      acc[d.categoria_destino].recibido += d.monto
      acc[d.categoria_destino].movimientos += 1
      return acc
    }, {})
  ).filter((item) => item.prestado > 0 || item.recibido > 0)
    .sort((a, b) => b.prestado - a.prestado)

  // Editado: 2026-03-30 — Carga análisis inteligente
  function cargarAnalisis() {
    fetch('/api/desviaciones/analisis')
      .then((r) => r.json())
      .then((data) => {
        setAnalisis(data)
        setMostrarAnalisis(true)
      })
  }

  // Editado: 2026-03-30 — Callback cuando se registra una desviación
  function handleDesviacionGuardada() {
    cargarDatos()
    if (registroActual) {
      fetch(`/api/desviaciones?registro_id=${registroActual.id}`)
        .then((r) => r.json())
        .then(setDesviacionesMes)
    }
  }

  // Editado: 2026-03-30 — Saldar una deuda manualmente
  async function handleSaldarDeuda(desvId: number) {
    const res = await fetch(`/api/desviaciones/${desvId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldada_en_registro_id: registroActual?.id }),
    })
    if (res.ok) {
      cargarDatos()
      if (registroActual) {
        fetch(`/api/desviaciones?registro_id=${registroActual.id}`)
          .then((r) => r.json())
          .then(setDesviacionesMes)
      }
    }
  }

  async function handleSaldarCategoria(categoria: string) {
    if (!registroActual) return

    const res = await fetch('/api/desviaciones/saldar-categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria_origen: categoria, registro_id: registroActual.id }),
    })

    if (res.ok) {
      const resRegenerar = await fetch(`/api/ingresos/${registroActual.id}/regenerar`, {
        method: 'POST',
      })

      if (resRegenerar.ok) {
        toast.success(`Deuda de ${categoria} saldada y mes reajustado`)
      } else {
        toast.success(`Deuda de ${categoria} saldada`)
      }
      cargarDatos()
      fetch(`/api/desviaciones?registro_id=${registroActual.id}`)
        .then((r) => r.json())
        .then(setDesviacionesMes)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || 'Error al saldar la deuda de esa categoría')
    }
  }

  function handleEditarCategoria(cat: Categoria) {
    setEditandoCategoria(cat)
    setDialogCategoriaOpen(true)
  }

  async function handleGuardarCategoria(datos: { nombre: string; porcentaje: number; color: string; icono: string }) {
    if (!editandoCategoria) return

    const res = await fetch(`/api/categorias/${editandoCategoria.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, orden: editandoCategoria.orden ?? categorias.length }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || 'Error al guardar la categoría')
      return
    }

    toast.success('Categoría actualizada')
    setDialogCategoriaOpen(false)
    setEditandoCategoria(null)

    // Recalcular automáticamente el mes que se está viendo para que
    // el usuario no tenga que buscar otro botón.
    if (registroActual) {
      const resRegenerar = await fetch(`/api/ingresos/${registroActual.id}/regenerar`, {
        method: 'POST',
      })

      if (resRegenerar.ok) {
        toast.success('Mes actual actualizado con los nuevos porcentajes')
      } else {
        toast.error('Se guardó la categoría, pero no se pudo actualizar el mes actual')
      }
    }

    cargarDatos()
  }

  // Editado: 2026-03-30 — Eliminar una desviación
  async function handleEliminarDesviacion(desvId: number) {
    if (!confirm('¿Eliminar esta desviación?')) return
    const res = await fetch(`/api/desviaciones/${desvId}`, { method: 'DELETE' })
    if (res.ok) {
      handleDesviacionGuardada()
    }
  }

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

      {/* Aviso de desincronización de categorías */}
      {registroActual && hayDesync && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <span className="font-medium">Tus categorías han cambiado</span> — la distribución mostrada puede no estar actualizada.
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 text-yellow-800 dark:text-yellow-200 border-yellow-400">
            <Link href="/ingresos">Actualizar distribución →</Link>
          </Button>
        </div>
      )}

      {/* Editado: 2026-03-30 — Banner de deudas pendientes de meses anteriores */}
      {pendientes && pendientes.total_deuda > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/50 dark:border-red-800 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-800 dark:text-red-200">
            <span className="text-lg">🔴</span>
            <div className="flex-1">
              <span className="font-medium">Tienes deudas pendientes: {formatEuro(pendientes.total_deuda)}</span>
              <div className="mt-1 space-y-1">
                {Object.entries(pendientes.resumen).map(([cat, info]) => (
                  <p key={cat} className="text-xs">
                    {cat}: <span className="font-medium">{formatEuro(info.total)}</span> pendiente
                    {info.detalle.length > 0 && info.detalle[0].motivo && (
                      <span className="text-red-500/70"> — {info.detalle[0].motivo}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-red-400 text-red-800 dark:text-red-200"
              onClick={cargarAnalisis}
            >
              Ver análisis →
            </Button>
          </div>
        </div>
      )}

      {registroActual ? (
        <>
          {/* Fila superior: ingreso principal + métricas rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ingreso del mes */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ingreso {MESES[mes - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatEuro(registroActual.ingreso_bruto)}</p>
                {registroActual.notas && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{registroActual.notas}</p>
                )}
              </CardContent>
            </Card>

            {/* Comparativa mes anterior */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  vs {MESES[mesPrevNum - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {diferenciaMes !== null ? (
                  <>
                    <p
                      className={`text-2xl font-bold ${
                        diferenciaMes >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                      }`}
                    >
                      {diferenciaMes >= 0 ? '+' : ''}{formatEuro(diferenciaMes)}
                    </p>
                    {diferenciaPct !== null && (
                      <p className={`text-xs mt-1 ${diferenciaPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatPct(diferenciaPct)} respecto al mes anterior
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Sin datos del mes anterior</p>
                )}
              </CardContent>
            </Card>

            {/* Media del año */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Media {anio}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mediaAnio !== null ? (
                  <>
                    <p className="text-2xl font-bold">{formatEuro(mediaAnio)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {registrosAnio.length} mes{registrosAnio.length !== 1 ? 'es' : ''} registrado{registrosAnio.length !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Sin registros este año</p>
                )}
              </CardContent>
            </Card>

            {/* Tasa de ahorro o mejor mes */}
            {tasaAhorro !== null ? (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tasa de ahorro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {tasaAhorro.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatEuro(snapAhorro!.monto_calculado)} ahorrados este mes
                  </p>
                </CardContent>
              </Card>
            ) : mejorMes ? (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Mejor mes {anio}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatEuro(mejorMes.ingreso_bruto)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {MESES[mejorMes.mes - 1]}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Huchas activas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatEuro(totalHuchas)}</p>
                  <p className="text-xs text-muted-foreground mt-1">ahorrado en total</p>
                </CardContent>
              </Card>
            )}
          </div>

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
                  ingreso={ingresoDisponible ?? registroActual.ingreso_bruto}
                />
              </CardContent>
            </Card>
          )}

          {pendientes && pendientes.total_deuda > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-base text-red-700 dark:text-red-200">Deudas pendientes por categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-red-700/80 dark:text-red-200/80">
                  Saldar una categoría marca como pagadas todas sus deudas pendientes.
                </p>
                {Object.entries(pendientes.resumen).map(([cat, info]) => (
                  <div
                    key={cat}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-background px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{cat}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.detalle.length} movimiento{info.detalle.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-red-600 dark:text-red-400">{formatEuro(info.total)}</p>
                      <Button size="sm" variant="outline" onClick={() => handleSaldarCategoria(cat)}>
                        Saldar deuda
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {resumenDeudaPorCategoria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deuda por categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Esto muestra cuánto ha prestado cada categoría este mes y cuánto ha recibido.
                </p>
                {resumenDeudaPorCategoria.map((item) => (
                  <div
                    key={item.categoria}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{item.categoria}</p>
                      <p className="text-xs text-muted-foreground">{item.movimientos} movimiento{item.movimientos !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right text-sm">
                      {item.prestado > 0 && (
                        <p className="text-red-600 dark:text-red-400">Prestado: {formatEuro(item.prestado)}</p>
                      )}
                      {item.recibido > 0 && (
                        <p className="text-green-600 dark:text-green-400">Recibido: {formatEuro(item.recibido)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Neto: {formatEuro(item.recibido - item.prestado)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Dialog open={dialogCategoriaOpen} onOpenChange={setDialogCategoriaOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar categoría</DialogTitle>
              </DialogHeader>
              <FormCategoria
                categoria={editandoCategoria}
                coloresPreset={COLORES_PRESET}
                onGuardar={handleGuardarCategoria}
                onCancelar={() => {
                  setDialogCategoriaOpen(false)
                  setEditandoCategoria(null)
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Editado: 2026-04-08 — Tarjetas por categoría + botón Mover dinero */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Por categoría</h2>
              {/* Botón para mover dinero entre categorías (genera deuda pendiente) */}
              <MoverDinero
                registroId={registroActual.id}
                snapshots={registroActual.snapshots}
                ingresoBruto={registroActual.ingreso_bruto}
                onGuardado={handleDesviacionGuardada}
              />
            </div>
            {/* Editado: 2026-03-30 — Tarjetas simplificadas: solo muestran monto del snapshot */}
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
                      <p className="text-xl font-bold">
                        {formatEuro(snap.monto_calculado)}
                      </p>
                      {(() => {
                        const deudaPrestada = desviacionesMes
                          .filter((d) => d.categoria_origen === snap.categoria_nombre)
                          .reduce((s, d) => s + d.monto, 0)
                        const deudaRecibida = desviacionesMes
                          .filter((d) => d.categoria_destino === snap.categoria_nombre)
                          .reduce((s, d) => s + d.monto, 0)
                        if (deudaPrestada === 0 && deudaRecibida === 0) return null

                        return (
                          <div className="mt-2 text-xs space-y-1">
                            {deudaPrestada > 0 && (
                              <p className="text-red-600 dark:text-red-400">
                                Deuda prestada: {formatEuro(deudaPrestada)}
                              </p>
                            )}
                            {deudaRecibida > 0 && (
                              <p className="text-green-600 dark:text-green-400">
                                Recibido: {formatEuro(deudaRecibida)}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const cat = categorias.find((c) => c.nombre === snap.categoria_nombre)
                            if (cat) handleEditarCategoria(cat)
                          }}
                        >
                          Editar %
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

            </div>
          </div>

          {/* Editado: 2026-03-30 — Lista de desviaciones de este mes */}
          {desviacionesMes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Desviaciones de este mes</h2>
              <div className="space-y-2">
                {desviacionesMes.map((d) => (
                  <Card key={d.id} className="group">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-red-500">
                              -{formatEuro(d.monto)} de {d.categoria_origen}
                            </span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="text-sm font-medium text-green-600">
                              +{formatEuro(d.monto)} a {d.categoria_destino}
                            </span>
                          </div>
                          {d.motivo && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📝 {d.motivo}
                            </p>
                          )}
                          <div className="flex gap-2 mt-1">
                            {d.etiqueta && (
                              <Badge variant="outline" className="text-xs">
                                {d.etiqueta.replace('_', ' ')}
                              </Badge>
                            )}
                            <Badge
                              variant={d.saldada ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {d.saldada ? '✅ Saldada' : '⏳ Pendiente'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!d.saldada && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaldarDeuda(d.id)}
                              title="Marcar como saldada"
                            >
                              ✅
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEliminarDesviacion(d.id)}
                            title="Eliminar"
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Editado: 2026-03-30 — Sección de análisis inteligente (se muestra al pulsar) */}
          {desviacionesMes.length > 0 && !mostrarAnalisis && (
            <div className="flex justify-center">
              <Button variant="ghost" onClick={cargarAnalisis} className="gap-2">
                <span>💡</span> Ver análisis de desviaciones
              </Button>
            </div>
          )}

          {mostrarAnalisis && analisis && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">💡 Análisis de desviaciones</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setMostrarAnalisis(false)}>
                    Cerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumen general */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{analisis.num_total}</p>
                    <p className="text-xs text-muted-foreground">desviaciones totales</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-red-500">{formatEuro(analisis.total_historico)}</p>
                    <p className="text-xs text-muted-foreground">total histórico desviado</p>
                  </div>
                </div>

                {/* Top categorías más desviadas */}
                {analisis.analisis.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Categorías más desviadas:</p>
                    <div className="space-y-2">
                      {analisis.analisis.slice(0, 5).map((a) => (
                        <div key={a.categoria} className="flex items-center gap-3 text-sm">
                          <span className="font-medium flex-1">{a.categoria}</span>
                          <span className="text-muted-foreground">{a.num_desviaciones}x</span>
                          <span className="text-red-500 font-medium">{formatEuro(a.total_desviado)}</span>
                          <span className="text-xs text-muted-foreground">
                            (media: {formatEuro(a.media_por_desviacion)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sugerencias inteligentes */}
                {analisis.sugerencias.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">💡 Sugerencias:</p>
                    {analisis.sugerencias.map((s, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                {analisis.sugerencias.length === 0 && analisis.num_total > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aún no hay suficientes datos para generar sugerencias. Sigue registrando desviaciones.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
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

      {/* Resumen huchas + total ahorrado */}
      {huchas.filter((h) => h.activa).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Huchas en progreso</h2>
              <p className="text-xs text-muted-foreground">
                Total ahorrado: <span className="font-medium text-foreground">{formatEuro(totalHuchas)}</span>
              </p>
            </div>
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
