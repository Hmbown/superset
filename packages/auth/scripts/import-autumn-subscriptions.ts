import { db } from "@superset/db/client";
import { subscriptions } from "@superset/db/schema";
import * as authSchema from "@superset/db/schema/auth";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@superset/shared/billing";
import { desc, eq, inArray } from "drizzle-orm";
import { autumnClient } from "../src/autumn";
import { env } from "../src/env";
import { paidPlanIdFromFlags } from "../src/lib/billing/autumn/entitlements";
import { SEATS_FEATURE_ID } from "../src/lib/billing/autumn/features";
import { seatItem } from "../src/lib/billing/autumn/subscription-row";
import {
	PRO_ANNUAL_PLAN_ID,
	PRO_MONTHLY_PLAN_ID,
} from "../src/lib/billing/legacy/plan-ids";
import { stripeClient } from "../src/stripe";

const PLAN_BY_PRICE: Record<string, string> = {
	[env.STRIPE_PRO_MONTHLY_PRICE_ID]: PRO_MONTHLY_PLAN_ID,
	[env.STRIPE_PRO_YEARLY_PRICE_ID]: PRO_ANNUAL_PLAN_ID,
	[env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID]: "enterprise",
};

const apply = process.argv.includes("--apply");

async function main() {
	const autumn = autumnClient;
	const rows = await db
		.select({
			organizationId: subscriptions.referenceId,
			stripeSubscriptionId: subscriptions.stripeSubscriptionId,
			name: authSchema.organizations.name,
			stripeCustomerId: authSchema.organizations.stripeCustomerId,
		})
		.from(subscriptions)
		.innerJoin(
			authSchema.organizations,
			eq(authSchema.organizations.id, subscriptions.referenceId),
		)
		.where(inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES]))
		.orderBy(desc(subscriptions.createdAt));

	const seen = new Set<string>();
	const counts = { imported: 0, alreadyLinked: 0, skipped: 0, drifted: 0 };
	const verify = async (organizationId: string) => {
		const result = await autumn.billing.verify({ customerId: organizationId });
		const mismatched = result.subscriptions.filter(
			(subscription) => subscription.mismatches.length > 0,
		);
		if (result.customerMismatches.length > 0 || mismatched.length > 0) {
			counts.drifted += 1;
			console.log(
				`[autumn-import] drift ${organizationId}: ${JSON.stringify({
					customer: result.customerMismatches,
					subscriptions: mismatched,
				})}`,
			);
		}
	};
	for (const row of rows) {
		if (seen.has(row.organizationId)) continue;
		seen.add(row.organizationId);
		const label = `${row.organizationId} (${row.stripeSubscriptionId})`;
		try {
			if (!row.stripeSubscriptionId || !row.stripeCustomerId) {
				counts.skipped += 1;
				console.log(`[autumn-import] skip ${label}: no Stripe ids`);
				continue;
			}
			const existing = await autumn.customers
				.get({ customerId: row.organizationId, expand: ["flags.feature"] })
				.catch(() => null);
			if (existing && paidPlanIdFromFlags(existing.flags)) {
				counts.alreadyLinked += 1;
				await verify(row.organizationId);
				continue;
			}
			const stripeSubscription = await stripeClient.subscriptions.retrieve(
				row.stripeSubscriptionId,
			);
			const seat = seatItem(stripeSubscription);
			const planId = seat ? PLAN_BY_PRICE[seat.price.id] : undefined;
			console.log(
				`[autumn-import] ${label}: status=${stripeSubscription.status} items=${stripeSubscription.items.data.length} discounts=${stripeSubscription.discounts.length} trial_end=${stripeSubscription.trial_end ?? "-"}`,
			);
			if (!seat || !planId) {
				counts.skipped += 1;
				console.log(
					`[autumn-import] skip ${label}: unknown price ${seat?.price.id}`,
				);
				continue;
			}
			const result = await autumn.billing.import({
				customerId: row.organizationId,
				customerData: { name: row.name },
				processors: [{ type: "stripe", id: row.stripeCustomerId }],
				billables: [
					{
						processor: "stripe",
						link: { subscriptionId: row.stripeSubscriptionId },
						plan: {
							planId,
							featureQuantities: [
								{ featureId: SEATS_FEATURE_ID, quantity: seat.quantity ?? 1 },
							],
						},
					},
				],
				dryRun: !apply,
			});
			const problems = result.flashed.filter(
				(entry) => entry.mismatch || entry.skipped,
			);
			if (problems.length > 0) {
				counts.skipped += 1;
				console.log(
					`[autumn-import] skip ${label}: ${JSON.stringify(problems)}`,
				);
				continue;
			}
			counts.imported += 1;
			if (apply) await verify(row.organizationId);
		} catch (error) {
			counts.skipped += 1;
			console.error(`[autumn-import] failed ${label}`, error);
		}
	}

	console.log(
		`[autumn-import] ${apply ? "imported" : "would import"} ${counts.imported}, already linked ${counts.alreadyLinked}, skipped ${counts.skipped}, drifted ${counts.drifted}, of ${seen.size} organizations. Flip BILLING_PROVIDER only when skipped and drifted are both 0.`,
	);
}

await main();
