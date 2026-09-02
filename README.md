# Pendolino Ceste

Tracks the olive Ceste of an oil mill: which ones are out with which Cliente,
which are available, and every movement in and out of the mill.

Start with [`CONTEXT.md`](CONTEXT.md) for the mill's own vocabulary and with
[`docs/adr/`](docs/adr) for the decisions behind the shape of the app.

## Stack

A Next.js PWA, Tailwind and shadcn/ui on the front, Convex for data and
functions, and Better Auth as a Convex component for accounts (ADR-0008). UI
copy is Italian; code, comments and docs are English.

## Running it

```bash
npm install
npx convex dev --once          # push the schema and functions, write .env.local
npm run dev                    # Next on :3000 and `convex dev` side by side
```

Two variables live on the Convex deployment rather than in `.env.local`:

```bash
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

`.env.example` lists what belongs in `.env.local`.

## The first Admin

There is no public registration route: the sign-up endpoint is off, and every
account after the first arrives by an Admin's invitation. A fresh deployment is
opened by seeding one Admin, once:

```bash
npx convex run seed:createFirstAdmin \
  '{"name":"Gabriele","email":"gabriele@example.com","password":"..."}'
```

It refuses to run a second time.

## Tests

```bash
npm test
```

Tests drive the app through its public Convex functions with `convex-test` under
Vitest, and assert on what those functions return. That boundary is the only
seam this suite uses: no table reads, no mocks, no React.

## Typechecking

```bash
npm run typecheck
```
