'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { CheckCircle2, Database, ExternalLink, Globe2, KeyRound, Leaf, Loader2, MessageCircle, PlugZap, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { buildOpenRouterModelChain, DEFAULT_OPENROUTER_MODEL, OPENROUTER_MODEL_OPTIONS } from '@/lib/ai/model-routing'

type AiProvider = 'openrouter' | 'openai'

type AiSettingsResponse = {
  provider: AiProvider
  model: string
  models: {
    searchFree: string
    searchPremium: string
    portfolioAnalysis: string
  }
  hasApiKey: boolean
  apiKeyHint: string | null
  source: 'app' | 'environment' | 'none'
  lastTestAt: string | null
  lastTestOk: boolean | null
}

type TestResult = {
  ok: boolean
  message: string
  model?: string
  latencyMs?: number
}

type CredentialStatus = {
  configured: boolean
  hint: string | null
}

type InvestmentSourcesResponse = {
  secContactEmail: string
  allowPaidWebSearch: boolean
  premiumReady: boolean
  freeSourcesReady: boolean
  aiReady: boolean
  firecrawl: CredentialStatus & { baseUrl: string }
  fiscal: CredentialStatus
  finnhub: CredentialStatus
  alphaVantage: CredentialStatus
  financialDatasets: CredentialStatus
  newsApi: CredentialStatus
}

type WhatsappSettingsResponse = {
  graphUrl: string
  phoneNumberId: string
  recipient: string
  templateName: string
  templateLanguage: string
  accessToken: CredentialStatus
  ready: boolean
  missing: string[]
}

const aiProviderHelp: Record<AiProvider, { url: string; label: string }> = {
  openrouter: {
    url: 'https://openrouter.ai/keys',
    label: 'Crear clave',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    label: 'Crear clave en OpenAI',
  },
}

type SourceSecretFieldProps = {
  id: string
  label: string
  description: string
  helpUrl?: string
  helpLabel?: string
  labelClassName?: string
  descriptionClassName?: string
  value: string
  configured: boolean
  onChange: (value: string) => void
}

