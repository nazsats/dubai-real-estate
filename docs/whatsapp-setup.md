# Getting WhatsApp Business API access (Dubai broker assistant)

Goal: get the credentials so the assistant can send/receive WhatsApp messages (Phase 3).
There are two routes — pick based on how fast you want to move.

| Route | Effort | Cost | Best for |
|---|---|---|---|
| **Meta Cloud API (direct)** | Medium — you host a webhook | Free platform + per-conversation fees | Dev now + single agency; full control |
| **BSP (Twilio / 360dialog / Wati)** | Low — they handle infra | Higher per-msg + monthly | Fast launch; less plumbing |

**Recommendation:** use **Meta Cloud API directly** for development (free test number works today),
and revisit a BSP / Meta **Tech Provider Embedded Signup** when you go multi-tenant so each agency
connects *their own* number. Start Meta **Business Verification now** — it's the slow step (days).

---

## What you'll end up with (the credentials Phase 3 needs)

Add these to `backend/.env` later — leave blank for now:

```env
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=          # permanent System User token
WHATSAPP_APP_SECRET=            # to verify inbound webhook signatures
WHATSAPP_WEBHOOK_VERIFY_TOKEN=  # a random string you choose
```

---

## Step-by-step (Meta Cloud API)

### 1. Prerequisites
- A personal **Facebook account**.
- A **phone number** that is NOT currently active on a WhatsApp/WhatsApp Business app
  (or one you're willing to migrate). Meta also gives you a free **test number** to start.
- Your business details. For Dubai, have your **DED/DET trade licence** ready (used for
  Business Verification) — plus business name, address, website, and email.

### 2. Create a Meta Business Account
Go to **business.facebook.com** → create a Business Portfolio with your agency's details.

### 3. Create an app + add WhatsApp
- Go to **developers.facebook.com** → **My Apps** → **Create App**.
- Type: **Business**. Link it to the Business Portfolio from step 2.
- On the app dashboard, find **WhatsApp** → **Set up**.
- This auto-creates a **WhatsApp Business Account (WABA)** and a **test number**.

### 4. Send your first test message (today, free)
- In **WhatsApp → API Setup**, you'll see a **temporary access token** (24h),
  a **Phone number ID**, and a field to add **recipient test numbers**.
- Add your own mobile as a recipient, then use the sample `curl` to send the
  `hello_world` template. If it arrives, the pipeline works.

### 5. Start Business Verification (do this now — it's slow)
- **Business Settings → Security Center → Start Verification**.
- Upload the trade licence + verify business phone/email/domain.
- Takes anywhere from a day to a couple of weeks. Required before you can message
  real (non-test) users at scale and raise messaging limits.

### 6. Add & verify your real sending number
- **WhatsApp → API Setup → Add phone number** → verify by SMS/call.
- Set a **Display name** (e.g. "Demo Realty") → submit for approval.

### 7. Create a PERMANENT access token (the temp one expires in 24h)
- **Business Settings → Users → System Users → Add** (role: Admin).
- **Add Assets** → assign your app + WABA with full control.
- **Generate token** → select your app → permissions: `whatsapp_business_messaging`
  and `whatsapp_business_management` → copy the token (this is `WHATSAPP_ACCESS_TOKEN`).

### 8. Collect the IDs
- **Phone number ID** and **WABA ID** are on the **API Setup** page.
- **App secret**: App dashboard → **Settings → Basic → App Secret**.
- **Webhook verify token**: any random string you invent — you'll reuse it when we
  register the webhook in Phase 3.

### 9. (Phase 3) Webhook + message templates
- We'll expose `POST /api/whatsapp/webhook` in the backend and register its public URL
  in **WhatsApp → Configuration** (use ngrok/Cloudflare Tunnel for local dev).
- Business-initiated messages outside the 24h window require **approved message
  templates** (created in **WhatsApp Manager → Message templates**). We'll add a few
  (new-listing alert, viewing reminder, follow-up).

---

## Pricing (so there are no surprises)
- Meta bills **per 24-hour conversation**, by category (marketing / utility / service /
  authentication), with rates varying by country. Service conversations have a free tier.
- A BSP adds its own per-message or monthly fee on top.
- Check the current Meta WhatsApp pricing page for UAE rates before launch.

## Multi-tenant note (for the SaaS)
When agencies onboard their own numbers, become a Meta **Tech Provider** and use
**Embedded Signup** so each agency connects their WABA to your app in a few clicks —
you never handle their tokens manually. We'll design Phase 3 to support this.
