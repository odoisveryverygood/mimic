# Chrome Web Store draft

Name: Mimic — Teach once. Run your busywork.

Summary: Record browser workflows, map CSV inputs, and run batches with outcome checks, review checkpoints, and clear results.

Category: Workflow & Planning

Language: English

## Description

Turn a browser task you repeat into a reusable workflow.

Mimic lives in Chrome's side panel. Record the steps in your current tab or a new tab, review the inputs and checkpoints, and run them again with new values. Bring a CSV from Excel or Google Sheets to work through a list one row at a time.

Pick a visible success message on the page. Mimic turns it into a final text check and substitutes unambiguous recorded inputs when you use new values. Mimic marks rows verified only after observing the expected result. If a row fails or Chrome is interrupted, the batch stops for review. You can inspect the destination, mark a row manually confirmed or skipped, and continue the pending rows. Completed rows are never automatically replayed.

Free includes three custom workflows, a practice workflow, and batches of up to three rows. Pro is planned at $15/month for 100 workflows, up to 100 rows per batch, and 1,000 batch rows per calendar month. Pro checkout is currently unavailable.

Workflow and spreadsheet data are stored in your Chrome profile. The account server stores account, subscription, and usage records, not your CSV contents. Chrome displays a debugging indicator while Mimic controls the workflow tab.

Mimic requires desktop Chrome 125 or later. Chrome must remain open during a run. Workflows inside embedded frames or new popup tabs are not recorded. Review every workflow before using it on important data.

Website: https://mimic-aradhya.vercel.app/extension
Privacy policy: https://mimic-aradhya.vercel.app/privacy
Support: odoisveryverygood@gmail.com

## Single purpose

Capture, replay, and verify user-demonstrated browser workflows, including spreadsheet-driven repetition of those workflows.

## Permission justifications

- debugger: Record interactions and replay fixed supported browser operations in the current tab explicitly selected by the user or a dedicated user-requested tab. Includes isolated outcome/regression testing through the existing dashboard. This permission is powerful; Chrome's indicator remains visible.
- storage: Save workflows, demonstrations, batch inputs/results, interrupted-session recovery, and the local account connection token.
- tabs: Read the title and URL of the active tab only when the user opens the recording flow; create or identify the selected workflow tab, detect closure and popup recording limitations, and open the associated website/account page. No general history collection.
- sidePanel: Display the extension's primary interface beside the user's current page.
- host permission for https://mimic-aradhya.vercel.app/*: Authenticated billing and usage requests to Mimic's own backend. No blanket host permission is requested.
- externally_connectable: Only the exact Mimic dashboard origin can request companion operations. Development loopback origins are absent from the production package.

## Remote code explanation

The extension UI and control logic are bundled. Workflow schema allows only fixed supported actions, with no arbitrary executable command type. User-entered HTML regression testing retained for the existing web dashboard runs through the Debugger API inside an isolated sandbox with network blocking; it is not loaded into an extension page. The reviewer can inspect engine.js/testRepair and the sandbox tests. MV3 has a documented Debugger API exception, but the reviewer determines policy compliance and single-purpose scope. Do not hide this functionality in the submission.

## Data disclosures to review in publisher dashboard

Potentially handles authentication information (session token), user activity (user-requested recording), website content (recorded inputs and results), personally identifiable information (account email). Workflow data stays local except for actions the user instructs the destination website to perform. Payment details are entered only on Stripe's hosted checkout when enabled. No sale of data, advertising use, or creditworthiness/lending determination. Complete the dashboard's exact disclosure options based on this implementation.

## Reviewer test steps (free; no paid account required)

1. Open Mimic from the toolbar to display the side panel.
2. Choose Save a reading. Click Test with review, then Continue this step when it pauses before saving. Observe the Reading Room confirmation.
3. Add final outcome selector #confirmation and text Saved; save it.
4. Download the practice CSV and upload it. Column names map automatically. Create and review the batch.
5. Start the batch. Each save checkpoints for review by default. Continue each requested action and observe three verified rows.
6. Export Results. Review the CSV containing per-row status and observed result text.
7. Set an impossible expected text and try a batch. It stops at the first failed row. Later rows stay pending.

## Submission checklist

Upload public/downloads/mimic-chrome-store.zip (manifest at archive root), not the user download ZIP (which has a containing directory). The bundled public key preserves the existing unpacked extension identity. For a new Web Store listing, verify the ID assigned by the publisher dashboard. If it differs, copy that listing’s public key into extension/identity.json, update the extension ID in the dashboard transport and the exact extension origin in api/cloud/[action].js, rebuild, and test pairing before publication. Do not assume the first store upload will keep the unpacked ID. Provide a 128px icon and 1280x800 screenshot(s) from store/assets. Review all declarations, pay any required publisher registration fee personally, and submit through your developer account. No store submission has occurred in this task.
