# Conferimento in frantoio

Design confirmed by the user and implemented.

## Agreed

A Cliente brings olives by tractor or other means and deposits them into Ceste
already at the Frantoio. Those Ceste have not been taken away. This is an
ordinary Movimento named **Conferimento in frantoio**, distinct from a Rientro
and from a Rettifica. Its normal transition is Disponibile → Attesa molitura,
with the Ceste attributed to the selected Cliente.

The screen reuses Rientro's layout and controls, with the selection behavior
described below. Selecting a Cliente is mandatory.
A Conferimento in frantoio sends no Sms; the initial flow has no Sms option.

The alternative considered was a per-Rientro checkbox suppressing its Sms.
The explicit flow was chosen because it records what happened to Ceste that
never left the Frantoio, without treating that ordinary event as a discrepancy.

## Operator flow

Conferimento in frantoio has its own navigation entry alongside Ritiro,
Rientro and Svuotamento.

1. The Operatore selects the Cliente.
2. Starting from an empty selection, the Operatore adds the filled Ceste by
   scanning their QR codes or entering their numbers. The screen uses the same
   scanner, number entry and selectable tiles as Rientro.
3. The Operatore confirms the Conferimento in frantoio. The selected Ceste
   enter Attesa molitura attributed to that Cliente, subject to the existing
   discrepancy rules below. No Sms is sent.

The screen does not infer the Cliente from a scanned Cesta, preload that
Cliente's Ceste Fuori or warn about Ceste remaining Fuori. Those Ceste may still
be in the fields and do not belong to this Conferimento in frantoio.

## Existing rules to preserve

ADR-0005 applies to unexpected Cesta states: warn, record the discrepancy and
let the Operatore record the physical event. A Conferimento should not offer
only Ceste the app believes are Disponibili, since that would prevent recording
discrepancies. Dismessa retains its existing special handling; restoring a Cesta
to the fleet remains an Admin's Rettifica.

## Implementation implications

Attesa molitura must use the latest relevant Rientro or Conferimento to date
the wait. Likewise, correcting an erroneous Svuotamento must recover the Cliente
from either kind of movement. History and Registro must name the new movement
explicitly, and automatic Sms dispatch must remain limited to Ritiro and Rientro.

The waiting-list API retains its existing `oldestRientro` field for older
clients, but its value now accounts for both kinds of arrival.

## Verification

Tests use the existing public Convex operations and queries to verify state,
Cliente attribution, Registro, discrepancy handling, authorization, absence of
Sms and recovery after an erroneous Svuotamento. Component tests drive the real
selection controls against a simulated Convex boundary, including duplicate
entry, changing Cliente, errors and pending registration. Existing Rientro
tests exercise the shared screen alongside the new flow.
