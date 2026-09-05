---
status: accepted
---

# A telephone is validated where it is typed

The registry's telephone existed to be dialled. Whatever the counter wrote down was good enough, because a person read it back off the screen and a person can read past a missing digit or a note to himself. Now the app sends an Sms to that field, and a number a person reads past is a number the carrier silently refuses. So the Cliente form refuses a telephone it cannot parse, the mutation behind it refuses the same, and what parses is stored as E.164.

This is the one field in the app that argues with ADR-0005, and it is worth saying why the argument is safe: the field may be empty. A Cliente with no telephone is an ordinary Cliente, on the Lista di recupero like any other and simply not textable, so the Operatore at the counter with a queue behind him is never held up — he leaves it blank and moves on. What he cannot do is store four digits and a shrug. The rule bites only on somebody who typed something wrong, at the moment they can still ask the man in front of them.

The alternative was to accept anything and sort it out at send time, which is what a mill with two thousand rows already in its registry would have had to do. This one has none: the decision is cheap only because it was taken before the first Campagna, and taking it later would have meant guessing at what "347 12345" was supposed to be.

## Consequences

A landline is a valid telephone and is stored and dialled like any other; it is the Sms that refuses it, as _numero fisso_, recorded on the send. Numbers are held as E.164 and shown in national form, so what the app dialled and what the counter reads are the same number in two costumes.

The rule is the mill's own, written once and shared between `lib/` and `convex/` rather than taken from a library: Italian numbering is small enough that the edge cases a library gets right are ones this mill will not see, and the counter's phone should not carry 145 kB to learn them. It runs in the form and in the mutation both — the form tells you before you press, the mutation refuses regardless.
