# PWA installation

Design agreed and implemented on 2026-09-10. Verified locally; not deployed.

## Confirmed scope

- Installation gives Pendolino a home-screen entry and a standalone window. The app requires an internet connection to work; offline reading and queued actions are outside this feature.
- Provide guided installation on iPhone, iPad, and Android. Desktop installation remains available through browser controls.
- Use Serwist in configurator mode, as explicitly requested. Follow the [configurator documentation](https://serwist.pages.dev/docs/next/config).
- Do not inspect the separate branch containing a PWA implementation.

## Agreed behavior

- Offer an "Installa Pendolino" action inside Altro on mobile. On iPhone and iPad, show instructions for adding the app to the home screen. Use the browser installation prompt where supported. Do not show automatic popups or repeated reminders.
- When the installed app opens without internet, show a "Connessione necessaria" screen with a retry button. Do not serve cached customer or basket data.
- Cache versioned JavaScript, CSS, icons, and the offline screen. Keep authenticated pages and application data network-only.
- Never force a reload during active work. A downloaded worker update waits until all app windows and browser tabs controlled by the previous worker close; a subsequent launch uses the update.

## Implementation constraints

- Preserve the existing Pendolino Ceste branding and reuse the available icons after checking their dimensions and suitability.
- Build the service worker after Next.js using the Serwist configurator and CLI. Do not copy the documentation's broad default runtime caching policy into this authenticated app.
- Disable automatic prerendered-route precaching and explicitly include the offline screen. Check generated precache entries and runtime rules against the agreed cache scope.
- Do not force waiting workers to activate or reload clients when an update arrives.
- Account for the worker registration already referenced on main so the integration has one registration owner. Inspect only the current checkout, never the separate PWA branch.

## Acceptance checks

- Check the production build produces the worker, manifest, and required icons.
- Verify Android installation and iPhone/iPad installation guidance, including launch in a standalone window. Identify any device checks that cannot be performed in the available environment.
- Verify desktop browser installation remains available.
- Open the installed app without internet and verify the connection screen and retry behavior.
- Inspect worker caches after authenticated use to verify customer data, basket data, and authenticated pages are absent.
- Make an update available while an Operatore is recording a Ritiro. Verify no forced reload occurs and that the waiting worker activates after all controlled windows and tabs close.

## Implementation

`pnpm build` runs Next.js followed by `serwist build serwist.config.mjs`. `app/sw.ts` replaces the original network-only worker on main; `public/sw.js` and its source map are generated and ignored by Git. `PwaProvider` owns registration, disables it during development, and turns off navigation caching and automatic reloads on reconnection. Test the worker with `pnpm build` followed by `pnpm start`.

`Installa Pendolino` lives inside Altro. The root provider retains the browser installation event until the action is used. A dismissed prompt is consumed once; a subsequent request can show manual guidance. Installed standalone windows hide the action. iPhone and iPad users receive Home Screen instructions, including iPad browsers identifying as desktop Safari.

The offline page is a standalone public HTML file. It can render without authentication, Next.js, or Convex. Its precache revision is a content hash. The existing manifest, app name, and icons are retained, with an explicit manifest ID and Apple touch icon metadata.

## Local verification

- `pnpm build` passed, including TypeScript checking and generation of a worker with 61 precached URLs totaling 2.31 MB.
- `pnpm typecheck` passed.
- `pnpm exec vitest run components/install-app.test.tsx components/app-shell.test.tsx` passed all 13 tests. Coverage includes an install event arriving before Altro opens, prompt dismissal and failure, iPad detection, hiding the action after installation, and existing authentication gating.
- Chromium loaded the production build and activated the worker. Inspection of Cache Storage found only static assets and the offline page. Signed-out requests to protected routes and the auth endpoint added no cache entries.
- Stopping the local server and navigating to `/ritiro` displayed the offline page. Restarting the server and selecting Riprova returned to the online sign-in page.
- A changed worker remained waiting with the existing page and controller intact. Leaving the last controlled page allowed activation. The temporary worker change was removed by rebuilding.
- An isolated browser preview of the installation component verified iPhone instructions, light and dark appearance, and focus returning to the install action when guidance closes. Icon dimensions and the maskable icon were checked.

Physical Android/iPhone/iPad installation and standalone launch still need device checks. No authenticated browser session was available for checking a real Ritiro across an update. No deployment or backend changes were made, and the other PWA branch was not inspected.

The glossary remains unchanged: this feature has not introduced a new term specific to the mill's domain. No ADR is needed for the library choice alone.
