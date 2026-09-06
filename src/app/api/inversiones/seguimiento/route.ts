import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { inversiones_excel_filas, inversiones_posiciones } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getAiCredentials } from '@/lib/ai/provider-config'
import { createRun, listRuns, loadCandidates, schedulerState } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const [runs, scheduler, ai, candidates, positions, context] = await Promise.all([
    listRuns(auth.userId), schedulerState(auth.userId),
    getAiCredentials(auth.userId),
    loadCandidates(auth.userId),
    db.query.inversiones_posiciones.findMany({ where: eq(inversiones_posiciones.usuario_id, auth.userId), columns: { id: true } }),
    db.query.inversiones_excel_filas.findMany({ where: and(eq(inversiones_excel_filas.usuario_id, auth.userId), eq(inversiones_excel_filas.tipo, 'context')), columns: { id: true }, limit: 1 }),
  ])
  return NextResponse.json({ runs, watchlistCount: candidates.filter(candidate => !candidate.held).length, portfolioCount: positions.length, contextCount: context.length ? 1 : 0, newsletter: { configured: true }, scheduler, aiConfigured: Boolean(ai) })
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const body = await request.json().catch(() => null) as { command?: unknown } | null
  const command = typeof body?.command === 'string' ? body.command.trim().slice(0, 160) : null
  const run = await createRun(auth.userId)
  return NextResponse.json({ runId: run.id, status: run.status, command }, { status: 202 })
}
