import { describe, expect, test } from "bun:test";
import {
	applySeatUpdate,
	assertAllowancePreview,
	checkoutSeatAllowanceUpdate,
	SeatAllowanceError,
	seatAllowanceUpdate,
	seatUpdateForCustomer,
	withRetry,
} from "./seat-allowance";

type Plan = Parameters<typeof seatAllowanceUpdate>[0];
type Customer = Parameters<typeof seatUpdateForCustomer>[0];
type Item = Plan["items"][number];
type FixturePlan = Omit<Plan, "items"> & {
	items: [Item, Item & { price: NonNullable<Item["price"]> }];
};

function plan(): FixturePlan {
	return {
		metadata: { box_gb_minutes_per_seat: 10_000 },
		items: [
			{
				featureId: "seats",
				included: 0,
				unlimited: false,
				pooled: false,
				reset: null,
				price: {
					amount: 180,
					interval: "year",
					billingMethod: "prepaid",
					billingUnits: 1,
					maxPurchase: null,
					processors: { stripe: { priceId: "price_negotiated" } },
				},
			},
			{
				featureId: "box_gb_minutes",
				included: 50_000,
				unlimited: false,
				pooled: false,
				reset: { interval: "month", intervalCount: 1 },
				price: {
					amount: 1,
					additionalCurrencies: [{ currency: "eur", amount: 0.9 }],
					interval: "month",
					billingMethod: "usage_based",
					billingUnits: 1_000,
					maxPurchase: 200_000,
					processors: { stripe: { priceId: "price_memory" } },
				},
			},
		],
	};
}

function customer(attachedPlan: Plan, planId = "pro_annual"): Customer {
	return {
		flags: { pro_access: { planId } },
		subscriptions: [
			{ planId, status: "active", plan: { ...attachedPlan, version: 7 } },
		],
		balances: {
			box_gb_minutes: {
				breakdown: [
					{
						planId,
						includedGrant: attachedPlan.items
							.filter((item) => item.featureId === "box_gb_minutes")
							.reduce((sum, item) => sum + item.included, 0),
						reset: { interval: "month" },
					},
				],
			},
		},
	} as Customer;
}

describe("seatAllowanceUpdate", () => {
	test("six seats get a shared 60k monthly grant without replacing seat pricing", () => {
		const source = plan();
		const original = structuredClone(source);
		const update = seatAllowanceUpdate(source, 6);
		expect(update).toEqual({
			customize: {
				removeItems: [
					{ featureId: "box_gb_minutes", included: 50_000, interval: "month" },
				],
				addItems: [
					{
						featureId: "box_gb_minutes",
						included: 60_000,
						pooled: false,
						reset: { interval: "month", intervalCount: 1 },
						price: {
							amount: 1,
							additionalCurrencies: [{ currency: "eur", amount: 0.9 }],
							interval: "month",
							intervalCount: 1,
							billingMethod: "usage_based",
							billingUnits: 1_000,
							maxPurchase: 200_000,
						},
					},
				],
			},
			carryOverUsages: { enabled: true },
		});
		expect(source).toEqual(original);
	});

	test("a seat decrease changes the grant without resetting usage or the cycle", () => {
		const source = plan();
		source.items[1].included = 60_000;
		expect(
			seatAllowanceUpdate(source, 5)?.customize?.addItems?.[0]?.included,
		).toBe(50_000);
	});

	test("an already-scaled grant is left alone on repeated synchronization", () => {
		expect(seatAllowanceUpdate(plan(), 5)).toBeNull();
	});

	test("plans without the Autumn setting keep their fixed grant", () => {
		const source = plan();
		source.metadata = {};
		expect(seatAllowanceUpdate(source, 6)).toBeNull();
	});

	test("unlimited cloud access is never replaced by a finite grant", () => {
		const source = plan();
		source.items[1].unlimited = true;
		expect(seatAllowanceUpdate(source, 6)).toBeNull();
	});

	test("invalid metadata is rejected instead of silently changing an allowance", () => {
		const source = plan();
		source.metadata.box_gb_minutes_per_seat = "10000";
		expect(() => seatAllowanceUpdate(source, 6)).toThrow("Invalid seat-scaled");
	});

	test("non-monthly grants cannot accidentally become monthly", () => {
		const source = plan();
		source.items[1].reset = { interval: "year" };
		expect(() => seatAllowanceUpdate(source, 6)).toThrow("one monthly grant");
	});

	test("tiered overage pricing is rejected rather than changing tier boundaries", () => {
		const source = plan();
		source.items[1].price.tiers = [{ to: "inf", amount: 1 }];
		expect(() => seatAllowanceUpdate(source, 6)).toThrow("Unsupported");
	});
});

