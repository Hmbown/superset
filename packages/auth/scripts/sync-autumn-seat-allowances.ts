import { parseArgs } from "node:util";

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			organization: { type: "string", multiple: true },
			apply: { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
	});
	if (values.help) {
		console.log(
			"Usage: bun packages/auth/scripts/sync-autumn-seat-allowances.ts --organization ORG_ID [--organization ORG_ID ...] [--apply]",
		);
		return;
	}
	if (!values.organization?.length) {
		throw new Error(
			"Pass at least one --organization; previews are the default",
		);
	}
	const [autumn, customers, billing, allowances, features] = await Promise.all([
		import("../src/autumn"),
		import("../src/lib/billing/autumn/customer"),
		import("../src/utils/billing"),
		import("../src/lib/billing/autumn/seat-allowance"),
		import("../src/lib/billing/autumn/features"),
	]);
	for (const organizationId of new Set(values.organization)) {
		try {
			const seats = Math.max(
				1,
				await billing.countBillableSeats(organizationId),
			);
			const request = await customers.buildAutumnSeatUpdate(
				organizationId,
				seats,
				{ allowanceOnly: true },
			);
			if (!request) {
				console.log(`${organizationId}: unchanged or not configured`);
				continue;
			}
			const preview = await autumn.autumnClient.billing.previewUpdate(request);
			const included = request.customize?.addItems?.[0]?.included;
			console.log(
				JSON.stringify({
					organizationId,
					seats,
					includedGbMinutes: included,
					total: preview.total,
					currency: preview.currency,
					resetsUsage: preview.resetsUsage ?? false,
					apply: values.apply,
				}),
			);
			allowances.assertAllowancePreview(preview, { allowanceOnly: true });
			if (!values.apply) continue;
			await autumn.autumnClient.billing.update(request);
			const customer = await autumn.autumnClient.customers.get({
				customerId: organizationId,
			});
			const actual = customer.balances[
				features.BOX_GB_MINUTES_FEATURE_ID
			]?.breakdown
				?.filter(
					(item) =>
						item.planId === request.planId && item.reset?.interval === "month",
				)
				.reduce((sum, item) => sum + item.includedGrant, 0);
			if (actual !== included) {
				throw new Error(
					`Expected ${included} monthly GB-minutes after update, received ${actual}`,
				);
			}
			console.log(`${organizationId}: monthly grant verified`);
		} catch (error) {
			process.exitCode = 1;
			console.error(`${organizationId}: allowance sync failed`, error);
		}
	}
}

await main();
