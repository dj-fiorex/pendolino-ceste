# Prototype: the app shell (#32, branch `prototype/app-shell`)

Throwaway. Nothing on this branch is meant to be merged: the winning variant
gets rewritten properly on `main`, and this branch stays as the primary source.

## The question

The app is a column of Cards in a `max-w-md` container on every screen, with a
"← Indietro" link back to a home that is a list of buttons. What should it be
instead — an app on the phone at the counter, and a dashboard on the PC the
Gestionale already runs on?

## What is here

Three shells and three homes, on the **real routes with the real data**. The
feature screens (Ritiro, Rientro, Svuotamento, Ceste, Clienti, recupero,
Registro) are the ones that ship; only the chrome around them and the home
change. Nothing writes: the variants are navigation and layout only.

The variant is kept on the device (not in the URL), so walking from the home
into a Ritiro stays inside the same variant. Flip with the pill at the bottom
or with the `←` `→` keys.

- **A — Banco.** Phone: a bottom tab bar over Banco, Ceste, Recupero and
  Altro. Desktop: a permanent sidebar with the screens in three groups. The
  home is a dashboard — four figures, the three Movimenti, the head of the
  Lista di recupero.
- **B — Azioni.** No permanent navigation: the three Movimenti live in the top
  bar, everything else behind one full-screen menu. The home is three doors
  the size of a hand, each carrying the figure it will work on, with the state
  of the frantoio beside them.
- **C — Stato.** The chrome carries the fleet: an icon rail, and on a wide
  screen a right-hand rail with Disponibili, Attesa molitura and chi è in
  ritardo. Registering is one round button that opens the three Movimenti. The
  home *is* the fleet, as three columns of where a Cesta can be.

## Run

```
npm run dev          # or npx next dev, if the deployment is already pushed
```

Then <http://localhost:3000>, signed in as an Operatore. Judge it at 375 px
and at desktop width, in both themes (the device decides the theme, as the app
does).

Without a session, <http://localhost:3000/prototipo> shows the same three
homes on invented figures — a peak-day frantoio rather than the handful of
Ceste the dev deployment holds. The shells around it are the real ones.

The dev deployment holds only a handful of Ceste and three Clienti, so the
lists are thinner than a peak day at the counter. Density on the busy screens
is better judged from `docs/screenshots/`.

## Files

Everything prototype is marked `PROTOTYPE (#shell)` in its header comment:

- `lib/prototype-shell.ts` — the variant, kept on the device
- `lib/prototype-nav.ts` — every screen, as a shell has to offer it
- `lib/prototype-home.ts` — what the three homes are built from
- `components/prototype/*` — the shells, the homes, the switcher
- `app/layout.tsx`, `app/page.tsx` — where they hang
- `app/prototipo/page.tsx` — the same homes on invented figures, no session
- every other `app/**/page.tsx` — the "← Indietro" link and the `CampagnaBar`
  removed, because the shell now carries both

## Verdict

**A — "Banco" wins, and ships as it is built here.** Nothing is taken from B
or C: the bottom tab bar over Banco, Ceste, Recupero and Altro on the phone,
the permanent sidebar in three groups on the desktop, and the dashboard home —
four figures, then the three Movimenti, then the head of the Lista di recupero
— are the shell.

Recorded by the owner on 4 September 2026, on #32. B and C stay here, with the
switcher, as the record of what was tried; A is rewritten properly on `main`,
without the variant machinery.
