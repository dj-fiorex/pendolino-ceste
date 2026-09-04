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

Some variables live on the Convex deployment rather than in `.env.local`:

```bash
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set RESEND_API_KEY re_...
npx convex env set RESEND_FROM "Pendolino Ceste <ceste@frantoio.example>"
```

The two Resend ones carry the mill's email: the invitation an Admin sends to a
new Operatore, and the link that replaces a forgotten password (ADR-0008).
`RESEND_FROM` has to be an address on a domain the Resend account has verified,
and defaults to Resend's own test sender. A deployment with no `RESEND_API_KEY`
runs and counts Ceste exactly as one with it — nothing sends, and an invitation
shows on the Operatori screen as one that never went out.

`.env.example` lists what belongs in `.env.local`.

## The first Admin

There is no public registration route: the sign-up endpoint is off, and every
account after the first arrives by an Admin's invitation. A fresh deployment is
opened by seeding one Admin, once:

```bash
npx convex run seed:createFirstAdmin \
  '{"name":"Gabriele","email":"gabriele@example.com","password":"..."}'
```

It refuses to run a second time. Everybody after that first Admin arrives by
invitation: an Admin invites them by email from **Gli Operatori**, they choose
their own password from the link, and an Admin sends the same kind of link
again when somebody forgets theirs. Nobody hands out a password, and an
Operatore who leaves is deactivated rather than deleted — they can no longer
sign in, and everything they registered stays under their name (ADR-0004).

The dev deployment named in `.env.local` already has its Admin:
`gabriele@frantoio.example`, password `olio-di-ottobre`. It is written down
because it opens nothing but a dev deployment full of test data, and a screen
nobody can sign in to is a screen nobody can check.

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
