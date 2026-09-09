---
status: accepted
---

# Movimenti require server confirmation

Pendolino is installable from the website, but a Movimento is shown as recorded only after server confirmation. This version preserves unfinished Ritiro, Rientro and Svuotamento input across connection loss and app closure, with photos and signatures captured again; it does not introduce durable offline submission. This keeps recovery of unfinished work separate from reconciling movements submitted by multiple disconnected devices and deciding when their Sms should be sent.

An offline launch shows a connection message and retry; saved work becomes recoverable after reconnection. The counter policy in ADR-0005 still permits discrepant basket states: it does not promise that the app can confirm a Movimento without reaching the server.
