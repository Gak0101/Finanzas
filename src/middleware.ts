import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// El middleware usa SOLO authConfig (sin imports de Node.js/DB)
// Esto es compatible con Edge Runtime
export default NextAuth(authConfig).auth

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
