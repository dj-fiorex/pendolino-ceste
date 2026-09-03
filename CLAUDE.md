# pendolino-ceste

## Language

**All code, documentation and comments are written in English.** This includes identifiers, table and field names, route paths, file names, commit messages, ADRs and `CONTEXT.md`.

Two deliberate exceptions:

- **Domain terms stay Italian.** The terms in `CONTEXT.md` (`Cesta`, `Ritiro`, `Rientro`, `Attesa molitura`, `Campagna`) are the mill staff's own words, captured verbatim during requirements gathering. They are proper nouns: use them untranslated in identifiers, types and status values, so that what the app says matches what the counter says. Write the surrounding prose in English.

  The exception covers those terms and nothing else. An Italian word `CONTEXT.md` does not define is not a domain term, it is a coinage — `flotta` for the set of Ceste, say — and a coinage gives the codebase a second vocabulary the mill never uses. Reach for the term the glossary already has (`Cesta`), or, where the concept is not a domain one at all, for the English word. A concept that is genuinely missing from the glossary is a gap to raise with `/domain-modeling`, not a licence to name it yourself.

- **Text shown to the mill staff or to their customers is Italian.** UI copy, labels and error messages are written for an Italian-speaking frantoio. Their surrounding code and comments are still English.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `dj-fiorex/pendolino-ceste`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
