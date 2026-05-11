from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Account
from config.settings import Settings
from web.dependencies import get_db, get_current_admin, get_settings_dep
from web.schemas.admin.ads import (
    AdminAdCampaignItem,
    AdminAdCampaignStats,
    AdminAdsListResponse,
    AdminAdsOverview,
    AdCampaignCreateRequest,
    AdCampaignUpdateRequest,
)
from core.dal import ad_dal
from web.middleware.rate_limit import admin_action_limit

router = APIRouter()


def _to_item(campaign, stats: dict, settings: Settings) -> AdminAdCampaignItem:
    telegram_link = None
    if settings.BOT_USERNAME:
        telegram_link = f"https://t.me/{settings.BOT_USERNAME.lstrip('@')}?start={campaign.start_param}"

    return AdminAdCampaignItem(
        ad_campaign_id=campaign.ad_campaign_id,
        source=campaign.source,
        start_param=campaign.start_param,
        telegram_link=telegram_link,
        cost=float(campaign.cost or 0),
        is_active=bool(campaign.is_active),
        created_at=campaign.created_at,
        stats=AdminAdCampaignStats(
            starts=int(stats.get("starts", 0)),
            trials=int(stats.get("trials", 0)),
            payers=int(stats.get("payers", 0)),
            revenue=float(stats.get("revenue", 0.0)),
        ),
    )


@router.get("/ads/overview", response_model=AdminAdsOverview)
async def ads_overview(
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    totals = await ad_dal.get_totals(db)
    total_count = await ad_dal.count_campaigns(db)
    active_count = await ad_dal.count_campaigns(db, only_active=True)
    return AdminAdsOverview(
        total_cost=float(totals.get("cost", 0.0)),
        total_revenue=float(totals.get("revenue", 0.0)),
        active_campaigns=active_count,
        total_campaigns=total_count,
    )


@router.get("/ads", response_model=AdminAdsListResponse)
async def list_ads(
    page: int = Query(0, ge=0),
    page_size: int = Query(20, ge=1, le=100),
    only_active: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    _admin: Account = Depends(get_current_admin),
):
    campaigns = await ad_dal.list_campaigns_paged(
        db, page=page, page_size=page_size, only_active=only_active
    )
    total = await ad_dal.count_campaigns(db, only_active=only_active)
    items = []
    for c in campaigns:
        stats = await ad_dal.get_campaign_stats(db, c.ad_campaign_id)
        items.append(_to_item(c, stats, settings))
    return AdminAdsListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/ads/{campaign_id}", response_model=AdminAdCampaignItem)
async def get_ad(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    _admin: Account = Depends(get_current_admin),
):
    campaign = await ad_dal.get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    stats = await ad_dal.get_campaign_stats(db, campaign_id)
    return _to_item(campaign, stats, settings)


@router.post(
    "/ads", response_model=AdminAdCampaignItem,
    dependencies=[Depends(admin_action_limit)],
)
async def create_ad(
    body: AdCampaignCreateRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    _admin: Account = Depends(get_current_admin),
):
    try:
        campaign = await ad_dal.create_campaign(
            db,
            source=body.source.strip(),
            start_param=body.start_param.strip(),
            cost=float(body.cost),
        )
        await db.commit()
    except ValueError as ve:
        await db.rollback()
        if str(ve) == "ad_campaign_start_param_exists":
            raise HTTPException(status_code=409, detail="start_param already exists")
        raise HTTPException(status_code=422, detail=str(ve))
    return _to_item(campaign, {"starts": 0, "trials": 0, "payers": 0, "revenue": 0.0}, settings)


@router.patch(
    "/ads/{campaign_id}", response_model=AdminAdCampaignItem,
    dependencies=[Depends(admin_action_limit)],
)
async def update_ad(
    campaign_id: int,
    body: AdCampaignUpdateRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    _admin: Account = Depends(get_current_admin),
):
    campaign = await ad_dal.get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if body.is_active is not None:
        campaign.is_active = body.is_active
    if body.cost is not None:
        campaign.cost = float(body.cost)
    if body.source is not None:
        campaign.source = body.source.strip()

    await db.commit()
    await db.refresh(campaign)
    stats = await ad_dal.get_campaign_stats(db, campaign_id)
    return _to_item(campaign, stats, settings)


@router.delete(
    "/ads/{campaign_id}",
    dependencies=[Depends(admin_action_limit)],
)
async def delete_ad(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    existed = await ad_dal.delete_campaign(db, campaign_id)
    if not existed:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.commit()
    return {"deleted": True, "id": campaign_id}
