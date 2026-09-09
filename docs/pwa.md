# Installable Pendolino

Design agreed and implemented locally on 2026-09-09. Physical-device installation checks remain as listed below.

## Agreed scope

- Target phones, tablets and desktops across Android, iOS/iPadOS, Windows, macOS and Linux, through browsers that support installation on each platform. Installation instructions must reflect platform capabilities; the app remains usable in a browser.
- Distribute through the website. App-store distribution is outside this version's scope.
- On connection loss, preserve unfinished input and show the connection problem. Only show a Movimento as recorded after server confirmation. Durable offline submission is outside this version's scope.
- Recover unfinished Ritiro, Rientro and Svuotamento after closing the app or restarting the device. Photos and signatures must be captured again.
- When launched offline, show "Connessione assente" with retry. Recover saved work after reconnection rather than presenting cached basket availability as current.
- Never force an update reload during a movement. Show "Aggiornamento disponibile" and apply the update after the movement finishes or the Operatore explicitly chooses to reload.
- Provide "Installa Pendolino" on the login screen and in the app menu, with device-specific installation guidance where needed.
- Launch at the existing home dashboard, using the existing login flow when authentication is required. Restore saved input when the Operatore opens the relevant movement flow.
- Allow portrait and landscape orientation on phones and tablets, with layouts adapting to the available screen.

## Starting point

The app already had a manifest, installation icons and a registered service worker. That worker did not cache content or provide an offline launch page.

Ritiro already saved its Cliente and Ceste selection locally on the device, shared across Operatori, excluding photos and signatures. Rientro and Svuotamento selections lived in memory. The proposal promises recovery of a Ritiro after connection loss or a powered-off phone; this is distinct from confirming a Movimento offline.

## Implementation

- The login screen, desktop sidebar and mobile Altro menu offer installation. A native prompt is used when the browser supplies one; otherwise the dialog explains the platform's installation flow. The entry is hidden in standalone mode and after the browser reports installation.
- The manifest has a stable app identity and no orientation lock. Apple touch-icon metadata is explicit.
- A build-specific `/sw.js` caches only `/offline.html`. Navigations use the network, falling back to that public document when the request fails. Authenticated pages, API responses and movement submissions are not cached. An online visit that successfully installs the worker is required before offline launch works.
- The app monitors both browser connectivity and the Convex connection. Disconnection leaves mounted work intact, labels displayed data as potentially stale and disables new movement confirmations. An already submitted request stays pending until the server answers; it is not shown as successful early.
- Each movement flow offers explicit recovery from device storage. Rientro selections are checked against the currently displayed load, and Svuotamento uses its existing live-yard selection rules. Storage failures are visible and disable update reloads while work cannot be saved.
- Closing the app while confirmation is pending leaves an uncertainty marker in the draft. Recovery warns that the Movimento may already have been recorded and asks the Operatore to verify basket state. There is no automatic replay or durable submission queue.
- A new build changes the worker bytes. Visible apps check for updates every minute and when returning to the foreground or reconnecting. Updates wait for an explicit click. Unfinished work gets a recovery warning; pending confirmations and uploads disable updating. Activation from another tab never reloads the current tab.

## Architectural decision

[Movimenti require server confirmation](adr/0012-movimenti-require-server-confirmation.md) records the boundary between recovering unfinished input and recording a Movimento offline.

## Verification on 2026-09-09

- `pnpm test`: 248 tests passed across 15 files. New tests cover recovery of all three movement flows, failed and pending submissions, interrupted confirmation, invalid storage, storage refusal, installation prompts, update consent and activation by another tab. Worker tests verify the public-only cache and network fallback.
- `pnpm typecheck`, `pnpm build` and `git diff --check` passed.
- Chromium against a local production build exposed its native install prompt. The install dialog was inspected at phone and landscape sizes in light and dark themes. iPhone identity/viewport emulation displayed the Apple-specific guidance; this is not a WebKit or physical-device test.
- With the local production server stopped, reloading displayed the cached offline screen. Restarting the server and selecting Riprova returned to login.
- Two successive production builds produced distinct worker versions. The existing page offered the update, waited for a click, then reloaded successfully and removed the old offline cache.

### Device acceptance still required

On physical iPhone/iPad, Android, Windows, macOS and Linux devices with supported browsers, install from the website and launch from the resulting icon. Verify login persistence, the home dashboard, camera access, portrait/landscape layout, offline launch after an online visit, reconnection and draft recovery. Authenticated movement flows were exercised with mocked backend responses, not against live mill records. Browser/OS installation support varies, so a browser without installation remains a supported way to use the website.

## Reference

[MDN installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), consulted 2026-09-09. Installation UI and support vary by browser and platform; service workers are not themselves an installation requirement.
