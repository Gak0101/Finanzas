// Editado: 2026-03-30 — API de análisis inteligente de desviaciones
// Calcula patrones: categorías más desviadas, frecuencia, media, y sugerencias
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones, categorias } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

// Interfaz para el análisis por categoría
interface AnalisisCategoria {
  categoria: string
  total_desviado: number
  num_desviaciones: number
  media_por_desviacion: number
  etiquetas_frecuentes: Record<string, number>
  meses_consecutivos: number
  ultima_desviacion: string | null
}

// GET /api/desviaciones/analisis — Análisis inteligente de patrones de desviación
export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  // Obtener todas las desviaciones del usuario (historial completo)
  const todas = await db.query.desviaciones.findMany({
    where: eq(desviaciones.usuario_id, auth.userId),
    orderBy: [desc(desviaciones.created_at)],
    with: {
      registro: true,
    },
  })

  // Obtener categorías del usuario para comparar porcentajes
  const cats = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
  })

  if (todas.length === 0) {
    return NextResponse.json({
      analisis: [],
      sugerencias: [],
      total_historico: 0,
    })
  }

  // Agrupar por categoría origen (de dónde suele salir dinero)
  const porOrigen: Record<string, typeof todas> = {}
  for (const d of todas) {
    const cat = d.categoria_origen
    if (!porOrigen[cat]) porOrigen[cat] = []
    porOrigen[cat].push(d)
  }

  // Calcular análisis por categoría
  const analisis: AnalisisCategoria[] = Object.entries(porOrigen).map(([cat, lista]) => {
    const total = lista.reduce((s, d) => s + d.monto, 0)
    const etiquetas: Record<string, number> = {}
    for (const d of lista) {
      const et = d.etiqueta ?? 'sin_etiqueta'
      etiquetas[et] = (etiquetas[et] || 0) + 1
    }

    // Calcular meses consecutivos recientes con desviación
    const mesesConDesviacion = new Set(
      lista.map((d) => {
        const reg = d.registro as { anio: number; mes: number } | null
        return reg ? `${reg.anio}-${reg.mes}` : ''
      }).filter(Boolean)
    )

    return {
      categoria: cat,
      total_desviado: Math.round(total * 100) / 100,
      num_desviaciones: lista.length,
      media_por_desviacion: Math.round((total / lista.length) * 100) / 100,
      etiquetas_frecuentes: etiquetas,
      meses_consecutivos: mesesConDesviacion.size,
      ultima_desviacion: lista[0]?.created_at ?? null,
    }
  })

  // Ordenar por total desviado (las que más se desvían primero)
  analisis.sort((a, b) => b.total_desviado - a.total_desviado)

  // Generar sugerencias inteligentes
  const sugerencias: string[] = []

  for (const a of analisis) {
    const catConfig = cats.find((c) => c.nombre === a.categoria)

    // Sugerencia si lleva 3+ meses desviando de la misma categoría
    if (a.meses_consecutivos >= 3 && catConfig) {
      const porcentajeSugerido = Math.max(
        catConfig.porcentaje - Math.ceil(a.media_por_desviacion / 10),
        1
      )
      sugerencias.push(
        `Llevas ${a.meses_consecutivos} meses desviando de "${a.categoria}" ` +
        `(media: ${a.media_por_desviacion}€/vez). Considera reducir su porcentaje ` +
        `del ${catConfig.porcentaje}% a ~${porcentajeSugerido}%.`
      )
    }

    // Sugerencia si hay muchos imprevistos
    if ((a.etiquetas_frecuentes['imprevisto'] || 0) >= 3) {
      sugerencias.push(
        `Has tenido ${a.etiquetas_frecuentes['imprevisto']} imprevistos en "${a.categoria}". ` +
        `Considera crear un fondo de emergencia o hucha para imprevistos.`
      )
    }

    // Sugerencia si mucho ahorro forzado
    if ((a.etiquetas_frecuentes['ahorro_forzado'] || 0) >= 2) {
      sugerencias.push(
        `Llevas ${a.etiquetas_frecuentes['ahorro_forzado']} veces forzando ahorro desde "${a.categoria}". ` +
        `Quizás deberías subir el % de ahorro y bajar el de "${a.categoria}".`
      )
    }
  }

  return NextResponse.json({
    analisis,
    sugerencias,
    total_historico: Math.round(todas.reduce((s, d) => s + d.monto, 0) * 100) / 100,
    num_total: todas.length,
  })
}
