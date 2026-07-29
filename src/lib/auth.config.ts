import type { NextAuthConfig } from 'next-auth'

// Configuración base compatible con Edge Runtime (sin imports de Node.js)
export const authConfig: NextAuthConfig = {
  // Coolify termina TLS en su proxy y reenvía el host público a Next.js.
  // Auth.js debe aceptar ese host para que login y sesión funcionen en VPS.
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === '/login'
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

      if (isApiAuth) return true
      if (!isLoggedIn && !isLoginPage) return false
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
