"""Remove the randomly generated demo leads (created by generate_leads.py).

Those all use '@example.com' emails, so this only deletes fake data — any real
leads you've added (with real emails, or via Telegram/forms) are untouched.

Run from backend/ with the venv active:
    python cleanup_demo_leads.py
"""
import asyncio

from sqlalchemy import delete, func, select

from app.db import SessionLocal
from app.models import Interaction, Lead

FAKE_EMAIL = "%@example.com"


async def main() -> None:
    async with SessionLocal() as session:
        count = (
            await session.execute(select(func.count(Lead.id)).where(Lead.email.like(FAKE_EMAIL)))
        ).scalar_one()
        if count == 0:
            print("No generated demo leads found (nothing with @example.com). Nothing to remove.")
            return

        # Remove any interactions tied to those leads first (FK safety), then the leads.
        fake_ids = select(Lead.id).where(Lead.email.like(FAKE_EMAIL))
        await session.execute(delete(Interaction).where(Interaction.lead_id.in_(fake_ids)))
        await session.execute(delete(Lead).where(Lead.email.like(FAKE_EMAIL)))
        await session.commit()
        print(f"Removed {count} generated demo leads. Real leads (non-example.com) were kept.")


if __name__ == "__main__":
    asyncio.run(main())
