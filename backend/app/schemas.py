"""Pydantic request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Auth & users ──────────────────────────────────────────────
class SignupRequest(BaseModel):
    agency_name: str
    full_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class InviteRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "agent"  # admin | agent


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agency_id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


# ── Properties ────────────────────────────────────────────────
class PropertyBase(BaseModel):
    location: str
    building: str
    price: float
    type: str
    bedrooms: int
    size_sqft: int
    has_pool: bool = False
    has_gym: bool = False
    has_balcony: bool = False
    available: bool = True
    possession: str = "Ready"


class PropertyCreate(PropertyBase):
    pass  # agency_id comes from the authenticated user


class PropertyOut(PropertyBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agency_id: int | None = None
    image_url: str | None = None
    external_id: str | None = None
    source: str = "manual"
    created_at: datetime
    status: str = "approved"


class AgentContact(BaseModel):
    """The person a buyer enquiry reaches.

    Deliberately not the full UserOut: a public-facing listing exposes a name
    and business contact details, never the account's role or internal ids
    beyond what's needed to route the enquiry.
    """

    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    phone: str | None = None


class PropertyDetail(PropertyOut):
    """Everything the property page shows, including who to contact."""

    description: str | None = None
    bathrooms: int | None = None
    parking: int | None = None
    furnished: bool = False
    reference: str | None = None
    rejection_reason: str | None = None
    submitted_at: datetime | None = None
    listed_by: AgentContact | None = None
    agency_name: str | None = None


class ListingSubmission(BaseModel):
    """A broker submitting their own listing for review."""

    location: str = Field(min_length=2, max_length=120)
    building: str = Field(min_length=2, max_length=160)
    price: float = Field(gt=0, le=1_000_000_000)
    type: str
    bedrooms: int = Field(ge=0, le=20)
    size_sqft: int = Field(gt=0, le=200_000)
    bathrooms: int | None = Field(default=None, ge=0, le=20)
    parking: int | None = Field(default=None, ge=0, le=20)
    has_pool: bool = False
    has_gym: bool = False
    has_balcony: bool = False
    furnished: bool = False
    possession: str = "Ready"
    description: str | None = Field(default=None, max_length=4000)
    image_url: str | None = Field(default=None, max_length=1000)
    reference: str | None = Field(default=None, max_length=64)


class ReviewRequest(BaseModel):
    approve: bool
    # Required on rejection: "rejected" with no explanation gives the broker
    # nothing to act on and generates a support conversation instead of a fix.
    reason: str | None = Field(default=None, max_length=1000)


class BayutImportRequest(BaseModel):
    location: str = "Dubai"  # area name, e.g. "Dubai Marina"
    purpose: str = "for-sale"  # for-sale | for-rent
    pages: int = 1  # pages of ~25 listings each
    to_shared_pool: bool = False  # if true, agency_id=NULL (visible to all tenants)


class BayutImportResult(BaseModel):
    location: str
    imported: int
    skipped: int
    fetched: int


# ── Leads ─────────────────────────────────────────────────────
class LeadBase(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    language: str = "English"
    source: str = "manual"
    status: str = "New"
    budget_min: float | None = None
    budget_max: float | None = None
    preferred_locations: str | None = None
    bedrooms: int | None = None
    property_type: str | None = None
    notes: str | None = None
    owner_id: int | None = None


class LeadCreate(LeadBase):
    pass  # agency_id from the authenticated user


class LeadUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    language: str | None = None
    source: str | None = None
    status: str | None = None
    score: int | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    preferred_locations: str | None = None
    bedrooms: int | None = None
    property_type: str | None = None
    notes: str | None = None
    owner_id: int | None = None


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agency_id: int
    score: int
    created_at: datetime


# ── Interactions (timeline) ───────────────────────────────────
class InteractionCreate(BaseModel):
    channel: str = "note"  # note|call|whatsapp|email|meeting|viewing
    direction: str = "out"  # in|out
    body: str


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    user_id: int | None
    channel: str
    direction: str
    body: str
    created_at: datetime


# ── Tasks ─────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    lead_id: int | None = None
    assignee_id: int | None = None
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    assignee_id: int | None = None
    due_at: datetime | None = None
    done: bool | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int | None
    assignee_id: int | None
    title: str
    due_at: datetime | None
    done: bool
    created_at: datetime


# ── Deals & revenue ───────────────────────────────────────────
class DealCreate(BaseModel):
    title: str
    lead_id: int | None = None
    property_id: int | None = None
    owner_id: int | None = None
    value: float = 0
    commission: float = 0
    stage: str = "Negotiation"
    payment_status: str = "Pending"
    expected_close: datetime | None = None


class DealUpdate(BaseModel):
    title: str | None = None
    value: float | None = None
    commission: float | None = None
    stage: str | None = None
    payment_status: str | None = None
    expected_close: datetime | None = None


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int | None
    property_id: int | None
    owner_id: int | None
    title: str
    value: float
    commission: float
    stage: str
    payment_status: str
    expected_close: datetime | None
    closed_at: datetime | None
    created_at: datetime


class RevenueSummary(BaseModel):
    open_deals: int
    won_deals: int
    lost_deals: int
    pipeline_value: float  # value of open deals
    won_value: float
    commission_won: float
    commission_pending: float  # commission on won deals not fully paid


# ── AI ────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    history: list[dict] = []


class SearchResponse(BaseModel):
    answer: str
    properties: list[PropertyOut] = []


class MatchRequest(BaseModel):
    lead_id: int
    limit: int = 6


class PitchRequest(BaseModel):
    lead_id: int
    channel: str = "whatsapp"  # whatsapp | email
    limit: int = 4


class PitchResponse(BaseModel):
    channel: str
    message: str
    properties: list[PropertyOut] = []


class MarketingRequest(BaseModel):
    property_id: int
    channels: list[str] = ["listing", "instagram", "ad"]


class MarketingResponse(BaseModel):
    property_id: int
    assets: dict
