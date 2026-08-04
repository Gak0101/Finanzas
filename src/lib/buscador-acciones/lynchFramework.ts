export type SearchMode = 'boring' | 'ipo' | 'everyday' | 'growth'

export type LynchCategoryKey =
  | 'slow-grower'
  | 'stalwart'
  | 'fast-grower'
  | 'cyclical'
  | 'turnaround'
  | 'asset-play'

export type ResearchLead = {
  id: string
  title: string
  subtitle: string
  category: LynchCategoryKey
  fit: number
  thesis: string
  evidence: string[]
  risks: string[]
  monitoring?: string[]
  exitSignals?: string[]
  firstSource: string
  stage: 'Universo' | 'Preselección' | 'Revisión'
  ticker?: string
  company?: string
  exchange?: string
  sourceUrls?: ResearchSource[]
  dataAsOf?: string
  categoryReason?: string
  scorecard?: ResearchScorecard
}

export type ResearchSource = {
  label: string
  url: string
}

export type ResearchMetricKey =
  | 'price'
  | 'market-cap'
  | 'revenue'
  | 'revenue-growth'
  | 'net-income'
  | 'eps'
  | 'eps-growth'
  | 'gross-margin'
  | 'operating-margin'
  | 'net-margin'
  | 'free-cash-flow'
  | 'operating-cash-flow'
  | 'cash'
  | 'debt'
  | 'net-debt'
  | 'shares'
  | 'pe'
  | 'ps'
  | 'roe'
  | 'roic'

export type ResearchMetricStatus = 'verified' | 'partial' | 'missing'

export type ResearchMetric = {
  key: ResearchMetricKey
  label: string
  value: string
  numericValue?: number
  unit?: string
  period?: string
  status: ResearchMetricStatus
  sourceUrls: ResearchSource[]
  note?: string
}

export type ResearchCheckKey =
  | 'story'
  | 'category'
  | 'growth'
  | 'profitability'
  | 'balance-sheet'
  | 'valuation'
  | 'dilution'
  | 'risk'

export type ResearchCheckStatus = 'verified' | 'partial' | 'missing'

export type ResearchCheck = {
  key: ResearchCheckKey
  label: string
  status: ResearchCheckStatus
  detail: string
  sourceUrls: ResearchSource[]
}

export type ResearchScorecard = {
  score: number
  coverage: number
  dataQuality: 'complete' | 'partial' | 'insufficient'
  verdict: 'investigar' | 'esperar' | 'sin-datos'
  categoryReason: string
  metrics: ResearchMetric[]
  checks: ResearchCheck[]
  valuation: {
    status: 'evaluable' | 'partial' | 'not-evaluable'
    label: string
    note: string
  }
}

export type ResearchEngine = 'local' | 'openrouter-free' | 'openai-firecrawl' | 'openrouter-firecrawl' | 'local-fallback' | 'data-fallback'

export const RESEARCH_INTEGRITY_NOTE = 'Regla de integridad: no se inventan empresas, tickers, cifras, fechas ni fuentes. Si un dato no está respaldado por una fuente trazable, aparece como «No encontrado» o el candidato se descarta.'
export const RESEARCH_INTERPRETATION_NOTE = 'Las categorías, tesis, riesgos y señales de seguimiento son hipótesis para revisar; no son hechos verificados ni órdenes de compra o venta.'

export type LynchCoachCategory = LynchCategoryKey | 'undecided'

export type LynchMetricFocus =
  | 'growth'
  | 'profitability'
  | 'cash-flow'
  | 'balance-sheet'
  | 'valuation'
  | 'dilution'

export type LynchResearchProfile = {
  observation: string
  business: string
  category: LynchCoachCategory
  metricFocus: LynchMetricFocus[]
  thesis: string
  invalidation: string
}

export type LynchCoachStep = {
  key: 'observation' | 'business' | 'category' | 'metricFocus' | 'thesis' | 'invalidation'
  label: string
  prompt: string
  hint: string
}

