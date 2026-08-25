---
status: accepted
---

# Track each Cesta individually rather than counting them by size

The mill's central problem is Ceste that never come back, and they have never had any way to say *which* one is missing or *who* still has it. Asked directly whether they cared about which Cesta a Cliente holds or only how many, they chose which. So every Cesta is a tracked entity with its own identity, and a Ritiro records the specific Ceste that left, not a quantity per size.

## Considered options

**Counting by size** — a Cliente owes N Ceste of 400 kg and M of 250 kg, with no identity per container. This is markedly cheaper: nothing to label, nothing to scan, and a Ritiro is two numbers typed in. It was rejected because it cannot answer the one question the mill actually has. A count tells you a Cliente is three Ceste short; it cannot tell you which three, cannot survive a Cliente disputing the tally, and cannot distinguish a Cesta lost in the field from one broken at the mill.

## Consequences

Identity has to come from somewhere, and today it does not exist: **no Cesta is marked or numbered**. The owner has bought the numbers and will label the fleet himself, with a printed number plus a QR code on each Cesta. That labelling is a hard prerequisite — until the whole fleet is labelled the app has nothing to track, so it belongs on the schedule as a blocking task before the Campagna opens, not as a nice-to-have.

Individual identity also puts pressure on the counter. On a peak day around 150 Clienti pass through and a Ritiro has to take seconds. Capturing identity for each Cesta is inherently more work than typing a count, and how much more depends on how many Ceste a single Cliente takes at once — still an open question with the mill.

This decision fixes *that* Ceste are identified, not *how* identity is captured at the counter. Scanning each QR one at a time, entering a range of numbers, and scanning one Cesta then confirming a count are all still open, and any of them can be chosen later without reopening this ADR.
