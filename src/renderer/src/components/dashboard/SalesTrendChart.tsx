import { useEffect, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { formatRands } from '@shared/money'
import type { DailySalesPoint } from '@shared/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const ACCENT = '#c9962c'
const ACCENT_TINT = 'rgba(201, 150, 44, 0.14)'
const INK_MUTED = '#a69b87'
const BORDER = '#2a251d'

function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'line'>) => formatRands(Math.round((ctx.parsed.y ?? 0) * 100))
      }
    }
  },
  scales: {
    x: { ticks: { color: INK_MUTED }, grid: { color: BORDER } },
    y: { ticks: { color: INK_MUTED }, grid: { color: BORDER }, beginAtZero: true }
  }
}

export function SalesTrendChart(): React.JSX.Element {
  const [points, setPoints] = useState<DailySalesPoint[] | null>(null)

  useEffect(() => {
    void window.api.dashboard.salesTrend().then(setPoints)
  }, [])

  if (!points) {
    return <p className="text-sm text-ink-muted">Loading…</p>
  }

  const data = {
    labels: points.map((p) => formatDayLabel(p.date)),
    datasets: [
      {
        data: points.map((p) => p.totalCents / 100),
        borderColor: ACCENT,
        backgroundColor: ACCENT_TINT,
        pointBackgroundColor: ACCENT,
        pointRadius: 3,
        fill: true,
        tension: 0.3
      }
    ]
  }

  return (
    <div style={{ height: 220 }}>
      <Line data={data} options={options} />
    </div>
  )
}
