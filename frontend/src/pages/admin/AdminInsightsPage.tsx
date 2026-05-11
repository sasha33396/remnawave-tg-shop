import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { getInsightsOverview, getInsightsTimeseries } from '@/api/admin/insights'

const PERIODS: { value: number; key: string }[] = [
  { value: 7, key: 'admin_insights_period_7d' },
  { value: 30, key: 'admin_insights_period_30d' },
  { value: 90, key: 'admin_insights_period_90d' },
  { value: 365, key: 'admin_insights_period_year' },
]

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits })
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'blue' }) {
  const cls = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-600' : accent === 'blue' ? 'text-blue-600' : ''
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className={`text-xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  )
}

export function AdminInsightsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(90)

  const { data: overview } = useQuery({
    queryKey: ['admin', 'insights', 'overview'],
    queryFn: getInsightsOverview,
    staleTime: 30_000,
  })

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ['admin', 'insights', 'timeseries', days],
    queryFn: () => getInsightsTimeseries(days),
    staleTime: 30_000,
  })

  const chartData = (series?.points ?? []).map((p) => ({
    date: p.date,
    new_users: p.new_users,
    new_subs: p.new_subscriptions,
    revenue: p.revenue,
    payments: p.payments_count,
  }))

  return (
    <div className="px-4 py-6 sm:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin_insights_title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            {t('admin_insights_subtitle')}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {PERIODS.map((p) => (
            <button
              key={p.value} onClick={() => setDays(p.value)}
              className={`px-3 h-8 rounded-md text-sm font-medium transition-colors ${
                days === p.value
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {t(p.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase text-[hsl(var(--muted-foreground))] mb-3">
          {t('admin_insights_overview_title')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label={t('admin_insights_total_users')} value={fmt(overview?.total_users ?? 0)} />
          <StatCard label={t('admin_insights_subscribed')} value={fmt(overview?.users_with_subscription ?? 0)} accent="blue" />
          <StatCard label={t('admin_insights_paid_users')} value={fmt(overview?.paid_users ?? 0)} accent="green" />
          <StatCard label={t('admin_insights_active_users')} value={fmt(overview?.active_users ?? 0)} accent="blue" />
          <StatCard label={t('admin_insights_trial_users')} value={fmt(overview?.trial_users ?? 0)} />
          <StatCard label={t('admin_insights_no_purchase')} value={fmt(overview?.no_purchase_users ?? 0)} accent="red" />
          <StatCard label={t('admin_insights_conversion')} value={`${overview?.conversion_to_paid_pct ?? 0}%`} />
          <StatCard label={t('admin_insights_paying_share')} value={`${overview?.paying_share_pct ?? 0}%`} />
          <StatCard label={t('admin_insights_revenue')} value={`${fmt(overview?.total_revenue ?? 0, 2)} ₽`} accent="green" />
          <StatCard label={t('admin_insights_payments_count')} value={fmt(overview?.total_payments ?? 0)} />
          <StatCard label={t('admin_insights_avg_check')} value={`${fmt(overview?.avg_check ?? 0, 2)} ₽`} />
        </div>
      </div>

      {/* New users chart */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">{t('admin_insights_users_chart')}</h2>
        {seriesLoading ? (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('admin_funnel_loading')}</div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[hsl(var(--muted-foreground))]">
            <BarChart3 size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('admin_funnel_empty')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="new_users" name={t('admin_insights_chart_users')} stroke="#f59e0b" fillOpacity={1} fill="url(#gradUsers)" />
              <Area type="monotone" dataKey="new_subs" name={t('admin_insights_chart_subs')} stroke="#10b981" fillOpacity={1} fill="url(#gradSubs)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">{t('admin_insights_revenue_chart')}</h2>
        {seriesLoading ? (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('admin_funnel_loading')}</div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[hsl(var(--muted-foreground))]">
            <BarChart3 size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('admin_funnel_empty')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" name={t('admin_insights_chart_revenue')} stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="payments" name={t('admin_insights_chart_payments')} stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
