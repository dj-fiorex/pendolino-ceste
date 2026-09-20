# Give the Ritiro lifecycle one home

Status: agreed, implemented and verified.

## Agreed scope

A Ritiro module independent of React owns the unfinished Ritiro. It owns draft
recovery, media ownership, draft persistence, optional uploads, recording and
draft removal. The screen renders state and sends intentions. It does not
order these operations.

A thin React adapter connects the module to React and existing dependencies.
An authenticated app provider keeps the module across page visits. Leaving an
unfinished Ritiro drops its in-memory media and offers its draft on return.
Leaving during confirmation keeps the same pending attempt; returning cannot
create a second recording or edit work that is still being recorded.
Cliente search, camera controls, signature drawing, previews and presentation
remain in the UI. Campagna selection remains shared with other movement
screens. The module receives the current choice and enforces confirmation
eligibility. The server remains authoritative when recording.

Keep the existing server mutation and device draft format. This change does
not add server recognition of an already recorded draft.

## Agreed lifecycle rules

- Read the draft before allowing edits. Offer it before restoring any Cliente
  or Ceste. Do not overwrite an unanswered offer.
- Resume restores the Cliente, Ceste and missing-media reminders. It never
  restores signatures or photographs.
- Store only an explicit projection of Cliente, Ceste and media kinds that
  will need capture again. Never serialize captured files or their contents.
- Keep missing-media reminders through repeated reloads and resumes.
- Changing Cliente keeps scanned Ceste and clears captured media and
  missing-media reminders. Clearing the reminders is an intentional correction
  to current behavior.
- During the search for another Cliente, retain the previous named draft.
  A reload can offer it again, so the scans are not lost. Selecting the next
  Cliente replaces that draft with the current Ritiro.
- Accept capture results only for the Ritiro and Cliente that started them.
  An old photo conversion must not restore a previous Cliente's media.
  Updating one media kind must not overwrite another kind from stale state.
- Freeze lifecycle edits when confirmation starts. The module enforces this,
  as well as the UI. Repeated confirmation joins the same in-flight attempt.
- Confirmation uses a fixed snapshot. Failed optional uploads do not prevent
  recording. Successful recording reports which captured files failed to upload.
- Upload optional files first. Then record the Ritiro and links to successful
  uploads in the existing database transaction, together with the Ceste updates,
  Movimenti and Registro entry. File transfer itself is outside that transaction.
- Do not impose an application timeout on requesting an upload URL or uploading
  a file. Remove the existing 12-second upload timeout. Wait for success or an
  error from the underlying request. An error still permits recording without
  that file. While a request remains pending, confirmation remains pending and
  edits stay frozen. Browser, network and server limits still apply.
- Recording failure preserves the Ritiro for editing and retry. It does not
  clear the draft as if recording had succeeded.
- Keep successful upload identifiers in memory for retry of unchanged files
  on the same Ritiro and Cliente. Retry failed uploads. Replacing or removing
  a file invalidates its cached identifier; changing Cliente, abandonment or
  starting another Ritiro clears all cached identifiers. Neither files nor
  upload identifiers go into drafts.
- Successful recording or explicit abandonment attempts draft removal.
  Later updates must not recreate that completed or abandoned draft.
- Storage errors do not block the Ritiro. Removal is best effort: if removal
  fails, an old draft can appear after reload. This limitation is accepted.
- Starting another Ritiro clears the previous in-memory work and result.

## Implemented interface

Expose a readonly snapshot and domain intentions: resume, abandon, change
Cliente, choose Cliente, add or remove a Cesta, capture or remove media,
confirm, and start another Ritiro. Expose confirmation eligibility with the
snapshot. Keep persistence and upload operations private to the module.
The React adapter reports page opening and closing. The module decides whether
to release unfinished work or retain a confirmation that is still pending.

Use explicit states for loading, offering a draft, editing, recording and
recorded. Recording failure returns to editing with an error. The module owns
all transitions and side-effect ordering; the React adapter does not implement
a second lifecycle through effects.

Inject draft storage, media transport and recording dependencies. Tests use
controlled adapters through the same interface as production callers.
Media capture callbacks must carry module-controlled ownership so a late
callback cannot act on a different Cliente or a subsequent Ritiro.

## Upload behavior

Keep the existing sequence of signature then photo. Replace today's repeated
uploads on recording retry with reuse of successful upload identifiers for
unchanged files during the same session. Remove the application timeout rather
than extending it to cover the upload-URL request. This is an explicit change
to current behavior, chosen so elapsed time alone does not discard an upload.

## Verification for implementation

| Scenario                      | Required behavior                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Offer                         | No restored active work and no write that overwrites the unanswered offer.                                        |
| Resume                        | Restore Cliente and Ceste; files remain absent; reminders are visible.                                            |
| Decline                       | Remove the offered draft when storage works; next instance starts empty.                                          |
| Repeated reloads              | Offer on every new instance; scans and missing-media reminders survive.                                           |
| Cliente change                | Keep Ceste; clear files and reminders; reject old capture results.                                                |
| Reload during Cliente search  | Offer the previous named draft with its scans.                                                                    |
| Concurrent captures           | A photo result cannot overwrite a newer signature.                                                                |
| Draft serialization           | Stored data contains only the allowed fields, never files or media contents.                                      |
| Storage failure               | Read, write and removal errors do not block editing or recording; test the accepted stale-draft limitation.       |
| Optional upload failure       | One or both failures still allow recording with successful attachment identifiers; success names failed uploads.  |
| Slow upload                   | Advancing time past 12 seconds does not fail or abort the upload; recording waits for success or a request error. |
| Recording failure             | Retain work and draft; expose an error; permit retry.                                                             |
| Retry after recording failure | Reuse successful upload identifiers for unchanged files; retry failed uploads.                                    |
| Cached upload ownership       | Replaced or removed files cannot reuse old identifiers; changing Cliente or starting another Ritiro clears them.  |
| Recording success             | Attempt draft removal before publishing success; later updates cannot recreate it.                                |
| Confirmation concurrency      | One recording attempt; edits and late capture results cannot change its snapshot.                                 |
| Another Ritiro                | Begin with no previous Cliente, Ceste, media, reminders or errors.                                                |

Add module test discovery to Vitest, which currently discovers only Convex and
component tests. Add a small React integration check for the offer, confirmation
state and adapter wiring. Run relevant tests and type checking after implementation.

## Existing decisions

ADR-0005 explains why optional media failures do not block recording.
ADR-0006 keeps Movimenti and Registro creation together on the server.
ADR-0004 protects recorded events; removing an unfinished draft does not
remove a recorded event. CONTEXT.md remains the domain glossary and does not
need implementation details about this module.

## Verification result

All 287 tests pass across 18 files, including 24 Ritiro module tests and five
screen integration tests. Type checking and the staged whitespace check pass.

Standards review: no outstanding findings.
Specification review: no outstanding findings. Review found that a page remount
could create a second confirmation; the authenticated app provider and navigation
regression tests resolve it.

No backend changes or deployment are required. Draft removal remains best
effort as agreed, and optional uploads have no application time limit.
