import { describe, expect, test } from "bun:test";
import {
	autumnProPlanId,
	isCloudUsageRefusal,
	machineSizeConfigFrom,
	machineSpec,
	planAllowsAutomations,
	planAllowsTriggerKind,
	planTierFromSubscription,
	proSeatPricePerMonth,
	requiredPlanForTriggerKind,
	resolveCurrentPlan,
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

describe("autumnProPlanId", () => {
	test("annual picks the annual Pro plan", () => {
		expect(autumnProPlanId({ annual: true })).toBe("pro_annual");
		expect(autumnProPlanId({ annual: false })).toBe("pro");
	});
});

describe("proSeatPricePerMonth", () => {
	test("yearly is the annual price spread over twelve months", () => {
		expect(proSeatPricePerMonth({ annual: false })).toBe(20);
		expect(proSeatPricePerMonth({ annual: true })).toBe(15);
	});
});

describe("machine sizes", () => {
	test("with nothing set an org gets small and medium, and medium by default", () => {
		expect(machineSizeConfigFrom({ customer: {}, plan: undefined })).toEqual({
			sizes: { small: 2, medium: 4 },
			defaultSize: "medium",
		});
	});

	test("a customer's sizes replace its plan's, and its default must be one of them", () => {
		expect(
			machineSizeConfigFrom({
				customer: { machine_sizes: { small: 2, medium: 4, large: 8 } },
				plan: { machine_sizes: { small: 2 } },
			}),
		).toEqual({
			sizes: { small: 2, medium: 4, large: 8 },
			defaultSize: "medium",
		});
		expect(
			machineSizeConfigFrom({
				customer: {
					machine_sizes: { large: 8 },
					default_machine_size: "small",
				},
				plan: {},
			}),
		).toEqual({ sizes: { large: 8 }, defaultSize: "large" });
	});

	test("sizes Vercel cannot run, and bad names, are dropped", () => {
		expect(
			machineSizeConfigFrom({
				customer: {
					machine_sizes: { odd: 3, huge: 64, zero: 0, "Bad Name": 4, ok: "6" },
				},
				plan: {},
			}).sizes,
		).toEqual({ ok: 6 });
		expect(
			machineSizeConfigFrom({
				customer: { machine_sizes: { odd: 3 } },
				plan: {},
			}).sizes,
		).toEqual({ small: 2, medium: 4 });
	});

	test("a box hour is one hour of the 4 vCPU / 8 GB box", () => {
		expect(machineSpec(2)).toEqual({
			vcpus: 2,
			memoryGb: 4,
			boxHoursPerHour: 0.5,
		});
		expect(machineSpec(8).boxHoursPerHour).toBe(2);
	});
});
