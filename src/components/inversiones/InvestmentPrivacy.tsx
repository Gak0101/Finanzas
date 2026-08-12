'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'finanzas:investment-values-visibility:v1'

type InvestmentPrivacyContextValue = {
  valuesVisible: boolean
  toggleValues: () => void
}

const InvestmentPrivacyContext = createContext<InvestmentPrivacyContextValue | null>(null)

export function InvestmentPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [valuesVisible, setValuesVisible] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setValuesVisible(window.localStorage.getItem(STORAGE_KEY) !== 'hidden')
    } catch {
      // El modo visible es el fallback si el navegador bloquea el almacenamiento.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, valuesVisible ? 'visible' : 'hidden')
    } catch {
      // La preferencia es opcional; no debe impedir consultar la cartera.
    }
  }, [hydrated, valuesVisible])

  const toggleValues = useCallback(() => setValuesVisible((current) => !current), [])
  const contextValue = useMemo(() => ({ valuesVisible, toggleValues }), [toggleValues, valuesVisible])
  const privacyClassName = valuesVisible
    ? 'contents'
    : 'contents [&_.tabular-nums]:blur-[0.32em] [&_.tabular-nums]:select-none'

  return (
    <InvestmentPrivacyContext.Provider value={contextValue}>
      <div data-investment-values={valuesVisible ? 'visible' : 'hidden'} className={privacyClassName}>
        {children}
      </div>
    </InvestmentPrivacyContext.Provider>
  )
}

export function useInvestmentPrivacy() {
  const context = useContext(InvestmentPrivacyContext)
  if (!context) throw new Error('useInvestmentPrivacy debe usarse dentro de InvestmentPrivacyProvider')
  return context
}
