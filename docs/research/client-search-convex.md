# Cliente search: requiring every word

Research checked on 2026-09-19 against installed `convex` 1.45.0 and current official documentation. The initial analysis below preceded implementation. The accepted behavior is recorded in the search refinement in ADR-0010.

## What Convex supports

The installed [`SearchFilterBuilder`](../../node_modules/convex/src/server/search_filter_builder.ts) explicitly describes matching any query word. Its `search` method accepts only the field and query string, then returns a builder exposing equality filters. There is no AND switch, phrase option, or supported second `search` call. Quoting text or inserting `AND` is not a documented way to change this behavior.

Convex splits text on whitespace and punctuation, lowercases terms, and enables prefix matching on the final query term. Search results arrive by relevance; that ranking can change. Index filter fields support exact equality. Additional filters examine candidates after the index lookup, so they do not remove the cost of reading rejected candidates. Search queries support pagination, but can scan at most 1,024 search results per query. Search expressions permit up to 16 terms. Search billing currently counts the full index size per query regardless of returned result count or index filters. These are current service rules, distinct from the installed SDK version. [Official text search documentation](https://docs.convex.dev/search/text-search)

## Application before the change

Both entry points use [`components/cliente-picker.tsx`](../../components/cliente-picker.tsx), which calls `clienti.search`. The same picker also serves Rientro and Rettifica, so a shared search change reaches those workflows too. [`convex/clienti.ts`](../../convex/clienti.ts) takes 20 search hits, then sorts that selected set alphabetically. [`convex/schema.ts`](../../convex/schema.ts) combines the name and aliases into `searchableNames` and already has an exact `by_comparableName` index.

[ADR-0010](../adr/0010-the-registry-is-read-by-index.md) records why this replaced a full scan: at that time there were 2,919 Clienti and about 478 kB read per query. Those are historical figures, not a fresh production measurement.

## Recommended behavior

Require every query word, allowing any order across the name and aliases. Preserve exact matching for completed words and prefix matching for the final word. Thus `oleificio cellulare` requires both words, and `oleificio cell` still finds Oleificio Cellulare. This is AND matching, not exact phrase matching: another Cliente containing both words also legitimately matches, even in reverse order or across a name and alias.

Use one shared tokenization rule for the query and candidate documents. Deliberately define punctuation, apostrophes, accents, repeated words, and trailing whitespace. A substring `includes` check changes the behavior to matching inside words, contrary to the existing indexed search contract.

## Implementation options and tradeoffs

1. **Indexed candidates followed by AND filtering.** Keep the current search index and active filter. Read a bounded candidate page, apply the token predicate, and return matches together with a continuation cursor and an explicit incomplete-search state. Continue when necessary. Apply the final display limit after filtering. This is the smallest change and preserves existing name and alias lookup. It can inspect more than 20 documents, and a broad query may need several pages. Pagination bounds each request, not total work. Convex's own filtering guidance confirms that TypeScript filtering can produce small or empty pages and that scanning work remains. [Official filtering guidance](https://stack.convex.dev/complex-filters-in-convex)

2. **Selective candidate lookup.** Search a single query word likely to narrow the candidate set, then apply the same AND predicate. Every valid match must contain that word, so this can reduce irrelevant candidates. Word length is only a heuristic for selectivity; measure it. Preserve the original final-word semantics during validation because a single-word Convex search treats its own word as a prefix. This still needs continuation and a read budget. It also changes candidate relevance ordering.

3. **Exact-name shortcut.** The existing `by_comparableName` index can find a complete normalized name directly. This can guarantee the example's exact name is found quickly, but does not implement general AND matching or partial-name lookup. Do not silently hide other valid AND matches when an exact result exists. Return exact matches first, deduplicate subsequent matches, and disclose continuation when the broader search is unfinished.

4. **A different index if measurements justify it.** A normalized name-prefix range is efficient but changes the contract to the beginning of the whole name and needs separate treatment for aliases. A token-to-Cliente table supports word lookups and candidate verification, at the cost of extra rows, write maintenance, and backfill. Intersection work can still grow with common terms. An external engine with native AND support introduces another service and synchronization. None is necessary merely to remove the current unrelated matches. Ordinary indexes support efficient equality and range lookups; the proposed data layouts are application design options, not built-in Convex AND features. [Official index performance documentation](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf)

Do not filter only the current top 20: valid matches below that cutoff disappear. Increasing the cap to 100 or 200 reduces that risk but does not eliminate it. Intersecting separately truncated per-word result lists has the same problem. Scanning until 20 survivors appear can become expensive or hit limits. A bounded scan must communicate when it has not finished, especially before presenting an empty result as proof that a Cliente does not exist.

## Validation before choosing a budget

Measure document reads, bytes, duration, number of continuation pages, and result correctness on representative data. Include the reported query, reversed words, partial final words, aliases, inactive clients, punctuation, common surnames, no-match queries, and a valid match beyond the first candidate page. Test a broad query across the 1,024-result boundary using supported pagination. Check the real Convex engine in a development deployment because a local mock may simplify relevance and tokenization.

The recommendation is bounded indexed retrieval with explicit AND validation and continuation. It avoids restoring full-table reads, but cannot honestly promise complete arbitrary AND results for the current fixed cost of 20 candidate reads.

## Native-engine finding during implementation

Development checks with 1,052 temporary records established that the 1,024-result limit applies to the candidate pool across cursor pages, not only to each request. Traversal returned 1,024 unique candidates in 52 pages and then reported `isDone`. The backend source confirms that the cursor is applied after candidate selection. Consequently, continuation cannot guarantee exhaustive AND matching over a larger candidate pool. [Search query implementation](https://github.com/get-convex/convex-backend/blob/main/crates/database/src/query/search_query.rs), [candidate aggregation](https://github.com/get-convex/convex-backend/blob/main/crates/search/src/lib.rs).

The implementation retains null placeholders for rejected candidates, allowing the picker to count the pool. At the ceiling it requests a narrower search instead of showing a false empty result. Native search also retains its existing prefix-expansion limits. No full-table fallback, schema change, or backfill was added. All temporary records were deleted after the checks.
