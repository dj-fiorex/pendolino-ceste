---
status: accepted
---

# Mirror the Gestionale customer registry into Convex, one way

The mill keeps every customer it has ever billed in its Gestionale, on a PC that stays on around the clock. Rather than have the counter retype names that already exist, a daemon on that PC pushes customer records into Convex, keyed by each record's `gestionaleId`.

The communication is one way and always will be. The daemon reads the Gestionale and writes to Convex; nothing ever travels back. The credentials it uses are read-only, because the database it reads is the one the mill invoices from and a bug that writes there is a debt this project cannot repay.

The app itself never talks to the Gestionale — not at startup, not at the counter, not at all. It reads Convex and only Convex. The daemon is therefore not a dependency of the app but a feed into it, and the counter keeps working unchanged when the PC is off, the daemon is dead, or the mill's network is down. A stale registry costs nothing, because a Cliente can always be created at the counter without one.

## Considered options

**A one-shot CSV import before each Campagna.** Cheaper, with no runtime dependency on a machine we do not control, and its marginal loss looked small: the Gestionale only learns of a new customer at milling time, by which point that person already exists in this app with their Ceste attached, so a live feed mostly returns people the app already knows. It was rejected in favour of the live daemon so that the registry stays current on its own, without a manual step to remember each season.

## Consequences

A Cliente created at the counter and a Gestionale record for the same person are two separate rows until somebody says otherwise. They are linked by an Admin on a dedicated screen, where the sync surfaces likely duplicates that carry no `gestionaleId`. Nothing is ever merged automatically: linking the wrong two people would attach one Cliente's Ceste to another, which is the exact harm this app exists to prevent.

The mirror's columns and the app's own columns are kept apart rather than reconciled. Whatever the daemon writes belongs to the daemon and the app never edits it; whatever the counter collects belongs to the app and the daemon never sees it. A phone number is therefore two fields, not one contested field, and the app shows the counter's if there is one. This is deliberately not a conflict-resolution strategy: there is no conflict to resolve, no record of who last touched which field, and no way for a sync to quietly undo a correction an Operatore made at the counter — which is what any single-column design would eventually do, on a busy day, to a phone number somebody had just fixed.

A Cliente that disappears from the Gestionale is marked inactive and nothing else about it is touched. It is never deleted, and least of all when it has Ceste Fuori: an archived old record in the mill's invoicing software says nothing about whether that person is currently holding three Ceste, and a cascading delete would drop them out of the count silently, which is the one failure this app cannot afford. The daemon treats an absence as *I no longer know*, never as *this person does not exist*.

Which fields the mirror carries is not settled here, and waits on seeing the Gestionale's actual schema. The standing constraint is to carry the fewest that make the counter work — this is a third party's customer registry being copied into a cloud database, and every column copied is a column to account for.
