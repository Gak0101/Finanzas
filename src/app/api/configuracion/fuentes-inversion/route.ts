import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion, configuraciones_ia } from '@/lib/db/schema'
import { encryptSecret } from '@/lib/ai/secret-crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const settingsSchema = z.object({
  sec_contact_email: z.union([z.string().trim().email('El email de contacto SEC no es válido'), z.literal('')]).default(''),
  allow_paid_web_search: z.boolean().default(false),
  fiscal_api_key: z.string().trim().max(1000).optional(),
  finnhub_token: z.string().trim().max(1000).optional(),
  alpha_vantage_api_key: z.string().trim().max(1000).optional(),
  financial_datasets_api_key: z.string().trim().max(1000).optional(),
  newsapi_key: z.string().trim().max(1000).optional(),
  firecrawl_base_url: z.union([z.string().trim().url('La URL de Firecrawl no es válida'), z.literal('')]).default(''),
  firecrawl_api_key: z.string().trim().max(1000).optional(),
})

type SourcesRow = typeof configuraciones_fuentes_inversion.$inferSelect

function secretState(value: string | null) {
  if (!value) return { configured: false, hint: null }
  // Solo necesitamos una referencia visual estable. El secreto cifrado no se
  // descifra ni sale de este endpoint.
  return { configured: true, hint: 'Clave guardada' }
}

async function publicSettings(userId: number, row?: SourcesRow) {
  const ai = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, userId),
  })
  const firecrawlUrl = row?.firecrawl_base_url ?? ''
  const aiReady = ai?.ultimo_test_ok === true
  // Yahoo Finance no requiere una credencial y sirve como base gratuita. Las
  // demás fuentes amplían cobertura, pero ya no son requisito para arrancar.
  const freeSourcesReady = true

  return {
    secContactEmail: row?.sec_contact_email ?? '',
    allowPaidWebSearch: false,
    premiumReady: Boolean(firecrawlUrl),
    freeSourcesReady,
    aiReady,
    firecrawl: {
      baseUrl: firecrawlUrl,
      ...secretState(row?.firecrawl_api_key_cifrada ?? null),
    },
    fiscal: secretState(row?.fiscal_api_key_cifrada ?? null),
    finnhub: secretState(row?.finnhub_token_cifrado ?? null),
    alphaVantage: secretState(row?.alpha_vantage_api_key_cifrada ?? null),
    financialDatasets: secretState(row?.financial_datasets_api_key_cifrada ?? null),
    newsApi: secretState(row?.newsapi_key_cifrada ?? null),
  }
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const row = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  return NextResponse.json(await publicSettings(auth.userId, row))
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Configuración no válida' }, { status: 400 })
  }

  const existing = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  const input = parsed.data
  const now = new Date().toISOString()
  const values = {
    sec_contact_email: input.sec_contact_email || null,
    permitir_busqueda_web_pago: input.allow_paid_web_search,
    firecrawl_base_url: input.firecrawl_base_url || null,
    ...(input.fiscal_api_key ? { fiscal_api_key_cifrada: encryptSecret(input.fiscal_api_key) } : {}),
    ...(input.finnhub_token ? { finnhub_token_cifrado: encryptSecret(input.finnhub_token) } : {}),
    ...(input.alpha_vantage_api_key ? { alpha_vantage_api_key_cifrada: encryptSecret(input.alpha_vantage_api_key) } : {}),
    ...(input.financial_datasets_api_key ? { financial_datasets_api_key_cifrada: encryptSecret(input.financial_datasets_api_key) } : {}),
    ...(input.newsapi_key ? { newsapi_key_cifrada: encryptSecret(input.newsapi_key) } : {}),
    ...(input.firecrawl_api_key ? { firecrawl_api_key_cifrada: encryptSecret(input.firecrawl_api_key) } : {}),
    updated_at: now,
  }

  if (existing) {
    await db
      .update(configuraciones_fuentes_inversion)
      .set(values)
      .where(eq(configuraciones_fuentes_inversion.id, existing.id))
  } else {
    await db.insert(configuraciones_fuentes_inversion).values({
      usuario_id: auth.userId,
      ...values,
      created_at: now,
    })
  }

  const saved = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  return NextResponse.json(await publicSettings(auth.userId, saved))
}
