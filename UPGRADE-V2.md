# Mimic 2

Live at https://mimic-aradhya.vercel.app. The site is hosted on Vercel; browser control uses the Chrome companion, with no local application server required.

| Workspace | Working now | Still requires integration |
| --- | --- | --- |
| Workflows | Record examples, infer varying inputs, replay with review, add expected-text outcome assertions, retain run evidence, use recorded alternative selectors | Natural-language planning, model-driven recovery, multi-tab work |
| What if? | Import an explicit monthly CSV baseline, compare price/growth/churn/cost/hiring assumptions over 12 months, save scenarios, compare ending cash with an actual result | Live business-system sync, statistical calibration, AI interpretation |
| Repair lab | Capture a case, link a reproduction command, attach one HTML file, run the same browser assertion against original and candidate, download tested source and evidence | Automatic patch generation, repository builds, repository access, pull requests |
| Open loops | Capture pasted requests, review suggested dates/amounts, track checklists/deadlines, link browser commands, draft follow-ups, close with explicit evidence | Inbox connections, automated follow-ups, background monitoring |

No model key was created or saved: secure destination confirmation was declined. The interface explicitly shows the missing AI connection. No AI API calls, billing, automatic code generation, or background agent services are enabled.

## Try the workspaces

- **Workflows:** teach a command, select it, and add an outcome check such as `#confirmation` containing `Saved`. A click completing does not prove that its outcome check passed. Test mode still pauses before clicks and key presses.
- **What if?:** start with your numbers or the explicitly labeled example. Download the CSV template for the eight supported monthly columns. The last imported row is the baseline, and its row/file is recorded. Every month first applies churn and new customers, then revenue and costs, then carries profit into cash. These are assumption-based calculations, not forecasts learned from your business.
- **Repair lab:** try the authored example. The original leaves the result on “Saving...”; the supplied correction changes it to “Saved successfully.” Test each separately. Download becomes available only after a failed original and passing candidate are bound to the same case, exact source hashes, and exact test hash. Editing source or the test invalidates earlier proof. One assertion does not establish whole-application correctness.
- **Open loops:** paste a request, review the extracted first-line title, dollar amount, and explicit YYYY-MM-DD deadline. Add required steps. Closure requires checked items and a completion note; manual confirmations and passed browser assertions are labeled separately. Follow-up drafts download as text and are never sent automatically.

## Repair execution boundary

Requires Chrome 125 or newer. Only a self-contained HTML page with inline JavaScript is supported, up to 200 KB. Tests run in a dedicated sandboxed frame with no same-origin, popup, form, or top-navigation permission. The browser blocks network requests, external scripts, frames, and workers. The dedicated tab closes after the run; a 30-second watchdog closes stalled tests. No repository files are executed on the host. Source and candidate text remain in the local workbench until explicitly exported.

Implementation references: [HTML iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox), [Chrome Runtime evaluation](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate).

## Storage and backups

Commands, demonstrations, and run evidence stay in the companion's `chrome.storage.local`. Scenarios, repair source files, and open loops use the dashboard origin's `localStorage` under `mimic-workbench-v2`. They persist in that browser profile, with no cloud sync. Private browsing or clearing site/extension storage can remove them.

Use **Export backup** at the top of any workbench page for scenarios, loops, and repair cases. Use the original command-library export separately for demonstrations, commands, and browser run evidence. Restoring a workbench backup keeps the prior snapshot under `mimic-workbench-v2-previous`; invalid data is rejected without overwriting it. Storage quota errors are shown instead of claiming a successful save.

The original Node edition still supports recording, replay, and outcome assertions. Repair browser tests require the Chrome companion. Complete any running workflow before reloading the companion; update its existing folder without uninstalling it to retain its identity and command library.

## Validation

Run `npm run check`, `npm run build:cloud`, `npm run build`, and `npm test`. Browser tests use isolated profiles and authored test inputs; they never alter the user's actual command library. After deployment, `node scripts/verify-live.mjs` exercises the production site and companion download in an isolated browser, including scenario persistence, admin evidence requirements, and the failing-original/passing-candidate repair cycle.
