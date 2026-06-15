# Dubai AI Broker — Telegram Bot

Operate the assistant from Telegram: natural-language property search + quick lead
capture, backed by the FastAPI API. No business verification needed (unlike WhatsApp) —
you can be live in 2 minutes.

## 1. Get a bot token (free, instant)

1. Open Telegram and message **@BotFather**.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. BotFather replies with a **token** like `123456:ABC...` — copy it.

## 2. Configure + run

The **backend must be running** (`../backend`, default `http://localhost:8000`).

```bash
cd telegram_bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env              # macOS/Linux: cp .env.example .env
# edit .env → paste TELEGRAM_BOT_TOKEN
python bot.py
```

## 3. Use it

Open your bot in Telegram and:

- Type anything → AI property search
  _e.g. "3 bed in Dubai Marina under 5M with a pool"_
- `/newlead Ahmed | 5000000 | Dubai Marina` → captures a lead (shows up in the pipeline)
- `/help` → command list

The bot signs in to the backend as the account in `.env` (the demo agency by default),
so leads it creates appear in that agency's CRM/pipeline.

## Notes

- This is **polling** mode (simplest — no public URL needed). For production, switch to
  webhooks behind HTTPS.
- One bot = one agency account today. Multi-agency Telegram onboarding can come later
  (map each Telegram user to their own agency login).
