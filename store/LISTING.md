# Chrome Web Store draft

Name: Mimic — Your personal repeat button

Summary: Teach everyday browser tasks once. Repeat them with new details, save time on routine clicks, and check the results.

Category: Workflow & Planning

Language: English

## Description

Less clicking. More living. Show Mimic a small browser task once, then repeat it with new details and see what happened.

Save good reads, collect trip ideas, or keep a wishlist. Start with the real Reading Room example, then teach a task on a website you use. Other websites require their own recording and checks. Read the everyday guide at https://mimic-aradhya.vercel.app/docs.

Mimic lives in Chrome's side panel. Record the steps in your current tab or a new tab, review the inputs and checkpoints, and run them again with new values. Type items directly into a list. CSV import is available if you already have a spreadsheet. Preview the list and explicitly start it, then inspect each result.

Pick a visible success message on the page. Mimic turns it into a final text check and substitutes unambiguous recorded inputs when you use new values. Mimic marks rows verified only after observing the expected result. If a row fails or Chrome is interrupted, the batch stops for review. You can inspect the destination, mark a row manually confirmed or skipped, and continue the pending rows. Completed rows are never automatically replayed.

Free includes three custom workflows, a practice workflow, and batches of up to three rows. Paid plans are still being prepared; consumer pricing is not finalized and checkout is currently unavailable.

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

1. Open Mimic from the toolbar to display the side panel. Click See it actually work and observe a reading saved in the Reading Room with its exact title and shelf checked.
2. Open Save your first reading, change its title and URL under Run once, and click Run task. Observe the changed saved result.
3. Choose Run a list. Type the details for two items using Add another item. Preview my list, then Review batch. No spreadsheet is required.
4. Start the batch and observe two verified items. Inspect Inputs & observed result, then Export results.
5. Return to the task, choose Run a list, and try Use 3 example rows. CSV import is also available under Import a CSV file instead.
6. Teach a task on the practice site, pick the exact success result, finish, and save. Try different inputs and check the result. Saved checkpoints pause for review.
7. Set an impossible expected text in Task details and try a list. It stops at the first uncertain item and leaves later items pending. Inspect the site before confirming or skipping.
8. Open Ideas & how-to guides to see the consumer examples and sample downloads. These examples do not imply external-site integrations.

## Submission checklist

Upload public/downloads/mimic-chrome-store.zip (manifest at archive root), not the user download ZIP (which has a containing directory). The bundled public key preserves the existing unpacked extension identity. For a new Web Store listing, verify the ID assigned by the publisher dashboard. If it differs, copy that listing’s public key into extension/identity.json, update the extension ID in the dashboard transport and the exact extension origin in api/cloud/[action].js, rebuild, and test pairing before publication. Do not assume the first store upload will keep the unpacked ID. Provide a 128px icon and 1280x800 screenshot(s) from store/assets. Review all declarations, pay any required publisher registration fee personally, and submit through your developer account. No store submission has occurred in this task.
