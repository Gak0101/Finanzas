'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Sparkles,
  Tag,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/categorias', label: 'Categorías', icon: Tag },
  { href: '/huchas', label: 'Huchas', icon: PiggyBank },
  { href: '/historial', label: 'Historial', icon: CalendarDays },
  { href: '/configuracion', label: 'Config.', icon: Settings },
]

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const finderActive = pathname === '/inversiones' && searchParams.get('tab') === 'buscador'
  const investmentsSectionActive = isPathActive(pathname, '/inversiones') || isPathActive(pathname, '/buscador-acciones')

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 px-2 pt-2 shadow-[0_-12px_35px_rgb(0_0_0_/_18%)] backdrop-blur-xl md:hidden"
      data-mobile-nav
    >
      <div className="mx-auto max-w-xl">
        <div className="scrollbar-none flex gap-1 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.href === '/inversiones' ? investmentsSectionActive : isPathActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none',
                  active ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
                <span className="max-w-[76px] truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {investmentsSectionActive && (
          <div className="border-t border-sidebar-border/70 py-1.5">
            <Link
              href="/inversiones?tab=buscador"
              aria-current={finderActive || isPathActive(pathname, '/buscador-acciones') ? 'page' : undefined}
              className={cn(
                'mx-auto flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none',
                finderActive || isPathActive(pathname, '/buscador-acciones') ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Sparkles className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              Buscador IA de acciones
            </Link>
          </div>
        )}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
    </nav>
  )
}