describe("checkoutSeatAllowanceUpdate", () => {
	test("an interval switch carries usage even when five seats already get 50k", () => {
		expect(checkoutSeatAllowanceUpdate(plan(), 5)).toEqual({
			carryOverUsages: { enabled: true },
		});
	});

	test("unlimited plans still preserve consumption on an interval switch", () => {
		const source = plan();
		source.items[1].unlimited = true;
		expect(checkoutSeatAllowanceUpdate(source, 6)).toEqual({
			carryOverUsages: { enabled: true },
		});
	});

	test("unconfigured checkouts keep their existing behavior", () => {
		const source = plan();
		source.metadata = {};
		expect(checkoutSeatAllowanceUpdate(source, 6)).toBeNull();
	});
});

describe("seatUpdateForCustomer", () => {
	test("seat billing and the allowance change in one update using the attached plan", () => {
		const source = plan();
		source.items[1].price.amount = 0.5;
		const update = seatUpdateForCustomer(customer(source), "org_1", 6);
		expect(update?.request).toMatchObject({
			customerId: "org_1",
			planId: "pro_annual",
			version: 7,
			featureQuantities: [{ featureId: "seats", quantity: 6 }],
			customize: { addItems: [{ included: 60_000, price: { amount: 0.5 } }] },
		});
		expect(update?.seatsOnly).not.toHaveProperty("customize");
		expect(update?.request).not.toHaveProperty("billingCycleAnchor");
	});

	test("enterprise allowance changes do not change seat billing or create prorations", () => {
		const update = seatUpdateForCustomer(
			customer(plan(), "enterprise_custom"),
			"org_1",
			6,
			{ allowanceOnly: true },
		);
		expect(update?.request).toMatchObject({
			planId: "enterprise_custom",
			prorationBehavior: "none",
			customize: { addItems: [{ included: 60_000 }] },
		});
		expect(update?.request).not.toHaveProperty("featureQuantities");
	});

	test("an unconfigured enterprise contract is not updated", () => {
		const source = plan();
		source.metadata = {};
		expect(
			seatUpdateForCustomer(customer(source), "org_1", 6, {
				allowanceOnly: true,
			})?.request,
		).toBeNull();
	});

	test("catalog metadata enables scaling without replacing an attached plan version", () => {
		const source = plan();
		source.metadata = {};
		const update = seatUpdateForCustomer(customer(source), "org_1", 6, {
			metadata: { box_gb_minutes_per_seat: 10_000 },
		});
		expect(update?.request).toMatchObject({
			version: 7,
			customize: { addItems: [{ included: 60_000 }] },
		});
	});

	test("a stale grant skips the allowance but still bills the seat", () => {
		const source = customer(plan());
		const grant = source.balances.box_gb_minutes?.breakdown?.[0];
		if (!grant) throw new Error("Missing fixture grant");
		grant.includedGrant = 60_000;
		const update = seatUpdateForCustomer(source, "org_1", 6);
		expect(update?.allowanceError?.message).toContain(
			"does not match its balance",
		);
		expect(update?.request).toEqual(update?.seatsOnly ?? null);
		expect(update?.request?.featureQuantities).toEqual([
			{ featureId: "seats", quantity: 6 },
		]);
	});

	test("a seat removal is not credited and keeps the grant until renewal", () => {
		const attached = plan();
		attached.items[1].included = 60_000;
		const source = customer(attached);
		source.balances.seats = { granted: 6 } as never;
		const update = seatUpdateForCustomer(source, "org_1", 5);
		expect(update?.request).toEqual({
			customerId: "org_1",
			planId: "pro_annual",
			version: 7,
			featureQuantities: [{ featureId: "seats", quantity: 5 }],
			prorationBehavior: "none",
		});
	});

	test("the daily pass lowers a grant only when usage fits the smaller grant", () => {
		const attached = plan();
		attached.items[1].included = 60_000;
		const source = customer(attached);
		const balance = source.balances.box_gb_minutes;
		if (!balance) throw new Error("Missing fixture balance");
		const sync = () =>
			seatUpdateForCustomer(source, "org_1", 5, {
				allowanceOnly: true,
				grantDecrease: "when-unused",
			})?.request;
		balance.usage = 55_000;
		expect(sync()).toBeNull();
		balance.usage = 1_000;
		expect(sync()?.customize?.addItems?.[0]?.included).toBe(50_000);
	});

	test("a past-due subscription still has its seats synchronized", () => {
		const source = customer(plan());
		const active = source.subscriptions[0];
		if (!active) throw new Error("Missing fixture subscription");
		source.subscriptions[0] = { ...active, status: "past_due" as never };
		expect(seatUpdateForCustomer(source, "org_1", 6)?.request?.version).toBe(7);
	});

	test("a scheduled subscription does not hide the active subscribed version", () => {
		const source = customer(plan());
		const active = source.subscriptions[0];
		if (!active?.plan) throw new Error("Missing fixture subscription");
		source.subscriptions.unshift({
			...active,
			status: "scheduled",
			plan: { ...active.plan, version: 8 },
		});
		expect(seatUpdateForCustomer(source, "org_1", 6)?.request?.version).toBe(7);
	});

	test("multiple active copies of the same plan are not updated ambiguously", () => {
		const source = customer(plan());
		source.subscriptions.push(...source.subscriptions);
		expect(() => seatUpdateForCustomer(source, "org_1", 6)).toThrow(
			"unique active Autumn plan",
		);
	});

	test("a free customer does not receive a paid allowance", () => {
		expect(
			seatUpdateForCustomer(
				{ flags: {}, subscriptions: [], balances: {} },
				"org_1",
				6,
			),
		).toBeNull();
	});
});

