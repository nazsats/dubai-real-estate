"""Persisted AI Search conversations.

The AI endpoints in `ai.py` are stateless — the caller passes whatever history
it wants. That is fine for one-shot use but puts the transcript in the client's
hands, which means it vanishes on refresh and can be forged. These routes own
the transcript server-side instead: history is read from the database, never
from the request body.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai import broker_agent
from app.api.deps import get_current_user
from app.db import get_session
from app.models import ChatMessage, Conversation, Property, User
from app.ratelimit import ai_rate_limiter
from app.schemas import PropertyOut

router = APIRouter(prefix="/api/chat", tags=["chat"])

# How many prior turns to replay as context. Each turn costs input tokens on
# every subsequent request, so this is a cost/coherence trade rather than a
# technical limit. 12 covers the follow-up chains agents actually use
# ("what about 3 beds?", "same but under 4M") without the prompt growing
# without bound in a long-running thread.
HISTORY_TURNS = 12

# Longest a stored message may be. Guards the transcript against a pathological
# paste; the model's own replies are already capped by AI_MAX_TOKENS.
MAX_MESSAGE_CHARS = 4000


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    property_ids: list[int] = []
    created_at: datetime


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []
    # Every property referenced anywhere in the thread, fetched once so the
    # client can re-render cards without an N+1 per message.
    properties: list[PropertyOut] = []


class SendRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class SendResponse(BaseModel):
    conversation_id: int
    title: str
    user_message: MessageOut
    assistant_message: MessageOut
    properties: list[PropertyOut] = []


async def _owned(conversation_id: int, user: User, session: AsyncSession) -> Conversation:
    """Fetch a conversation the caller actually owns.

    Filters on owner as well as agency, and returns 404 (not 403) for someone
    else's thread — a 403 would confirm the id exists.
    """
    convo = await session.get(Conversation, conversation_id)
    if convo is None or convo.agency_id != user.agency_id or convo.owner_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return convo


def _derive_title(text: str) -> str:
    """First line of the opening message, trimmed to fit the sidebar.

    Deliberately not an AI call: titling is cosmetic, and spending a request
    and a second of latency on it before the user sees their answer is a bad
    trade. They can rename it.
    """
    line = " ".join(text.strip().split())
    return (line[:57] + "…") if len(line) > 58 else line or "New chat"


def _to_message_out(m: ChatMessage) -> MessageOut:
    return MessageOut(
        id=m.id, role=m.role, content=m.content,
        property_ids=list(m.property_ids or []), created_at=m.created_at,
    )


async def _load_properties(session: AsyncSession, ids: list[int], user: User) -> list[PropertyOut]:
    """Re-fetch referenced listings, tenant-scoped.

    A listing that was deleted, or belongs to another agency, simply doesn't
    come back — the transcript keeps its text and drops the card.
    """
    if not ids:
        return []
    rows = (
        await session.execute(
            select(Property).where(
                Property.id.in_(ids),
                (Property.agency_id == user.agency_id) | (Property.agency_id.is_(None)),
            )
        )
    ).scalars().all()
    by_id = {p.id: p for p in rows}
    return [PropertyOut.model_validate(by_id[i]) for i in ids if i in by_id]


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """The caller's threads, most recently active first."""
    counts = (
        select(ChatMessage.conversation_id, func.count(ChatMessage.id).label("n"))
        .group_by(ChatMessage.conversation_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(Conversation, func.coalesce(counts.c.n, 0))
            .outerjoin(counts, counts.c.conversation_id == Conversation.id)
            .where(Conversation.agency_id == user.agency_id, Conversation.owner_id == user.id)
            .order_by(Conversation.updated_at.desc())
            .limit(50)
        )
    ).all()
    return [
        ConversationOut(
            id=c.id, title=c.title, created_at=c.created_at,
            updated_at=c.updated_at, message_count=int(n),
        )
        for c, n in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _owned(conversation_id, user, session)
    convo = (
        await session.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
    ).scalar_one()

    ids: list[int] = []
    for m in convo.messages:
        for pid in m.property_ids or []:
            if pid not in ids:
                ids.append(pid)

    return ConversationDetail(
        id=convo.id, title=convo.title, created_at=convo.created_at,
        updated_at=convo.updated_at, message_count=len(convo.messages),
        messages=[_to_message_out(m) for m in convo.messages],
        properties=await _load_properties(session, ids, user),
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendResponse,
    dependencies=[Depends(ai_rate_limiter)],
)
async def send_message(
    conversation_id: int,
    body: SendRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a turn and get the assistant's reply.

    Pass `conversation_id=0` to start a new thread in the same call, so the
    first message doesn't need a create round-trip before it can be sent.
    """
    if conversation_id == 0:
        convo = Conversation(
            agency_id=user.agency_id, owner_id=user.id, title=_derive_title(body.message)
        )
        session.add(convo)
        await session.flush()
    else:
        convo = await _owned(conversation_id, user, session)

    # History comes from the database, never the request body — the client
    # cannot inject turns the model will treat as its own prior statements.
    prior = (
        await session.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == convo.id)
            .order_by(ChatMessage.id.desc())
            .limit(HISTORY_TURNS)
        )
    ).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(prior)]

    user_msg = ChatMessage(conversation_id=convo.id, role="user", content=body.message)
    session.add(user_msg)
    await session.flush()

    answer, props = await broker_agent.nl_search(session, user.agency_id, body.message, history)

    assistant_msg = ChatMessage(
        conversation_id=convo.id,
        role="assistant",
        content=answer or "(no response)",
        property_ids=[p.id for p in props],
    )
    session.add(assistant_msg)

    # Title the thread from its first real exchange, not from a placeholder.
    if not prior:
        convo.title = _derive_title(body.message)
    convo.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)

    return SendResponse(
        conversation_id=convo.id,
        title=convo.title,
        user_message=_to_message_out(user_msg),
        assistant_message=_to_message_out(assistant_msg),
        properties=[PropertyOut.model_validate(p) for p in props],
    )


class RenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    conversation_id: int,
    body: RenameRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    convo = await _owned(conversation_id, user, session)
    convo.title = body.title.strip()
    await session.commit()
    await session.refresh(convo)
    return ConversationOut(
        id=convo.id, title=convo.title, created_at=convo.created_at, updated_at=convo.updated_at
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _owned(conversation_id, user, session)
    # Explicit message delete first: ON DELETE CASCADE is declared on the FK,
    # but SQLite doesn't enforce it unless PRAGMA foreign_keys is on.
    await session.execute(delete(ChatMessage).where(ChatMessage.conversation_id == conversation_id))
    await session.execute(delete(Conversation).where(Conversation.id == conversation_id))
    await session.commit()
