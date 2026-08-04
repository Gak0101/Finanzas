import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { configuraciones_ia } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/ai/secret-crypto'
import {
  normalizeOpenRouterFreeModel,
  normalizeOpenRouterModel,
} from '@/lib/ai/model-routing'

export type AiProviderName = 'openrouter' | 'openai'

export type AiCredentials = {
  provider: AiProviderName
  apiKey: string
  model: string
  models: {
    searchFree: string
    searchPremium: string
    portfolioAnalysis: string
  }
  source: 'app' | 'environment'
}

export async function getAiCredentials(userId: number): Promise<AiCredentials | null> {
  const stored = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, userId),
  })

  if (stored && (stored.proveedor === 'openrouter' || stored.proveedor === 'openai')) {
    try {
      const storedModel = stored.proveedor === 'openrouter'
        ? normalizeOpenRouterModel(stored.modelo)
        : stored.modelo
      return {
        provider: stored.proveedor,
        apiKey: decryptSecret(stored.api_key_cifrada),
        model: storedModel,
        models: {
          searchFree: stored.proveedor === 'openrouter'
            ? normalizeOpenRouterFreeModel(stored.modelo_busqueda_gratuita ?? storedModel)
            : stored.modelo_busqueda_gratuita ?? storedModel,
          searchPremium: stored.proveedor === 'openrouter'
            ? normalizeOpenRouterModel(stored.modelo_busqueda_premium ?? storedModel)
            : stored.modelo_busqueda_premium ?? storedModel,
          portfolioAnalysis: stored.proveedor === 'openrouter'
            ? normalizeOpenRouterModel(stored.modelo_analisis_cartera ?? storedModel)
            : stored.modelo_analisis_cartera ?? storedModel,
        },
        source: 'app',
      }
    } catch {
      return null
    }
  }

  const requestedProvider = process.env.BUSCADOR_ACCIONES_PROVIDER?.trim().toLowerCase()
  if (requestedProvider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    const environmentModel = normalizeOpenRouterModel(process.env.OPENROUTER_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL)
    return {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: environmentModel,
      models: {
        searchFree: normalizeOpenRouterFreeModel(process.env.OPENROUTER_FREE_SEARCH_MODEL ?? environmentModel),
        searchPremium: normalizeOpenRouterModel(process.env.OPENROUTER_ADVANCED_MODEL ?? process.env.OPENROUTER_PREMIUM_SEARCH_MODEL ?? environmentModel),
        portfolioAnalysis: normalizeOpenRouterModel(process.env.OPENROUTER_ADVANCED_MODEL ?? process.env.OPENROUTER_PORTFOLIO_MODEL ?? environmentModel),
      },
      source: 'environment',
    }
  }
  if (requestedProvider === 'openai' && process.env.OPENAI_API_KEY) {
    const environmentModel = process.env.BUSCADOR_ACCIONES_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini'
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: environmentModel,
      models: {
        searchFree: environmentModel,
        searchPremium: process.env.OPENAI_ADVANCED_MODEL ?? process.env.OPENAI_PREMIUM_SEARCH_MODEL ?? environmentModel,
        portfolioAnalysis: process.env.OPENAI_ADVANCED_MODEL ?? process.env.OPENAI_PORTFOLIO_MODEL ?? environmentModel,
      },
      source: 'environment',
    }
  }
  return null
}
