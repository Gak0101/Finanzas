'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Usuario o contraseña incorrectos')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-[#7e8bff]/10 blur-3xl" />
        <div className="absolute inset-x-0 top-1/2 border-t border-white/[.05]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <section className="hidden px-4 py-8 lg:block" aria-labelledby="welcome-title">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Espacio financiero personal
          </div>
          <h1 id="welcome-title" className="max-w-xl text-6xl font-medium leading-[0.96] tracking-[-0.07em] text-foreground">
            Pon tus decisiones<br />
            <span className="text-primary">en contexto.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
            Un lugar tranquilo para entender tus ingresos, tus objetivos y el patrimonio que estás construyendo.
          </p>
          <div className="mt-10 flex items-center gap-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-primary" strokeWidth={1.8} /> Datos privados</span>
            <span className="inline-flex items-center gap-2"><ArrowUpRight className="size-4 text-primary" strokeWidth={1.8} /> Lectura clara</span>
          </div>
        </section>

        <Card className="w-full overflow-hidden">
          <CardHeader className="gap-4 border-b border-[#deddd6] px-6 pb-6 pt-7 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_0_0_6px_rgb(200_245_106_/_12%)]" aria-hidden="true">
                F
              </span>
              <div>
                <CardTitle className="text-xl tracking-[-0.04em]">Finanzas</CardTitle>
                <CardDescription className="mt-1">Tu panel personal</CardDescription>
              </div>
            </div>
            <p className="text-sm leading-5 text-[#68747e]">Inicia sesión para continuar donde lo dejaste.</p>
          </CardHeader>
          <CardContent className="px-6 pb-7 pt-6 sm:px-8">
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu_usuario"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[#8f3f47]" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-11 w-full rounded-lg text-sm font-semibold" disabled={loading} aria-busy={loading}>
                <LockKeyhole className="size-4" strokeWidth={1.8} />
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
            </form>
            <p className="mt-5 text-center text-[10px] leading-4 text-[#7f8a93]">Acceso protegido · Tus datos permanecen en tu espacio privado</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
