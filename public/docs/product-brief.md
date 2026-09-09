# Mimic: client updates, on repeat

Product direction · September 8, 2026

## The promise

Show Mimic one client-portal update. Give it your spreadsheet. It repeats the work and checks the result of each row.

## Our first customer

**Target hypothesis:** an operations coordinator or account manager at a small service agency who repeatedly transfers approved spreadsheet updates into a client's web portal. The likely buyer is the agency owner or operations lead; the person doing the work should be involved in evaluation.

Start with agencies that have a recurring weekly task, a single-tab portal, an unambiguous record identifier, and a visible result that includes the updated record and values. Qualify out workflows that already have a satisfactory bulk import or API solution. A named customer portal must pass an observed trial before we describe it as supported.

Agency size, time spent, willingness to pay, and the availability of these workflows are unvalidated. This brief is a product decision, not market research or evidence of demand.

## The first job

When approved weekly statuses are ready in my spreadsheet, help me update the matching records in a client's portal and identify anything that needs review, so I can finish the handoff without repeatedly copying fields or guessing which rows saved.

**Before:** find a record, copy its new status and note, save, check the result, mark the spreadsheet, and repeat.

**With Mimic:** teach the full path from finding one record through saving and checking it; run once with another record; map a short CSV to those inputs; review the results and any uncertain row.

The benefit to validate is less total operator time with correct outcomes. Include recording, checkpoints, review, and repair time in the comparison. Do not claim a percentage or hours saved before measuring it.

## Scope of the first offer

1. Primary: weekly client-record status updates.
2. Secondary hypothesis: refreshing approved contact details in a client portal.
3. Secondary hypothesis: adding an internal handoff note to the correct record.

The [workflow playbook](workflow-playbook.md) defines inputs, checks, and limits. These are recipes to teach on the customer's site, not installed integrations or preconfigured working templates.

## Why someone might pay

Mimic combines a demonstration in the user's browser, editable inputs from a spreadsheet, and a saved outcome for each attempted row. An uncertain result stops the list for review. The customer can use their existing login and inspect the work in the visible browser.

The commercial hypothesis is that this saves enough recurring operator time to justify a subscription while requiring little ongoing support. Validate that against the customer's current process and alternatives. Browser automation alone is not evidence of differentiation or willingness to pay.

## Current delivery and limits

- A Chrome side panel and hosted companion website are built. Installation is currently unpacked; Chrome Web Store publication is pending.
- Recording, replay, editable inputs, CSV mapping, per-row outcome checks, and result export are implemented. The existing reading-form demo is a working practice exercise, not a customer-portal case study.
- Workflows and CSV contents stay in the Chrome profile. Chrome must remain open; there is no unattended cloud execution or team library sync.
- The initial supported shape is a single tab with ordinary browser controls. Multi-tab flows, embedded frames, file uploads, drag-and-drop, and CAPTCHA automation are outside this offer.
- Free currently permits three custom tasks and three rows per list. The proposed Pro price is $15/month; paid checkout remains disabled pending payment setup and testing. This brief does not change pricing or quotas.
- Login, ambiguous outcomes, and saved checkpoints can require human attention. Site changes can require a revised recording.

## Positioning rules

Use: “Client updates, on repeat”; “Teach one update, repeat it from a spreadsheet, check each result”; “Built for repeatable client-portal work.”

Do not use: “works on every site,” “fully autonomous,” “guaranteed results,” “saves hours” without measured evidence, invented customer logos, or claims that AI planning is implemented.

## Next decision

Find five target users with a real recurring workflow. Observe a baseline, help them teach one low-risk task, and see whether they return for the next scheduled use. Follow the [beta validation plan](beta-validation-plan.md). No customer interviews, payments, or portal compatibility are established by publishing these documents.
