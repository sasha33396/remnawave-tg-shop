from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class InsightsOverview(BaseModel):
    total_users: int
    users_with_subscription: int
    active_users: int
    paid_users: int
    no_purchase_users: int
    total_revenue: float
    total_payments: int
    avg_check: float
    conversion_to_paid_pct: float
    trial_users: int
    paying_share_pct: float


class TimeseriesPoint(BaseModel):
    date: date
    new_users: int
    new_subscriptions: int
    revenue: float
    payments_count: int


class InsightsTimeseriesResponse(BaseModel):
    period_from: date
    period_to: date
    points: List[TimeseriesPoint]
