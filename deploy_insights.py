#!/usr/bin/env python3
"""
One-shot deploy of /admin/insights feature on top of admin-ads-funnel state.

Idempotent: re-running won't double-insert.
Run from /opt/remnawave-tg-shop:
    python3 deploy_insights.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def insert_after(path: Path, anchor: str, new_line: str) -> bool:
    """Insert new_line after the first occurrence of anchor line. Returns True if inserted."""
    text = path.read_text(encoding="utf-8")
    if new_line.rstrip() in text:
        return False  # already there
    lines = text.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if anchor in ln:
            indent = len(ln) - len(ln.lstrip(" \t"))
            lines.insert(i + 1, " " * 0 + new_line if new_line.startswith(" ") else new_line)
            path.write_text("".join(lines), encoding="utf-8")
            return True
    raise SystemExit(f"Anchor not found in {path}: {anchor!r}")


def insert_before(path: Path, anchor: str, block: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if block.strip().splitlines()[0] in text:
        return False
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit(f"Anchor not found in {path}: {anchor!r}")
    new_text = text[:idx] + block + text[idx:]
    path.write_text(new_text, encoding="utf-8")
    return True


# ============================================================================
# 1. Modify web/routers/admin/__init__.py
# ============================================================================
init_py = ROOT / "web/routers/admin/__init__.py"
insert_after(
    init_py,
    "from .funnel import router as funnel_router",
    "from .insights import router as insights_router\n",
)
insert_after(
    init_py,
    "admin_router.include_router(funnel_router)",
    "admin_router.include_router(insights_router)\n",
)

# ============================================================================
# 2. Modify frontend/src/App.tsx
# ============================================================================
app_tsx = ROOT / "frontend/src/App.tsx"
insert_after(
    app_tsx,
    "const AdminFunnelPage = lazy",
    "const AdminInsightsPage = lazy(() => import('@/pages/admin/AdminInsightsPage').then(({ AdminInsightsPage }) => ({ default: AdminInsightsPage })))\n",
)
insert_after(
    app_tsx,
    '<Route path="funnel" element=',
    '              <Route path="insights" element={<ErrorBoundary><AdminInsightsPage /></ErrorBoundary>} />\n',
)

# ============================================================================
# 3. Modify frontend/src/components/admin/AdminSidebar.tsx
# ============================================================================
sidebar_tsx = ROOT / "frontend/src/components/admin/AdminSidebar.tsx"
insert_after(sidebar_tsx, "  Target,", "  BarChart3,\n")
insert_after(
    sidebar_tsx,
    "{ to: '/admin/funnel'",
    "  { to: '/admin/insights', icon: BarChart3, labelKey: 'admin_nav_insights' },\n",
)

# ============================================================================
# 4. Modify frontend/src/i18n.ts — add insights strings (RU then EN)
# ============================================================================
i18n_ts = ROOT / "frontend/src/i18n.ts"
text = i18n_ts.read_text(encoding="utf-8")

if "admin_nav_insights" not in text:
    # RU nav item
    text = text.replace(
        "  admin_nav_funnel: 'Воронка',\n",
        "  admin_nav_funnel: 'Воронка',\n  admin_nav_insights: 'Аналитика',\n",
        1,
    )
    # EN nav item
    text = text.replace(
        "  admin_nav_funnel: 'Funnel',\n",
        "  admin_nav_funnel: 'Funnel',\n  admin_nav_insights: 'Analytics',\n",
        1,
    )

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

"""

if "admin_insights_title: 'Аналитика'" not in text:
    text = text.replace(
        "  // Admin panel — funnel\n  admin_funnel_title: 'Воронка продаж',",
        INSIGHTS_RU + "  // Admin panel — funnel\n  admin_funnel_title: 'Воронка продаж',",
        1,
    )

if "admin_insights_title: 'Analytics'" not in text:
    text = text.replace(
        "  // Admin panel — funnel\n  admin_funnel_title: 'Sales Funnel',",
        INSIGHTS_EN + "  // Admin panel — funnel\n  admin_funnel_title: 'Sales Funnel',",
        1,
    )

i18n_ts.write_text(text, encoding="utf-8")

print("✅ Modifications applied. Now make sure all 4 new files exist:")
for p in [
    "web/routers/admin/insights.py",
    "web/schemas/admin/insights.py",
    "frontend/src/api/admin/insights.ts",
    "frontend/src/pages/admin/AdminInsightsPage.tsx",
]:
    exists = (ROOT / p).exists()
    print(f"   {'✅' if exists else '❌'} {p}")