export const LYNCH_COACH_STEPS: LynchCoachStep[] = [
  {
    key: 'observation',
    label: 'La pista',
    prompt: '¿Qué has visto que merece una pregunta? Puede ser una empresa, un producto, un sector o un cambio que observes a diario.',
    hint: 'No necesitas saber el ticker todavía. La observación es el punto de partida, no una tesis.',
  },
  {
    key: 'business',
    label: 'La historia',
    prompt: '¿Qué crees que vende, quién paga y por qué el cliente volvería? Explícalo como si se lo contaras a alguien en dos minutos.',
    hint: 'Si aún no lo sabes, escribe “quiero que lo investigue”. La app lo dejará como pregunta pendiente.',
  },
  {
    key: 'category',
    label: 'La categoría',
    prompt: '¿Qué tipo de historia parece ser? La categoría no es una etiqueta decorativa: cambia qué números importan y cuándo una tesis deja de tener sentido.',
    hint: 'Puedes elegir “Todavía no lo sé” y dejar que la evidencia pese más que la intuición.',
  },
  {
    key: 'metricFocus',
    label: 'Los números',
    prompt: '¿Qué quieres que la investigación compruebe con especial cuidado? Elige una o varias prioridades.',
    hint: 'Siempre se revisarán ventas, beneficio, caja, deuda, acciones y valoración cuando haya datos; esto marca tu foco personal.',
  },
  {
    key: 'thesis',
    label: 'La tesis',
    prompt: '¿Qué tendría que ocurrir para que esta empresa demostrase que la historia funciona durante tu horizonte?',
    hint: 'Escribe una condición observable, no una promesa de rentabilidad.',
  },
  {
    key: 'invalidation',
    label: 'La salida',
    prompt: '¿Qué dato, hecho o cambio te haría revisar o abandonar la tesis? Decidirlo antes ayuda a no mover la portería después.',
    hint: 'Si no tienes una respuesta, escribe “proponer señales” y la IA planteará preguntas de invalidación, no órdenes de compra o venta.',
  },
]

export const LYNCH_METRIC_FOCUS: Array<{ key: LynchMetricFocus; label: string; description: string }> = [
  { key: 'growth', label: 'Crecimiento', description: 'Ventas y BPA a través del tiempo' },
  { key: 'profitability', label: 'Rentabilidad', description: 'Márgenes, ROE y calidad del beneficio' },
  { key: 'cash-flow', label: 'Caja', description: 'Flujo operativo y flujo libre' },
  { key: 'balance-sheet', label: 'Deuda y balance', description: 'Caja, deuda neta y resistencia' },
  { key: 'valuation', label: 'Valoración', description: 'PER, precio/ventas y margen' },
  { key: 'dilution', label: 'Dilución', description: 'Acciones, opciones y nuevas emisiones' },
]

export function createInitialResearchProfile(): LynchResearchProfile {
  return {
    observation: '',
    business: '',
    category: 'undecided',
    metricFocus: [],
    thesis: '',
    invalidation: '',
  }
}

export type ResearchInput = {
  query: string
  mode: SearchMode
  horizon: '3-5' | '5-10' | '10+'
  risk: 'prudente' | 'moderado' | 'alto'
  profile?: LynchResearchProfile
}

export type ResearchResult = {
  title: string
  summary: string
  methodNote: string
  leads: ResearchLead[]
  questions: string[]
  nextStep: string
  engine: ResearchEngine
  generatedAt: string
  profile?: LynchResearchProfile
  providerNote?: string
  screening?: {
    companiesFound: number
    candidatesReturned: number
    candidatesDiscarded: number
    note: string
  }
}

export const SEARCH_MODES: Array<{
  key: SearchMode
  label: string
  description: string
  prompt: string
}> = [
  {
    key: 'boring',
    label: 'Aburridas',
    description: 'Negocios poco glamourosos y fáciles de pasar por alto.',
    prompt: 'Distribuidores, servicios B2B y negocios que nadie comenta',
  },
  {
    key: 'ipo',
    label: 'Nuevas cotizadas',
    description: 'IPO, spin-offs y empresas con poco historial público.',
    prompt: 'Una empresa recién cotizada con un nicho entendible',
  },
  {
    key: 'everyday',
    label: 'Lo cotidiano',
    description: 'Ideas que aparecen en tu trabajo, barrio o consumo.',
    prompt: 'Un producto que veo usar cada semana',
  },
  {
    key: 'growth',
    label: 'Crecimiento',
    description: 'Crecimiento visible, pero con valoración que aún exige trabajo.',
    prompt: 'Una empresa pequeña que crece y todavía no es famosa',
  },
]

