# Mimic agency workflow playbook

September 8, 2026 · Three recipes to validate on a customer's portal

These are guides for teaching your own task. They are not prebuilt integrations. The CSV files contain fictional data and must be adapted before use on a real website. A CSV does not create a workflow by itself.

## First, prove the basics

Install and connect Mimic, then click **See it actually work** on My tasks. It fills the included reading form and checks the save. Open that practice task, choose **Run a list**, and select **Use 3 example rows** to learn mapping and row results. The agency CSVs below belong to your own agency recordings, not this reading example.

## Choose a suitable portal

Use a single-tab task with a repeatable path, a unique record identifier, and a visible outcome containing that identifier and the changed value. Sign in before recording. Start with test records or reversible edits you are authorized to make. Confirm the website permits your intended use.

Prefer an existing bulk import if it already handles the job well. Avoid the initial pilot if it depends on embedded frames, multiple tabs, uploads, drag-and-drop, CAPTCHA, sending client messages, payments, or destructive changes.

## 1. Weekly status updates — primary workflow

**Job:** transfer approved status and note changes from an agency spreadsheet into the matching client records.

**CSV:** [weekly-status.csv](weekly-status.csv)

| Field | Meaning | Example |
| --- | --- | --- |
| record_id | Unique portal record identifier | DEMO-104 |
| status | Exact option or text accepted by the portal | In progress |
| note | Approved internal update | Draft prepared for review |

**Teach:** open the portal's search page → search the unique identifier → open the matching record → choose the status → fill the note → save → select the visible saved record and changed status using **Pick success** → **Finish** → **Save task**.

Record the search from a repeatable starting page. Avoid baking the first record's identity into an unchanging link or selector. If opening a second record uses a different element, inspect **Task details** and verify the replay targets the right record before using a list.

**Check:** a result such as “DEMO-104 — In progress” that changes when either the identifier or status changes. A generic “Saved” toast alone does not prove the correct record was updated. Review the expected text in Task details; short or ambiguous identifiers may need manual adjustment.

**Trial:** run once with a second test record and different status. Inspect that record and confirm the original record was not overwritten. Only then map a three-row CSV and start the batch.

## 2. Contact refresh — secondary hypothesis

**Job:** update approved contact details for existing client records without creating duplicate contacts.

**CSV:** [contact-refresh.csv](contact-refresh.csv)

Fields: `record_id`, `contact_name`, `contact_email`. Email examples use the reserved example.com domain.

**Teach:** search a unique record ID → open contact details in the same tab → replace name and email → save → pick a visible result containing the record ID and new email → finish and save the task.

**Check:** confirm the correct record has the new email. Keep the record ID as the lookup key; do not rely on a non-unique person's name. Begin with test contacts, and ensure this action does not trigger notifications or invitations.

**Trial:** change a second record with a distinct email, inspect both records, then try three rows. A portal with a good contact import may not be a useful Mimic customer for this job.

## 3. Internal handoff note — secondary hypothesis

**Job:** place an approved internal handoff note on the correct client record.

**CSV:** [handoff-notes.csv](handoff-notes.csv)

Fields: `record_id`, `note_ref`, `note`. A unique note reference such as HANDOFF-DEMO-104 helps identify the exact saved note.

**Teach:** search the record ID → open its internal notes section → fill the note reference and note → save → pick a visible result containing the record ID and note reference → finish and save.

**Check:** identify the specific new internal note, not a generic confirmation. If the portal has no separate reference field, include the reference in the note and adjust the spreadsheet mapping accordingly. Check that “save note” does not also send a message.

**Trial:** use a disposable record first. Appending notes can create duplicates, so an uncertain result must be inspected before any rerun. Mimic pauses uncertain batch rows; it cannot undo an external save.

## Run a list

1. Teach and save a task with a final success check.
2. Run once using different inputs and inspect the actual website result.
3. Choose **Run a list**. Upload or paste your CSV.
4. Map each learned input to the matching spreadsheet column. Labels depend on the website; they may differ from these CSV headings. If an input is missing or an irrelevant field is required, revise the task first.
5. Choose **Review batch** and check each row before **Start batch**. Free supports three rows per list; do not promise paid capacity before billing is ready.
6. Keep Chrome open. Complete any review checkpoints. Inspect **Activity** and export the results.
7. If a row needs review, inspect the website. Confirm it only when you observed the intended result; otherwise skip with a truthful note. Continue pending rows. Do not restart the entire list blindly.

## What a result means

“Verified” means the configured visible outcome check passed. It is only as strong as the text and element you selected; it is not an independent audit of the portal's database. “Confirmed by you” records your manual review. “Skipped” is not completed work.

Retain the source CSV and exported results. Back up the local library before updating or removing the extension. Full extension-library restore and automatic history cleanup remain launch work; do not treat backup export alone as a tested recovery system.
