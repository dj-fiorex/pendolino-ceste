---
status: accepted
---

# Every action is recorded twice: as Movimenti and as one Registro row

A Ritiro of six Ceste writes six Movimenti, because individual state is what makes a partial Rientro work (spec #1), and *also* one row in the Registro naming the action a person took. The Movimenti stay the domain record — every count and every Cesta's history reads them — and the Registro row is the human-readable grouping that the mill reads to answer "who did what on Tuesday". Every mutation that changes the domain writes a Registro row, whether or not it produces Movimenti; each Movimento carries the id of the row that produced it.

## Considered options

**A shared action id on the Movimento, no Registro row for movements.** The six Movimenti of a Ritiro would carry the same action id, and the Registro screen would be built at read time by merging grouped Movimenti with the non-Movimento actions (Cliente edits, Campagna open and close, staff changes), which need a table of their own regardless. Rejected because the Registro would then be two sources of two shapes: every filter written twice, every row rendered from a different record, and a mutation that forgets to stamp the action id leaves no trace at all.

## Consequences

Operatore, Cliente, Campagna and time are stored both on the row and on each of its Movimenti. The duplication is harmless: both are immutable (ADR-0004) and cannot diverge.

The rule "every mutation that changes the domain writes a Registro row" has no half-true moment. Each ticket that adds a mutation adds its row in the same change, not in a later sweep.
