---
status: accepted
---

# Accounts live in Better Auth on Convex, with invitations and resets by email

Every Movimento is attributed to the Operatore who registered it (ADR-0006), so every Operatore holds a personal account under their own email. Accounts are handled by Better Auth running as a Convex component: email and password to sign in, a session that outlives the Campagna, and two emailed links — the invitation an Admin sends to a new Operatore, and the reset an Admin sends when somebody forgets their password. Emails go out through Resend. There is no self-service reset: the mill's staff do not read email in the yard, and the Admin is standing next to them.

Roles are the app's own concern. `Operatore` and `Admin` are stored on the app's staff record, not in the auth provider, and an Admin can promote another Operatore to Admin so that no single account is a point of failure.

## Considered options

**Clerk** — hosted invitation and reset flows, a ready-made UI and a dashboard. Rejected because it puts the mill's staff list in a third party's dashboard, adds a second place where an account can be edited, and its pricing and UI are sized for products with far more than five users.

**Convex Auth** — the first-party library, now in maintenance. Rejected because a library that is no longer moving is a migration waiting to happen, and an auth migration is the one this project can least afford at the opening of a Campagna.

## Consequences

Inviting and resetting both depend on email delivery working, so a Resend failure is visible to the Admin as an unsent invitation, never to the counter: a signed-in device keeps working with no network call to the auth provider on every action.

The session lifetime is set long enough to span a Campagna (180 days), so that a password is typed once in October and not again until spring. A lost phone is handled by the Admin deactivating that account (ADR-0004), not by a short session.
