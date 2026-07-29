import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-background text-foreground" data-app-shell>
      <Sidebar />
      <main className="min-w-0 flex-1 pb-28 md:pb-0">
        <div className="container mx-auto w-full max-w-[1600px] px-4 py-6" data-page-content>
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
