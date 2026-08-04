export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'

export const OPENROUTER_MODEL_FALLBACKS = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
] as const

export const OPENROUTER_MODEL_OPTIONS = [
  DEFAULT_OPENROUTER_MODEL,
  ...OPENROUTER_MODEL_FALLBACKS,
] as const

const LEGACY_FREE_ROUTER = 'openrouter/free'

export function normalizeOpenRouterModel(model: string | null | undefined) {
  const normalized = model?.trim() ?? ''
  return !normalized || normalized === LEGACY_FREE_ROUTER ? DEFAULT_OPENROUTER_MODEL : normalized
}

export function isExplicitOpenRouterFreeModel(model: string) {
  const normalized = model.trim()
  return normalized.endsWith(':free') && normalized !== LEGACY_FREE_ROUTER
}

export function normalizeOpenRouterFreeModel(model: string | null | undefined) {
  const normalized = normalizeOpenRouterModel(model)
  return isExplicitOpenRouterFreeModel(normalized)
    && (OPENROUTER_MODEL_OPTIONS as readonly string[]).includes(normalized)
    ? normalized
    : DEFAULT_OPENROUTER_MODEL
}

export function buildOpenRouterModelChain(primaryModel: string) {
  const primary = normalizeOpenRouterModel(primaryModel)
  return [primary, ...OPENROUTER_MODEL_OPTIONS.filter((model) => model !== primary)].slice(0, 5)
}
