# Pendolino Ceste

Tracks the olive baskets of an oil mill: which baskets are out with which customer, which are available, and every movement in and out of the mill.

## Language

_Terms are the mill staff's own Italian words and are not translated in code. The English gloss is for readers only._

### Core

**Cesta** (basket):
A reusable container owned by the mill, in which a Cliente harvests and brings back olives. Tracked individually, identified by a `numero` unique across the whole fleet and worn on an Etichetta. Has a Portata and a Forma; the counter counts and hands out Ceste by Portata alone, and the Forma changes nothing there.
_Avoid_: Bin, bins, cassetta, crate

**Cliente** (customer):
Whoever takes empty Ceste away from the mill and brings them back loaded with olives for milling. Identified by name, by any Alias, and, where given, phone number. May or may not correspond to a record in the Gestionale; when it does, the two are tied by that record's `gestionaleId`.
_Avoid_: Utente, user, client

**Alias**:
A further name a Cliente is known by at the counter, used to tell namesakes apart. A Cliente may have several. Labelled *Soprannomi* on screen, because that is the counter's word; `alias` in code.
_Avoid_: Soprannome (in code), nickname, nomignolo, secondo nome

**Gestionale** (management software):
The invoicing software the mill already runs on an always-on PC, holding the customer registry they have always billed from. It sits upstream of this app and is never written to.
_Avoid_: ERP, management system, billing software, accounting system

**Campagna** (season):
One harvest and milling season. The unit the mill compares its numbers across ("how many Ceste went round in the 2025 Campagna against the 2026 one").
_Avoid_: Stagione, season, annata, year

### Fleet

**Censimento** (fleet registration):
The act of entering Ceste into the app, one or more at a time of the same Portata and Forma. A Cesta receives its numero and its Codice here, once and for good; a Cesta bought mid-Campagna goes through the same act.
_Avoid_: Registrazione, registration, creazione, import, onboarding

**Portata** (capacity):
The weight of olives a Cesta carries: 400 kg or 250 kg. The unit the counter counts Ceste in.
_Avoid_: Tipo, taglia, size, peso, capacità, dimensione

**Forma** (shape):
Quadrata or rettangolare, written `Q` or `R` in the Codice. It exists to be read off the Etichetta; it never filters a list or splits a count.
_Avoid_: Shape (in code), formato, modello

**Codice** (speaking code):
The string printed on a Cesta's Etichetta and carried by its QR code: Portata, Forma and numero, as in `400-R-017`. Readable by a person as much as by a camera; at the counter one types only the numero.
_Avoid_: ID, identificativo, matricola, sigla, targa

**Etichetta** (label):
The printed label each Cesta wears, carrying its QR code and its Codice in large type. Not the paper tape, which is the mill's own record of a Rientro and is never touched by the app.
_Avoid_: Targhetta, adesivo, sticker, tag, nastro

### Cesta states

**Disponibile** (available):
At the mill, empty, ready to be taken by the next Cliente.

**Fuori** (out):
In a Cliente's hands. The only state in which a Cesta can be lost or stolen, and therefore the state the whole app exists to keep an eye on.
_Avoid_: Prestata, on loan, borrowed

**Attesa molitura** (awaiting milling):
Back at the mill, still full, not yet emptied. About half the Ceste sit here for a day or two; the other half are emptied straight away. Recognisable in the yard by the paper tape the mill sticks on at Rientro with the Cliente's name on it.
_Avoid_: Rientrata piena, pending, queued

**Dismessa** (retired):
Broken or lost for good, and permanently out of the fleet. Distinct from Fuori: nobody is coming back with it.
_Avoid_: Deleted, cancelled, inactive

### Roles

**Operatore** (counter operator):
Mill staff who register Ritiri and Rientri at the counter during a Campagna. Holds an account in the app, which a Cliente never does.
_Avoid_: Utente, user, staff

**Admin**:
An Operatore who can additionally act on the fleet, the registry and the staff rather than only on the day's movements — linking a Cliente to a Gestionale record, recording a Rettifica, and inviting further Operatori.
_Avoid_: Titolare, owner, superuser

### Movements

**Movimento** (movement):
One Cesta changing state on one occasion — a Ritiro, Rientro, Svuotamento or Rettifica — recorded against that Cesta with who registered it and when. Six Ceste leaving together are six Movimenti.
_Avoid_: Transaction, event, operazione, azione

**Ritiro** (pickup):
A Cliente takes one or more empty Ceste away. Disponibile → Fuori.
_Avoid_: Uscita, consegna, delivery, loan

**Rientro** (return):
Ceste come back to the mill loaded with olives. Fuori → Attesa molitura.
_Avoid_: Restituzione, entrata, dropoff

**Svuotamento** (emptying):
The Cesta is tipped out at the mill and its paper tape comes off. Attesa molitura -> Disponibile.
_Avoid_: Scarico, unload, release, cesta vuota

**Rettifica** (adjustment):
A correction to a Cesta's whereabouts that no Ritiro or Rientro explains — a Cesta written off as lost, one that turns up again, or one whose last Movimento was registered wrongly. Carries a reason, because losing a Cesta to a Cliente, breaking one at the mill and mis-scanning one at the counter are different facts.
_Avoid_: Fix, correction, writeoff, annullamento

### Supervision

**Registro** (activity record):
The record of every action taken in the app — who did it, when, and what it changed. Read by Admin only.
_Avoid_: Log, audit log, audit trail, storico, cronologia, diario, attività
