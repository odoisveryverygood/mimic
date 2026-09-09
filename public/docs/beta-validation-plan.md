# Mimic beta validation plan

September 8, 2026 · Proposed research plan; no completed customer evidence yet

## Question to answer

Will small agencies repeatedly use and pay for teaching client-portal updates once, running them from spreadsheets, and reviewing a result for each row?

The first target is weekly status updates. Contact refresh and internal handoff notes are secondary hypotheses. Do not test all three at once if the primary job has not produced repeat use.

## Recruit five initial participants

Look for an agency operations lead, account manager, or coordinator who personally does a weekly spreadsheet-to-portal update. Ask which exact site, what record type, how many rows, how often, and how the work is done today. Ask whether the site has a bulk import or API that already solves it. The portal name, task volume, pain, and budget remain unknown until a participant provides evidence.

Recruitment is a proposed next action. These documents do not send outreach, enroll anyone, or collect customer data. Obtain permission before observing a session. Keep interview notes outside this public repository, use participant codes, and never store credentials or raw client records in the evidence log.

## Interview guide

1. Walk me through the last time you did this task. What triggered it?
2. Show a sanitized spreadsheet and the exact browser path, if permitted.
3. How often does it recur? How many rows did the last run contain?
4. Where do mistakes or interruptions happen, and how do you discover them?
5. What have you tried already? Why did you stop using it?
6. What would prevent you from installing an extension for this work?
7. Who could approve a subscription, and what do you currently spend on the task?
8. After the pilot, would you choose to use Mimic for the next scheduled occurrence?

Ask about observed behavior before presenting pricing. Do not treat positive reactions, hypothetical intent, or an interview as a purchase.

## Run an observed pilot

1. **Baseline:** time a small manual batch. Record row count, task shape, operator minutes, errors, and correction time. Use sanitized or authorized test records.
2. **First use:** let the participant try setup and the practice task. Record where help was required and the time to the first verified practice result.
3. **Real task:** teach one low-risk portal task. Replay on a second record, then use three rows. Independently inspect every attempted row on the website, including untouched records that could have been targeted incorrectly.
4. **Comparison:** count teaching, checkpoint, review, repair, and support time. Compare similar work; report setup cost separately from repeat-run cost. If the samples differ materially, label the comparison inconclusive.
5. **Return:** observe the next scheduled occurrence. Distinguish unaided use from a founder-operated demonstration. Weekly usage is meaningful only if the work actually recurs weekly.
6. **Payment:** after value is demonstrated and checkout is tested and enabled, offer the proposed $15/month plan. Record a real successful payment separately from “would pay.” Verify cancellation and support expectations.

## Evidence log

Use [beta-scorecard.csv](beta-scorecard.csv) as a blank local template. Add one row per observed participant session. Keep populated copies private. Suggested evidence is a consented observation note, sanitized result export, follow-up confirmation, or provider-confirmed payment; never fabricate missing values.

Definitions:

- **Verified:** directly observed or supported by a specific artifact.
- **Inference:** interpretation of evidence; state the basis.
- **Unknown:** not checked, unavailable, or no evidence yet. Unknown is not a negative finding.
- **Correct completion:** the intended record and changed values were independently inspected on the actual portal.
- **False success:** Mimic reported success but the intended change was missing or wrong.
- **Repeat use:** the customer used Mimic for a later occurrence of their real task.
- **Net operator time saved:** comparable manual operator time minus recording, operation, review, and repair time. Keep first-use and repeat-use figures separate. Do not replace missing observations with estimates presented as measurements.

## Proposed decision gates

These are our operating choices, not industry benchmarks or achieved results.

Continue a focused beta when five suitable users have tried a real task, at least three return for a later occurrence, and the target workflow completes correctly with acceptable review and support time. Any false success or unintended duplicate must be investigated before expanding use.

Start broader paid distribution after the payment and store launch requirements are complete and at least three customers have actually paid and returned. Calculate hosting, payment, and support costs before claiming the $15 plan is sustainable.

Reconsider the segment if the workflow rarely recurs, a native import already does the job, permissions prevent adoption, the browser path is unsupported, or fixing each recording costs more than the saved work. Document the evidence and revise the target before adding broad new features.

## Current evidence register

| Claim | Status | Basis / next check |
| --- | --- | --- |
| Recorder, replay, and checked batches are implemented | Verified in project tests | Existing Mimic verification; does not establish compatibility with a customer portal |
| Agencies need this particular workflow | Unknown | Observe five qualified participants |
| A specific external portal is supported | Unknown | Validate the exact workflow on that portal |
| Mimic reduces total operator time | Unknown | Measure comparable manual and Mimic sessions |
| $15/month is acceptable and sustainable | Unknown | Observe payments, repeat use, and support costs |
| The target customer will return weekly | Unknown | Observe the next real occurrence |

No automated analytics, waitlist, outreach, or payment activation is added by this plan.
