import type { AiProviderName } from '@/lib/ai/provider-config'
import { buildOpenRouterModelChain, DEFAULT_OPENROUTER_MODEL } from '@/lib/ai/model-routing'

type TestProviderInput = {
  provider: AiProviderName
  apiKey: string
  model: string
}

type ChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: { message?: string }
}

function outputText(payload: ChatPayload) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .join('')
      .trim()
  }
  return ''
}

export async function testAiProvider({ provider, apiKey, model }: TestProviderInput) {
  const startedAt = Date.now()
  const configuredBase = provider === 'openrouter'
    ? process.env.OPENROUTER_BASE_URL
    : process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE
  const defaultBase = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1'
  const base = (configuredBase || defaultBase).replace(/\/+$/, '')
  const endpoint = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
  const modelAttempts = provider === 'openrouter' ? buildOpenRouterModelChain(model) : [model, model]
  let lastError = ''
  for (let attempt = 0; attempt < modelAttempts.length; attempt += 1) {
    const attemptModel = modelAttempts[attempt]
    const requestBody = {
      model: attemptModel,
      messages: [
        {
          role: 'system',
          content: provider === 'openrouter'
            ? 'Responde únicamente con JSON válido que cumpla el esquema.'
            : 'Eres el asistente de una app de finanzas personales. Responde de forma breve y en español.',
        },
        {
          role: 'user',
          content: provider === 'openrouter'
            ? 'Confirma que la conexión funciona.'
            : 'Responde exactamente con una frase breve confirmando que la conexión funciona e indica tu modelo.',
        },
      ],
      ...(provider === 'openai'
        ? { max_completion_tokens: 256 }
        : {
          max_tokens: 256,
          reasoning: { effort: 'none', exclude: true },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'connection_test',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: { ok: { type: 'boolean' }, message: { type: 'string' } },
                required: ['ok', 'message'],
              },
            },
          },
          provider: { require_parameters: true },
        }),
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider === 'openrouter'
          ? {
            'HTTP-Referer': process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
            'X-OpenRouter-Title': 'Finanzas · Prueba de conexión',
          }
          : {}),
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })

    const payload = await response.json().catch(() => null) as ChatPayload | null
    if (!response.ok) {
      const providerMessage = payload?.error?.message?.trim()
      lastError = providerMessage ? providerMessage.slice(0, 240) : `${provider} respondió HTTP ${response.status}`
      if (provider === 'openrouter') continue
      throw new Error(lastError)
    }

    const message = payload ? outputText(payload) : ''
    if (message) {
      let readableMessage = message
      try {
        const parsedMessage = JSON.parse(message) as { message?: unknown }
        if (typeof parsedMessage.message === 'string' && parsedMessage.message.trim()) {
          readableMessage = parsedMessage.message.trim()
        }
      } catch {
        // OpenAI y algunos proveedores devuelven texto libre en la prueba.
      }
      return {
        message: readableMessage.slice(0, 500),
        model: attemptModel,
        latencyMs: Date.now() - startedAt,
      }
    }
    lastError = `${attemptModel} aceptó la petición, pero no generó texto.`
  }

  const providerLabel = provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'
  const suggestion = provider === 'openrouter'
    ? `Prueba de nuevo o usa ${DEFAULT_OPENROUTER_MODEL}.`
    : 'Revisa el modelo configurado y la cuota de tu API.'
  throw new Error(`${providerLabel} no completó la prueba verificable. ${lastError || suggestion}`)
}
