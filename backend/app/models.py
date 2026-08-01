"""Database models.

Multi-tenant from day one: every tenant-owned row carries `agency_id`.
Phase 1 adds Users/auth and Postgres Row-Level Security; for now an `agency_id`
column + filtering in queries gives us the isolation seam to build on.
"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Agency(Base):
    __tablename__ = "agencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    leads: Mapped[list["Lead"]] = relationship(back_populates="agency")
    users: Mapped[list["User"]] = relationship(back_populates="agency")


class User(Base):
    """An agent or admin belonging to an agency."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="agent")  # admin | agent
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agency: Mapped["Agency"] = relationship(back_populates="users")


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable agency_id => part of the shared market pool visible to all tenants.
    agency_id: Mapped[int | None] = mapped_column(ForeignKey("agencies.id"), index=True)

    location: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    building: Mapped[str] = mapped_column(String(160), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    size_sqft: Mapped[int] = mapped_column(Integer, nullable=False)
    has_pool: Mapped[bool] = mapped_column(Boolean, default=False)
    has_gym: Mapped[bool] = mapped_column(Boolean, default=False)
    has_balcony: Mapped[bool] = mapped_column(Boolean, default=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    possession: Mapped[str] = mapped_column(String(40), default="Ready")
    image_url: Mapped[str | None] = mapped_column(Text)  # cover photo
    external_id: Mapped[str | None] = mapped_column(String(64), index=True)  # source id (dedupe imports)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | bayut | seed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Pipeline stages a lead can occupy.
LEAD_STAGES = ("New", "Contacted", "Qualified", "Viewing", "Negotiation", "Won", "Lost")


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)  # assigned agent

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    whatsapp: Mapped[str | None] = mapped_column(String(40))
    language: Mapped[str] = mapped_column(String(20), default="English")

    source: Mapped[str] = mapped_column(String(60), default="manual")  # portal, whatsapp, web, walk-in...
    status: Mapped[str] = mapped_column(String(40), default="New", index=True)  # pipeline stage
    score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100 lead heat

    # Requirements — what the buyer wants (drives AI matching)
    budget_min: Mapped[float | None] = mapped_column(Numeric(14, 2))
    budget_max: Mapped[float | None] = mapped_column(Numeric(14, 2))
    preferred_locations: Mapped[str | None] = mapped_column(Text)  # comma-separated
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    property_type: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agency: Mapped["Agency"] = relationship(back_populates="leads")
    interactions: Mapped[list["Interaction"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="Interaction.created_at.desc()"
    )


class Interaction(Base):
    """A single touchpoint with a lead — the CRM timeline."""

    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # who logged it

    channel: Mapped[str] = mapped_column(String(20), default="note")  # note|call|whatsapp|email|meeting|viewing
    direction: Mapped[str] = mapped_column(String(10), default="out")  # in|out
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lead: Mapped["Lead"] = relationship(back_populates="interactions")


class Task(Base):
    """A follow-up / reminder, optionally tied to a lead."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Deal(Base):
    """A sale in progress / closed — drives revenue + commission tracking."""

    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), index=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id"))
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)  # deal/property price in AED
    commission: Mapped[float] = mapped_column(Numeric(14, 2), default=0)  # agency commission in AED
    stage: Mapped[str] = mapped_column(String(20), default="Negotiation", index=True)  # Negotiation|Won|Lost
    payment_status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Partial|Paid
    expected_close: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


DEAL_STAGES = ("Negotiation", "Won", "Lost")


class Conversation(Base):
    """A saved AI Search chat thread.

    Scoped to both agency and user: an agent's chats are their own working
    notes, not shared agency inventory, so `owner_id` narrows further than the
    usual `agency_id` filter.
    """

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id"), index=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    title: Mapped[str] = mapped_column(String(160), default="New chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Bumped on every message so the sidebar can sort by recent activity.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    """One turn in a conversation.

    Only the visible text is stored, not Claude's intermediate tool_use /
    tool_result blocks. Replaying those faithfully means every tool_use must be
    paired with its matching tool_result or the API rejects the request — a
    brittle invariant to maintain across edits and deletes, for context the
    model does not need. A plain user/assistant text transcript is valid on
    replay and is enough for follow-ups like "what about 3 beds instead?".

    `property_ids` records which listings were shown so the cards can be
    re-rendered on reload. IDs rather than a snapshot: prices change, and a
    stale copy shown next to live inventory is worse than a missing card.
    """

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    property_ids: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class DldTransaction(Base):
    """A recorded Dubai Land Department sale — official market history.

    Market data is public and shared by every tenant, so there is no `agency_id`
    (same rationale as shared-pool properties). This is what an agent's price
    claims get grounded in: not asking prices from portals, but what buyers
    actually paid.

    Source: the DLD `Transactions` dataset on dubaipulse.gov.ae. Loaded via
    `import_dld.py` — see docs/dld-data.md.
    """

    __tablename__ = "dld_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # DLD's own transaction id — makes re-importing idempotent.
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    area: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    building: Mapped[str | None] = mapped_column(String(200))
    project: Mapped[str | None] = mapped_column(String(200))

    property_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    rooms: Mapped[int | None] = mapped_column(Integer, index=True)  # NULL = studio/unknown
    size_sqft: Mapped[int | None] = mapped_column(Integer)

    price_aed: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, index=True)
    # Stored rather than derived: DLD reports its own per-metre figure, and
    # deriving it per query would prevent indexing the column.
    price_per_sqft: Mapped[float | None] = mapped_column(Numeric(12, 2), index=True)

    # "Sales" | "Mortgages" | "Gifts" — filter to Sales for price analysis.
    transaction_type: Mapped[str] = mapped_column(String(40), default="Sales", index=True)
    # "Off-Plan" | "Ready" — the two behave like different markets.
    registration_type: Mapped[str | None] = mapped_column(String(40), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
