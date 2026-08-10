import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { refreshInvestmentPrices } from '@/lib/inversiones/marketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  return NextResponse.json(await refreshInvestmentPrices(auth.userId))
}
