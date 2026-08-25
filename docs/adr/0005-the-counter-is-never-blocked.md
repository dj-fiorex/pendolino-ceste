---
status: accepted
---

# The counter is never blocked

The app records what happens at the counter; it does not authorise it. When a scanned Cesta does not hold the state the app expected — it is Fuori with somebody else, or still in Attesa molitura — the app says so plainly and lets the Ritiro go through, writing a Rettifica that records the discrepancy.

The reasoning is that the physical event is already under way. The Cesta is in the yard, the Cliente is loading it, and there is a queue behind him on a day when 150 people come through. A validation that refuses the movement does not correct reality; it only removes the app from it, and an app that stands between five Operatori and their work on the busiest morning of the year stops being used that same morning.

There is a second reason, and it is the better one. A Cesta the app believes belongs to Tizio, being loaded onto Caio's trailer, is exactly the fact the mill has never been able to see. Blocking it throws that fact away and leaves the mill where it started. Recording it is the whole point of the project.

## Consequences

The database will hold sequences that look impossible if read as a ledger of authorised transactions — a Cesta going Fuori twice with no Rientro between, a Rientro from someone who never had a Ritiro. They are not corruption and must not be "repaired": they are the mill's actual year, and the attached Rettifica says what the app believed at the time.

Every read that counts Ceste therefore has to work from the current state of each Cesta rather than from a replay of its Movimenti, because the Movimenti are a record of events and not a balanced set of debits and credits.
