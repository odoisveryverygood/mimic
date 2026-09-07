# Mimic 3: Chrome workflows and spreadsheet batches

Mimic now opens as a native Chrome side panel. Record a workflow, test it with review checkpoints, define a final text outcome, map CSV columns to its inputs, and run the rows sequentially. An interrupted or failed row requires explicit review. Verified, manually confirmed, skipped, and pending rows are distinct. Continuing a batch only executes pending rows; it never automatically retries uncertain rows.

## Included

- Manifest V3 side panel, bundled UI and icons, stable existing extension identity.
- Recording controls, demonstration review, workflow inputs, single-run tests, checkpoint controls, and a final outcome editor.
- RFC-style quoted CSV parsing, BOM support, input validation, 1 MB/100-row file caps, mapped previews, result export with spreadsheet-formula neutralization.
- A saved copy of the workflow per batch; edits to the original do not alter queued rows.
- Crash recovery correlates saved run IDs to row IDs. No unattended retries. Stop-after-row and immediate active-run cancellation.
- Free: three saved custom workflows plus practice, batches up to three rows. Existing workflows remain accessible after upgrade/downgrade.
- Pro offer: $15 USD/month, 100 workflows, 100 rows per batch, 1,000 batch rows per UTC calendar month. Failed attempts count; no metered charges or overages. Payments remain disabled until the account is activated and the integration is verified.
- Neon Auth email sign-in, verification code, password reset, a server-verified connection to one Chrome profile, 30-day expiry, and revoke control.
- Neon Postgres schema managed by Drizzle; Stripe hosted Checkout and customer portal handlers; signature-verified webhook, mode and price guards; serialized subscription refresh; server-side quota reservations.
- Account and subscription records only are uploaded. CSVs, recorded values, page text, and results remain in the Chrome profile. Billing access tokens are separate from library backups and stored hashed on the server.

## Validation

`npm run check` and all 19 tests pass, including actual Chrome recording/replay and new side-panel CSV-to-two-verified-rows flow. A failing outcome check stops before row 2. `scripts/verify-billing-db.mjs` on the isolated `billing-validation` Neon branch proves eight concurrent repeats consume one row, concurrent requests cannot exceed the 1,000-row cap, cancellation denies Pro usage, and forged device tokens/webhook signatures fail. These are software and database checks, not an actual Stripe payment.

## Launch boundaries

- Stripe profile was verified as odoisveryverygood@gmail.com, account `acct_1TO24hHx5cHqu8bO`. The dashboard confirms a recent ChatGPT OAuth authorization, and the OAuth callback page visibly reports Authorization successful. The tool connection then returned `Unknown tool` in this task, so further connector operations remain unavailable. Through the signed-in dashboard, a **test-mode** Mimic Pro product `prod_VDZu3biCGjkbIQ` and $15 USD monthly price `price_1UD8kKHx5cHqu8bOJNNNz2Cx` were created and verified. No key, webhook registration, checkout session, charge, or paid subscription was created. Payout onboarding is still open for the user to finish.
- Required Stripe planner is unavailable without a valid account context; implementation follows the installed Stripe skill and official Checkout/subscription/webhook documentation. Run the planner after connector recovery and reconcile before enabling billing.
- Auth currently uses Neon's shared email provider. Configure dedicated SMTP, disable production localhost access, and verify actual sign-up, OTP delivery, reset, and account-to-extension pairing before accepting customers. The code requires verified email before pairing or checkout. Shared Google OAuth is not offered in the UI.
- Browser automation cannot guarantee exactly-once effects on an arbitrary third-party site. Ambiguous rows stop and require human inspection; no retry mechanism attempts to infer whether submission happened.
- Outcome checks look for visible expected text, not an independently queried destination API. Choose a selector specific to the completed action.
- Embedded frames and popup-tab workflows are not recorded. Workflows run only while Chrome is open. Free workflows do not need the account server.
- Chrome storage has finite capacity. Export your library/results and manage retained data as needed. Account sync does not move workflow data between devices.
- Chrome Web Store package and listing assets are prepared. The extension is not yet submitted, reviewed, or listed. Store approval cannot be guaranteed.

## Production setup after Stripe reconnects

1. Confirm the account matching the selected email with the Stripe connector; use a sandbox first and clearly distinguish it from live mode. Run Stripe's implementation planner for this exact flat-rate SaaS model.
2. Reuse the verified test-mode product and price above for sandbox testing; create separate live objects only after activation. Configure the customer portal to allow cancellation and payment-method updates. Configure taxes only after identifying the appropriate registrations.
3. Create a restricted server API key with the necessary Customer, Price, Checkout, Subscription, Portal, and Account read/write scope. Keep it only in sensitive Vercel environment variables. Set `STRIPE_ACCOUNT_ID` to the verified exact account ID.
4. Register `https://mimic-aradhya.vercel.app/api/cloud/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Set its signing secret and the price ID.
5. In a sandbox deployment, test Checkout success, authentication-required and failed payments, webhook replay, renewal, cancellation, portal access, duplicate checkout, and server-side entitlement enforcement. Do not charge a real card for tests.
6. Once those checks and account activation succeed, use separately verified live credentials/price/webhook, `STRIPE_LIVE_MODE=true` and `MIMIC_BILLING_ENABLED=true`. Deploy and verify before promoting the paid offering.

## Source references

- https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- https://docs.stripe.com/payments/checkout/build-subscriptions
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/webhooks
- https://neon.com/docs/auth/quick-start/react
- https://neon.com/docs/auth/guides/plugins/jwt
- https://neon.com/docs/auth/guides/plugins/email-otp
- https://neon.com/docs/auth/production-checklist

## Installed upgrade

The existing unpacked companion folder was updated, its card reloaded in Chrome, and version 3.0.0 was verified enabled with the original extension ID. Mimic is pinned, its native side panel opened successfully, and the preexisting practice command and recorded Demo were preserved.
