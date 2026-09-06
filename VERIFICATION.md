# Build verification — September 6, 2026

## Passed

- `npm run check`: TypeScript check completed without errors.
- `npm run build`: production bundle built successfully using Vite 7.3.6.
- `npm test`: **8 tests passed, 0 failed** (12.5 seconds on the final full run).
- Browser integration used an actual locally installed Chrome browser in headless mode against the included practice site.
- Recorded two distinct demonstrations through the injected recorder, learned one changing title input, kept the repeated URL fixed, replayed a third value, paused before submission, continued, and read the resulting confirmation text.
- Verified that the page had not submitted while the run waited at its checkpoint.
- Cancelled a paused run; it ended as cancelled. An unresolvable selector caused failure and left later steps pending.
- A password field became a manual step. Its synthetic private test value did not occur in the saved library.
- Enter-based form submission recorded one key action and no duplicate button click.
- Native selection and checkbox values were captured.
- Recording pause excluded setup text; resuming recorded subsequent input.
- Storage survived reload, interrupted runs received an interrupted status, and malformed JSON was left untouched.
- HTTP checks rejected foreign-origin requests and unauthenticated mutations; import/export, update, delete, and persistence were verified. Unsupported executable step types were rejected.
- CLI `list` and `status` read the running application's actual saved data.

## Visible application checks

The production app was opened in a headed browser. The supplied “Save a reading” command was started through the actual UI with the title **Mimic acceptance test**. It paused before saving. After continuing from the run dialog, all six steps passed and the output read:

> Saved “Mimic acceptance test” to Research.

This actual run remains in the local app's history. Its persistence was checked after restarting the server with the final backend code. No recording or run counts were invented.

The workflow editor also opened and saved successfully through the UI. The interface was visually inspected at **1440 × 1000** and **390 × 844**. On the mobile viewport, document width was 375 px (the 390 px viewport minus its scrollbar), with no horizontal overflow. The bundled fonts loaded successfully. A fresh load of the final build reported **0 console errors and 0 warnings**. Its resource requests used only `http://127.0.0.1:4318`; no third-party asset origins were present. Screenshots are included in `screenshots/`.

## Limits of the evidence

The browser behavior was exercised against the local practice site. No user accounts were accessed, external communications sent, or external websites submitted to during verification. Authentication-heavy, dynamically changing, and third-party applications still require testing with the user's selected workflows. Native Mac applications, embedded-frame interactions, multi-tab recording, drag-and-drop, and file uploads are outside this release.

Learning uses deterministic comparison of demonstrations. It does not call Astra or another hosted model at runtime. Astra was used to build the application.
