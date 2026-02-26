import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { usuarios } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hash, compare } from 'bcryptjs'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

const cambiarPasswordSchema = z.object({
  password_actual: z.string().min(1),
  password_nueva: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
})

export async function PUT(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json()
  const parsed = cambiarPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, auth.userId),
  })

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const passwordCorrecta = await compare(parsed.data.password_actual, usuario.password_hash)
  if (!passwordCorrecta) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
  }

  const nuevoHash = await hash(parsed.data.password_nueva, 10)

  await db
    .update(usuarios)
    .set({ password_hash: nuevoHash })
    .where(eq(usuarios.id, auth.userId))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, auth.userId),
    columns: { id: true, username: true, created_at: true },
  })

  return NextResponse.json(usuario)
}
