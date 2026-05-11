import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Megaphone, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { useToast } from '@/hooks/useToast'
import {
  createAd,
  deleteAd,
  getAds,
  getAdsOverview,
  updateAd,
  type AdminAdCampaignItem,
  type AdCampaignCreateRequest,
} from '@/api/admin/ads'

function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [source, setSource] = useState('')
  const [startParam, setStartParam] = useState('')
  const [cost, setCost] = useState('0')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: AdCampaignCreateRequest) => createAd(data),
    onSuccess: () => {
      toast.success(t('admin_ads_created_toast'))
      onCreated()
      onClose()
    },
    onError: (e: Error) => {
      const msg = e.message || t('admin_ads_create_error')
      setError(msg)
      toast.error(msg)
    },
  })

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (!source.trim()) return setError(t('admin_ads_enter_source'))
    if (!/^[A-Za-z0-9_\-]{2,64}$/.test(startParam.trim())) return setError(t('admin_ads_invalid_start_param_form'))
    const costNum = parseFloat(cost.replace(',', '.'))
    if (Number.isNaN(costNum) || costNum < 0) return setError(t('admin_ads_invalid_cost_form'))
    mutation.mutate({ source: source.trim(), start_param: startParam.trim(), cost: costNum })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-bold mb-4">{t('admin_ads_create_title')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium">{t('admin_ads_source_label')}</label>
            <input
              type="text" value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="VK, TG-channel, AEZA"
              className="mt-1 w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('admin_ads_start_param_label')}</label>
            <input
              type="text" value={startParam} onChange={(e) => setStartParam(e.target.value)}
              placeholder="vk2024"
              className="mt-1 w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-mono"
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {t('admin_ads_start_param_hint')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">{t('admin_ads_cost_label')}</label>
            <input
              type="text" value={cost} onChange={(e) => setCost(e.target.value)}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))]">
              {t('admin_cancel')}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 h-9 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {mutation.isPending ? t('admin_creating') : t('admin_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ item, onClose, onDeleted }: {
  item: AdminAdCampaignItem; onClose: () => void; onDeleted: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: () => deleteAd(item.ad_campaign_id),
    onSuccess: () => {
      toast.success(t('admin_ads_deleted_toast'))
      onDeleted()
      onClose()
    },
    onError: () => toast.error(t('admin_ads_delete_error')),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-lg font-bold mb-2">{t('admin_ads_delete_confirm_title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          {t('admin_ads_delete_confirm_text', { source: item.source, start_param: item.start_param })}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))]">
            {t('admin_cancel')}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 h-9 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
            {mutation.isPending ? t('admin_deleting') : t('admin_delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminAdsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminAdCampaignItem | null>(null)
  const [copiedCampaignId, setCopiedCampaignId] = useState<number | null>(null)

  const { data: overview } = useQuery({
    queryKey: ['admin', 'ads', 'overview'],
    queryFn: getAdsOverview,
    staleTime: 30_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ads', page, pageSize],
    queryFn: () => getAds(page, pageSize),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => updateAd(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ads'] })
      toast.success(t('admin_ads_status_updated'))
    },
    onError: () => toast.error(t('admin_ads_status_error')),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'ads'] })
  }

  async function copyAdLink(item: AdminAdCampaignItem) {
    const text = item.telegram_link ?? item.start_param
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedCampaignId(item.ad_campaign_id)
    toast.success(t('copied'))
    window.setTimeout(() => setCopiedCampaignId(null), 2000)
  }

  const roi = overview && overview.total_cost > 0
    ? ((overview.total_revenue - overview.total_cost) / overview.total_cost) * 100
    : null

  const columns: Column<AdminAdCampaignItem>[] = [
    { key: 'source', header: t('admin_ads_source_label'), size: 140, render: (r) => <span className="font-medium">{r.source}</span> },
    {
      key: 'start_param',
      header: t('admin_ads_start_param_label'),
      size: 250,
      minSize: 190,
      render: (r) => {
        const display = r.telegram_link ?? `start=${r.start_param}`
        const copied = copiedCampaignId === r.ad_campaign_id
        return (
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 truncate text-xs" title={display}>{display}</code>
            <button
              type="button"
              onClick={() => copyAdLink(r)}
              className="shrink-0 rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              title={t('admin_ads_copy_link')}
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
        )
      },
    },
    { key: 'cost', header: t('admin_ads_cost_label'), size: 100, render: (r) => `${fmtMoney(r.cost)} ₽` },
    { key: 'starts', header: t('admin_ads_starts'), size: 80, render: (r) => r.stats.starts },
    { key: 'trials', header: t('admin_ads_trials'), size: 80, render: (r) => r.stats.trials },
    { key: 'payers', header: t('admin_ads_payers'), size: 80, render: (r) => r.stats.payers },
    { key: 'revenue', header: t('admin_ads_revenue'), size: 110, render: (r) => `${fmtMoney(r.stats.revenue)} ₽` },
    {
      key: 'roi', header: 'ROI', size: 80,
      render: (r) => {
        if (!r.cost) return '—'
        const v = ((r.stats.revenue - r.cost) / r.cost) * 100
        const cls = v >= 0 ? 'text-green-600' : 'text-red-600'
        return <span className={cls}>{v >= 0 ? '+' : ''}{v.toFixed(0)}%</span>
      },
    },
    {
      key: 'status', header: t('admin_status'), size: 90,
      render: (r) => (
        <button
          onClick={() => toggleMutation.mutate({ id: r.ad_campaign_id, is_active: !r.is_active })}
          disabled={toggleMutation.isPending}
          role="switch" aria-checked={r.is_active}
          className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.is_active ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      ),
    },
    {
      key: 'actions', header: '', size: 60,
      render: (r) => (
        <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title={t('admin_delete')}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="px-4 py-6 sm:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{t('admin_ads_title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">{t('admin_ads_subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-medium text-white hover:opacity-90">
          <Plus size={16} />
          {t('admin_ads_create_short')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_ads_total_revenue')}</div>
          <div className="text-xl font-bold mt-1 text-green-600">{fmtMoney(overview?.total_revenue ?? 0)} ₽</div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_ads_total_cost')}</div>
          <div className="text-xl font-bold mt-1 text-red-600">{fmtMoney(overview?.total_cost ?? 0)} ₽</div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">ROI</div>
          <div className={`text-xl font-bold mt-1 ${roi === null ? '' : roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {roi === null ? '—' : `${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%`}
          </div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin_ads_active_campaigns')}</div>
          <div className="text-xl font-bold mt-1">{overview?.active_campaigns ?? 0} / {overview?.total_campaigns ?? 0}</div>
        </div>
      </div>

      {data?.total === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Megaphone size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('admin_ads_empty')}</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-3 text-[hsl(var(--primary))] text-sm font-medium hover:underline">
            {t('admin_ads_create_first')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0) }}
          isLoading={isLoading}
          emptyMessage={t('admin_ads_empty')}
          keyExtractor={(r) => r.ad_campaign_id}
        />
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={invalidate} />}
      {deleteTarget && <DeleteConfirm item={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={invalidate} />}
    </div>
  )
}
