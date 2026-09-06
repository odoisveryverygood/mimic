# Mimic on Vercel

**Dashboard:** https://mimic-aradhya.vercel.app

This version needs **no localhost server, Terminal process, or running Codex task**. Vercel serves the dashboard and downloads. A personal Chrome extension handles recording, replay, learning, and persistence in your browser.

## One-time Chrome setup

1. Open the dashboard in desktop Google Chrome and click **Connect Chrome**.
2. Download the browser companion and unzip it. Move the `mimic-browser-companion` folder to a permanent location.
3. Open `chrome://extensions` in Chrome. Enable **Developer mode**.
4. Choose **Load unpacked** and select that extracted folder.
5. Return to the dashboard. Its status changes to **Chrome connected**. Pin the extension for a shortcut back to the dashboard.

The companion is a personal unpacked extension, not a Chrome Web Store listing. It uses Chrome's `debugger`, `tabs`, and `storage` APIs. Chrome displays a connection indicator while it controls the workflow tab. Uninstalling the extension removes its stored library; export a backup before doing so.

## What stays available

- The dashboard has a permanent HTTPS Vercel URL.
- No application server runs on your Mac, and no tunnel is required.
- Your commands, demonstrations, and run history live in the extension's `chrome.storage.local`, scoped to that Chrome profile.
- The extension starts on demand. Active browser-control sessions keep its service worker alive on supported Chrome versions.
- Finished work persists through browser restarts. A browser restart during a run marks it interrupted; Mimic never automatically repeats unfinished external actions.
- Chrome must remain open while a workflow records or runs. This is browser automation on your machine, not an unattended cloud robot running while your computer is off.
- Safari and the Codex in-app browser can display the dashboard and setup instructions. Use Chrome with the companion for recording and replay.

The companion opens a new tab in your current Chrome profile. It can use that profile's existing website sign-ins. It does not use the separate Playwright profile from the original local edition.

## Existing local commands

The original local library has not been published or automatically copied into the extension. Open the original local app, export a command, then import its JSON in the Chrome dashboard. Commands targeting the local practice URL need their first step changed to `https://mimic-aradhya.vercel.app/practice`. The web edition includes a fresh practice command already configured for its public URL.

The earlier local edition remains available with `npm run build` and `npm start`; its files are stored in `.mimic/`. Its authentication data and recordings are excluded from Vercel deployments and downloadable source bundles.

## Updating the extension

Download and unzip the new companion. Replace the contents of its existing permanent folder, then click the extension's reload button in `chrome://extensions`. Do not remove and reinstall it just to update; its stable public identity keeps the same extension ID and local library. Complete active recordings and runs before updating.

## Build and deploy

```sh
npm ci
npm run check
npm run build:cloud
npm test
vercel deploy --prod --scope vendraft
```

The cloud build produces `dist-cloud/` and the production companion ZIP. The original local build produces `dist/`. The Vercel project is explicitly configured as a static Vite site: no Express server, browser profile, library data, or credentials are hosted.

The build consumes `extension/identity.json`, containing only a public extension identity and the allowed dashboard origin. No private signing key is saved. The manifest and service worker both restrict website access to the exact production dashboard origin. The test build temporarily adds a loopback test origin, then restores the production build; the production downloadable ZIP excludes that test permission.

## Tests

The extension integration test launches a real Chromium extension against a server serving **only static assets**, records two workflows, learns a parameter, replays a third value through Chrome's debugging API, verifies a review checkpoint and captured output, then restarts the browser and verifies persistence. The dashboard makes no `/api/` HTTP requests in this flow. The original Node recorder tests also remain available.

References: [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger), [service-worker lifetime](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Playwright extension testing](https://playwright.dev/docs/chrome-extensions).

## Version 2 workbench

The companion is now version 2.0.0. Reload the existing installation after replacing its files. Scenarios, repair sources, and open loops are saved in dashboard site storage; workflow records remain in extension storage. Export both backups as described in [UPGRADE-V2.md](UPGRADE-V2.md). AI planning, patch generation, inbox connections, and repository automation are not connected.
