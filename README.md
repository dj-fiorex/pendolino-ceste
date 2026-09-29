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
pnpm install
pnpm convex dev --once          # push the schema and functions, write .env.local
pnpm dev                        # Next on :3000 and `convex dev` side by side
```

Some variables live on the Convex deployment rather than in `.env.local`:

```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
pnpm convex env set RESEND_API_KEY re_...
pnpm convex env set RESEND_FROM "Pendolino Ceste <ceste@frantoio.example>"
pnpm convex env set RESEND_TEST_MODE false
pnpm convex env set TWILIO_ACCOUNT_SID AC...
pnpm convex env set TWILIO_API_KEY_SID SK...
pnpm convex env set TWILIO_API_KEY_SECRET ...
pnpm convex env set TWILIO_AUTH_TOKEN ...
pnpm convex env set TWILIO_TEST_MODE false
```

The Resend ones carry the mill's email: the invitation an Admin sends to a new
Operatore, and the link that replaces a forgotten password (ADR-0008).
`RESEND_FROM` has to be an address on a domain the Resend account has verified,
and defaults to Resend's own test sender. A deployment with no `RESEND_API_KEY`
runs and counts Ceste exactly as one with it — nothing sends, and an invitation
shows on the Operatori screen as one that never went out.

`RESEND_TEST_MODE=true` says the deployment is only pretending. The invitation
is written and its message built exactly as it would be, but nothing is handed
to Resend: the link goes to the Convex logs, where whoever is trying the flow
reads it, and the Operatori screen says the email was not sent rather than
leaving an Admin waiting on one nobody will get. It needs no `RESEND_API_KEY`,
which makes it what a development deployment wants. Anything other than `true`
or `false` is refused, and the refusal reaches the Admin on the same screen: a
typo that quietly posted real mail, or quietly swallowed an invitation, is
worse than one that says so.

The Twilio ones carry the mill's SMS: the receipt a Ritiro and a Rientro send
to the Cliente, and the messages an Admin writes by hand from **Gli SMS** or
from a Cliente's own page.

Sending is done with an API key — `TWILIO_API_KEY_SID` and
`TWILIO_API_KEY_SECRET` — against the account named by `TWILIO_ACCOUNT_SID`.
Two credentials and not one, because a key is revoked and reissued from the
Twilio console in a minute, while the account's auth token opens the account
itself. `TWILIO_AUTH_TOKEN` is set all the same, and does one job: Twilio signs
its delivery callbacks with the account token and with nothing else, so a
deployment without it sends every message perfectly well and never learns which
of them arrived.

What the Cliente sees in place of a sender is not an environment variable: it
is the **Mittente**, which an Admin settles on **Il frantoio** and which lives
in the database with the mill's name and telephone (ADR-0011). The three
credentials above stay on the deployment because leaking one costs money; the
Mittente is public by definition — every Cliente reads it off their telephone —
and a mill should be able to correct its own name without a deploy.

A Mittente is at most eleven characters, letters, digits and spaces with at
least one letter, which Italy needs no registration for and which costs
nothing, there being no telephone number to rent to carry it. The trade is that
a name is one-way: nobody can reply to it, and Twilio's own STOP handling does
not apply, so the Cliente who asks not to be written to is marked `smsOptOut`
in the registry and nowhere else. Until an Admin has settled one, both
automatic messages refuse to be switched on and a message written by hand is
refused as it is sent. `TWILIO_TEST_MODE=true` works exactly as
`RESEND_TEST_MODE` does: the message is written down and built, nothing is
handed to Twilio, and the row says it was not sent. A deployment with no Twilio
account counts Ceste exactly as one with it — the Ritiro is registered, the
message is written down, and the row says it never left. Nothing at the counter
ever waits on a carrier (ADR-0005).

Both automatic messages start switched off, so that trying the app out does not
text two hundred farmers. An Admin turns each one on from **Gli SMS**, where the
words are edited and previewed first.

`.env.example` lists what belongs in `.env.local`.

## The first Admin

There is no public registration route: the sign-up endpoint is off, and every
account after the first arrives by an Admin's invitation. A fresh deployment is
opened by seeding one Admin, once:

```bash
pnpm convex run seed:createFirstAdmin \
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
pnpm test
```

Tests drive the app through its public Convex functions with `convex-test` under
Vitest, and assert on what those functions return. That boundary is the only
seam this suite uses: no table reads, no mocks, no React.

## Typechecking

```bash
pnpm typecheck
```
