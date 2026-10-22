import { describe, expect, test } from "bun:test";
import {
	type AutumnCatalogPlan,
	defaultMachineSize,
	familyForPlan,
	isCloudUsageRefusal,
	machineSpec,
	maxYearlyDiscount,
	offeredMachineSizes,
	offersYearlyDiscount,
	planAllowsAutomations,
	planAllowsTriggerKind,
	planCatalogFromAutumn,
	planForInterval,
	planTierFromSubscription,
	requiredPlanForTriggerKind,
	resolveCurrentPlan,
	seatPricePerMonth,
} from "./billing";
import { LAUNCHED_TRIGGER_KINDS } from "./constants";

describe("planAllowsAutomations", () => {
	test("free cannot, paid plans can", () => {
		expect(planAllowsAutomations("free")).toBe(false);
		expect(planAllowsAutomations("pro")).toBe(true);
		expect(planAllowsAutomations("enterprise")).toBe(true);
	});
});

describe("planTierFromSubscription", () => {
	test("no subscription is free", () => {
		expect(planTierFromSubscription(null)).toBe("free");
		expect(planTierFromSubscription(undefined)).toBe("free");
	});

	test("a paying subscription resolves to its plan", () => {
		expect(planTierFromSubscription({ plan: "pro", status: "active" })).toBe(
			"pro",
		);
		expect(
			planTierFromSubscription({ plan: "enterprise", status: "trialing" }),
		).toBe("enterprise");
		// Stripe is still retrying; access continues through its dunning window.
		expect(planTierFromSubscription({ plan: "pro", status: "past_due" })).toBe(
			"pro",
		);
	});

	test("a lapsed subscription is free again", () => {
		expect(planTierFromSubscription({ plan: "pro", status: "canceled" })).toBe(
			"free",
		);
		expect(planTierFromSubscription({ plan: "free", status: "active" })).toBe(
			"free",
		);
	});
});

describe("planAllowsTriggerKind", () => {
	test("free plans get no trigger kinds at all", () => {
		expect(planAllowsTriggerKind("free", "schedule")).toBe(false);
		expect(planAllowsTriggerKind("free", "slack")).toBe(false);
		expect(planAllowsTriggerKind("free", "microsoft_teams")).toBe(false);
	});

	test("pro gets schedules and the pro providers but not the enterprise ones", () => {
		expect(planAllowsTriggerKind("pro", "schedule")).toBe(true);
		expect(planAllowsTriggerKind("pro", "slack")).toBe(true);
		expect(planAllowsTriggerKind("pro", "linear")).toBe(true);
		expect(planAllowsTriggerKind("pro", "microsoft_teams")).toBe(false);
	});

	test("enterprise gets everything", () => {
		for (const kind of LAUNCHED_TRIGGER_KINDS) {
			expect(planAllowsTriggerKind("enterprise", kind)).toBe(true);
		}
	});

	test("an unknown kind is unrestricted rather than blocked", () => {
		// The map gates known providers; it is not an allowlist, so a kind it
		// has never heard of must not become accidentally ungateable-but-blocked.
		expect(requiredPlanForTriggerKind("not_a_provider")).toBeUndefined();
		expect(planAllowsTriggerKind("free", "not_a_provider")).toBe(true);
	});
});

/**
 * The drift guard, and the reason this file exists.
 *
 * Adding a provider is a code-only change everywhere else, so nothing forces
 * whoever adds one to think about billing — and a kind missing from the map is
 * silently free for everybody, when automations as a whole are Pro. This
 * fails the moment that happens.
 */
describe("every launched provider is priced", () => {
	for (const kind of LAUNCHED_TRIGGER_KINDS) {
		test(`${kind}`, () => {
			expect(requiredPlanForTriggerKind(kind)).toBeDefined();
			expect(planAllowsTriggerKind("free", kind)).toBe(false);
		});
	}
});

describe("resolveCurrentPlan", () => {
	test("prefers the live subscription plan over a stale session plan", () => {
		expect(
			resolveCurrentPlan({
				subscriptionPlan: "pro",
				sessionPlan: "free",
				subscriptionsLoaded: true,
			}),
		).toBe("pro");
	});

	test("treats loaded subscriptions with no active plan as free", () => {
		expect(
			resolveCurrentPlan({
				subscriptionPlan: null,
				sessionPlan: "pro",
				subscriptionsLoaded: true,
			}),
		).toBe("free");
	});

	test("falls back to the session plan while subscriptions are still loading", () => {
		expect(
			resolveCurrentPlan({
				subscriptionPlan: null,
				sessionPlan: "pro",
				subscriptionsLoaded: false,
			}),
		).toBe("pro");
	});

	test("supports enterprise subscriptions", () => {
		expect(
			resolveCurrentPlan({
				subscriptionPlan: "enterprise",
				sessionPlan: "free",
				subscriptionsLoaded: true,
			}),
		).toBe("enterprise");
	});
});

