import type { autumnClient } from "../../../autumn";
import { paidPlanIdFromFlags } from "./entitlements";
import { BOX_GB_MINUTES_FEATURE_ID, SEATS_FEATURE_ID } from "./features";

type Plan = Awaited<ReturnType<typeof autumnClient.plans.get>>;
type Update = Parameters<typeof autumnClient.billing.update>[0];
type AllowanceUpdate = Pick<Update, "customize" | "carryOverUsages">;
type Customer = Awaited<ReturnType<typeof autumnClient.customers.get>>;

export const GB_MINUTES_PER_SEAT_METADATA_KEY = "box_gb_minutes_per_seat";

export class SeatAllowanceError extends Error {}

export async function withRetry<T>(
	run: () => Promise<T>,
	{ attempts = 3, delayMs = 500 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run();
		} catch (error) {
			if (error instanceof SeatAllowanceError || attempt >= attempts) {
				throw error;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, delayMs * 2 ** (attempt - 1)),
			);
		}
	}
}

export function assertAllowancePreview(
	preview: { resetsUsage?: boolean; total: number },
	{ allowanceOnly = false }: { allowanceOnly?: boolean } = {},
): void {
	if (preview.resetsUsage) {
		throw new SeatAllowanceError(
			"Cloud allowance update would reset existing usage",
		);
	}
	if (allowanceOnly && preview.total !== 0) {
		throw new SeatAllowanceError(
			"Cloud allowance update would create a charge or credit",
		);
	}
}

export async function applySeatUpdate(
	request: Update,
	api: {
		previewUpdate: (
			request: Update,
		) => Promise<{ resetsUsage?: boolean; total: number }>;
		update: (request: Update) => Promise<unknown>;
	},
	options?: { allowanceOnly?: boolean },
): Promise<void> {
	if (request.customize) {
		assertAllowancePreview(await api.previewUpdate(request), options);
	}
	await api.update(request);
}

export function seatAllowanceUpdate(
	plan: Pick<Plan, "items" | "metadata">,
	quantity: number,
): AllowanceUpdate | null {
	const rate = plan.metadata[GB_MINUTES_PER_SEAT_METADATA_KEY];
	if (rate === undefined) return null;
	if (
		typeof rate !== "number" ||
		!Number.isSafeInteger(rate) ||
		rate <= 0 ||
		!Number.isSafeInteger(quantity) ||
		quantity < 1 ||
		!Number.isSafeInteger(rate * quantity)
	) {
		throw new SeatAllowanceError(
			"Invalid seat-scaled cloud allowance configuration",
		);
	}
	const items = plan.items.filter(
		(item) => item.featureId === BOX_GB_MINUTES_FEATURE_ID,
	);
	if (items.some((item) => item.unlimited)) return null;
	const grants = items.filter((item) => (item.included ?? 0) > 0);
	const grant = grants[0];
	if (
		grants.length !== 1 ||
		!grant ||
		grant.reset?.interval !== "month" ||
		(grant.reset.intervalCount ?? 1) !== 1
	) {
		throw new SeatAllowanceError(
			"Seat-scaled cloud allowance needs one monthly grant",
		);
	}
	const included = rate * quantity;
	if (grant.included === included) return null;
	const price = grant.price;
	if (
		grant.rollover ||
		grant.expiry ||
		grant.featureOverride ||
		grant.thresholdBilling ||
		(price &&
			(price.billingMethod !== "usage_based" ||
				price.interval !== "month" ||
				(price.intervalCount ?? 1) !== 1 ||
				price.tiers ||
				price.amount === undefined))
	) {
		throw new SeatAllowanceError(
			"Unsupported seat-scaled cloud allowance item",
		);
	}
	return {
		customize: {
			removeItems: [
				{
					featureId: BOX_GB_MINUTES_FEATURE_ID,
					included: grant.included,
					interval: "month",
				},
			],
			addItems: [
				{
					featureId: BOX_GB_MINUTES_FEATURE_ID,
					included,
					pooled: grant.pooled,
					reset: { interval: "month", intervalCount: 1 },
					...(price
						? {
								price: {
									amount: price.amount,
									additionalCurrencies: price.additionalCurrencies,
									interval: "month",
									intervalCount: 1,
									billingMethod: "usage_based",
									billingUnits: price.billingUnits,
									maxPurchase: price.maxPurchase,
								},
							}
						: {}),
				},
			],
		},
		carryOverUsages: { enabled: true },
	};
}