function SourceSecretField({ id, label, description, helpUrl, helpLabel = 'Dónde conseguirla', labelClassName, descriptionClassName, value, configured, onChange }: SourceSecretFieldProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className={labelClassName}>{label}</Label>
        <div className="flex items-center gap-2">
          {helpUrl && (
            <a href={helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 underline-offset-2 hover:underline">
              {helpLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {configured && <span className="text-[10px] font-medium text-emerald-700">Configurada</span>}
        </div>
      </div>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={configured ? 'Deja vacío para conservarla' : 'Introduce la credencial'}
          className="pl-9"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <p className={`text-[11px] leading-5 ${descriptionClassName ?? 'text-muted-foreground'}`}>{description}</p>
    </div>
  )
}

function payloadError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error
  }
  return fallback
}

export default function ConfiguracionPage() {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [provider, setProvider] = useState<AiProvider>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL)
  const [advancedModel, setAdvancedModel] = useState(DEFAULT_OPENROUTER_MODEL)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null)
  const [settingsSource, setSettingsSource] = useState<AiSettingsResponse['source']>('none')
  const [loadingAi, setLoadingAi] = useState(true)
  const [savingAi, setSavingAi] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [sources, setSources] = useState<InvestmentSourcesResponse | null>(null)
  const [loadingSources, setLoadingSources] = useState(true)
  const [savingSources, setSavingSources] = useState(false)
  const [secContactEmail, setSecContactEmail] = useState('')
  const [fiscalApiKey, setFiscalApiKey] = useState('')
  const [finnhubToken, setFinnhubToken] = useState('')
  const [alphaVantageApiKey, setAlphaVantageApiKey] = useState('')
  const [financialDatasetsApiKey, setFinancialDatasetsApiKey] = useState('')
  const [newsApiKey, setNewsApiKey] = useState('')
  const [firecrawlBaseUrl, setFirecrawlBaseUrl] = useState('')
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('')
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsappSettingsResponse | null>(null)
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [whatsappGraphUrl, setWhatsappGraphUrl] = useState('')
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('')
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('')
  const [whatsappRecipient, setWhatsappRecipient] = useState('')
  const [whatsappTemplateName, setWhatsappTemplateName] = useState('')
  const [whatsappTemplateLanguage, setWhatsappTemplateLanguage] = useState('es_ES')

  useEffect(() => {
    const controller = new AbortController()
    async function loadAiSettings() {
      try {
        const response = await fetch('/api/configuracion/ia', { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudo cargar la configuración IA'))
        const settings = payload as AiSettingsResponse
        setProvider(settings.provider)
        setModel(settings.model)
        setAdvancedModel(settings.models.searchPremium)
        setHasApiKey(settings.hasApiKey)
        setApiKeyHint(settings.apiKeyHint)
        setSettingsSource(settings.source)
        if (settings.lastTestOk !== null) {
          setTestResult({
            ok: settings.lastTestOk,
            message: settings.lastTestOk
              ? 'La última prueba guardada terminó correctamente.'
              : 'La última prueba guardada no pudo conectar.',
          })
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error(error instanceof Error ? error.message : 'No se pudo cargar la configuración IA')
        }
      } finally {
        setLoadingAi(false)
      }
    }
    void loadAiSettings()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadSources() {
      try {
        const response = await fetch('/api/configuracion/fuentes-inversion', { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudieron cargar las fuentes'))
        const settings = payload as InvestmentSourcesResponse
        setSources(settings)
        setSecContactEmail(settings.secContactEmail)
        setFirecrawlBaseUrl(settings.firecrawl.baseUrl)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las fuentes')
        }
      } finally {
        setLoadingSources(false)
      }
    }
    void loadSources()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadWhatsappSettings() {
      try {
        const response = await fetch('/api/configuracion/whatsapp', { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudo cargar la configuración de WhatsApp'))
        const settings = payload as WhatsappSettingsResponse
        setWhatsappSettings(settings)
        setWhatsappGraphUrl(settings.graphUrl)
        setWhatsappPhoneNumberId(settings.phoneNumberId)
        setWhatsappRecipient(settings.recipient)
        setWhatsappTemplateName(settings.templateName)
        setWhatsappTemplateLanguage(settings.templateLanguage)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error(error instanceof Error ? error.message : 'No se pudo cargar la configuración de WhatsApp')
        }
      } finally {
        setLoadingWhatsapp(false)
      }
    }
    void loadWhatsappSettings()
    return () => controller.abort()
  }, [])

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
    try {
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
        const err = await res.json().catch(() => null)
        toast.error(payloadError(err, 'Error al cambiar la contraseña'))
      }
    } finally {
      setGuardando(false)
    }
  }

  function changeProvider(nextProvider: AiProvider) {
    setProvider(nextProvider)
    const defaultModel = nextProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : 'gpt-5-mini'
    setModel(defaultModel)
    setAdvancedModel(defaultModel)
    setApiKey('')
    setTestResult(null)
  }

  async function saveAiSettings() {
    setSavingAi(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/configuracion/ia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          model_search_free: model,
          model_search_premium: advancedModel || model,
          model_portfolio_analysis: advancedModel || model,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudo guardar la configuración'))

      const settings = payload as AiSettingsResponse
      setHasApiKey(settings.hasApiKey)
      setApiKeyHint(settings.apiKeyHint)
      setSettingsSource(settings.source)
      setModel(settings.models.searchFree)
      setAdvancedModel(settings.models.searchPremium)
      setApiKey('')
      toast.success('Configuración IA guardada de forma segura')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    } finally {
      setSavingAi(false)
    }
  }

  async function testConnection() {
    setTestingAi(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/configuracion/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) throw new Error(payloadError(payload, 'La prueba de conexión falló'))

      setTestResult({
        ok: true,
        message: String((payload as { message?: unknown }).message ?? 'Conexión correcta'),
        model: String((payload as { model?: unknown }).model ?? model),
        latencyMs: Number((payload as { latencyMs?: unknown }).latencyMs ?? 0),
      })
      toast.success('El modelo respondió correctamente')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La prueba de conexión falló'
      setTestResult({ ok: false, message })
      toast.error(message)
    } finally {
      setTestingAi(false)
    }
  }

  async function saveInvestmentSources() {
    setSavingSources(true)
    try {
      const response = await fetch('/api/configuracion/fuentes-inversion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sec_contact_email: secContactEmail.trim(),
          allow_paid_web_search: false,
          firecrawl_base_url: firecrawlBaseUrl.trim(),
          ...(firecrawlApiKey.trim() ? { firecrawl_api_key: firecrawlApiKey.trim() } : {}),
          ...(fiscalApiKey.trim() ? { fiscal_api_key: fiscalApiKey.trim() } : {}),
          ...(finnhubToken.trim() ? { finnhub_token: finnhubToken.trim() } : {}),
          ...(alphaVantageApiKey.trim() ? { alpha_vantage_api_key: alphaVantageApiKey.trim() } : {}),
          ...(financialDatasetsApiKey.trim() ? { financial_datasets_api_key: financialDatasetsApiKey.trim() } : {}),
          ...(newsApiKey.trim() ? { newsapi_key: newsApiKey.trim() } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudieron guardar las fuentes'))

      const settings = payload as InvestmentSourcesResponse
      setSources(settings)
      setFirecrawlBaseUrl(settings.firecrawl.baseUrl)
      setFiscalApiKey('')
      setFinnhubToken('')
      setAlphaVantageApiKey('')
      setFinancialDatasetsApiKey('')
      setNewsApiKey('')
      setFirecrawlApiKey('')
      toast.success('Fuentes de inversión guardadas de forma segura')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar las fuentes')
    } finally {
      setSavingSources(false)
    }
  }

  async function saveWhatsappSettings() {
    setSavingWhatsapp(true)
    try {
      const response = await fetch('/api/configuracion/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_url: whatsappGraphUrl.trim(),
          ...(whatsappAccessToken.trim() ? { access_token: whatsappAccessToken.trim() } : {}),
          phone_number_id: whatsappPhoneNumberId.trim(),
          recipient: whatsappRecipient.trim(),
          template_name: whatsappTemplateName.trim(),
          template_language: whatsappTemplateLanguage.trim() || 'es_ES',
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) throw new Error(payloadError(payload, 'No se pudo guardar la configuración de WhatsApp'))

      const settings = payload as WhatsappSettingsResponse
      setWhatsappSettings(settings)
      setWhatsappGraphUrl(settings.graphUrl)
      setWhatsappPhoneNumberId(settings.phoneNumberId)
      setWhatsappRecipient(settings.recipient)
      setWhatsappTemplateName(settings.templateName)
      setWhatsappTemplateLanguage(settings.templateLanguage)
      setWhatsappAccessToken('')
      toast.success(settings.ready ? 'WhatsApp listo para las alertas que lo seleccionen' : 'Configuración de WhatsApp guardada; faltan algunos datos')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración de WhatsApp')
    } finally {
      setSavingWhatsapp(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cuenta / sistema</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Configuración</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gestiona el acceso y los proveedores externos que utiliza tu app.</p>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="grid lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
          <div className="bg-[#111820] p-6 text-[#f7f5ef] sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#c8f56a]"><Sparkles className="h-4 w-4" /> Buscador de inversiones</div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">Motor de análisis IA</h2>
            <p className="mt-3 text-sm leading-6 text-[#aab4be]">OpenRouter u OpenAI redactan y ordenan la información. No aportan por sí mismos cotizaciones, noticias ni documentos: esos datos llegan de las fuentes de la sección inferior.</p>
            <div className="mt-6 flex gap-2 rounded-lg border border-white/10 bg-white/[.04] p-3 text-xs leading-5 text-[#cbd3da]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c8f56a]" />
              <span>La clave se cifra antes de guardarse. La prueba envía únicamente un mensaje técnico y no utiliza tu cartera ni tus datos financieros.</span>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            {loadingAi ? (
              <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración…</div>
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="ai-provider">Proveedor</Label>
                  <select id="ai-provider" value={provider} onChange={(event) => changeProvider(event.target.value as AiProvider)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-slate-500">
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="ai-api-key">Clave del motor IA</Label>
                    <div className="flex items-center gap-2">
                      <a href={aiProviderHelp[provider].url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 underline-offset-2 hover:underline">
                        {aiProviderHelp[provider].label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {hasApiKey && <span className="text-[10px] font-medium text-emerald-700">{apiKeyHint ?? 'Clave guardada'}</span>}
                    </div>
                  </div>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ai-api-key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={hasApiKey ? 'Deja vacío para conservar la clave guardada' : 'Introduce la clave API'}
                      className="pl-9"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-muted-foreground">Al escribir una nueva clave se sustituirá la anterior. Nunca se vuelve a mostrar completa. Esta clave solo cubre el modelo IA, no las APIs de datos.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-model">Modelo principal</Label>
                  <Input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} list="ai-model-suggestions" placeholder={DEFAULT_OPENROUTER_MODEL} spellCheck={false} />
                  <datalist id="ai-model-suggestions">
                    {provider === 'openrouter'
                      ? OPENROUTER_MODEL_OPTIONS.map((modelOption) => <option key={modelOption} value={modelOption} />)
                      : <option value="gpt-5-mini" />}
                  </datalist>
                  <p className="text-[11px] leading-5 text-muted-foreground">{provider === 'openrouter' ? 'La app usa este modelo como principal y prueba automáticamente cuatro modelos gratuitos concretos si falla. No utiliza el router aleatorio de OpenRouter.' : 'OpenAI factura según el modelo y la cuenta. La suscripción de ChatGPT no funciona como crédito API y su inicio OAuth solo está soportado en clientes oficiales como Codex, no en esta app.'}</p>
                  {provider === 'openrouter' && (
                    <p className="break-words text-[10px] leading-5 text-slate-500">
                      Orden de respaldo: {buildOpenRouterModelChain(model).join(' → ')}
                    </p>
                  )}
                </div>

                <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <Label htmlFor="ai-model-advanced">Modelo avanzado <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Input id="ai-model-advanced" value={advancedModel} onChange={(event) => setAdvancedModel(event.target.value)} list="ai-model-suggestions" placeholder={model} spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Solo se usa al pedir un análisis más profundo o de cartera. Puede seguir siendo gratuito: solo tendrá coste si eliges un modelo o proveedor que facture.</p>
                </div>

                <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3.5 text-xs leading-5 text-sky-950">
                  <p className="font-semibold">Qué puede tener coste</p>
                  <p className="mt-1">La app no contrata planes ni activa pagos automáticamente. Las fuentes de datos tienen sus propios límites y planes; Firecrawl es tu instancia propia del VPS. El coste del análisis IA depende del modelo que elijas.</p>
                </div>

                {testResult && (
                  <div role="status" className={`rounded-lg border p-3.5 text-xs leading-5 ${testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
                    <div className="flex items-start gap-2">
                      {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <div>
                        <p className="font-semibold">{testResult.ok ? 'Conexión correcta' : 'No se pudo conectar'}</p>
                        <p className="mt-1">{testResult.message}</p>
                        {testResult.ok && <p className="mt-1 text-[10px] opacity-70">{testResult.model}{testResult.latencyMs ? ` · ${testResult.latencyMs} ms` : ''}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] text-muted-foreground">{settingsSource === 'app' ? 'Configuración guardada en la app' : settingsSource === 'environment' ? 'Configuración heredada del servidor' : 'Sin proveedor configurado'}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={testConnection} disabled={testingAi || savingAi || !model.trim()}>
                      {testingAi ? <Loader2 className="animate-spin" /> : <PlugZap />}
                      {testingAi ? 'Probando…' : 'Probar conexión'}
                    </Button>
                    <Button type="button" onClick={saveAiSettings} disabled={savingAi || testingAi || !model.trim()}>
                      {savingAi ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                      {savingAi ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card id="fuentes-inversion" className="scroll-mt-6 overflow-hidden border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-[#82a53f]" /> Fuentes de datos y búsqueda</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-5">
                Añade solo las fuentes que quieras consultar. Las claves se cifran y nunca se muestran completas.
              </CardDescription>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
              <Leaf className="h-3.5 w-3.5" /> Gratuito por defecto
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSources ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando fuentes…</div>
          ) : (
            <>
              <section className="p-6 sm:p-7">
                <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs leading-5 text-emerald-950">
                  <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="font-semibold">Datos gratuitos por defecto</p>
                    <p className="mt-1">Yahoo Finance aporta sin clave identidad, cotización y fundamentales cuando están disponibles; Firecrawl propio aporta la web. Las claves opcionales amplían la cobertura. La app no contrata ni renueva planes.</p>
                  </div>
                </div>
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Datos financieros y noticias</p>
                  <h3 className="mt-2 text-lg font-semibold">Credenciales opcionales</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Cada enlace abre la página oficial para crear la clave o revisar sus condiciones. Empieza con el nivel gratuito; los límites y posibles planes los define cada proveedor.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <SourceSecretField
                    id="fiscal-api-key"
                    label="Fiscal.ai API key"
                    helpUrl="https://docs.fiscal.ai/docs/guides/getting-started"
                    helpLabel="Ver cómo empezar"
                    description="Dispone de prueba o nivel gratuito según la cuenta; revisa allí los límites y las funciones avanzadas."
                    value={fiscalApiKey}
                    configured={sources?.fiscal.configured ?? false}
                    onChange={setFiscalApiKey}
                  />
                  <SourceSecretField
                    id="finnhub-token"
                    label="Finnhub token"
                    helpUrl="https://finnhub.io/"
                    helpLabel="Crear clave"
                    description="Nivel gratuito para uso personal, útil para cotizaciones, perfiles y noticias con límites; el volumen superior depende del plan."
                    value={finnhubToken}
                    configured={sources?.finnhub.configured ?? false}
                    onChange={setFinnhubToken}
                  />
                  <SourceSecretField
                    id="alpha-vantage-api-key"
                    label="Alpha Vantage API key"
                    helpUrl="https://www.alphavantage.co/support/"
                    helpLabel="Obtener clave"
                    description="Clave gratuita con límite diario reducido; el nivel de pago solo sería necesario para más volumen."
                    value={alphaVantageApiKey}
                    configured={sources?.alphaVantage.configured ?? false}
                    onChange={setAlphaVantageApiKey}
                  />
                  <SourceSecretField
                    id="newsapi-key"
                    label="NewsAPI key"
                    helpUrl="https://newsapi.org/register"
                    helpLabel="Registrarse"
                    description="Nivel gratuito para desarrollo y contexto de noticias; el uso de producción o más volumen puede requerir un plan."
                    value={newsApiKey}
                    configured={sources?.newsApi.configured ?? false}
                    onChange={setNewsApiKey}
                  />
                  <SourceSecretField
                    id="financial-datasets-api-key"
                    label="Financial Datasets API key"
                    helpUrl="https://financialdatasets.ai/"
                    helpLabel="Crear cuenta"
                    description="Opcional: datos financieros estructurados de EE. UU.; su endpoint puede exigir un plan de pago y la app lo indicará sin activarlo automáticamente."
                    value={financialDatasetsApiKey}
                    configured={sources?.financialDatasets.configured ?? false}
                    onChange={setFinancialDatasetsApiKey}
                  />
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="sec-contact-email">Contacto para SEC EDGAR</Label>
                      <a href="https://www.sec.gov/edgar/sec-api-documentation" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 underline-offset-2 hover:underline">
                        Ver requisitos
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <Input id="sec-contact-email" type="email" value={secContactEmail} onChange={(event) => setSecContactEmail(event.target.value)} placeholder="tu-email@dominio.com" />
                    <p className="text-[11px] leading-5 text-muted-foreground">SEC EDGAR es gratuito y sin clave; exige identificar la aplicación con un email de contacto.</p>
                  </div>
                </div>
              </section>

              <section className="border-t border-slate-200 bg-slate-50/70 p-6 text-slate-900 sm:p-7">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700"><Globe2 className="h-4 w-4" /> Búsqueda web</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Firecrawl propio · gratuito</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">La app consulta tu instancia alojada en el VPS y entrega esos resultados al modelo. No es una suscripción ni activa el buscador web de pago de OpenRouter; el coste es el del VPS.</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${sources?.firecrawl.baseUrl ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                    {sources?.firecrawl.baseUrl ? 'Propio · activo' : 'Pendiente de configurar'}
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="firecrawl-base-url" className="text-slate-900">URL de Firecrawl</Label>
                      <a href="https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 underline-offset-2 hover:underline">
                        Ver self-hosting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <Input id="firecrawl-base-url" type="url" value={firecrawlBaseUrl} onChange={(event) => setFirecrawlBaseUrl(event.target.value)} placeholder="http://firecrawl.tudominio.com:3002" spellCheck={false} />
                    <p className="text-[11px] leading-5 text-slate-600">URL base pública o accesible desde la app. La app probará `/v2/search` y, si tu instalación solo expone scraping, usará `/v1/scrape`. El coste es el del VPS, no el de una búsqueda contratada.</p>
                  </div>
                  <SourceSecretField
                    id="firecrawl-api-key"
                    label="Firecrawl API key"
                    helpUrl="https://docs.firecrawl.dev/introduction"
                    helpLabel="Ver documentación"
                    labelClassName="text-slate-900"
                    descriptionClassName="text-slate-600"
                    description="No hace falta en tu instancia propia si no exige autenticación. Si la necesita, se guarda cifrada."
                    value={firecrawlApiKey}
                    configured={sources?.firecrawl.configured ?? false}
                    onChange={setFirecrawlApiKey}
                  />
                </div>
              </section>

              <div className="flex flex-col gap-2 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="text-[10px] leading-4 text-muted-foreground">Las credenciales nuevas sustituyen a las anteriores; nunca se muestran completas después de guardarlas.</p>
                <Button type="button" onClick={saveInvestmentSources} disabled={savingSources}>
                  {savingSources ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  {savingSources ? 'Guardando…' : 'Guardar fuentes'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card id="whatsapp-alertas" className="overflow-hidden border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><MessageCircle className="h-5 w-5 text-[#82a53f]" /> WhatsApp para alertas</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-5">Configuración opcional. Telegram y email siguen funcionando igual; WhatsApp solo se usará en las alertas donde lo selecciones.</CardDescription>
            </div>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${whatsappSettings?.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {whatsappSettings?.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {whatsappSettings?.ready ? 'Listo para usar' : 'Pendiente de configurar'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          {loadingWhatsapp ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando WhatsApp…</div>
          ) : (
            <div className="grid gap-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-950">
                <p className="font-semibold">Qué falta para activarlo</p>
                <p className="mt-1">
                  {whatsappSettings?.ready
                    ? 'La configuración está completa. Al marcar WhatsApp en una alerta, se enviará la plantilla usando estos datos.'
                    : `Puedes dejarlo pendiente. Faltan: ${(whatsappSettings?.missing ?? ['los datos de WhatsApp']).join(', ')}.`}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp-graph-url">URL de WhatsApp Cloud / Graph API</Label>
                  <Input id="whatsapp-graph-url" type="url" value={whatsappGraphUrl} onChange={(event) => setWhatsappGraphUrl(event.target.value)} placeholder="https://graph.facebook.com/vXX.X" spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Pega la versión de Graph API que te indique Meta.</p>
                </div>
                <SourceSecretField
                  id="whatsapp-access-token"
                  label="Token de acceso de Meta"
                  description="Se cifra al guardarlo y nunca se vuelve a mostrar completo. Déjalo vacío para conservar el token actual."
                  value={whatsappAccessToken}
                  configured={whatsappSettings?.accessToken.configured ?? false}
                  onChange={setWhatsappAccessToken}
                />
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp-phone-number-id">Phone Number ID</Label>
                  <Input id="whatsapp-phone-number-id" value={whatsappPhoneNumberId} onChange={(event) => setWhatsappPhoneNumberId(event.target.value)} placeholder="123456789012345" spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Es el identificador del número en WhatsApp Business, no el número visible.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp-recipient">Número destinatario</Label>
                  <Input id="whatsapp-recipient" type="tel" inputMode="numeric" value={whatsappRecipient} onChange={(event) => setWhatsappRecipient(event.target.value)} placeholder="34612345678" spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Formato internacional, solo dígitos y sin «+», espacios ni guiones.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp-template-name">Nombre de plantilla aprobada</Label>
                  <Input id="whatsapp-template-name" value={whatsappTemplateName} onChange={(event) => setWhatsappTemplateName(event.target.value)} placeholder="finanzas_alerta" spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Debe coincidir exactamente con la plantilla aprobada en Meta.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp-template-language">Idioma de la plantilla</Label>
                  <Input id="whatsapp-template-language" value={whatsappTemplateLanguage} onChange={(event) => setWhatsappTemplateLanguage(event.target.value)} placeholder="es_ES" spellCheck={false} />
                  <p className="text-[11px] leading-5 text-muted-foreground">Normalmente es <code>es_ES</code>; usa el código que figure en Meta.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] leading-4 text-muted-foreground">Necesitas una plantilla aprobada en Meta con un parámetro de texto para recibir el contenido de la alerta.</p>
                <Button type="button" onClick={saveWhatsappSettings} disabled={savingWhatsapp || loadingWhatsapp}>
                  {savingWhatsapp ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  {savingWhatsapp ? 'Guardando…' : 'Guardar WhatsApp'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cambiar contraseña</CardTitle>
            <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCambiarPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password-actual">Contraseña actual</Label>
                <Input id="password-actual" type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="password-nueva">Nueva contraseña</Label>
                <Input id="password-nueva" type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} placeholder="Mínimo 6 caracteres" required autoComplete="new-password" minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-confirm">Confirmar nueva contraseña</Label>
                <Input id="password-confirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Repite la nueva contraseña" required autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={guardando}>{guardando ? 'Actualizando...' : 'Cambiar contraseña'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Sesión</CardTitle>
            <CardDescription>Cierra la sesión activa en este dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => signOut({ callbackUrl: '/login' })}>Cerrar sesión</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
