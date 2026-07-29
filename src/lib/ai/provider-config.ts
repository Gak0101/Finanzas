import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { configuraciones_ia } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/ai/secret-crypto'

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

function isFreeOpenRouterModel(model: string) {
  return model === 'openrouter/free' || model.endsWith(':free')
}

export async function getAiCredentials(userId: number): Promise<AiCredentials | null> {
  const stored = await db.query.configuraciones_ia.findFirst({
    where: eq(configuraciones_ia.usuario_id, userId),
  })

  if (stored && (stored.proveedor === 'openrouter' || stored.proveedor === 'openai')) {
    try {
      return {
        provider: stored.proveedor,
        apiKey: decryptSecret(stored.api_key_cifrada),
        model: stored.modelo,
        models: {
          searchFree: stored.modelo_busqueda_gratuita
            ?? (stored.proveedor === 'openrouter' && isFreeOpenRouterModel(stored.modelo) ? stored.modelo : 'openrouter/free'),
          searchPremium: stored.modelo_busqueda_premium ?? stored.modelo,
          portfolioAnalysis: stored.modelo_analisis_cartera ?? stored.modelo,
        },
        source: 'app',
      }
    } catch {
      return null
    }
  }

  const requestedProvider = process.env.BUSCADOR_ACCIONES_PROVIDER?.trim().toLowerCase()
  if (requestedProvider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL ?? 'openrouter/free',
      models: {
        searchFree: process.env.OPENROUTER_FREE_SEARCH_MODEL ?? 'openrouter/free',
        searchPremium: process.env.OPENROUTER_ADVANCED_MODEL ?? process.env.OPENROUTER_PREMIUM_SEARCH_MODEL ?? process.env.OPENROUTER_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL ?? 'openrouter/free',
        portfolioAnalysis: process.env.OPENROUTER_ADVANCED_MODEL ?? process.env.OPENROUTER_PORTFOLIO_MODEL ?? process.env.OPENROUTER_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL ?? 'openrouter/free',
      },
      source: 'environment',
    }
  }
  if (requestedProvider === 'openai' && process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.BUSCADOR_ACCIONES_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini',
      models: {
        searchFree: 'openrouter/free',
        searchPremium: process.env.OPENAI_ADVANCED_MODEL ?? process.env.OPENAI_PREMIUM_SEARCH_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini',
        portfolioAnalysis: process.env.OPENAI_ADVANCED_MODEL ?? process.env.OPENAI_PORTFOLIO_MODEL ?? process.env.BUSCADOR_ACCIONES_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini',
      },
      source: 'environment',
    }
  }
  return null
}
