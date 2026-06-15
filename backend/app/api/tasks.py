"""Follow-up tasks / reminders."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models import Task, User
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def _get_owned_task(task_id: int, user: User, session: AsyncSession) -> Task:
    task = await session.get(Task, task_id)
    if task is None or task.agency_id != user.agency_id:
        raise HTTPException(404, "Task not found")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    done: bool | None = None,
    assignee_id: int | None = None,
    due_before: datetime | None = None,
):
    stmt = select(Task).where(Task.agency_id == user.agency_id)
    if done is not None:
        stmt = stmt.where(Task.done == done)
    if assignee_id is not None:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if due_before is not None:
        stmt = stmt.where(Task.due_at <= due_before)
    stmt = stmt.order_by(Task.due_at.is_(None), Task.due_at.asc())
    return list((await session.execute(stmt)).scalars().all())


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = Task(agency_id=user.agency_id, **body.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    body: TaskUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_owned_task(task_id, user, session)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await session.commit()
    await session.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_owned_task(task_id, user, session)
    await session.delete(task)
    await session.commit()


# Convenience: complete a task and stamp nothing fancy (kept minimal for now).
@router.post("/{task_id}/done", response_model=TaskOut)
async def complete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_owned_task(task_id, user, session)
    task.done = True
    await session.commit()
    await session.refresh(task)
    return task
