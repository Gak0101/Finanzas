'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
  if (percent < 0.05) return null
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
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function DonutChart({ segmentos, ingreso }: Props) {
  if (segmentos.length === 0) return null

  const data = segmentos.map((s) => ({
    name: `${s.icono} ${s.nombre}`,
    value: s.monto,
    color: s.color,
    porcentaje: s.porcentaje,
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
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
          <Tooltip
            formatter={(value) => [formatEuro(Number(value)), '']}
            labelFormatter={(label) => label}
          />
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
    </div>
  )
}
