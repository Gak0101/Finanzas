import type { AiProviderName } from '@/lib/ai/provider-config'

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
  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'Eres el asistente de una app de finanzas personales. Responde de forma breve y en español.',
      },
      {
        role: 'user',
        content: 'Responde exactamente con una frase breve confirmando que la conexión funciona e indica tu modelo.',
      },
    ],
    ...(provider === 'openai'
      ? { max_completion_tokens: 256 }
      : {
        max_tokens: 256,
        // Un modelo de razonamiento puede consumir un límite pequeño pensando y
        // terminar con content vacío. Para este test técnico no necesitamos CoT.
        reasoning: { effort: 'none', exclude: true },
      }),
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      throw new Error(providerMessage ? providerMessage.slice(0, 240) : `${provider} respondió HTTP ${response.status}`)
    }

    const message = payload ? outputText(payload) : ''
    if (message) {
      return {
        message: message.slice(0, 500),
        latencyMs: Date.now() - startedAt,
      }
    }

    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 750))
    }
  }

  throw new Error('La clave es válida y OpenRouter aceptó la petición, pero este modelo no generó texto. Prueba de nuevo o usa openrouter/free.')
}