describe("isCloudUsageRefusal", () => {
	test("matches only the two refusal keys a box start can answer with", () => {
		for (const i18nKey of [
			"serverError.cloudWorkspace.cloudNeedsPaidPlan",
			"serverError.cloudWorkspace.usageLimitReached",
		]) {
			expect(isCloudUsageRefusal({ data: { i18nKey } })).toBe(true);
		}
		expect(
			isCloudUsageRefusal({
				data: {
					i18nKey: "serverError.cloudWorkspace.cloudSandboxesAreInternalOnly",
				},
			}),
		).toBe(false);
		expect(isCloudUsageRefusal(new Error("network"))).toBe(false);
		expect(isCloudUsageRefusal(null)).toBe(false);
	});
});

function autumnPlan(
	id: string,
	seatPrice: number,
	interval: "month" | "year",
	metadata: Record<string, unknown>,
): AutumnCatalogPlan {
	return {
		id,
		name: id,
		metadata,
		items: [
			{ featureId: "seats", price: { amount: seatPrice, interval } },
			{
				featureId: "box_gb_minutes",
				price: { amount: 1, interval: "month", billingUnits: 1000 },
			},
		],
	};
}

const lineup = planCatalogFromAutumn([
	autumnPlan("ultra", 200, "month", {
		self_serve: true,
		family: "ultra",
		display_order: 3,
	}),
	autumnPlan("ultra_annual", 2400, "year", {
		self_serve: true,
		family: "ultra",
		display_order: 3,
	}),
	autumnPlan("pro_annual", 192, "year", {
		self_serve: true,
		family: "pro",
		display_order: 1,
	}),
	autumnPlan("pro", 20, "month", {
		self_serve: true,
		family: "pro",
		display_order: 1,
		box_gb_minutes_per_seat: 19200,
	}),
	autumnPlan("enterprise", 400, "year", { family: "enterprise" }),
	autumnPlan("broken", 10, "month", {
		self_serve: true,
		family: "broken",
		box_gb_minutes_per_seat: -5,
	}),
]);

describe("planCatalogFromAutumn", () => {
	test("groups self-serve plans into families ordered by display_order, reading interval from the seat price", () => {
		expect(lineup.map((family) => family.family)).toEqual([
			"pro",
			"ultra",
			"broken",
		]);
		const [pro] = lineup;
		expect(pro?.monthly?.id).toBe("pro");
		expect(pro?.yearly?.id).toBe("pro_annual");
		expect(pro?.gbMinutesPerSeat).toBe(19200);
		expect(pro?.overagePerGbHour).toBe(0.06);
		expect(lineup[2]?.gbMinutesPerSeat).toBeNull();
	});

	test("a yearly plan without a discount is not offered; checkout stays monthly", () => {
		const [pro, ultra] = lineup;
		if (!pro || !ultra) throw new Error("lineup");
		expect(offersYearlyDiscount(pro)).toBe(true);
		expect(offersYearlyDiscount(ultra)).toBe(false);
		expect(planForInterval(pro, true)?.id).toBe("pro_annual");
		expect(planForInterval(ultra, true)?.id).toBe("ultra");
		expect(seatPricePerMonth(pro, true)).toBe(16);
		expect(seatPricePerMonth(ultra, true)).toBe(200);
		expect(maxYearlyDiscount(lineup)).toBeCloseTo(0.2);
	});

	test("finds the family and interval of an Autumn plan id", () => {
		expect(familyForPlan(lineup, "pro_annual")).toMatchObject({
			family: { family: "pro" },
			interval: "year",
		});
		expect(familyForPlan(lineup, "enterprise")).toBeNull();
	});
});

describe("machine sizes", () => {
	test("small, medium and large are open to all; bigger sizes only when their feature is on", () => {
		expect(offeredMachineSizes([])).toEqual(["small", "medium", "large"]);
		expect(offeredMachineSizes(["2xlarge"])).toEqual([
			"small",
			"medium",
			"large",
			"2xlarge",
		]);
	});

	test("the default is medium when offered, else the smallest offered size", () => {
		expect(defaultMachineSize(["small", "medium", "large"])).toBe("medium");
		expect(defaultMachineSize(["large", "xlarge"])).toBe("large");
	});

	test("memory scales with vCPUs", () => {
		expect(machineSpec("small")).toEqual({ vcpus: 2, memoryGb: 4 });
		expect(machineSpec("2xlarge")).toEqual({ vcpus: 32, memoryGb: 64 });
	});
});
