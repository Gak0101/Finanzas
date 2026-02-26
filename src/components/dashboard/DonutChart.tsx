'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Segmento {
  nombre: string
  porcentaje: number
  monto: number
  color: string
  icono: string
}

interface Props {
  segmentos: Segmento[]
  ingreso: number
}

function formatEuro(val: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)
}

// Label con % dentro de cada sector
const CustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}) => {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// Tooltip personalizado
const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { porcentaje: number } }>
}) => {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{item.name}</p>
      <p className="text-base font-bold">{formatEuro(item.value)}</p>
      <p className="text-muted-foreground">{item.payload.porcentaje}% del ingreso</p>
    </div>
  )
}

export function DonutChart({ segmentos, ingreso }: Props) {
  if (segmentos.length === 0) return null

  const totalPct = segmentos.reduce((sum, s) => sum + s.porcentaje, 0)
  const ok = Math.abs(totalPct - 100) < 0.1

  const data = segmentos.map((s) => ({
    name: `${s.icono} ${s.nombre}`,
    value: s.monto,
    color: s.color,
    porcentaje: s.porcentaje,
  }))

  return (
    <div className="w-full">
      {/* Contenedor relativo para superponer el texto central */}
      <div className="relative" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={CustomLabel as any}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value, entry: any) => (
                <span className="text-sm">
                  {value}{' '}
                  <span className="text-muted-foreground">
                    ({entry.payload.porcentaje}%)
                  </span>
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Texto central superpuesto con CSS — evita el bug de NaN de Recharts */}
        {/* El donut ocupa ~los primeros 260px de alto (antes de la leyenda), centrado horizontalmente */}
        <div
          className="absolute inset-x-0 pointer-events-none flex flex-col items-center justify-center gap-1"
          style={{ top: 0, height: 260 }}
        >
          <span className="text-base font-bold text-foreground leading-none">
            {formatEuro(ingreso)}
          </span>
          <span
            className="text-xs font-medium leading-none"
            style={{ color: ok ? '#22c55e' : '#f59e0b' }}
          >
            {ok ? '✓ 100%' : `${totalPct.toFixed(1)}% / 100%`}
          </span>
        </div>
      </div>
    </div>
  )
}
