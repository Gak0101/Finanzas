import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { adjustInvestmentCash, investmentCashAdjustmentSchema } from '@/lib/inversiones/cash'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido' }, { status: 400 })
  }

  const parsed = investmentCashAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  return NextResponse.json(adjustInvestmentCash(auth.userId, parsed.data))
}
