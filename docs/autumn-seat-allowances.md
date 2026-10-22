# Seat-scaled cloud allowances

Cloud usage remains one shared organization balance in Autumn. Plans can opt in
to a monthly allowance that scales with billable seats:

```json
{ "box_gb_minutes_per_seat": 19200 }
```

This is **Autumn plan metadata**, not an environment variable or customer grant.
The value must be a positive integer. Five seats receive 96,000 GB-minutes; six
receive 115,200. This is not a per-user cap. An 8 GB box consumes eight GB-minutes
per elapsed minute.

## Configuration

Set the metadata on each applicable Autumn plan, including `pro` and
`pro_annual`. The allowance item must be one finite, positive `box_gb_minutes`
grant resetting every month. Its optional overage price must be a flat monthly
usage-based price. The code refuses tiered prices, rollovers, expiry, feature
overrides, threshold billing, or ambiguous grants rather than silently changing
those terms. Separate zero-grant overage items are left alone.

Plans without this metadata keep their existing fixed allowances. Unlimited
allowances stay unlimited. Free plans must not gain a cloud allowance.

Enterprise contracts remain opt-in. Enable the metadata on an enterprise deal
only when its allowance is meant to follow the application's billable member
count, not a separate contracted minimum. Enterprise member changes resize only
the allowance; they do not change contracted seat pricing or create prorations.
Configure each enterprise deal plan separately, including newly imported deals.
The import script does not copy the enterprise template's opt-in setting.

## Application behavior

- Modern and released-client checkout paths use the same calculation as checkout
  previews.
- Member additions, removals, and account deletion update the shared allowance.
  Billable seats use the application's existing membership-count policy.
- The update removes and adds only the matching monthly allowance item. It does
  not replace the full plan or overwrite negotiated seat prices.
- The amount comes from current catalog metadata, while overage pricing comes
  from the customer's unique active attached plan, including its existing
  customizations. Updates pin that plan version. Its monthly grant must match
  the customer's balance breakdown before an update can proceed.
- The request carries existing consumable usage forward. It does not change the
  billing-cycle anchor. Annual seat pricing still gets a monthly cloud grant.
- Custom allowance changes are previewed before execution. A preview that resets
  usage is refused. Allowance-only changes also refuse any charge or credit.
- Adding a seat adds its full 19,200 GB-minutes to the current monthly grant
  (five to six seats: 96,000 to 115,200). Usage so far carries over and the reset
  date does not move. A removed seat stays billed and keeps its grant until
  renewal; the grant drops at the next cycle. Consumption is never erased and
  nothing is refunded.

## Sandbox verification gate

Before enabling this rule on live plans, verify it with Autumn sandbox
credentials and the existing Stripe test subscription:

1. Use a five-seat plan with 96,000 included GB-minutes and nonzero usage.
2. Preview six seats. Confirm the grant becomes 115,200, usage is carried forward,
   and the reset date and overage price are unchanged. Seat-price proration must
   match the existing seat policy.
3. Apply the test update, then decrease to five seats. Confirm the grant becomes
   96,000 without resetting usage or the monthly cycle.
4. Repeat for annual seat billing, an existing customer switching between
   monthly and annual plans with usage in more than one feature, a negotiated
   overage price, and an opted-in enterprise allowance-only update. The
   enterprise preview must total zero.
5. Confirm expanded `subscriptions.plan` includes attached customizations, and
   that adding/removing the allowance item does not remove separate overage
   items or change the seat's Stripe price linkage.

Unit tests verify the request construction and safety checks. They do not replace
these external billing checks. Do not enable live metadata until this gate passes.

## Existing organizations and imports

Deploy the code before enabling live plan metadata. Metadata enables the rule;
existing grants change on the next successful seat synchronization, not merely
when metadata is edited. To update an existing organization without changing its
seat invoice, use the preview-first script with explicit organization IDs:

```bash
bun packages/auth/scripts/sync-autumn-seat-allowances.ts --organization ORG_ID
```

Review the printed seat count, proposed included GB-minutes, zero total, and
`resetsUsage: false`. Only then apply the same operation:

```bash
bun packages/auth/scripts/sync-autumn-seat-allowances.ts --organization ORG_ID --apply
```

The script previews again before applying and verifies the resulting monthly
grant. Repeated `--organization` options are supported. There is no implicit
all-customer apply. Both modes require credentials for the intended environment;
the script does not change plan metadata or create customers.

Autumn's subscription import API does not accept these allowance customizations.
Run the allowance preview/apply step after importing opted-in subscriptions.
Changes made directly in Autumn rather than through application member hooks
also need this synchronization.

For transient Autumn API failures, the existing Stripe seat-billing fallback
remains available. The allowance may remain stale; the error is logged. A
configuration, balance-invariant, or unsafe-preview rejection is raised instead
of falling back to Stripe and bypassing the policy. Account purges log these
policy rejections and continue deletion without a direct Stripe update. Re-run
the explicit allowance synchronization after the failure is resolved. The
billing UI can take up to the existing cache TTL to reflect the new grant.