export const LYNCH_CATEGORIES: Array<{
  key: LynchCategoryKey
  label: string
  color: string
  description: string
  watch: string
}> = [
  {
    key: 'fast-grower',
    label: 'Fast grower',
    color: '#c8f56a',
    description: 'Empresa pequeña con una historia de crecimiento que todavía puede desplegarse.',
    watch: 'Crecimiento, tamaño del mercado y precio pagado.',
  },
  {
    key: 'stalwart',
    label: 'Stalwart',
    color: '#72c9b0',
    description: 'Negocio resistente y conocido, útil para estabilidad más que para soñar con 10×.',
    watch: 'Ritmo de crecimiento, deuda y valoración.',
  },
  {
    key: 'slow-grower',
    label: 'Slow grower',
    color: '#9aa5ae',
    description: 'Compañía madura: puede tener sentido, pero la expectativa debe ser realista.',
    watch: 'Dividendo, caja y pérdida de cuota.',
  },
  {
    key: 'cyclical',
    label: 'Cyclical',
    color: '#e7a35e',
    description: 'Resultados que dependen del ciclo; el beneficio de hoy puede ser el máximo.',
    watch: 'Inventarios, demanda y punto del ciclo.',
  },
  {
    key: 'turnaround',
    label: 'Turnaround',
    color: '#e58b8d',
    description: 'Empresa con problemas concretos y una vía plausible para recuperarse.',
    watch: 'Liquidez, deuda y señales de recuperación.',
  },
  {
    key: 'asset-play',
    label: 'Asset play',
    color: '#a78bfa',
    description: 'El valor puede estar en activos que el mercado no está reconociendo bien.',
    watch: 'Activos netos, catalizador y descuento.',
  },
]

export const RESEARCH_CHECKLIST = [
  {
    title: 'La historia cabe en dos minutos',
    description: 'Qué vende, a quién, por qué vuelve el cliente y qué tendría que pasar para crecer.',
  },
  {
    title: 'Los números confirman la historia',
    description: 'Ventas, beneficio, caja, deuda, márgenes y acciones en circulación; sin rellenar huecos con imaginación.',
  },
  {
    title: 'La categoría está bien elegida',
    description: 'Una empresa cíclica no se valora como una fast grower, ni una turnaround como un negocio estable.',
  },
  {
    title: 'La valoración deja margen',
    description: 'El crecimiento esperado debe justificar el precio; el potencial no sirve si ya está descontado.',
  },
  {
    title: 'Sabemos qué invalidaría la tesis',
    description: 'Define antes de comprar qué dato, cambio competitivo o problema financiero te haría salir.',
  },
]

