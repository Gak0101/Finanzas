import { Suspense } from 'react'
import { InvestmentPortfolio } from '@/components/inversiones/InvestmentPortfolio'

export default function InversionesPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] animate-pulse rounded-2xl bg-[#0d1118]" />}>
      <InvestmentPortfolio />
    </Suspense>
  )
}
