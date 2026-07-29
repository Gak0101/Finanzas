'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  CalendarDays,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  LineChart,
  LogOut,
  PiggyBank,
  Settings,
  Sparkles,
  Tag,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type NavChild = {
  href: string
  label: string
  icon: LucideIcon
}

type NavItem = NavChild & {
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/inversiones',
    label: 'Inversiones',
    icon: TrendingUp,
    children: [{ href: '/inversiones?tab=buscador', label: 'Buscador IA', icon: Sparkles }],
  },
  { href: '/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/categorias', label: 'Categorías', icon: Tag },
  { href: '/huchas', label: 'Huchas', icon: PiggyBank },
  { href: '/historial', label: 'Historial', icon: CalendarDays },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const finderActive = pathname === '/inversiones' && searchParams.get('tab') === 'buscador'
  const investmentsSectionActive = isPathActive(pathname, '/inversiones') || isPathActive(pathname, '/buscador-acciones')

  return (
    <aside
      aria-label="Navegación principal"
      className="hidden min-h-screen w-[264px] shrink-0 flex-col border-r border-[#26313c] bg-sidebar px-4 py-6 md:flex"
      data-sidebar
    >
      <div className="mb-9 px-2">
        <Link href="/dashboard" className="group inline-flex items-center gap-3 rounded-lg focus-visible:outline-none">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground shadow-[0_0_0_5px_rgb(200_245_106_/_10%)] transition-transform group-hover:scale-105" aria-hidden="true">
            F
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.03em] text-sidebar-foreground">Finanzas</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Gestión personal</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1" aria-label="Secciones">
        {navItems.map((item) => {
          const itemActive = item.href === '/inversiones' ? investmentsSectionActive : isPathActive(pathname, item.href)
          const Icon = item.icon

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none',
                  itemActive
                    ? 'bg-primary/10 text-primary shadow-[inset_2px_0_0_var(--primary)]'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.children && <ChevronRight className={cn('size-3.5 transition-transform', itemActive && 'rotate-90')} aria-hidden="true" />}
              </Link>

              {item.children && itemActive && (
                <div className="ml-5 mt-1 border-l border-sidebar-border pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    const childActive = child.href.includes('tab=buscador')
                      ? finderActive || isPathActive(pathname, '/buscador-acciones')
                      : isPathActive(pathname, child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={childActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-9 items-center gap-2 rounded-md px-3 text-[12px] font-medium transition-colors focus-visible:outline-none',
                          childActive
                            ? 'bg-secondary text-primary'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <ChildIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mt-6 border-t border-sidebar-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-[12px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Cerrar sesión
        </Button>
        <div className="mt-4 flex items-center gap-2 px-3 text-[10px] text-muted-foreground">
          <LineChart className="size-3.5 text-primary" strokeWidth={1.8} aria-hidden="true" />
          <span>Tu dinero, en contexto.</span>
        </div>
      </div>
    </aside>
  )
}
