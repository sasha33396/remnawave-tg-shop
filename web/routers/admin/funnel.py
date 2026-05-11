from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    Account,
    AdAttribution,
    AdCampaign,
    Payment,
    Subscription,
    User,
)
from web.dependencies import get_current_admin, get_db
from web.schemas.admin.funnel import (
    FunnelBySourceItem,
    FunnelBySourceResponse,
    FunnelResponse,
    FunnelStage,
)

router = APIRouter()


STAGE_LABELS_RU = {
    "registered": "Зарегистрировались",
    "trial": "Активировали триал",
    "first_payment": "Первая оплата",
    "renewed": "Продлили подписку",
    "active": "Активная подписка",
}


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(part * 100.0 / whole, 2)


def _date_to_dt(d: Optional[date], end_of_day: bool = False) -> Optional[datetime]:
    if d is None:
        return None
    if end_of_day:
        return datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc)
    return datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)


@router.get("/funnel", response_model=FunnelResponse)
async def get_funnel(
    period_from: Optional[date] = Query(None),
    period_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    dt_from = _date_to_dt(period_from)
    dt_to = _date_to_dt(period_to, end_of_day=True)

    user_filters = []
    if dt_from is not None:
        user_filters.append(User.registration_date >= dt_from)
    if dt_to is not None:
        user_filters.append(User.registration_date <= dt_to)

    payment_filters = [Payment.status == "succeeded"]
    if dt_from is not None:
        payment_filters.append(Payment.created_at >= dt_from)
    if dt_to is not None:
        payment_filters.append(Payment.created_at <= dt_to)

    # Trial = subscription with provider IS NULL (paid subs always have a provider).
    # The trial_activations table only covers new trials after that feature was added,
    # so we use Subscription.provider IS NULL as the historical source of truth.
    trial_filters = [Subscription.provider.is_(None)]
    if dt_from is not None:
        trial_filters.append(Subscription.start_date >= dt_from)
    if dt_to is not None:
        trial_filters.append(Subscription.start_date <= dt_to)

    # 1. Registered users in period
    registered_stmt = select(func.count(User.user_id))
    if user_filters:
        registered_stmt = registered_stmt.where(and_(*user_filters))
    registered = int((await db.execute(registered_stmt)).scalar() or 0)

    # 2. Trial activations (distinct users with at least one trial subscription)
    trial_stmt = select(func.count(func.distinct(Subscription.user_id))).where(and_(*trial_filters))
    trial = int((await db.execute(trial_stmt)).scalar() or 0)

    # 3. First payment (distinct users who paid at least once)
    paid_stmt = select(func.count(func.distinct(Payment.user_id))).where(and_(*payment_filters))
    paid = int((await db.execute(paid_stmt)).scalar() or 0)

    # 4. Renewed (users with >= 2 succeeded payments in period)
    renewed_subq = (
        select(Payment.user_id, func.count(Payment.payment_id).label("cnt"))
        .where(and_(*payment_filters))
        .group_by(Payment.user_id)
        .having(func.count(Payment.payment_id) >= 2)
        .subquery()
    )
    renewed_stmt = select(func.count()).select_from(renewed_subq)
    renewed = int((await db.execute(renewed_stmt)).scalar() or 0)

    # 5. Currently active subscriptions (period filter on Subscription.end_date if given)
    active_stmt = select(func.count(func.distinct(Subscription.user_id))).where(
        and_(Subscription.is_active.is_(True), Subscription.end_date > datetime.now(timezone.utc))
    )
    active = int((await db.execute(active_stmt)).scalar() or 0)

    # Total revenue in period
    revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0.0)).where(and_(*payment_filters))
    revenue = float((await db.execute(revenue_stmt)).scalar() or 0.0)

    counts = [
        ("registered", registered),
        ("trial", trial),
        ("first_payment", paid),
        ("renewed", renewed),
        ("active", active),
    ]
    top = counts[0][1] if counts else 0
    stages = []
    for i, (key, count) in enumerate(counts):
        prev = counts[i - 1][1] if i > 0 else top
        stages.append(
            FunnelStage(
                key=key,
                label=STAGE_LABELS_RU[key],
                count=count,
                pct_from_top=_pct(count, top),
                pct_from_prev=_pct(count, prev) if prev > 0 else 0.0,
            )
        )

    return FunnelResponse(
        stages=stages,
        period_from=period_from,
        period_to=period_to,
        total_revenue=revenue,
        total_users=registered,
    )


@router.get("/funnel/by-source", response_model=FunnelBySourceResponse)
async def get_funnel_by_source(
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    """Per-source aggregate: starts (attributed), trials, payers, revenue."""
    # Aggregate across campaigns grouped by source
    starts_stmt = (
        select(AdCampaign.source, func.count(AdAttribution.user_id).label("starts"))
        .select_from(AdCampaign)
        .join(AdAttribution, AdAttribution.ad_campaign_id == AdCampaign.ad_campaign_id, isouter=True)
        .group_by(AdCampaign.source)
    )
    starts_rows = (await db.execute(starts_stmt)).all()
    by_source = {row[0]: {"starts": int(row[1] or 0), "trials": 0, "payers": 0, "revenue": 0.0} for row in starts_rows}

    trials_stmt = (
        select(AdCampaign.source, func.count(AdAttribution.user_id).label("trials"))
        .select_from(AdCampaign)
        .join(AdAttribution, AdAttribution.ad_campaign_id == AdCampaign.ad_campaign_id)
        .where(AdAttribution.trial_activated_at.is_not(None))
        .group_by(AdCampaign.source)
    )
    for row in (await db.execute(trials_stmt)).all():
        src = row[0]
        if src in by_source:
            by_source[src]["trials"] = int(row[1] or 0)

    # Payers + revenue: join payments via attributions
    payers_stmt = (
        select(
            AdCampaign.source,
            func.count(func.distinct(Payment.user_id)).label("payers"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("revenue"),
        )
        .select_from(AdCampaign)
        .join(AdAttribution, AdAttribution.ad_campaign_id == AdCampaign.ad_campaign_id)
        .join(Payment, Payment.user_id == AdAttribution.user_id)
        .where(and_(Payment.status == "succeeded", Payment.created_at >= AdAttribution.first_start_at))
        .group_by(AdCampaign.source)
    )
    for row in (await db.execute(payers_stmt)).all():
        src = row[0]
        if src in by_source:
            by_source[src]["payers"] = int(row[1] or 0)
            by_source[src]["revenue"] = float(row[2] or 0.0)

    items = [
        FunnelBySourceItem(source=src, **data)
        for src, data in sorted(by_source.items(), key=lambda kv: -kv[1]["revenue"])
    ]
    return FunnelBySourceResponse(items=items)