describe("withRetry", () => {
	test("a transient failure is retried and a policy rejection is not", async () => {
		let calls = 0;
		expect(
			await withRetry(
				async () => {
					calls++;
					if (calls < 3) throw new Error("timeout");
					return "ok";
				},
				{ delayMs: 0 },
			),
		).toBe("ok");
		calls = 0;
		await expect(
			withRetry(
				async () => {
					calls++;
					throw new SeatAllowanceError("unsafe");
				},
				{ delayMs: 0 },
			),
		).rejects.toThrow("unsafe");
		expect(calls).toBe(1);
	});
});

describe("applySeatUpdate", () => {
	test("an unsafe preview prevents the billing write", async () => {
		const calls: string[] = [];
		await expect(
			applySeatUpdate(
				{ customerId: "org_1", ...seatAllowanceUpdate(plan(), 6) },
				{
					previewUpdate: async () => {
						calls.push("preview");
						return { total: 0, resetsUsage: true };
					},
					update: async () => {
						calls.push("update");
					},
				},
			),
		).rejects.toThrow("reset existing usage");
		expect(calls).toEqual(["preview"]);
	});

	test("the exact seat-and-allowance request is previewed before being applied", async () => {
		const calls: Array<{ method: string; request: unknown }> = [];
		const request = { customerId: "org_1", ...seatAllowanceUpdate(plan(), 6) };
		await applySeatUpdate(request, {
			previewUpdate: async (value) => {
				calls.push({ method: "preview", request: value });
				return { total: 5, resetsUsage: false };
			},
			update: async (value) => {
				calls.push({ method: "update", request: value });
			},
		});
		expect(calls).toEqual([
			{ method: "preview", request },
			{ method: "update", request },
		]);
	});

	test("legacy seat updates do not add a preview dependency", async () => {
		const calls: string[] = [];
		await applySeatUpdate(
			{
				customerId: "org_1",
				featureQuantities: [{ featureId: "seats", quantity: 6 }],
			},
			{
				previewUpdate: async () => {
					calls.push("preview");
					return { total: 0 };
				},
				update: async () => {
					calls.push("update");
				},
			},
		);
		expect(calls).toEqual(["update"]);
	});
});

describe("assertAllowancePreview", () => {
	test("an allowance-only preview must not reset usage", () => {
		expect(() =>
			assertAllowancePreview({ total: 0, resetsUsage: true }),
		).toThrow("reset existing usage");
	});

	test("an allowance-only preview must not create a charge or credit", () => {
		expect(() =>
			assertAllowancePreview({ total: 5 }, { allowanceOnly: true }),
		).toThrow("charge or credit");
	});

	test("normal seat proration is retained when usage is preserved", () => {
		expect(() =>
			assertAllowancePreview({ total: 5, resetsUsage: false }),
		).not.toThrow();
	});
});
