"""Telegram bot front-end for the Dubai AI Broker backend.

Lets an agent operate the assistant from Telegram: natural-language property
search, quick lead capture, and marketing copy — all backed by the FastAPI API.

Setup: see README.md (get a token from @BotFather, fill .env, run this file).
"""
import logging
import os

import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("broker-bot")

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
LOGIN_EMAIL = os.getenv("BACKEND_EMAIL", "demo@demo.ae")
LOGIN_PASSWORD = os.getenv("BACKEND_PASSWORD", "demo12345")

# Cached backend JWT (re-fetched on expiry/401).
_token: str | None = None


async def _login(client: httpx.AsyncClient) -> str:
    resp = await client.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def backend(method: str, path: str, payload: dict | None = None) -> httpx.Response:
    """Call the backend with the cached token, re-logging in once on 401."""
    global _token
    async with httpx.AsyncClient() as client:
        if _token is None:
            _token = await _login(client)
        headers = {"Authorization": f"Bearer {_token}"}
        resp = await client.request(method, f"{BACKEND_URL}{path}", json=payload, headers=headers, timeout=90)
        if resp.status_code == 401:
            _token = await _login(client)
            headers = {"Authorization": f"Bearer {_token}"}
            resp = await client.request(method, f"{BACKEND_URL}{path}", json=payload, headers=headers, timeout=90)
        return resp


# ── Commands ──────────────────────────────────────────────────
WELCOME = (
    "🏙️ *Dubai AI Broker*\n\n"
    "Just type what you're looking for and I'll search your inventory:\n"
    "_3 bed in Dubai Marina under 5M with a pool_\n\n"
    "*Commands*\n"
    "/newlead Name | maxBudget | area — capture a lead\n"
    "/help — show this message"
)


async def start(update: Update, _: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(WELCOME, parse_mode=ParseMode.MARKDOWN)


async def newlead(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw = " ".join(context.args)
    parts = [p.strip() for p in raw.split("|")]
    if not parts or not parts[0]:
        await update.message.reply_text("Usage: /newlead Name | maxBudget | area")
        return
    payload: dict = {"name": parts[0], "source": "telegram"}
    if len(parts) > 1 and parts[1]:
        try:
            payload["budget_max"] = float(parts[1].replace(",", ""))
        except ValueError:
            pass
    if len(parts) > 2 and parts[2]:
        payload["preferred_locations"] = parts[2]

    resp = await backend("POST", "/api/leads", payload)
    if resp.status_code in (200, 201):
        lead = resp.json()
        await update.message.reply_text(f"✅ Lead saved: {lead['name']} (#{lead['id']})")
    else:
        await update.message.reply_text(f"⚠️ Could not save lead ({resp.status_code}).")


async def on_message(update: Update, _: ContextTypes.DEFAULT_TYPE):
    query = update.message.text.strip()
    await update.message.chat.send_action("typing")
    resp = await backend("POST", "/api/ai/search", {"query": query})
    if resp.status_code != 200:
        await update.message.reply_text(f"⚠️ Search failed ({resp.status_code}).")
        return
    data = resp.json()
    answer = data.get("answer", "No results.")
    # Telegram messages cap at 4096 chars.
    await update.message.reply_text(answer[:4000])


def main() -> None:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", start))
    app.add_handler(CommandHandler("newlead", newlead))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    log.info("Bot starting (polling). Backend: %s", BACKEND_URL)
    app.run_polling()


if __name__ == "__main__":
    main()
