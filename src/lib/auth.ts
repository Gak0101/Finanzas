import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { usuarios } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const username = credentials.username as string
        const password = credentials.password as string

        const usuario = await db.query.usuarios.findFirst({
          where: eq(usuarios.username, username),
        })

        if (!usuario) return null

        const passwordValida = await compare(password, usuario.password_hash)
        if (!passwordValida) return null

        return {
          id: String(usuario.id),
          name: usuario.username,
          email: usuario.username,
        }
      },
    }),
  ],
})
