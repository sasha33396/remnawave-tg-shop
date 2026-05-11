#!/usr/bin/env python3
"""
Deploy admin Ads + Analytics (Insights) features on top of fresh upstream/main.
Funnel page is intentionally NOT included.

Pre-conditions:
  - You are on a new branch checked out from main (e.g., feat/admin-analytics-ads)
  - Backup branch backup-ads-funnel exists locally and contains the source files.

Run from /opt/remnawave-tg-shop:
    python3 deploy_ads_analytics.py

Idempotent: re-running won't double-insert.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKUP = "backup-ads-funnel"


def git_checkout_file(file_path: str) -> None:
    """Copy a file from BACKUP branch into the current branch's working tree."""
    res = subprocess.run(
        ["git", "checkout", BACKUP, "--", file_path],
        cwd=ROOT, capture_output=True, text=True,
    )
    if res.returncode != 0:
        print(f"❌ Failed to git-checkout {file_path}: {res.stderr.strip()}")
        sys.exit(1)
    print(f"   ✅ {file_path}")


def insert_after(path: Path, anchor: str, new_line: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new_line.rstrip() in text:
        return  # already there
    lines = text.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if anchor in ln:
            lines.insert(i + 1, new_line)
            path.write_text("".join(lines), encoding="utf-8")
            return
    raise SystemExit(f"Anchor not found in {path}: {anchor!r}")


# ─── Step 1: Pull 8 new files from backup branch ─────────────────────────────
print("\n[1/2] Copying ads + insights files from backup-ads-funnel:")
NEW_FILES = [
    # Ads
    "web/routers/admin/ads.py",
    "web/schemas/admin/ads.py",
    "frontend/src/api/admin/ads.ts",
    "frontend/src/pages/admin/AdminAdsPage.tsx",
    # Insights
    "web/routers/admin/insights.py",
    "web/schemas/admin/insights.py",
    "frontend/src/api/admin/insights.ts",
    "frontend/src/pages/admin/AdminInsightsPage.tsx",
]
for f in NEW_FILES:
    git_checkout_file(f)


# ─── Step 2: Edit shared files ────────────────────────────────────────────────
print("\n[2/2] Editing shared files:")

# 2.1 web/routers/admin/__init__.py — add ads + insights imports & includes
init_py = ROOT / "web/routers/admin/__init__.py"
insert_after(
    init_py,
    "from .panel_users import router as panel_users_router",
    "from .ads import router as ads_router\nfrom .insights import router as insights_router\n",
)
insert_after(
    init_py,
    "admin_router.include_router(panel_users_router)",
    "admin_router.include_router(ads_router)\nadmin_router.include_router(insights_router)\n",
)
print(f"   ✅ {init_py.relative_to(ROOT)}")

# 2.2 frontend/src/App.tsx — add lazy imports and routes
app_tsx = ROOT / "frontend/src/App.tsx"
insert_after(
    app_tsx,
    "const AdminPromosPage = lazy",
    "const AdminAdsPage = lazy(() => import('@/pages/admin/AdminAdsPage').then(({ AdminAdsPage }) => ({ default: AdminAdsPage })))\n"
    "const AdminInsightsPage = lazy(() => import('@/pages/admin/AdminInsightsPage').then(({ AdminInsightsPage }) => ({ default: AdminInsightsPage })))\n",
)
insert_after(
    app_tsx,
    '<Route path="promos" element=',
    '              <Route path="ads" element={<ErrorBoundary><AdminAdsPage /></ErrorBoundary>} />\n'
    '              <Route path="insights" element={<ErrorBoundary><AdminInsightsPage /></ErrorBoundary>} />\n',
)
print(f"   ✅ {app_tsx.relative_to(ROOT)}")

# 2.3 frontend/src/components/admin/AdminSidebar.tsx — icons and nav items
sidebar_tsx = ROOT / "frontend/src/components/admin/AdminSidebar.tsx"
# Add icons
sidebar_text = sidebar_tsx.read_text(encoding="utf-8")
if "Target," not in sidebar_text:
    sidebar_text = sidebar_text.replace(
        "  Megaphone,\n",
        "  Megaphone,\n  Target,\n  BarChart3,\n",
        1,
    )
    sidebar_tsx.write_text(sidebar_text, encoding="utf-8")
# Add nav items after promos
insert_after(
    sidebar_tsx,
    "{ to: '/admin/promos'",
    "  { to: '/admin/ads', icon: Target, labelKey: 'admin_nav_ads' },\n"
    "  { to: '/admin/insights', icon: BarChart3, labelKey: 'admin_nav_insights' },\n",
)
print(f"   ✅ {sidebar_tsx.relative_to(ROOT)}")

# 2.4 frontend/src/i18n.ts — add strings (RU + EN nav + full insights/ads blocks)
i18n_ts = ROOT / "frontend/src/i18n.ts"
text = i18n_ts.read_text(encoding="utf-8")

# Nav items
if "admin_nav_ads" not in text:
    text = text.replace(
        "  admin_nav_promos: 'Промокоды',\n",
        "  admin_nav_promos: 'Промокоды',\n  admin_nav_ads: 'Реклама',\n  admin_nav_insights: 'Аналитика',\n",
        1,
    )
    text = text.replace(
        "  admin_nav_promos: 'Promo Codes',\n",
        "  admin_nav_promos: 'Promo Codes',\n  admin_nav_ads: 'Ads',\n  admin_nav_insights: 'Analytics',\n",
        1,
    )

ADS_RU = """  // Admin panel — ads
  admin_ads_title: 'Рекламные кампании',
  admin_ads_subtitle: 'Учёт затрат на рекламу и доходов по источникам',
  admin_ads_create_title: 'Новая кампания',
  admin_ads_create_short: 'Создать',
  admin_ads_create_error: 'Ошибка при создании кампании',
  admin_ads_created_toast: 'Кампания создана',
  admin_ads_deleted_toast: 'Кампания удалена',
  admin_ads_delete_error: 'Ошибка при удалении',
  admin_ads_status_updated: 'Статус обновлён',
  admin_ads_status_error: 'Ошибка при изменении статуса',
  admin_ads_empty: 'Кампаний пока нет',
  admin_ads_create_first: 'Создать первую',
  admin_ads_source_label: 'Источник',
  admin_ads_start_param_label: 'Параметр start',
  admin_ads_start_param_hint: 'Будет в ссылке t.me/bot?start=<значение>. Только буквы, цифры, _ и -.',
  admin_ads_cost_label: 'Стоимость (₽)',
  admin_ads_starts: 'Запуски',
  admin_ads_trials: 'Триалы',
  admin_ads_payers: 'Оплатили',
  admin_ads_revenue: 'Доход',
  admin_ads_total_revenue: 'Доход всего',
  admin_ads_total_cost: 'Расход всего',
  admin_ads_active_campaigns: 'Активные / всего',
  admin_ads_delete_confirm_title: 'Удалить кампанию?',
  admin_ads_delete_confirm_text: 'Кампания {{source}} (start={{start_param}}) и её статистика будут удалены безвозвратно.',
  admin_ads_enter_source: 'Введите источник',
  admin_ads_invalid_start_param_form: 'Параметр: 2–64 символа, латиница/цифры/_/-',
  admin_ads_invalid_cost_form: 'Стоимость — неотрицательное число',

"""

INSIGHTS_RU = """  // Admin panel — insights
  admin_insights_title: 'Аналитика',
  admin_insights_subtitle: 'Ключевые метрики по пользователям, подпискам и доходам',
  admin_insights_overview_title: 'Общая статистика',
  admin_insights_period_7d: '7 дней',
  admin_insights_period_30d: '30 дней',
  admin_insights_period_90d: '90 дней',
  admin_insights_period_year: 'Год',
  admin_insights_total_users: 'Всего зашло',
  admin_insights_subscribed: 'Взяли подписку',
  admin_insights_paid_users: 'Купили хотя бы раз',
  admin_insights_active_users: 'Активных юзеров',
  admin_insights_trial_users: 'Триал хотя бы раз',
  admin_insights_no_purchase: 'Без покупки',
  admin_insights_conversion: 'Конверсия в оплату',
  admin_insights_paying_share: 'Доля платящих',
  admin_insights_revenue: 'Выручка',
  admin_insights_payments_count: 'Кол-во оплат',
  admin_insights_avg_check: 'Средний чек',
  admin_insights_users_chart: 'Новые пользователи и подписки по дням',
  admin_insights_revenue_chart: 'Выручка и кол-во оплат по дням',
  admin_insights_chart_users: 'Зашли',
  admin_insights_chart_subs: 'Подписок',
  admin_insights_chart_revenue: 'Выручка',
  admin_insights_chart_payments: 'Оплат',
  admin_funnel_loading: 'Загрузка...',
  admin_funnel_empty: 'Нет данных за выбранный период',

"""

ADS_EN = """  // Admin panel — ads
  admin_ads_title: 'Ad Campaigns',
  admin_ads_subtitle: 'Track ad spend and revenue by source',
  admin_ads_create_title: 'New Campaign',
  admin_ads_create_short: 'Create',
  admin_ads_create_error: 'Failed to create campaign',
  admin_ads_created_toast: 'Campaign created',
  admin_ads_deleted_toast: 'Campaign deleted',
  admin_ads_delete_error: 'Failed to delete',
  admin_ads_status_updated: 'Status updated',
  admin_ads_status_error: 'Failed to change status',
  admin_ads_empty: 'No campaigns yet',
  admin_ads_create_first: 'Create the first one',
  admin_ads_source_label: 'Source',
  admin_ads_start_param_label: 'Start parameter',
  admin_ads_start_param_hint: 'Will be in the link t.me/bot?start=<value>. Letters, digits, _ and - only.',
  admin_ads_cost_label: 'Cost (RUB)',
  admin_ads_starts: 'Starts',
  admin_ads_trials: 'Trials',
  admin_ads_payers: 'Payers',
  admin_ads_revenue: 'Revenue',
  admin_ads_total_revenue: 'Total revenue',
  admin_ads_total_cost: 'Total cost',
  admin_ads_active_campaigns: 'Active / total',
  admin_ads_delete_confirm_title: 'Delete campaign?',
  admin_ads_delete_confirm_text: 'Campaign {{source}} (start={{start_param}}) and its stats will be deleted permanently.',
  admin_ads_enter_source: 'Enter source',
  admin_ads_invalid_start_param_form: 'Parameter: 2–64 chars, latin/digits/_/-',
  admin_ads_invalid_cost_form: 'Cost must be a non-negative number',

"""

INSIGHTS_EN = """  // Admin panel — insights
  admin_insights_title: 'Analytics',
  admin_insights_subtitle: 'Key metrics on users, subscriptions and revenue',
  admin_insights_overview_title: 'Overview',
  admin_insights_period_7d: '7 days',
  admin_insights_period_30d: '30 days',
  admin_insights_period_90d: '90 days',
  admin_insights_period_year: 'Year',
  admin_insights_total_users: 'Total entered',
  admin_insights_subscribed: 'Got a subscription',
  admin_insights_paid_users: 'Paid at least once',
  admin_insights_active_users: 'Active users',
  admin_insights_trial_users: 'Trial users',
  admin_insights_no_purchase: 'Without purchase',
  admin_insights_conversion: 'Conversion to paid',
  admin_insights_paying_share: 'Paying share',
  admin_insights_revenue: 'Revenue',
  admin_insights_payments_count: 'Payments count',
  admin_insights_avg_check: 'Average check',
  admin_insights_users_chart: 'New users and subscriptions by day',
  admin_insights_revenue_chart: 'Revenue and payment count by day',
  admin_insights_chart_users: 'Users',
  admin_insights_chart_subs: 'Subscriptions',
  admin_insights_chart_revenue: 'Revenue',
  admin_insights_chart_payments: 'Payments',
  admin_funnel_loading: 'Loading...',
  admin_funnel_empty: 'No data for selected period',

"""

# Insert ads + insights blocks before the existing "// Admin panel — promos" sections (one for RU, one for EN)
if "admin_ads_title: 'Рекламные" not in text:
    text = text.replace(
        "  // Admin panel — promos\n  admin_promos_title: 'Промокоды',",
        ADS_RU + INSIGHTS_RU + "  // Admin panel — promos\n  admin_promos_title: 'Промокоды',",
        1,
    )

if "admin_ads_title: 'Ad Campaigns'" not in text:
    text = text.replace(
        "  // Admin panel — promos\n  admin_promos_title: 'Promo Codes',",
        ADS_EN + INSIGHTS_EN + "  // Admin panel — promos\n  admin_promos_title: 'Promo Codes',",
        1,
    )

i18n_ts.write_text(text, encoding="utf-8")
print(f"   ✅ {i18n_ts.relative_to(ROOT)}")

print("\n✅ All done. Verify with: git status && git diff --stat")
