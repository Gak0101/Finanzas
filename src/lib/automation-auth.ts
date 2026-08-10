import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { usuarios } from '@/lib/db/schema'

export function verifyAutomationSecret(req: Request) {
  const expected = process.env.AUTOMATION_SECRET?.trim()
  if (!expected) return NextResponse.json({ error: 'AUTOMATION_SECRET no está configurado' }, { status: 503 })

  const authorization = req.headers.get('authorization')
  const bearer = authorization?.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : null
  const provided = req.headers.get('x-finanzas-automation-secret')?.trim() || bearer
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Secreto de automatización no válido' }, { status: 401 })
  }
  return null
}

export async function resolveAutomationUserId(req: Request): Promise<number | NextResponse> {
  const parameter = new URL(req.url).searchParams.get('user_id') || process.env.AUTOMATION_USER_ID
  if (parameter) {
    const userId = Number(parameter)
    if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ error: 'user_id no válido' }, { status: 400 })
    return userId
  }

  const users = await db.query.usuarios.findMany({ columns: { id: true } })
  if (users.length !== 1) {
    return NextResponse.json({ error: 'Configura AUTOMATION_USER_ID o envía user_id cuando haya varios usuarios' }, { status: 400 })
  }
  return users[0].id
}
