# Prototype: the Svuotamento tile screen (#30)

Throwaway. Answers the layout questions of issue #30 for the Svuotamento
screen specified in #18. Nothing here is meant to be merged; the verdict is
on #18 and this branch is the primary source.

Three variants of the same screen, switchable with the floating pill or the
`←` `→` keys, on `?variant=A|B|C`:

- **A — Griglia 64**: the #18 layout as written. Full-width group bars,
  64 px tiles, keypad in a side column (tablet) or a bottom drawer (phone).
- **B — Schede 96**: one Card per Cliente, 96 px tiles, keypad in a Dialog.
- **C — Per Cliente 80**: master/detail, one Cliente at a time, 80 px tiles.

## Run

From the repo root, on this branch:

```
npm run prototype:svuotamento
```

Then open <http://localhost:3000> for the phone/tablet harness, or
<http://localhost:3000/prototype/svuotamento> for the bare screen.

State is in memory and resets on reload or on switching variant. The
`screenshots/` folder holds what was judged.
