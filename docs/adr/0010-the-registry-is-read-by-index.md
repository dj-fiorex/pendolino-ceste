---
status: accepted
---

# The registry is read by index, and written in one casing

The Clienti table was read whole. Every search, every namesake check, every import batch pulled the entire registry into memory and filtered it there, and `convex/clienti.ts` said so in as many words: a few hundred names on one counter, matched with `includes` so that a fragment anywhere in a name or a Soprannome would find somebody — and a note that a registry of thousands would be the point to revisit it.

The OleaPlus import made it thousands. 2,919 Clienti, about 478 kB read on every invocation of a query that re-runs on every keystroke at the counter. So: the registry is read by index now.

Three reads replace the one. The box at the counter reads a Convex search index over a Cliente's name and every Alias on one line, filtered on `active` in the index rather than after it. An empty box — which browses rather than searches, because the same box does both — reads the head of `by_active_and_name`, since a search index has no answer to an empty question. And the namesake rule reads `by_comparableName`, an index over the stored form of the name-comparison rule the app already had. All three take twenty rows or fewer.

## What the counter loses

**Search matches the start of a word now, not the middle of one.** Typing `cipo` still finds Cipolla Giuseppe, and `pilo` still finds the man the counter calls *u' pilota*. Typing `polla` finds nobody. That is a real loss and it is the price of the index: a full-text index is built on where words begin, and no index can be built on "anywhere inside a string" — the only way to answer that question is to read every string, which is the thing being paid for.

It is the smaller half of what the old search was for. Somebody half-remembering a Soprannome starts at the start of it; the substring match was reaching a case nobody had asked for. If the mill turns out to want it back, the honest answer is a second, narrower read — not the whole table again.

**Twenty results are the search index's twenty, not the alphabet's first twenty.** The old search filtered the registry in name order and took the first twenty of that; the new one takes twenty by relevance and then sorts them, so the list still reads in name order but a different twenty can be in it. The picker already tells the counter what to do about that — *ce ne sono altri: scrivi qualche lettera in più*.

## What it costs to keep

Two fields on every Cliente, `comparableName` and `searchableNames`, both derived and neither ever typed. They are written through one function, `indexedNames` in `convex/schema.ts`, spread into every insert and every patch that touches a name or an Alias, so that no write path can rename somebody and leave them findable under the old name. The rule that compares two names stays where it was, in `convex/schema.ts`, shared by the mutation and the form (ADR-0009 has the same shape for the telephone); the index is that rule stored rather than a second copy of it.

The namesake invariant is untouched. Two Clienti still never share a name with no Alias to tell them apart, and a deactivated Cliente still counts as a namesake (ADR-0004) — which is why `by_comparableName` carries no `active` and the search index does. That read still collects without a bound, and is the only one in the app that does: it is bounded by the invariant it enforces, because a name reaches as many rows as the counter has Soprannomi for it. The mill's worst is eight men called Cipolla Giuseppe.

## And the registry is written in one casing

The import wrote names as OleaPlus holds them, in capitals, and the counter wrote them as somebody typed them. A registry in two voices is a list read twice, and worse, `by_name` orders on the stored string — so the couple of dozen rows typed in lowercase sorted past Z and sat at the bottom of a list ordered by name.

One rule for all of it: every word capitalised and nothing else, so that MARIO ROSSI from the Gestionale and `mario rossi` typed at the counter both become Mario Rossi. It runs on the way in — `properName`, beside `tidy` and `comparableName` — and it touches casing and nothing else. It is deliberately invisible to the namesake rule, because `comparableName` lowercases: re-casing the registry moves nobody in or out of anybody else's namesakes, which is what makes it safe to rewrite 2,919 existing rows in place.

A Soprannome is not capitalised. It is what somebody is called rather than what they are named, and *u' pilota* shouted back as *U' Pilota* is not the same word.

## Consequences

The rows already in the database need the two new fields and the new casing. `convex/backfill.ts` does it in pages of two hundred, scheduling the next page as it finishes one, and is safe to run twice or to stop halfway; it writes no Registro rows, for the reason the import writes none (ADR-0006). Both fields are declared optional so that the deploy does not have to wait for it, and that is the one window this change opens: until the backfill has been through a row, that Cliente carries neither field, so the box at the counter cannot find them and the namesake rule cannot see them. Nobody is lost — `clienti.get` and the Lista di recupero read by id and are untouched — but a duplicate could be created in that window. It is minutes wide. Deploy and backfill go together, and neither goes during a queue.

The import in `convex/gestionale.ts` no longer keeps its own copy of the registry to check batches against. It does not need one: a Convex mutation reads its own writes, so two rows of the same batch are namesakes of each other through the index, exactly as they were through the array.

## Search refinement, 2026-09-19

Search now requires every word across the name and Alias, in any order. Completed words match exactly; the final word can be a prefix. Case and punctuation do not distinguish words, trailing whitespace is ignored, and accents remain significant.

The twenty-row read described above now applies to each candidate page, rather than the whole search. Convex still selects candidates with OR semantics. The backend replaces rejected candidates with null and preserves each page's continuation cursor, including when no candidate matches. Null slots let the picker count candidates without receiving rejected clients' details. The picker continues until it has twenty matches, exhausts the candidates, or has requested ten pages. After ten pages it offers "Continua a cercare" and says the search is unfinished. A new term resets the pages and budget. This avoids silently losing a valid match below the first twenty candidates.

Ten pages target 200 candidate reads. Reactive pages can grow, so each backend request also has a 100-row and 256 KiB scan cap. Ordinary browse pages retain Convex's split metadata; native search does not provide split cursors. These caps bound individual requests, not total work across reactive subscriptions. No schema change or backfill is needed. The display keeps at most twenty matching Clienti in name order; search is no longer promised to cost only twenty reads.

Convex has a separate limit that pagination cannot bypass: its search candidate pool stops at 1,024. A native-engine check with 1,052 temporary records returned exactly 1,024 over 52 pages. If the picker reaches that ceiling with fewer than twenty matches, it asks for a more precise name or Alias instead of claiming the search is complete. No full-registry fallback is used. This preserves native search's prefix behavior and limitations. [Convex candidate aggregation](https://github.com/get-convex/convex-backend/blob/main/crates/search/src/lib.rs), [cursor handling after candidate selection](https://github.com/get-convex/convex-backend/blob/main/crates/database/src/query/search_query.rs).
