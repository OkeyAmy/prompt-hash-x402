## PromptHash (Stacks + x402 + Supabase)

PromptHash is a Stacks-native prompt marketplace built on Next.js. Sellers list prompts in Supabase, buyers browse listed metadata publicly, and premium prompt content is gated behind x402 payment challenges (STX / sBTC).

## Stack

- Frontend: Next.js (App Router) + React + Tailwind
- Wallet: `@stacks/connect` (Leather / Xverse compatible)
- Data store: Supabase (Postgres + RLS)
- Payments: `x402-stacks` with facilitator settlement

## Environment

Copy `.env.example` to `.env.local` and fill values.

```bash
cp .env.example .env.local
```

Required vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NETWORK` (`testnet` or `mainnet`)
- `FACILITATOR_URL`
- `SERVER_ADDRESS`
- `SERVER_PRIVATE_KEY` (server-side only)

## Supabase migration

Apply SQL migration:

- `supabase/migrations/20260210_marketplace.sql`

This creates:

- `prompts` table
- `purchases` table
- required indexes
- RLS and column grants so public can only read listed prompt metadata (not `paid_content`)

## Run

```bash
npm install
npm run dev
```

App URL: `http://localhost:3000`

## API routes

- `GET /api/prompts`
  - Public browse metadata only:
  - `id,title,description,image_url,category,price_base_units,currency,seller_wallet,is_listed`

- `POST /api/prompts`
  - Create listing (seller wallet required in header + payload)

- `PATCH /api/prompts/:id`
  - Update listing (seller-only)

- `GET /api/prompts/:id/content`
  - x402-protected premium content route
  - Unpaid: returns `402` + `payment-required` header
  - Paid retry: accepts `payment-signature`, settles via facilitator, returns premium content and writes purchase row

## Wallet behavior

Client wallet layer is implemented with `@stacks/connect` APIs:

- `connect()`
- `isConnected()`
- `disconnect()`
- `request()`

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY`, `SERVER_PRIVATE_KEY`, and `CLIENT_PRIVATE_KEY` are never exposed to browser bundles.
- Use wallet-based signing for real users.
- `CLIENT_PRIVATE_KEY` is for local automation only.

## Removed legacy stack

- Legacy EVM wallet SDK removed
- MongoDB removed
- Legacy EVM contract flow removed
