# Dubai AI Broker — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind, with Framer Motion animations,
Recharts dashboards, and a Leaflet UAE market map.

## Run

The **backend must be running** first (see `../backend/README.md`, default `http://localhost:8000`).

```bash
cd frontend
npm install
copy .env.local.example .env.local   # PowerShell:  Copy-Item .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000** → log in with the demo account **demo@demo.ae / demo12345**.

`.env.local` controls the backend URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Pages

- **/** — animated marketing **landing page** (hero, features, CTA).
- **/login** — agency login / signup (animated, toasts).
- **/dashboard** — live stat cards, animated **UAE market map** (inventory + avg price by
  area), 30-day lead trend, avg price by area, leads by stage, inventory by type.
- **/pipeline** — kanban board; add leads, move them through stages.
- **/search** — conversational AI property search.

## Design system

- **shadcn/ui-style** components in `components/ui/` (Button, Card, Input, Badge) built on
  Radix + class-variance-authority + `cn()` (Tailwind merge).
- Design tokens (CSS variables) in `app/globals.css`; premium dark theme with brand glow.
- Framer Motion animations, `sonner` toasts. Add more shadcn components later with
  `npx shadcn@latest add <name>`.

## Notes

- Auth is a JWT kept in `localStorage`; `lib/auth.tsx` guards the `(app)` routes.
- All data comes from the FastAPI backend via `lib/api.ts`.
- The map is `react-leaflet` rendered client-side only (`next/dynamic`, `ssr:false`)
  using free CARTO dark tiles + OpenStreetMap — no API key needed.
