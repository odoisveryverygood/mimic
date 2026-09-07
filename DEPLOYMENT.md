# Production deployment — Mimic 2

- URL: https://mimic-aradhya.vercel.app
- Target: production
- Status: READY, confirmed with Vercel CLI deployment result and `vercel inspect`
- Project: `mimic-aradhya`, team `vendraft`
- Deployment: `dpl_FuxMKvxhQoJ7uZnHH8PezusBveCH`
- Immutable deployment URL: https://mimic-aradhya-ea9lhfpk5-vendraft.vercel.app
- Application commit: `1e6f210`
- Framework: Vite static dashboard with Chrome companion
- Deployment command duration: approximately 12 seconds
- Released September 6, 2026
- Public source: https://github.com/odoisveryverygood/mimic

## Verified behavior

TypeScript checking, cloud and local production builds passed. Full suite: **15 passed, 0 failed**. Vite emitted only the pre-existing Zod annotation warnings.

`node scripts/verify-live.mjs` loaded the real production site with the production companion in an isolated Chromium profile and verified:

- Dashboard, hosted practice page, and companion ZIP return HTTP 200 without authentication.
- Downloaded companion manifest and worker match the production build; only the production dashboard origin is allowed.
- The original six-step command pauses for review, resumes, and captures the saved confirmation.
- A new outcome assertion added through the Workflows UI passes only after observing its expected result.
- A scenario is saved and compared, with an actual ending-cash result recorded.
- An admin request cannot close with an unfinished checklist; checked items and completion evidence persist.
- A repair original fails, the authored correction passes the same test, and editing the candidate invalidates that proof.
- Workbench data survives dashboard reloads. Extension command history survives browser restarts in the integration suite.
- No localhost or `/api/` HTTP requests. Browser page errors: 0.

Additional integration checks verify the repair sandbox blocks attempted fetches, image requests, popups, and top-level navigation, then closes its test tab. Desktop and mobile screenshots are in `screenshots/mimic-v2-*.png`.

## User Chrome installation

The existing companion folder was updated and reloaded through Chrome's Extensions UI. The UI confirms version **2.0.0**, enabled, with the same extension ID `mobgpafflgnciihjnpbfmnhpoaaipnlb`. Permissions remain `debugger`, `storage`, and `tabs`. The user's live dashboard shows **Chrome connected**; the existing command and demonstration remain available. Verification scenarios and test cases were created only in isolated test profiles.

## Operational boundary

See [UPGRADE-V2.md](UPGRADE-V2.md) for the full capability matrix. Model-key destination approval was declined, so no model key was created or saved. Automatic planning and patch generation are not connected. Inbox, repository, background monitoring, and unattended cloud execution are not connected.

The website stays available independently of Codex or localhost. Browser workflows require Chrome open with the companion. Workbench data remains in dashboard site storage; command and browser-run data remain in the companion. Neither library is uploaded to Vercel. Export the two backups separately.

## Observability

Public route checks and production browser verification passed with no page errors. The app has no cloud workflow functions producing runtime logs. No ongoing monitoring or log drains were configured.


## v3 production release (September 7, 2026)

- Deployment: `dpl_4tgh7aq339ZBgzbihZmRDqFpnu3N`, READY.
- Production alias: https://mimic-aradhya.vercel.app
- Extension: 3.0.0; original ID preserved.
- New public routes: `/extension`, `/privacy`, `/account`, `/api/cloud/config`.
- Neon project: `crimson-resonance-12197216`; production branch `br-little-union-a5m3d9rg`; isolated migration/concurrency validation branch `br-divine-fog-a5r4z562`.
- Server database secret and public auth URL configured in Vercel. No Stripe secrets configured.
- Live verification passed original workflows/workbench, two CSV rows with checked outcomes, failure stop, public download/source equality, sign-in page rendering, 401 for unauthenticated/forged device access, and 403 for foreign origin. No page errors.
- Actual email delivery/account pairing and Stripe payment lifecycle remain unverified; billing is disabled. See RELEASE-V3.md.
