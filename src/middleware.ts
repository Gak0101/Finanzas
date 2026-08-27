import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextRequest, NextResponse } from 'next/server'
import type { NextFetchEvent } from 'next/server'

// El middleware usa SOLO authConfig (sin imports de Node.js/DB)
// Esto es compatible con Edge Runtime
const authMiddleware = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Response | undefined | Promise<Response | undefined>

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // n8n no tiene sesión de navegador: el endpoint de automatización valida
  // exclusivamente AUTOMATION_SECRET en su propia capa Node.js.
  const automationPaths = [
    '/api/automatizaciones/inversiones/alertas',
    '/api/automatizaciones/inversiones/whatsapp',
  ]
  if (automationPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname === `${path}/`)) {
    return NextResponse.next()
  }
  return authMiddleware(request, event)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
