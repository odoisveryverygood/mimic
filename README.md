# Mimic

A Chrome side panel that turns demonstrated browser tasks into reusable workflows and verified spreadsheet batches. The web dashboard also includes business scenarios, reproducible repairs, and unfinished admin.

**Version 3:** Open [Mimic for Chrome](https://mimic-aradhya.vercel.app/extension). See [RELEASE-V3.md](RELEASE-V3.md) for the extension, Free/Pro limits, account architecture, verification, and remaining billing activation steps. Pro payments are disabled pending provider setup.

**Version 2:** See [UPGRADE-V2.md](UPGRADE-V2.md) for the four workspaces, tested capabilities, storage, and remaining integrations.

**Web edition:** Mimic now has a Vercel-hosted dashboard and a Chrome companion that removes the local server requirement. See [CLOUD-SETUP.md](CLOUD-SETUP.md) for the one-time extension setup. The instructions below describe the original local edition, which is still available.

Mimic is a working local application with a React interface, a persistent command library, and a Playwright browser recorder and runner. It compares demonstrations to discover changing input fields. It does not require an API key or an AI subscription to run.

## Open it

On this Mac, double-click **Launch Mimic.command**, or run:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4318**. Node.js 22.12+ and Google Chrome are required. If you use Chromium instead of Chrome, install the browser with `npx playwright install chromium`. The supplied launcher installs missing npm dependencies and builds missing assets. Keep its Terminal window open while using Mimic; Control-C stops the server.

For development, run `npm run dev`. The same port serves the app and API, with Vite hot reload.

## Your first learned command

1. Click **Teach a new command** and select **Try the practice library**. Name your workflow, then click **Open browser & record**.
2. In the separate browser, type a reading title, enter a URL, choose a shelf, and click **Save reading**.
3. Hold **Option** (Alt) and click the confirmation to capture the result as text.
4. Click **Finish demonstration** in the browser toolbar, or **Finish** in Mimic. Review the captured steps and click **Create a command**.
5. Open your command and click **Teach again**. Follow the same steps with different values. Select **Learn from this example** when finished. Values that vary become command inputs; identical values become fixed steps.
6. Click **Run command**, enter new values, and choose **Test with me**. Inspect the browser at each pause and click **Continue this step**. Captured text appears in the run result.

The supplied **Save a reading** command is a labeled, authored example you can run immediately. It has no invented recording or run history. Learning a command yourself uses actual browser events.

## Features

- Dedicated, visible browser with locally retained login sessions.
- Explicit recording, pause/resume, finish, and capture feedback.
- Navigation, click, fill, select, checkbox/radio, selected keyboard actions, and text extraction.
- A first demonstration produces editable input candidates. Multiple matching demonstrations distinguish variable fields from constants.
- Review and edit step labels, selectors, fixed values, input mappings, and review checkpoints. Reorder or remove steps; add extraction or manual steps.
- Test replay pauses before clicks and key presses. Regular replay pauses at saved checkpoints. Manual steps always pause.
- Run cancellation, per-step status, captured outputs, and persistent run history.
- Command search with Command-K / Control-K; duplication; validated JSON import/export; full JSON library download.
- Terminal access and a Mac launcher.
- Locally bundled fonts; the app interface does not need an external font or API service.

## Learning behavior

Learning is deterministic pattern comparison, not an LLM making guesses about arbitrary applications. Actions are normalized to remove consecutive duplicate edits. Demonstrations must have the same ordered action types and target selectors. Different routes produce an explicit error instead of being combined incorrectly. Use a separate command for a different branch of a workflow.

With one demonstration, fill/select fields become candidate inputs. With two or more, only differing values become inputs. A varying starting URL can also become an input. The editor lets you override these choices. Learning again rebuilds the workflow from its demonstrations and replaces manual edits; the UI says so before updating.

## Data and browser behavior

For the original local edition, application data is in `.mimic/` beside this README:

- `library.json`: commands, captured demonstrations, and run history, written atomically with owner-only file permissions.
- `browser-profile/`: the dedicated browser's local profile, including site login sessions. This is separate from your ordinary Chrome profile.

The server listens only on `127.0.0.1`. Writes require an app-session token, and foreign browser origins and unexpected Host headers are rejected. The application never executes shell code supplied by imported workflows. Imports are schema validated.

Recognized password, token, payment, and similar private fields become manual steps without storing their values. This uses field attributes and names; it cannot identify every possible custom private field. Ordinary text and captured text are saved locally. Use the recording pause control when performing actions you do not want saved, and review every demonstration. The dedicated browser's profile can retain the normal session data websites store. Never share that profile or a raw library containing personal data.

Test mode performs real browser actions. It is **not** a simulation or a rollback sandbox. In test mode, clicks and key presses pause first; fill/select/check events can also have effects on some sites. Inspect the workflow before starting. Checkpoint detection recognizes common submission labels and form buttons, but it is not an exhaustive classification of side effects. Add explicit review or manual steps where needed.

## Supported boundaries

This version automates **single-tab browser workflows**. It does not control native Mac apps, record embedded-frame interactions, follow work across tabs, automate file uploads or drag-and-drop, or solve CAPTCHA challenges. Recordings display warnings when frames or new tabs are seen. Websites with unusual widgets or changing DOM structure may require selector edits or manual checkpoints. The runner uses recorded selector alternatives and requires a unique visible match; it stops on failure instead of clicking an arbitrary match.

Use the browser normally to sign in; pause recording for setup. Login sessions are retained. Closing the browser mid-recording saves captured steps; closing it during a run produces a failure or cancellation. Restarting the server marks unfinished saved runs as interrupted.

## CLI

Start the app first. From this directory:

```sh
node cli.mjs list
node cli.mjs run COMMAND_ID --reading_title "A new reading"
node cli.mjs status
node cli.mjs continue RUN_ID
node cli.mjs cancel RUN_ID
```

Use the actual input names printed by `list`. Test mode is the default. Add `--regular` to use only saved review checkpoints. `MIMIC_URL` can point the CLI to a different local port. Command JSON files can be downloaded from a command's export button and imported into another Mimic installation. Importing does not execute a command.

## Backup and restore

Download a full library backup from **How Mimic works**. To restore it, stop Mimic, retain a copy of the current `.mimic/library.json`, and place the backup at that path. Restart Mimic. A library with invalid JSON or an unsupported shape causes startup to stop without overwriting it. Backing up the library does not export your browser's cookies or login profile.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MIMIC_PORT` | `4318` | Local server port |
| `MIMIC_DATA_DIR` | `.mimic` in the app directory | Library/profile storage |
| `MIMIC_HEADLESS` | off | Set to `1` for automated verification; manual checkpoints need a visible browser for human use |

## Validation

```sh
npm run check
npm run build
npm run build:cloud
npm test
```

Tests cover the real browser recorder → two demonstrations → inference → third-input replay → captured result cycle, submission checkpoints, cancellation, missing-element failure, private-field exclusion, keyboard submission, native controls, durable storage, invalid imports, and local API access controls. See `VERIFICATION.md` for this build's recorded results and limits.

Implementation references: [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [Playwright Page](https://playwright.dev/docs/api/class-page), and [Vite](https://vite.dev/guide/). Font licenses are included under `public/fonts/`.
