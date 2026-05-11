from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, cast, func, select
from sqlalchemy.dialects.postgresql import DATE
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Account, Payment, Subscription, User
from web.dependencies import get_current_admin, get_db
from web.schemas.admin.insights import (
    InsightsOverview,
    InsightsTimeseriesResponse,
    TimeseriesPoint,
)

router = APIRouter()


def _to_date(dt: Optional[date], end_of_day: bool = False) -> Optional[datetime]:
    if dt is None:
        return None
    t = datetime.max.time() if end_of_day else datetime.min.time()
    return datetime.combine(dt, t).replace(tzinfo=timezone.utc)


@router.get("/insights/overview", response_model=InsightsOverview)
async def insights_overview(
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    # Total registered users
    total_users = int((await db.execute(select(func.count(User.user_id)))).scalar() or 0)

    # Users with at least one subscription (trial or paid)
    users_with_sub = int(
        (await db.execute(select(func.count(func.distinct(Subscription.user_id))))).scalar() or 0
    )

    # Users with at least one trial-only subscription (provider is null)
    trial_users = int(
        (
            await db.execute(
                select(func.count(func.distinct(Subscription.user_id))).where(
                    Subscription.provider.is_(None)
                )
            )
        ).scalar()
        or 0
    )

    # Active users (subscription active right now)
    now = datetime.now(timezone.utc)
    active_users = int(
        (
            await db.execute(
                select(func.count(func.distinct(Subscription.user_id))).where(
                    and_(Subscription.is_active.is_(True), Subscription.end_date > now)
                )
            )
        ).scalar()
        or 0
    )

    # Users who paid at least once
    paid_users = int(
        (
            await db.execute(
                select(func.count(func.distinct(Payment.user_id))).where(
                    Payment.status == "succeeded"
                )
            )
        ).scalar()
        or 0
    )

    # Total revenue
    total_revenue = float(
        (
            await db.execute(
                select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
                    Payment.status == "succeeded"
                )
            )
        ).scalar()
        or 0.0
    )

    # Count of succeeded payments
    total_payments = int(
        (
            await db.execute(
                select(func.count(Payment.payment_id)).where(Payment.status == "succeeded")
            )
        ).scalar()
        or 0
    )

    avg_check = (total_revenue / total_payments) if total_payments > 0 else 0.0
    no_purchase = max(0, total_users - paid_users)
    conv = round(paid_users * 100.0 / total_users, 2) if total_users > 0 else 0.0
    paying_share = round(paid_users * 100.0 / users_with_sub, 2) if users_with_sub > 0 else 0.0

    return InsightsOverview(
        total_users=total_users,
        users_with_subscription=users_with_sub,
        active_users=active_users,
        paid_users=paid_users,
        no_purchase_users=no_purchase,
        total_revenue=round(total_revenue, 2),
        total_payments=total_payments,
        avg_check=round(avg_check, 2),
        conversion_to_paid_pct=conv,
        trial_users=trial_users,
        paying_share_pct=paying_share,
    )


@router.get("/insights/timeseries", response_model=InsightsTimeseriesResponse)
async def insights_timeseries(
    period_from: Optional[date] = Query(None),
    period_to: Optional[date] = Query(None),
    days: int = Query(90, ge=1, le=730),
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    if period_to is None:
        period_to = date.today()
    if period_from is None:
        period_from = period_to - timedelta(days=days)

    dt_from = _to_date(period_from)
    dt_to = _to_date(period_to, end_of_day=True)

    # New users grouped by day
    users_q = (
        select(
            cast(User.registration_date, DATE).label("d"),
            func.count().label("n"),
        )
        .where(and_(User.registration_date >= dt_from, User.registration_date <= dt_to))
        .group_by("d")
    )
    users_by_day = {row[0]: int(row[1]) for row in (await db.execute(users_q)).all()}

    # New subscriptions by day (using start_date; fall back to None ignored)
    subs_q = (
        select(
            cast(Subscription.start_date, DATE).label("d"),
            func.count(func.distinct(Subscription.user_id)).label("n"),
        )
        .where(
            and_(
                Subscription.start_date.is_not(None),
                Subscription.start_date >= dt_from,
                Subscription.start_date <= dt_to,
            )
        )
        .group_by("d")
    )
    subs_by_day = {row[0]: int(row[1]) for row in (await db.execute(subs_q)).all()}

    # Revenue + payment count by day
    pays_q = (
        select(
            cast(Payment.created_at, DATE).label("d"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("revenue"),
            func.count().label("count"),
        )
        .where(
            and_(
                Payment.status == "succeeded",
                Payment.created_at >= dt_from,
                Payment.created_at <= dt_to,
            )
        )
        .group_by("d")
    )
    pays_by_day = {
        row[0]: (float(row[1] or 0.0), int(row[2] or 0))
        for row in (await db.execute(pays_q)).all()
    }

    # Build full date range with zeros where missing
    points: list[TimeseriesPoint] = []
    cur = period_from
    while cur <= period_to:
        revenue, pcount = pays_by_day.get(cur, (0.0, 0))
        points.append(
            TimeseriesPoint(
                date=cur,
                new_users=users_by_day.get(cur, 0),
                new_subscriptions=subs_by_day.get(cur, 0),
                revenue=round(revenue, 2),
                payments_count=pcount,
            )
        )
        cur = cur + timedelta(days=1)

    return InsightsTimeseriesResponse(period_from=period_from, period_to=period_to, points=points)
