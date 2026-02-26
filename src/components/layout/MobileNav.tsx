'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/ingresos', label: 'Ingresos', icon: '💵' },
  { href: '/categorias', label: 'Categorías', icon: '🏷️' },
  { href: '/huchas', label: 'Huchas', icon: '🐷' },
  { href: '/historial', label: 'Historial', icon: '📅' },
  { href: '/configuracion', label: 'Config', icon: '⚙️' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1 text-xs rounded-lg transition-colors',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
            )}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="hidden xs:block">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
