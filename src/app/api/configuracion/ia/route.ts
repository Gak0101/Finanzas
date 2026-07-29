import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { configuraciones_ia } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { decryptSecret, encryptSecret, maskedSecret } from '@/lib/ai/secret-crypto'
import { getAiCredentials } from '@/lib/ai/provider-config'
import { testAiProvider } from '@/lib/ai/test-provider'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const providerSchema = z.enum(['openrouter', 'openai'])
const settingsSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1, 'Indica un modelo').max(160),
  model_search_free: z.string().trim().min(1, 'Indica el modelo de búsqueda gratuita').max(160).optional(),
  model_search_premium: z.string().trim().min(1, 'Indica el modelo de búsqueda premium').max(160).optional(),
  model_portfolio_analysis: z.string().trim().min(1, 'Indica el modelo de análisis de cartera').max(160).optional(),
  api_key: z.string().trim().max(1000).optional(),
})

function isFreeOpenRouterModel(model: string) {
  return model === 'openrouter/free' || model.endsWith(':free')
}

function publicSettings(row: typeof configuraciones_ia.$inferSelect | undefined) {
  if (!row) {
    return {
      provider: 'openrouter',
      model: 'openrouter/free',
      hasApiKey: false,
      apiKeyHint: null,
      models: {
        searchFree: 'openrouter/free',
        searchPremium: 'openrouter/free',
        portfolioAnalysis: 'openrouter/free',
      },
      source: 'none',
      lastTestAt: null,
      lastTestOk: null,
    }
  }

  let apiKeyHint: string | null = null
  try {
    apiKeyHint = maskedSecret(decryptSecret(row.api_key_cifrada))
  } catch {
    apiKeyHint = 'Credencial no disponible'
  }

  return {
    provider: row.proveedor,
    model: row.modelo,
    hasApiKey: apiKeyHint !== 'Credencial no disponible',
    apiKeyHint,
    models: {
      searchFree: row.modelo_busqueda_gratuita
        ?? (row.proveedor === 'openrouter' && isFreeOpenRouterModel(row.modelo) ? row.modelo : 'openrouter/free'),
      searchPremium: row.modelo_busqueda_premium ?? row.modelo,
      portfolioAnalysis: row.modelo_analisis_cartera ?? row.modelo,
    },
    source: 'app',
    lastTestAt: row.ultimo_test_at,
    lastTestOk: row.ultimo_test_ok,
  }
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const row = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, auth.userId),
  })

  if (row) return NextResponse.json(publicSettings(row))

  const environment = await getAiCredentials(auth.userId)
  if (environment?.source === 'environment') {
    return NextResponse.json({
      provider: environment.provider,
      model: environment.model,
      hasApiKey: true,
      apiKeyHint: 'Configurada en el servidor',
      models: environment.models,
      source: 'environment',
      lastTestAt: null,
      lastTestOk: null,
    })
  }

  return NextResponse.json(publicSettings(undefined))
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Configuración no válida' }, { status: 400 })
  }

  const existing = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, auth.userId),
  })
  const apiKey = parsed.data.api_key
  if (!existing && !apiKey) {
    return NextResponse.json({ error: 'Introduce una clave API antes de guardar' }, { status: 400 })
  }
  if (existing && existing.proveedor !== parsed.data.provider && !apiKey) {
    return NextResponse.json({ error: 'Introduce la clave correspondiente al nuevo proveedor' }, { status: 400 })
  }
  const freeSearchModel = parsed.data.model_search_free
    ?? (parsed.data.provider === 'openrouter' && isFreeOpenRouterModel(parsed.data.model) ? parsed.data.model : 'openrouter/free')
  if (parsed.data.provider === 'openrouter' && !isFreeOpenRouterModel(freeSearchModel)) {
    return NextResponse.json({
      error: 'El modelo asignado a búsqueda gratuita debe ser openrouter/free o terminar en :free',
    }, { status: 400 })
  }

  const now = new Date().toISOString()
  if (existing) {
    await db
      .update(configuraciones_ia)
      .set({
        proveedor: parsed.data.provider,
        modelo: parsed.data.model,
        modelo_busqueda_gratuita: freeSearchModel,
        modelo_busqueda_premium: parsed.data.model_search_premium ?? parsed.data.model,
        modelo_analisis_cartera: parsed.data.model_portfolio_analysis ?? parsed.data.model,
        ...(apiKey ? { api_key_cifrada: encryptSecret(apiKey) } : {}),
        updated_at: now,
      })
      .where(eq(configuraciones_ia.id, existing.id))
  } else {
    await db.insert(configuraciones_ia).values({
      usuario_id: auth.userId,
      proveedor: parsed.data.provider,
      modelo: parsed.data.model,
      modelo_busqueda_gratuita: freeSearchModel,
      modelo_busqueda_premium: parsed.data.model_search_premium ?? parsed.data.model,
      modelo_analisis_cartera: parsed.data.model_portfolio_analysis ?? parsed.data.model,
      api_key_cifrada: encryptSecret(apiKey!),
      created_at: now,
      updated_at: now,
    })
  }

  const saved = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, auth.userId),
  })
  return NextResponse.json(publicSettings(saved))
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Configuración no válida' }, { status: 400 })
  }

  const existing = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, auth.userId),
  })

  let apiKey = parsed.data.api_key
  if (!apiKey && existing?.proveedor === parsed.data.provider) {
    try {
      apiKey = decryptSecret(existing.api_key_cifrada)
    } catch {
      return NextResponse.json({ error: 'No se pudo descifrar la clave guardada. Sustitúyela por una nueva.' }, { status: 400 })
    }
  }
  if (!apiKey) {
    const environment = await getAiCredentials(auth.userId)
    if (environment?.provider === parsed.data.provider) apiKey = environment.apiKey
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'Introduce o guarda una clave API antes de probar' }, { status: 400 })
  }

  try {
    const result = await testAiProvider({
      provider: parsed.data.provider,
      apiKey,
      model: parsed.data.model,
    })
    const now = new Date().toISOString()
    if (existing) {
      await db
        .update(configuraciones_ia)
        .set({ ultimo_test_at: now, ultimo_test_ok: true, updated_at: now })
        .where(eq(configuraciones_ia.id, existing.id))
    }
    return NextResponse.json({ ok: true, model: parsed.data.model, ...result, testedAt: now })
  } catch (error) {
    const now = new Date().toISOString()
    if (existing) {
      await db
        .update(configuraciones_ia)
        .set({ ultimo_test_at: now, ultimo_test_ok: false, updated_at: now })
        .where(eq(configuraciones_ia.id, existing.id))
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo conectar con el proveedor',
      testedAt: now,
    }, { status: 502 })
  }
}
