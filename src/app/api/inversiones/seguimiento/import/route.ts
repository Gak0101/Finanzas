import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { importWorkbook } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Adjunta un archivo Excel .xlsx.' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'El Excel supera el límite de 15 MB.' }, { status: 413 })
  try {
    const count = await importWorkbook(auth.userId, Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ count })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo leer el Excel.' }, { status: 400 })
  }
}
