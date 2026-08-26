# Preventivo

The commercial proposal for the mill, written in Italian for the customer.

| File | What |
| --- | --- |
| `preventivo-pendolino-ceste.html` | Source. One `<section class="page">` per printed A4 page, header and footer included; styled after the Fil Rouge proposal (`DB-2026-FR-002`). |
| `preventivo-pendolino-ceste.pdf` | The export, regenerated from the source with the command below. |

## Screenshots

Figures point at `docs/screenshots/<screen>/…png`. A file that does not exist yet is
replaced at load time by a dashed placeholder of the same proportions, so the PDF can be
exported before every prototype has been captured. All five sets are in; the Ritiro,
recupero, Etichetta and Rientro sets came from #31 under these names:

- `docs/screenshots/ritiro/ritiro-telefono-avviso.png`
- `docs/screenshots/rientro/rientro-telefono-parziale.png`
- `docs/screenshots/recupero/recupero-telefono-elenco.png`
- `docs/screenshots/etichetta/etichetta-stampa-400-R-017.png`

If a screenshot is retaken, re-export; nothing in the HTML needs to change.

## Export

Headless Chrome, from this directory:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 \
  --print-to-pdf="$PWD/preventivo-pendolino-ceste.pdf" \
  "file://$PWD/preventivo-pendolino-ceste.html"
```

To eyeball the pages without a PDF viewer, `--screenshot` at `--window-size=794,<1123 × pages>`
gives one tall PNG that splits cleanly every 1123 px.

## Before sending

Update on the cover and on the signature page: the date. The reference is `DB-2026-GB-001`,
the validity 30 days from the date shown.
