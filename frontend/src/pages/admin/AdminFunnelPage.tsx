import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { TrendingDown } from 'lucide-react'
import { getFunnel, getFunnelBySource } from '@/api/admin/funnel'

const STAGE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

type ChartType = 'funnel' | 'bars'

interface FunnelDatum {
  name: string
  value: number
  pct: number
  fill: string
}

function HorizontalFunnel({ data }: { data: FunnelDatum[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value), 1)
  const w = 1000
  const totalH = 320
  const nameH = 40           // top zone for stage name
  const labelH = 60          // bottom zone for value + pct
  const funnelH = totalH - nameH - labelH
  const segW = w / data.length
  const padding = 4
  const cy = nameH + funnelH / 2
  // sqrt scaling makes small values still visible
  const scaledHeight = (v: number) =>
    Math.max(20, Math.sqrt(Math.max(0, v) / max) * funnelH)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${totalH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', display: 'block' }}
      >
        {data.map((d, i) => {
          const next = data[i + 1]
          const valNext = next ? next.value : d.value
          const hL = scaledHeight(d.value)
          const hR = scaledHeight(valNext)
          const x = i * segW
          const yLT = cy - hL / 2
          const yLB = cy + hL / 2
          const yRT = cy - hR / 2
          const yRB = cy + hR / 2
          const path = `M ${x} ${yLT} L ${x + segW - padding} ${yRT} L ${x + segW - padding} ${yRB} L ${x} ${yLB} Z`
          const cx = x + (segW - padding) / 2
          const labelTop = cy + funnelH / 2 + 22
          return (
            <g key={i}>
              <path d={path} fill={d.fill} />
              <text
                x={cx} y={nameH - 12} textAnchor="middle"
                fontSize={14} fontWeight={500} fill="#111"
              >
                {d.name}
              </text>
              <text
                x={cx} y={labelTop} textAnchor="middle"
                fontSize={18} fontWeight={700} fill="#111"
              >
                {d.value.toLocaleString('ru-RU')}
              </text>
              <text
                x={cx} y={labelTop + 22} textAnchor="middle"
                fontSize={13} fontWeight={500} fill="#666"
              >
                {d.pct.toFixed(1)}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export function AdminFunnelPage() {
  const { t } = useTranslation()
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [chartType, setChartType] = useState<ChartType>('funnel')

  const { data: funnel, isLoading } = useQuery({
    queryKey: ['admin', 'funnel', periodFrom, periodTo],
    queryFn: () => getFunnel(periodFrom || undefined, periodTo || undefined),
    staleTime: 30_000,
  })

  const { data: bySource } = useQuery({
    queryKey: ['admin', 'funnel', 'by-source'],
    queryFn: getFunnelBySource,
    staleTime: 30_000,
  })

  const chartData = (funnel?.stages ?? []).map((s, i) => ({
    name: s.label,
    value: s.count,
    count: s.count,
    pct: s.pct_from_top,
    pctPrev: s.pct_from_prev,
    fill: STAGE_COLORS[i % STAGE_COLORS.length],
    color: STAGE_COLORS[i % STAGE_COLORS.length],
  }))
  // Funnel chart needs monotonically decreasing values to look right; sort by count desc
  // (legend below keeps the original sequential order).
  const funnelChartData = [...chartData].sort((a, b) => b.value - a.value)

  return (
    <div className="px-4 py-6 sm:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin_funnel_title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            {t('admin_funnel_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_from')}</label>
            <input
              type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}
              className="block h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_to')}</label>
            <input
              type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}
              className="block h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          {(periodFrom || periodTo) && (
            <button
              type="button" onClick={() => { setPeriodFrom(''); setPeriodTo('') }}
              className="h-9 px-3 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))]"
            >
              {t('admin_funnel_reset')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_total_users')}</div>
          <div className="text-xl font-bold mt-1">{funnel?.total_users ?? 0}</div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_total_revenue')}</div>
          <div className="text-xl font-bold mt-1 text-green-600">{fmtMoney(funnel?.total_revenue ?? 0)} ₽</div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_arpu')}</div>
          <div className="text-xl font-bold mt-1">
            {funnel && funnel.total_users > 0 ? `${fmtMoney(funnel.total_revenue / funnel.total_users)} ₽` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_funnel_conversion')}</div>
          <div className="text-xl font-bold mt-1">
            {(() => {
              const reg = funnel?.stages.find((s) => s.key === 'registered')?.count ?? 0
              const paid = funnel?.stages.find((s) => s.key === 'first_payment')?.count ?? 0
              if (reg === 0) return '—'
              return `${((paid / reg) * 100).toFixed(1)}%`
            })()}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">{t('admin_funnel_chart_title')}</h2>
          <div className="flex gap-1 p-1 rounded-lg border border-[hsl(var(--border))]">
            <button
              onClick={() => setChartType('funnel')}
              className={`px-3 h-7 rounded text-xs font-medium transition-colors ${
                chartType === 'funnel'
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {t('admin_funnel_chart_type_funnel')}
            </button>
            <button
              onClick={() => setChartType('bars')}
              className={`px-3 h-7 rounded text-xs font-medium transition-colors ${
                chartType === 'bars'
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {t('admin_funnel_chart_type_bars')}
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('admin_funnel_loading')}</div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[hsl(var(--muted-foreground))]">
            <TrendingDown size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('admin_funnel_empty')}</p>
          </div>
        ) : chartType === 'funnel' ? (
          <HorizontalFunnel data={funnelChartData} />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="mt-4 space-y-2">
          {funnel?.stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <div className="w-3 h-3 rounded" style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
              <span className="flex-1">{s.label}</span>
              <span className="font-bold">{s.count}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 text-right">
                {s.pct_from_top.toFixed(1)}% {t('admin_funnel_from_top')}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 text-right">
                {i > 0 ? `${s.pct_from_prev.toFixed(1)}% ${t('admin_funnel_from_prev')}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {bySource && bySource.items.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">{t('admin_funnel_by_source')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[hsl(var(--muted-foreground))] text-xs uppercase">
                  <th className="py-2 px-2">{t('admin_ads_source_label')}</th>
                  <th className="py-2 px-2 text-right">{t('admin_ads_starts')}</th>
                  <th className="py-2 px-2 text-right">{t('admin_ads_trials')}</th>
                  <th className="py-2 px-2 text-right">{t('admin_ads_payers')}</th>
                  <th className="py-2 px-2 text-right">{t('admin_ads_revenue')}</th>
                  <th className="py-2 px-2 text-right">CR</th>
                </tr>
              </thead>
              <tbody>
                {bySource.items.map((s) => {
                  const cr = s.starts > 0 ? ((s.payers / s.starts) * 100).toFixed(1) : '—'
                  return (
                    <tr key={s.source} className="border-t border-[hsl(var(--border))]">
                      <td className="py-2 px-2 font-medium">{s.source}</td>
                      <td className="py-2 px-2 text-right">{s.starts}</td>
                      <td className="py-2 px-2 text-right">{s.trials}</td>
                      <td className="py-2 px-2 text-right">{s.payers}</td>
                      <td className="py-2 px-2 text-right">{fmtMoney(s.revenue)} ₽</td>
                      <td className="py-2 px-2 text-right">{cr}{cr !== '—' && '%'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
