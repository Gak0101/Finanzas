import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { exportWorkbook } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const buffer = await exportWorkbook(auth.userId)
  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="maestro_lynch_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
