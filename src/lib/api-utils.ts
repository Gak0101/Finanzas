import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function getAuthenticatedUserId(): Promise<{ userId: number } | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return { userId: parseInt(session.user.id) }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}