const LEAD_LIBRARY: Record<SearchMode, ResearchLead[]> = {
  boring: [
    {
      id: 'vertical-distribution',
      title: 'Distribución especializada',
      subtitle: 'Industria local, catálogo difícil de sustituir',
      category: 'fast-grower',
      fit: 91,
      thesis: 'Rastrear distribuidores pequeños que ganan sucursales, clientes recurrentes o poder de compra sin ser una historia de moda.',
      evidence: ['Ventas por ubicación o cliente', 'Repetición de pedidos y margen bruto', 'Deuda usada para crecer, no para tapar pérdidas'],
      risks: ['Concentración en pocos clientes', 'Crecimiento comprado con adquisiciones caras'],
      firstSource: 'Memoria anual y presentaciones de resultados',
      stage: 'Universo',
    },
    {
      id: 'vertical-software',
      title: 'Software vertical de nicho',
      subtitle: 'Herramienta esencial para un oficio concreto',
      category: 'fast-grower',
      fit: 86,
      thesis: 'Buscar software que resuelva una tarea aburrida, tenga costes de cambio reales y cobre de forma recurrente.',
      evidence: ['Retención y expansión de clientes', 'Margen y flujo de caja por cliente', 'Mercado pequeño que pueda replicarse'],
      risks: ['Competencia de una plataforma mayor', 'Confundir crecimiento de usuarios con crecimiento rentable'],
      firstSource: '10-K/20-F, notas de ingresos y llamadas de resultados',
      stage: 'Universo',
    },
    {
      id: 'maintenance-services',
      title: 'Mantenimiento crítico',
      subtitle: 'Servicios que nadie presume, pero nadie puede dejar',
      category: 'stalwart',
      fit: 78,
      thesis: 'Explorar negocios de mantenimiento, inspección o recambios con demanda recurrente y poca atención mediática.',
      evidence: ['Renovación de contratos', 'Ventaja por certificaciones o red técnica', 'Conversión estable de beneficio en caja'],
      risks: ['Crecimiento limitado por mano de obra', 'Dependencia de una regulación o contrato'],
      firstSource: 'Informe anual, clientes principales y riesgos regulatorios',
      stage: 'Universo',
    },
  ],
  ipo: [
    {
      id: 'profitable-ipo',
      title: 'IPO con nicho rentable',
      subtitle: 'Empresa nueva en bolsa, negocio ya entendible',
      category: 'fast-grower',
      fit: 84,
      thesis: 'No perseguir el estreno: leer el prospecto y buscar una empresa que ya demuestre demanda antes de pagar por la novedad.',
      evidence: ['Ventas y margen antes de la oferta', 'Uso de los fondos claramente explicado', 'Accionistas vendedores, lock-up y dilución'],
      risks: ['Historial público corto', 'Valoración inicial y volatilidad', 'Dependencia del fundador'],
      firstSource: 'Prospecto S-1/F-1 y factores de riesgo',
      stage: 'Revisión',
    },
    {
      id: 'recent-spin-off',
      title: 'Spin-off de negocio sencillo',
      subtitle: 'Activo separado que el mercado aún no sigue',
      category: 'asset-play',
      fit: 76,
      thesis: 'Investigar separaciones recientes donde la nueva compañía tenga cuentas propias y una historia más fácil de leer que el conglomerado.',
      evidence: ['Cuentas pro forma comparables', 'Asignación de deuda y costes centrales', 'Catalizador operativo identificable'],
      risks: ['Cuentas pro forma optimistas', 'Pérdida de sinergias del grupo', 'Liquidez bursátil baja'],
      firstSource: 'Registro de la operación y primer informe trimestral',
      stage: 'Universo',
    },
    {
      id: 'post-ipo-proof',
      title: 'Empresa con 4 trimestres de prueba',
      subtitle: 'Menos novedad, más evidencia operativa',
      category: 'fast-grower',
      fit: 82,
      thesis: 'Esperar a que una empresa recién cotizada publique varios trimestres para distinguir negocio real de narrativa de salida a bolsa.',
      evidence: ['Guía cumplida sin contabilidad creativa', 'Caja y acciones en circulación', 'Retención de clientes y márgenes'],
      risks: ['Crecimiento que se normaliza rápido', 'Vencimiento de lock-up y presión vendedora'],
      firstSource: 'Últimos 10-Q/10-K y transcripciones de resultados',
      stage: 'Preselección',
    },
  ],
  everyday: [
    {
      id: 'customer-love',
      title: 'Producto que ves repetir',
      subtitle: 'Una observación cotidiana convertida en pregunta',
      category: 'fast-grower',
      fit: 88,
      thesis: 'Partir del comportamiento que observas, pero pasar rápido de “me gusta” a cuota, repetición, economía unitaria y valoración.',
      evidence: ['Clientes que repiten sin descuento', 'Distribución que puede escalar', 'Competencia y tamaño del mercado'],
      risks: ['Sesgo de tu barrio o burbuja', 'Producto popular con economía débil'],
      firstSource: 'Presentación corporativa y cuentas auditadas',
      stage: 'Universo',
    },
    {
      id: 'workplace-adoption',
      title: 'Herramienta que adopta tu trabajo',
      subtitle: 'Una mejora pequeña con presupuesto recurrente',
      category: 'stalwart',
      fit: 80,
      thesis: 'Buscar herramientas que ahorren tiempo o errores y se conviertan en infraestructura del cliente, aunque no sean virales.',
      evidence: ['Coste de cambio', 'Renovación y expansión', 'Beneficio por empleado o usuario'],
      risks: ['Dependencia de un canal de ventas', 'Cliente grande con poder de negociación'],
      firstSource: 'Informe anual, clientes y métricas operativas',
      stage: 'Universo',
    },
    {
      id: 'unloved-brand',
      title: 'Marca poco querida, negocio sólido',
      subtitle: 'Lo aburrido puede esconder una ventaja',
      category: 'asset-play',
      fit: 73,
      thesis: 'Separar el gusto personal de la rentabilidad: hay marcas poco atractivas que conservan distribución, caja o activos valiosos.',
      evidence: ['Flujo de caja y recompra', 'Poder de fijación de precios', 'Valor de marca o red de distribución'],
      risks: ['Declive estructural', 'Inventarios y promociones que maquillan la demanda'],
      firstSource: 'Memoria anual y evolución de inventarios',
      stage: 'Universo',
    },
  ],
  growth: [
    {
      id: 'profitable-compounder',
      title: 'Compounder pequeño y rentable',
      subtitle: 'Crecimiento visible sin depender de una moda',
      category: 'fast-grower',
      fit: 94,
      thesis: 'Priorizar crecimiento orgánico, reinversión rentable y un mercado que todavía pueda multiplicarse sin exigir una historia perfecta.',
      evidence: ['Crecimiento orgánico separado de adquisiciones', 'Retorno sobre capital reinvertido', 'Valoración comparada con el crecimiento'],
      risks: ['El mercado ya descuenta diez años perfectos', 'Saturación del nicho'],
      firstSource: '10-K/20-F, carta a accionistas y valoración propia',
      stage: 'Preselección',
    },
    {
      id: 'small-cap-leader',
      title: 'Líder de un nicho pequeño',
      subtitle: 'Número uno en un mercado que aún no sale en titulares',
      category: 'fast-grower',
      fit: 89,
      thesis: 'Buscar liderazgo medible en un mercado fragmentado antes de que la empresa se convierta en una historia popular.',
      evidence: ['Cuota y crecimiento del mercado', 'Ventaja de costes o distribución', 'Capacidad de financiar expansión'],
      risks: ['Mercado demasiado pequeño', 'Competidor con más capital'],
      firstSource: 'Informe anual, competidores y datos del sector',
      stage: 'Universo',
    },
    {
      id: 'recovery-growth',
      title: 'Recuperación con catalizador',
      subtitle: 'El beneficio actual no cuenta toda la historia',
      category: 'turnaround',
      fit: 75,
      thesis: 'Distinguir una caída temporal de un negocio roto y exigir un balance que permita esperar a que la recuperación llegue.',
      evidence: ['Causa concreta del deterioro', 'Plan de recuperación medible', 'Liquidez suficiente para ejecutarlo'],
      risks: ['Trampa de valor', 'Nueva financiación dilutiva', 'Turnaround sin fecha'],
      firstSource: 'Presentación de resultados, deuda y hechos relevantes',
      stage: 'Revisión',
    },
  ],
}

