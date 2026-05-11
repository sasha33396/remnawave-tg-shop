from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class FunnelStage(BaseModel):
    key: str
    label: str
    count: int
    pct_from_top: float
    pct_from_prev: float


class FunnelResponse(BaseModel):
    stages: List[FunnelStage]
    period_from: Optional[date] = None
    period_to: Optional[date] = None
    total_revenue: float
    total_users: int


class FunnelBySourceItem(BaseModel):
    source: str
    starts: int
    trials: int
    payers: int
    revenue: float


class FunnelBySourceResponse(BaseModel):
    items: List[FunnelBySourceItem]
