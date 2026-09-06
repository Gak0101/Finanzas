import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { deleteWatchlistRow, saveWatchlistRow } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const inputSchema = z.object({
  ticker: z.string().trim().min(1).max(20), empresa: z.string().trim().min(1).max(160), mercado: z.string().trim().max(80).optional(),
  rating: z.number().finite().nullable().optional(), orden: z.number().int().positive().nullable().optional(),
  entradaEur: z.number().finite().positive().nullable().optional(), proximaRevision: z.string().trim().max(200).optional(),
  tesis: z.string().trim().max(2000).optional(), riesgos: z.string().trim().max(2000).optional(), fuente: z.string().trim().max(500).optional(), notas: z.string().trim().max(2000).optional(),
})

function recordId(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const id = recordId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 })
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Completa al menos ticker y empresa.' }, { status: 400 })
  try { return NextResponse.json({ row: await saveWatchlistRow(auth.userId, parsed.data, id) }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el ticker.' }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const id = recordId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 })
  try { await deleteWatchlistRow(auth.userId, id); return NextResponse.json({ ok: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo eliminar el ticker.' }, { status: 400 })
  }
}
