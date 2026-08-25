# pendolino-ceste

## Language

**All code, documentation and comments are written in English.** This includes identifiers, file names, commit messages, ADRs and `CONTEXT.md`.

Two deliberate exceptions:

- **Domain terms stay Italian.** The terms in `CONTEXT.md` (`Cesta`, `Ritiro`, `Rientro`, `Attesa molitura`, `Campagna`) are the mill staff's own words, captured verbatim during requirements gathering. They are proper nouns: use them untranslated in identifiers, types and status values, so that what the app says matches what the counter says. Write the surrounding prose in English.
- **Text shown to the mill staff or to their customers is Italian.** UI copy, labels, error messages and the requirements questionnaire are written for an Italian-speaking frantoio. Their surrounding code and comments are still English.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `dj-fiorex/pendolino-ceste`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