const MODE_LABELS: Record<SearchMode, string> = {
  boring: 'aburridas y poco seguidas',
  ipo: 'nuevas cotizadas',
  everyday: 'lo que ya conoces',
  growth: 'crecimiento razonable',
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ')
}

export function getCategory(key: LynchCategoryKey) {
  return LYNCH_CATEGORIES.find((category) => category.key === key) ?? LYNCH_CATEGORIES[0]
}

export function createInitialResult(): ResearchResult {
  return {
    ...generateResearchResult({ query: '', mode: 'boring', horizon: '5-10', risk: 'moderado' }),
    title: 'Aún no hay informe',
    summary: 'Completa el preparador Lynch o usa el atajo con una empresa/ticker. La aplicación no mostrará candidatos hasta comprobar identidad, datos y fuentes.',
    methodNote: 'Todavía no se ha ejecutado ninguna consulta; no hay datos financieros verificados.',
    questions: [],
    nextStep: 'Responde las preguntas del preparador y pulsa «Buscar y verificar» cuando el mapa esté listo.',
    generatedAt: '',
    screening: {
      companiesFound: 0,
      candidatesReturned: 0,
      candidatesDiscarded: 0,
      note: 'El informe aparecerá después de una búsqueda real.',
    },
  }
}

export function createEmptyScorecard(categoryReason = 'No hay datos financieros verificados todavía.') : ResearchScorecard {
  const metricLabels: Array<[ResearchMetricKey, string]> = [
    ['price', 'Precio actual'],
    ['market-cap', 'Capitalización'],
    ['revenue', 'Ventas'],
    ['revenue-growth', 'Crecimiento de ventas'],
    ['net-income', 'Beneficio neto'],
    ['eps', 'Beneficio por acción'],
    ['eps-growth', 'Crecimiento del BPA'],
    ['gross-margin', 'Margen bruto'],
    ['operating-margin', 'Margen operativo'],
    ['net-margin', 'Margen neto'],
    ['free-cash-flow', 'Flujo de caja libre'],
    ['operating-cash-flow', 'Flujo de caja operativo'],
    ['cash', 'Caja'],
    ['debt', 'Deuda'],
    ['net-debt', 'Deuda neta'],
    ['shares', 'Acciones en circulación'],
    ['pe', 'PER'],
    ['ps', 'Precio / ventas'],
    ['roe', 'ROE'],
    ['roic', 'ROIC'],
  ]
  const metrics = metricLabels.map(([key, label]) => ({
    key,
    label,
    value: 'No encontrado',
    status: 'missing' as const,
    sourceUrls: [],
  }))
  const checks: ResearchCheck[] = ([
    ['story', 'Historia del negocio'],
    ['category', 'Categoría Lynch'],
    ['growth', 'Crecimiento'],
    ['profitability', 'Rentabilidad'],
    ['balance-sheet', 'Balance y deuda'],
    ['valuation', 'Valoración'],
    ['dilution', 'Acciones y dilución'],
    ['risk', 'Riesgos e invalidación'],
  ] as Array<[ResearchCheckKey, string]>).map(([key, label]) => ({
    key,
    label,
    status: 'missing',
    detail: 'Pendiente de datos verificables.',
    sourceUrls: [],
  }))

  return {
    score: 0,
    coverage: 0,
    dataQuality: 'insufficient',
    verdict: 'sin-datos',
    categoryReason,
    metrics,
    checks,
    valuation: {
      status: 'not-evaluable',
      label: 'No evaluable',
      note: 'Faltan múltiplos de valoración verificables.',
    },
  }
}

