import { db } from '@/lib/db'
import { inversiones_snapshots_diarios, type InversionPosicion } from '@/lib/db/schema'

function snapshotStatus(position: InversionPosicion) {
  if (position.precio_actual === null || position.valor_actual === null) return 'sin_precio'
  if (position.estado_fuente === 'API_OK') return 'verificado'
  if (position.estado_fuente === 'FALLBACK') return 'obsoleto'
  return 'manual'
}

export async function persistDailyInvestmentSnapshots(
  userId: number,
  positions: InversionPosicion[],
  valuationDate = new Date().toISOString().slice(0, 10)
) {
  const now = new Date().toISOString()
  const activePositions = positions.filter((position) => position.incluido_resumen && position.cantidad > 0)

  await Promise.all(activePositions.map((position) => {
    const values = {
      usuario_id: userId,
      posicion_id: position.id,
      fecha_valoracion: valuationDate,
      cantidad: position.cantidad,
      coste_eur: position.coste,
      precio_eur: position.precio_actual,
      valor_eur: position.valor_actual,
      pnl_no_realizado_eur: position.pnl,
      precio_as_of: position.snapshot_at,
      proveedor: position.proveedor,
      estado_precio: snapshotStatus(position),
      updated_at: now,
    }

    return db
      .insert(inversiones_snapshots_diarios)
      .values(values)
      .onConflictDoUpdate({
        target: [
          inversiones_snapshots_diarios.usuario_id,
          inversiones_snapshots_diarios.posicion_id,
          inversiones_snapshots_diarios.fecha_valoracion,
        ],
        set: values,
      })
  }))

  return { date: valuationDate, positions: activePositions.length }
}
