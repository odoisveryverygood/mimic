# Production deployment — September 6, 2026

- **URL:** https://mimic-aradhya.vercel.app
- **Target:** production
- **Status:** READY (confirmed through Vercel's deployment API)
- **Project:** `mimic-aradhya`
- **Deployment:** `dpl_7Er4DFLXWxaoawGjNcKjCTeVMRGj`
- **Framework:** Vite, static dashboard and companion download
- **Build duration:** approximately 11 seconds (14 seconds for the deployment command)
- **Commit:** unversioned local workspace; no Git repository was present

## Validation

- TypeScript check passed.
- Local and cloud production builds passed. Vite reports two non-blocking annotation warnings from Zod dependencies; both bundles were produced successfully.
- Full suite: **10 tests passed, 0 failed**. It includes the original recorder and the new real Chrome extension flow.
- Public dashboard, hosted practice page, and companion ZIP each returned **HTTP 200** without authentication.
- The manifest and worker in the downloaded production ZIP exactly matched the locally built production files. Only `https://mimic-aradhya.vercel.app/*` is permitted to message the extension; the development test origin is absent.
- A real Chromium browser loaded the production extension and the actual Vercel URL. Through the dashboard UI, the six-step sample command filled the hosted practice page, paused before saving, resumed, and captured **Saved “Mimic live deployment verification” to Research.**
- No localhost or `/api/` HTTP calls occurred during the cloud UI run. Browser page errors: **0**.
- Command persistence was separately verified through browser restarts in the extension integration test.
- Screenshots: `screenshots/cloud-dashboard.png` and `screenshots/cloud-run.png`.

## Operational boundary

The production site is available independently of this Codex task or the original Node process. Browser recording and replay require the companion to be installed in the Chrome profile where the user opens the dashboard. Verification installed it in an isolated test profile; it has **not** been installed in the user's everyday Chrome profile. The production site provides the download and one-time installation instructions.

The web edition stores workflow data in Chrome, not on Vercel. The original `.mimic/` library and its browser profile were excluded from deployment. The original local server was stopped after deployment so the new setup does not rely on it.

## Post-deployment observability

The public routes and a full browser run were checked directly. There are no cloud workflow execution functions to monitor: browser control runs inside the companion. No ongoing monitoring or log drains were configured.