export function checkoutSeatAllowanceUpdate(
	plan: Pick<Plan, "items" | "metadata">,
	quantity: number,
): AllowanceUpdate | null {
	const update = seatAllowanceUpdate(plan, quantity);
	if (plan.metadata[GB_MINUTES_PER_SEAT_METADATA_KEY] === undefined)
		return null;
	return { ...update, carryOverUsages: { enabled: true } };
}

export type GrantDecrease = "never" | "when-unused";

export interface SeatUpdate {
	request: Update | null;
	seatsOnly: Update | null;
	allowanceError: SeatAllowanceError | null;
}

function customerAllowance(
	customer: Pick<Customer, "balances">,
	plan: Pick<Plan, "items" | "metadata">,
	planId: string,
	quantity: number,
	decrease: GrantDecrease,
): AllowanceUpdate | null {
	const allowance = seatAllowanceUpdate(plan, quantity);
	const cloudItems = plan.items.filter(
		(item) => item.featureId === BOX_GB_MINUTES_FEATURE_ID,
	);
	if (
		plan.metadata[GB_MINUTES_PER_SEAT_METADATA_KEY] === undefined ||
		cloudItems.some((item) => item.unlimited)
	) {
		return allowance;
	}
	const balance = customer.balances[BOX_GB_MINUTES_FEATURE_ID];
	const breakdowns = balance?.breakdown?.filter(
		(item) => item.planId === planId && item.reset?.interval === "month",
	);
	const actual = breakdowns?.reduce((sum, item) => sum + item.includedGrant, 0);
	const expected = cloudItems.reduce((sum, item) => sum + item.included, 0);
	if (!breakdowns?.length || actual !== expected) {
		throw new SeatAllowanceError(
			"Attached cloud allowance does not match its balance",
		);
	}
	const included = allowance?.customize?.addItems?.[0]?.included;
	if (included === undefined || included >= expected) return allowance;
	if (decrease === "when-unused" && (balance?.usage ?? 0) <= included) {
		return allowance;
	}
	return null;
}

export function seatUpdateForCustomer(
	customer: Pick<Customer, "flags" | "subscriptions" | "balances">,
	organizationId: string,
	quantity: number,
	{
		allowanceOnly = false,
		metadata,
		grantDecrease = "never",
	}: {
		allowanceOnly?: boolean;
		metadata?: Plan["metadata"];
		grantDecrease?: GrantDecrease;
	} = {},
): SeatUpdate | null {
	const planId = paidPlanIdFromFlags(customer.flags);
	if (!planId) return null;
	const subscriptions = customer.subscriptions.filter(
		(item) => item.planId === planId && item.status !== "scheduled",
	);
	const subscription = subscriptions[0];
	if (subscriptions.length !== 1 || !subscription?.plan) {
		throw new SeatAllowanceError(
			`Missing unique active Autumn plan for ${organizationId}`,
		);
	}
	const plan = {
		...subscription.plan,
		metadata: metadata ?? subscription.plan.metadata,
	};
	let allowance: AllowanceUpdate | null = null;
	let allowanceError: SeatAllowanceError | null = null;
	try {
		allowance = customerAllowance(
			customer,
			plan,
			planId,
			quantity,
			grantDecrease,
		);
	} catch (error) {
		if (!(error instanceof SeatAllowanceError)) throw error;
		allowanceError = error;
	}
	const base = {
		customerId: organizationId,
		planId,
		version: subscription.plan.version,
	};
	if (allowanceOnly) {
		return {
			request: allowance
				? { ...base, prorationBehavior: "none" as const, ...allowance }
				: null,
			seatsOnly: null,
			allowanceError,
		};
	}
	const billedSeats = customer.balances[SEATS_FEATURE_ID]?.granted;
	const seatsOnly: Update = {
		...base,
		featureQuantities: [{ featureId: SEATS_FEATURE_ID, quantity }],
		...(billedSeats !== undefined && quantity < billedSeats
			? { prorationBehavior: "none" as const }
			: {}),
	};
	return {
		request: allowance ? { ...seatsOnly, ...allowance } : seatsOnly,
		seatsOnly,
		allowanceError,
	};
}
