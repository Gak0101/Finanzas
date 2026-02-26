'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/ingresos', label: 'Ingresos', icon: '💵' },
  { href: '/categorias', label: 'Categorías', icon: '🏷️' },
  { href: '/huchas', label: 'Huchas', icon: '🐷' },
  { href: '/historial', label: 'Historial', icon: '📅' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r bg-card px-3 py-6 shrink-0">
      <div className="mb-8 px-3">
        <h1 className="text-xl font-bold">💰 Finanzas</h1>
        <p className="text-xs text-muted-foreground mt-1">Gestión personal</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          🚪 Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