export function generateResearchResult(input: ResearchInput): ResearchResult {
  const query = normalizeQuery(input.query)
  const querySuffix = query
    ? ` a partir de «${query}»`
    : ' a partir de una observación cotidiana'

  const title = query
    ? `Sin candidatos verificables para ${query}`
    : 'Aún no hay informe'

  const summary = query
    ? `La búsqueda se ha ejecutado, pero todavía no ha convertido ${query} en una empresa cotizada con identidad, métricas y fuentes suficientes. La aplicación no rellena los huecos con una hipótesis.`
    : 'Escribe una consulta para iniciar un cribado con datos de mercado, estados financieros y fuentes trazables.'

  const methodNote = query
    ? 'No hay una ficha bursátil verificable que mostrar en esta pasada. Prueba una pista más concreta o revisa las fuentes que han respondido antes de sacar conclusiones.'
    : 'Todavía no se ha ejecutado ninguna consulta.'

  const questions = [
    `¿Puedes explicar el negocio de ${query || 'la empresa'} en dos minutos sin usar palabras de moda?`,
    '¿Qué número tendría que crecer para que la historia se convierta en beneficio por acción?',
    '¿Qué deuda, dilución o competidor puede romper la tesis?',
    `¿La valoración deja margen para un horizonte de ${input.horizon.replace('-', '–')} años?`,
  ]

  const nextStep = query
    ? 'Prueba con un ticker, una empresa o un sector más concreto; si buscas descubrimiento abierto, amplía la pista y vuelve a verificar las fuentes.'
    : 'Completa el mapa Lynch o escribe una empresa, un ticker o una pista temática para iniciar el cribado.'

  return {
    title,
    summary,
    methodNote,
    leads: [],
    questions,
    nextStep,
    engine: 'local',
    generatedAt: new Date().toISOString(),
    profile: input.profile,
    screening: {
      companiesFound: 0,
      candidatesReturned: 0,
      candidatesDiscarded: 0,
      note: query
        ? 'La consulta terminó sin candidatos que superaran el filtro de identidad, métricas y fuentes.'
        : 'El informe aparecerá después de una búsqueda real.',
    },
  }
}
