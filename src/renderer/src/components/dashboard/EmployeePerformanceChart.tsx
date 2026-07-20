import { useEffect, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type TooltipItem
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatRands } from '@shared/money'
import type { EmployeePerformancePoint } from '@shared/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const ACCENT = '#c9962c'
const INK_MUTED = '#a69b87'
const BORDER = '#2a251d'
const BAR_HEIGHT_PX = 40
const MIN_CHART_HEIGHT_PX = 120

export function EmployeePerformanceChart(): React.JSX.Element {
  const [points, setPoints] = useState<EmployeePerformancePoint[] | null>(null)

  useEffect(() => {
    void window.api.dashboard.employeePerformance().then(setPoints)
  }, [])

  if (!points) {
    return <p className="text-sm text-ink-muted">Loading…</p>
  }

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No active employees</p>
  }

  const data = {
    labels: points.map((p) => p.employeeName),
    datasets: [
      {
        data: points.map((p) => p.totalCents / 100),
        backgroundColor: ACCENT,
        borderRadius: 4
      }
    ]
  }

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const point = points[ctx.dataIndex]
            const suffix = point.salesCount === 1 ? 'sale' : 'sales'
            return `${formatRands(point.totalCents)} · ${point.salesCount} ${suffix}`
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: INK_MUTED, callback: (value) => formatRands(Math.round(Number(value) * 100)) },
        grid: { color: BORDER }
      },
      y: {
        ticks: { color: INK_MUTED },
        grid: { display: false }
      }
    }
  }

  const height = Math.max(MIN_CHART_HEIGHT_PX, points.length * BAR_HEIGHT_PX)

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  )
}
