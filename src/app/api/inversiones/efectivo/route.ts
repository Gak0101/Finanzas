import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import {
  adjustInvestmentCash,
  investmentCashAdjustmentSchema,
  investmentCashTransferSchema,
  transferInvestmentCash,
  getInvestmentCashSnapshotWithMarketRates,
} from '@/lib/inversiones/cash'

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

  const isTransfer = Boolean(body && typeof body === 'object' && (body as { action?: unknown }).action === 'transfer')
  const transferParsed = isTransfer
    ? investmentCashTransferSchema.safeParse(body)
    : null
  const parsed = isTransfer ? null : investmentCashAdjustmentSchema.safeParse(body)
  if (transferParsed && !transferParsed.success) {
    return NextResponse.json({ error: transferParsed.error.flatten() }, { status: 400 })
  }
  if (parsed && !parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (transferParsed?.success) {
    try {
      const result = transferInvestmentCash(auth.userId, transferParsed.data)
      return NextResponse.json({ ...result, cash: await getInvestmentCashSnapshotWithMarketRates(auth.userId) })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('INSUFFICIENT_CASH:')) {
        const disponible = Number(error.message.slice('INSUFFICIENT_CASH:'.length))
        return NextResponse.json({
          error: 'Saldo insuficiente en la cuenta de origen',
          detail: { disponible, divisa: transferParsed.data.divisa_origen, custodia: transferParsed.data.custodia_origen },
        }, { status: 400 })
      }
      throw error
    }
  }

  const result = adjustInvestmentCash(auth.userId, parsed!.data)
  return NextResponse.json({ ...result, cash: await getInvestmentCashSnapshotWithMarketRates(auth.userId) })
}
