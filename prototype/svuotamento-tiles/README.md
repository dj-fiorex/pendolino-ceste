# Prototype: the counter screens (#30, #31)

Throwaway. Nothing here is meant to be merged; this branch is the primary
source and the verdicts live on the issues.

## Svuotamento (#30)

Answers the layout questions of issue #30 for the Svuotamento screen
specified in #18. Three variants of the same screen, switchable with the
floating pill or the `←` `→` keys, on `?variant=A|B|C`:

- **A — Griglia 64**: the #18 layout as written. Full-width group bars,
  64 px tiles, keypad in a side column (tablet) or a bottom drawer (phone).
- **B — Schede 96**: one Card per Cliente, 96 px tiles, keypad in a Dialog.
  _Chosen for #18._
- **C — Per Cliente 80**: master/detail, one Cliente at a time, 80 px tiles.

## Reference screens for the preventivo (#31)

Same typography, tiles and themes as variant B above, fake data from
`lib/prototype-fuori.ts`. Three structurally different variants per screen,
on `?variant=A|B|C` (names in `lib/variants.ts`):

- `/prototype/ritiro` — Ritiro with the warning at the counter (#16, #22, #23).
  **A** scanner on top, warning as an Alert, list as rows · **B** list as
  96 px tiles, scanner thumbnail docked at the bottom, warning as a strip
  of chips · **C** camera edge to edge, this Ritiro and the Ceste already
  Fuori as two lists. Manual entry everywhere is the "Numero" key of #18:
  the keypad in a Dialog with the Codice echoed, never the device keyboard.
- `/prototype/recupero` — the recovery list (#22, Admin). **A** one card per
  Cliente with Codici as chips · **B** a table, Codici behind a chevron ·
  **C** three bands by days Fuori, a days tile and a round call button per row.
- `/prototype/etichetta` — the Etichette PDF preview (#29). **A** one page
  centred · **B** the range as a sheet of labels with the Admin settings
  beside it · **C** the fleet as a tick list with the ticked label previewed.
  `/prototype/etichetta/stampa` renders the single label at 300 dpi
  (1181 × 1772 px) for the print-proportion PNG.
- `/prototype/rientro` — Rientro with a partial return (#17, story 24).
  **A** scanner on top, Ceste as rows to tick · **B** Ceste as tiles, scanner
  docked at the bottom · **C** camera edge to edge, "Rientrano" and "Restano
  Fuori" as two lists a tap moves Ceste between.

Every screen takes `?tema=scuro` for the dark theme and `?embed=1` to hide
the switcher.

## Run

From the repo root, on this branch:

```
npm run prototype:svuotamento
```

Then open <http://localhost:3000> for the phone/tablet harness (pick the
screen, the device and the theme at the top), or `/prototype/<screen>` for
the bare screen at the window's own size.

State is in memory and resets on reload or on switching variant. The
`screenshots/` folder holds what was judged for #30; the #31 set is on
`main` under `docs/screenshots/`.
