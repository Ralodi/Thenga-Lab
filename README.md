# THENGA

THENGA is a delivery platform with three app surfaces in one React frontend:

- Customer App (`/`)
- Driver App (`/driver-dashboard`)
- Admin Dashboard (`/admin-dashboard`)

It integrates with Supabase (database, auth, storage, edge functions).

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (cart state)
- Supabase JS client
- Supabase Edge Functions (`create-order`, `calculate-distance`)

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
copy .env.example .env
```

3. Fill `.env` values for your Supabase project.

4. Start dev server:
```bash
npm run dev
```

5. Build for production check:
```bash
npm run build
```

## Required Supabase Setup

Run SQL files in Supabase SQL Editor:

- `supabase/catalog_phase1.sql`
- `supabase/offers.sql`
- `supabase/driver_profiles.sql`
- `supabase/delivery_proofs.sql`
- `supabase/loyalty_points.sql`

Then deploy edge functions with latest code:

- `supabase/functions/create-order/index.ts`
- `supabase/functions/calculate-distance/index.ts`

## Key Features

- Area + wholesaler based customer browsing
- Delivery fee by distance
- Loyalty points earn + redeem (`R0.33` per point)
- Bonus campaign points from active offers
- Driver order acceptance and proof-of-delivery upload
- Admin product, wholesaler, driver, and offer management

## Security Notes

- Do not commit real `.env` files
- Use `.env.example` for shared config shape
- Rotate Supabase keys if previously exposed in history

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - ESLint checks
- `npm run preview` - Preview production build

## Production Readiness Checklist

- [ ] All required SQL migrations executed
- [ ] Edge functions deployed and tested
- [ ] Test modes disabled in `.env.production`
- [ ] RLS policies verified for storage uploads
- [ ] Manual end-to-end tests for customer, driver, admin flows
