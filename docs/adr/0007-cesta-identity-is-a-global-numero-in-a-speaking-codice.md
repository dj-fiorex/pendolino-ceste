---
status: accepted
---

# Cesta identity is an app-generated global numero, printed as a speaking Codice

ADR-0001 fixed *that* every Cesta is identified and left open how. The mill has since said how it wants the labels made: the app assigns each identity at Censimento, produces the Etichette as a PDF, and a tipografia prints them. So each Cesta receives a `numero` that is unique across the whole fleet and never reused, and its Etichetta shows that numero inside a speaking Codice — `<portata>-<forma>-<numero>`, as in `400-R-017` — so that what the label says, what the QR carries and what the counter types all agree.

The numero is the identity. The Codice is a description of the Cesta wrapped around it, generated once at Censimento and never recomputed, and it is the string the QR code carries. At the counter an Operatore types only the numero and the app echoes the full Codice.

## Considered options

**Numbering that restarts per kind** — `400-R-1`, `400-Q-1`, `250-1` — which is what the mill first proposed and how the codes read most naturally. Rejected because the number alone then names three Ceste, so manual entry needs either the whole Codice typed or a Portata/Forma selector beside the number field. A selector remembers its last value, and on a busy morning a `250-12` typed while the selector still says `400-R` attributes the wrong Cesta to the Cliente silently, with nothing on screen to catch it. A global numero has no such failure mode, and costs only that the first 250 kg Cesta is called `250-Q-171` rather than `250-1`.

**The QR carrying a URL** rather than the bare Codice, so that a phone's own camera would open the Cesta's page. Rejected because ~195 physical labels would then be tied to a domain, while the app's own lookup by numero already answers "where is this one".

## Consequences

The Forma is on the label and therefore in the model, although the counter ignores it: it never filters a list or splits a count. Counts stay by Portata.

Codes are printed, so they are immutable and never reused: a Cesta that becomes Dismessa keeps its numero forever (ADR-0004) and a replacement takes the next one. The sequence is generated inside the Censimento mutation, which Convex runs transactionally, so a batch of a hundred is one mutation and one gap-free run of numbers.

Labelling the fleet is still the blocking prerequisite ADR-0001 named, but it now sits *after* the Censimento screen rather than beside it: the PDF is the fleet, and the tipografia's turnaround belongs on the schedule before the Campagna opens. ADR-0001's original account of the owner labelling the fleet himself with bought numbers was written before this was known — no numbers were ever bought — and has been corrected there.
