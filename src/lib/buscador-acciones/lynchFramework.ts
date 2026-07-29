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
  firstSource: string
  stage: 'Universo' | 'Preselección' | 'Revisión'
  ticker?: string
  company?: string
  exchange?: string
  sourceUrls?: ResearchSource[]
  dataAsOf?: string
}

export type ResearchSource = {
  label: string
  url: string
}

export type ResearchEngine = 'local' | 'openai-web' | 'local-fallback'

export type ResearchInput = {
  query: string
  mode: SearchMode
  horizon: '3-5' | '5-10' | '10+'
  risk: 'prudente' | 'moderado' | 'alto'
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
  providerNote?: string
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
    generatedAt: '',
  }
}

export function generateResearchResult(input: ResearchInput): ResearchResult {
  const query = normalizeQuery(input.query)
  const modeLabel = MODE_LABELS[input.mode]
  const querySuffix = query
    ? ` a partir de «${query}»`
    : ' a partir de una observación cotidiana'

  const leads = LEAD_LIBRARY[input.mode].map((lead, index) => ({
    ...lead,
    fit: Math.max(62, Math.min(97, lead.fit - (input.risk === 'prudente' && index === 2 ? 4 : 0))),
  }))

  const title = query
    ? `Hipótesis de investigación para ${query}`
    : `Mapa inicial de empresas ${modeLabel}`

  const summary = input.mode === 'ipo'
    ? `La IA no convierte una salida a bolsa en una oportunidad por el mero hecho de ser nueva. Primero pediría prospecto, factores de riesgo, uso de fondos, dilución y varios trimestres de evidencia${querySuffix}.`
    : `El punto de partida encaja con la búsqueda de Lynch: una historia entendible, poco ruido y una pregunta concreta sobre cómo puede crecer el beneficio${querySuffix}.`

  const methodNote = query
    ? 'La pista se ha convertido en un universo de búsqueda; todavía no es una acción validada ni una recomendación.'
    : 'Resultado de orientación metodológica. Para nombrar tickers hacen falta datos de mercado y documentos primarios actualizados.'

  const questions = [
    `¿Puedes explicar el negocio de ${query || 'la empresa'} en dos minutos sin usar palabras de moda?`,
    '¿Qué número tendría que crecer para que la historia se convierta en beneficio por acción?',
    '¿Qué deuda, dilución o competidor puede romper la tesis?',
    `¿La valoración deja margen para un horizonte de ${input.horizon.replace('-', '–')} años?`,
  ]

  const nextStep = input.mode === 'ipo'
    ? 'Abrir el prospecto y marcar riesgos, dilución y uso de fondos antes de mirar el gráfico.'
    : 'Elegir una pista, abrir el informe anual y escribir la historia y los números en una sola página.'

  return {
    title,
    summary,
    methodNote,
    leads,
    questions,
    nextStep,
    engine: 'local',
    generatedAt: new Date().toISOString(),
  }
}
