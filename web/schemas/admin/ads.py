from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from web.schemas.types import UTCDatetime


class AdminAdCampaignStats(BaseModel):
    starts: int
    trials: int
    payers: int
    revenue: float


class AdminAdCampaignItem(BaseModel):
    ad_campaign_id: int
    source: str
    start_param: str
    telegram_link: Optional[str] = None
    web_link: Optional[str] = None
    cost: float
    is_active: bool
    created_at: Optional[UTCDatetime] = None
    stats: AdminAdCampaignStats


class AdminAdsListResponse(BaseModel):
    items: List[AdminAdCampaignItem]
    total: int
    page: int
    page_size: int


class AdminAdsOverview(BaseModel):
    total_cost: float
    total_revenue: float
    active_campaigns: int
    total_campaigns: int


class AdCampaignCreateRequest(BaseModel):
    source: str = Field(min_length=1, max_length=64)
    start_param: str = Field(min_length=2, max_length=64)
    cost: float = Field(ge=0, le=1e8)

    @field_validator("start_param")
    @classmethod
    def validate_start_param(cls, v: str) -> str:
        import re
        if not re.match(r"^[A-Za-z0-9_\-]{2,64}$", v):
            raise ValueError("start_param must be 2-64 chars: letters, digits, _ or -")
        return v


class AdCampaignUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    cost: Optional[float] = Field(default=None, ge=0, le=1e8)
    source: Optional[str] = Field(default=None, min_length=1, max_length=64)
