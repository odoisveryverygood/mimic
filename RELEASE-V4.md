# Mimic 4 — a clearer path from demonstration to result

The previous interface put setup, CSS selectors, three execution modes, and a paid-plan promotion ahead of the first useful action. Version 4 gives the website and Chrome side panel the same focused task interface.

## Product changes

- The root website and `/extension` connect to the installed extension and show My tasks, Activity, and Settings. Visitors without the extension see an honest setup page; no simulated runs or fabricated results are presented as execution.
- A one-click practice task fills a real form and checks the complete saved title and shelf. The separate authored example is added without overwriting any existing command.
- Teach a task records either the explicitly selected current tab (from the side panel) or a new website tab. Current-tab recording validates the selection again at start and preserves the page without a reload.
- Pick success highlights the element under the pointer. Clicking the visible result adds an assertion without performing a click action on the website. Escape cancels selection.
- Finish leads directly to a review and Save task. Inputs are editable in Run once; CSV upload, paste, mapping, preview, and example rows live in a separate Run a list view.
- Selected outcomes can include explicit input templates. Learning substitutes complete, unambiguous recorded input values of at least three characters. Literal expected text remains literal; unsupported references are rejected. Review the resulting expected text for short or ambiguous inputs.
- Task details contains selectors and checkpoint settings. Account and billing controls are in Settings. The four earlier workspaces remain at `/studio`, with their existing local data.
- Activity shows saved outcomes, step status, and row-level evidence. Uncertain rows still stop a batch; users can resolve them with a note and resume only pending rows.

## Compatibility and boundaries

The extension ID and Chrome permissions are unchanged. Library format remains version 1. Existing commands, demonstrations, and run records remain intact. An optional `valueTemplate` field extends outcome assertions; the local server and Chrome runner share materialization logic. Exporting a v4 template to an older Mimic build requires upgrading that build first.

Recorder event listeners and overlays are cleaned up when recording stops, so the same tab can be recorded again. Current-tab recording is allowed only from the installed extension, not through external website messages. Workflow data is local; the account service does not receive page contents or CSV rows.

This release is deterministic browser automation. It does not add automatic AI planning, support for embedded frames or popup workflows, background execution while Chrome is closed, live Stripe checkout, or a Chrome Web Store publication. Websites with changing structures can still need a revised recording or selector.

## Verification

`npm run check`, `npm test`, and `npm run build:cloud` are the local release gates. The isolated Chrome integration scenario covers the legacy recorder and workspaces, batch stop-on-failure, one-click practice, three verified sample rows, visual teaching followed by replay with changed inputs, current-tab capture without navigation, stale-tab rejection, external-caller rejection, repeated recording, recorder cleanup, and desktop/mobile overflow checks. Screenshots are saved in `screenshots/mimic-v4-*.png`.

`scripts/verify-live.mjs` repeats the product flows against the deployed website in a disposable Chrome profile and verifies that the downloadable extension matches the production build.
