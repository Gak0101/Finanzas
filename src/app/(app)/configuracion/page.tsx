'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export default function ConfiguracionPage() {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault()

    if (passwordNueva !== passwordConfirm) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }

    if (passwordNueva.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }

    setGuardando(true)

    const res = await fetch('/api/usuario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password_actual: passwordActual,
        password_nueva: passwordNueva,
      }),
    })

    if (res.ok) {
      toast.success('Contraseña actualizada correctamente')
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirm('')
    } else {
      const err = await res.json()
      toast.error(err.error || 'Error al cambiar la contraseña')
    }

    setGuardando(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
          <CardDescription>
            Actualiza tu contraseña de acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-actual">Contraseña actual</Label>
              <Input
                id="password-actual"
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="password-nueva">Nueva contraseña</Label>
              <Input
                id="password-nueva"
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-confirm">Confirmar nueva contraseña</Label>
              <Input
                id="password-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" disabled={guardando}>
              {guardando ? 'Actualizando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            🚪 Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
