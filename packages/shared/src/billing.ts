export const PLAN_TIERS = ["free", "pro", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * Subscription.status values considered "paying" for gating purposes.
 *
 * `past_due` counts. Stripe retries a failed payment for ~14 days before giving
 * up, and duplicating that window here would mean two sources of truth that
 * drift the moment anyone edits the retry schedule in the dashboard. When Stripe
 * does give up it cancels the subscription, `customer.subscription.deleted`
 * lands, and the row moves to `canceled` — dropping out of this list on its own.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
	"active",
	"trialing",
	"past_due",
] as const;
export type ActiveSubscriptionStatus =
	(typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

export function isPaidPlan(plan: string | null | undefined): boolean {
	return plan != null && plan !== "free";
}

export function isActiveSubscriptionStatus(
	status: string | null | undefined,
): status is ActiveSubscriptionStatus {
	return ACTIVE_SUBSCRIPTION_STATUSES.some((candidate) => candidate === status);
}

/**
 * Access continues, but collection is failing and the subscription will be
 * canceled if it keeps failing. Surface this — never gate on it.
 */
export function isPaymentFailingStatus(
	status: string | null | undefined,
): boolean {
	return status === "past_due";
}

/** The paying tiers, for SQL filters; `isPaidPlanTier` is the same set in TypeScript. */
export const PAID_PLAN_TIERS = ["pro", "enterprise"] as const;

export function isPaidPlanTier(
	plan: string | null | undefined,
): plan is "pro" | "enterprise" {
	return plan === "pro" || plan === "enterprise";
}

/**
 * The tier to render right now. The subscription row wins over the session
 * (which can lag a checkout), but an unresolved query must not read as free —
 * that would show a live Upgrade to an organization that may already pay —
 * so the session plan fills in until it arrives.
 */
export function resolveCurrentPlan({
	subscriptionPlan,
	sessionPlan,
	subscriptionsLoaded,
}: {
	subscriptionPlan?: string | null;
	sessionPlan?: string | null;
	subscriptionsLoaded: boolean;
}): PlanTier {
	if (isPaidPlanTier(subscriptionPlan)) return subscriptionPlan;
	if (subscriptionsLoaded) return "free";
	if (isPaidPlanTier(sessionPlan)) return sessionPlan;
	return "free";
}

export const PLAN_RANK: Record<PlanTier, number> = {
	free: 0,
	pro: 1,
	enterprise: 2,
};

/** The tier an org needs to create, run, or resume an automation. */
export const AUTOMATIONS_REQUIRED_PLAN: Exclude<PlanTier, "free"> = "pro";

/**
 * The plan tier a subscription row resolves to: its plan while the
 * subscription is still paying, `free` otherwise (or when there is no row).
 */
export function planTierFromSubscription(
	subscription:
		| { plan: string | null | undefined; status: string | null | undefined }
		| null
		| undefined,
): PlanTier {
	if (!subscription || !isActiveSubscriptionStatus(subscription.status)) {
		return "free";
	}
	const plan = subscription.plan;
	return plan === "pro" || plan === "enterprise" ? plan : "free";
}

/** Whether an org on this plan may create, run, or resume automations. */
export function planAllowsAutomations(plan: PlanTier): boolean {
	return PLAN_RANK[plan] >= PLAN_RANK[AUTOMATIONS_REQUIRED_PLAN];
}

/**
 * The billing tier each trigger kind needs. Automations are a Pro feature,
 * so every kind is at least Pro; a kind absent here would be free, which is
 * what the billing test guards against. One map for both sides of the
 * product: the desktop Add Trigger menu locks and badges off it, and the
 * dispatchers skip triggers above the org's plan. Editing a saved above-tier
 * trigger is deliberately still allowed — a downgraded org maintains its
 * automations, they just don't fire.
 */
const TRIGGER_KIND_REQUIRED_PLAN: Partial<
	Record<string, Exclude<PlanTier, "free">>
> = {
	schedule: AUTOMATIONS_REQUIRED_PLAN,
	github: "pro",
	slack: "pro",
	linear: "pro",
	sentry: "pro",
	notion: "pro",
	gmail: "pro",
	webhook: "pro",
	microsoft_teams: "enterprise",
};

/** The tier a trigger kind needs, or undefined when every plan has it. */
export function requiredPlanForTriggerKind(
	kind: string,
): Exclude<PlanTier, "free"> | undefined {
	return TRIGGER_KIND_REQUIRED_PLAN[kind];
}

/** Whether an org on this plan may run triggers of this kind. */
export function planAllowsTriggerKind(plan: PlanTier, kind: string): boolean {
	const required = TRIGGER_KIND_REQUIRED_PLAN[kind];
	return required === undefined || PLAN_RANK[plan] >= PLAN_RANK[required];
}

export const CLOUD_USAGE_REFUSAL_KEYS = [
	"serverError.cloudWorkspace.cloudNeedsPaidPlan",
	"serverError.cloudWorkspace.usageLimitReached",
] as const;

export function isCloudUsageRefusal(error: unknown): boolean {
	const data = (error as { data?: { i18nKey?: unknown } | null } | null)?.data;
	return (
		typeof data?.i18nKey === "string" &&
		(CLOUD_USAGE_REFUSAL_KEYS as readonly string[]).includes(data.i18nKey)
	);
}

export const SELF_SERVE_PLAN_IDS = ["pro", "team", "ultra"] as const;
export type SelfServePlanId = (typeof SELF_SERVE_PLAN_IDS)[number];

export function isSelfServePlanId(value: unknown): value is SelfServePlanId {
	return (SELF_SERVE_PLAN_IDS as readonly unknown[]).includes(value);
}

// Display copy of the Autumn `pro`, `team` and `ultra` plans and their
// `_annual` versions; checkout bills from Autumn, so change both together.
export const PLAN_PRICE_CURRENCY = "USD";
export const SELF_SERVE_PLANS: Record<
	SelfServePlanId,
	{ monthlyCents: number; yearlyCents: number; gbMinutesPerSeat: number }
> = {
	pro: { monthlyCents: 2000, yearlyCents: 19200, gbMinutesPerSeat: 19200 },
	team: { monthlyCents: 6000, yearlyCents: 64800, gbMinutesPerSeat: 72000 },
	ultra: { monthlyCents: 20000, yearlyCents: 240000, gbMinutesPerSeat: 240000 },
};

export type SelfServePlanCatalog = typeof SELF_SERVE_PLANS;

export interface AutumnPlanSummary {
	id: string;
	metadata?: Record<string, unknown> | null;
	items: Array<{
		featureId: string;
		price?: { amount?: number | null } | null;
	}>;
}

export function selfServePlansFromAutumn(
	plans: AutumnPlanSummary[],
): SelfServePlanCatalog {
	const byId = new Map(plans.map((plan) => [plan.id, plan]));
	const seatCents = (planId: string) => {
		const amount = byId
			.get(planId)
			?.items.find((item) => item.featureId === "seats")?.price?.amount;
		return amount == null ? null : Math.round(amount * 100);
	};
	return Object.fromEntries(
		SELF_SERVE_PLAN_IDS.map((id) => {
			const builtIn = SELF_SERVE_PLANS[id];
			const perSeat = byId.get(id)?.metadata?.box_gb_minutes_per_seat;
			return [
				id,
				{
					monthlyCents: seatCents(id) ?? builtIn.monthlyCents,
					yearlyCents: seatCents(`${id}_annual`) ?? builtIn.yearlyCents,
					gbMinutesPerSeat:
						typeof perSeat === "number" &&
						Number.isFinite(perSeat) &&
						perSeat > 0
							? perSeat
							: builtIn.gbMinutesPerSeat,
				},
			];
		}),
	) as SelfServePlanCatalog;
}

export function seatPricePerMonth(
	plan: SelfServePlanId,
	{ annual }: { annual: boolean },
	catalog: SelfServePlanCatalog = SELF_SERVE_PLANS,
): number {
	const { monthlyCents, yearlyCents } = catalog[plan];
	return (annual ? yearlyCents / 12 : monthlyCents) / 100;
}

export function autumnPlanIdFor(
	plan: SelfServePlanId,
	{ annual }: { annual: boolean },
): string {
	return annual ? `${plan}_annual` : plan;
}

export function selfServePlanFromAutumnPlanId(
	autumnPlanId: string | null | undefined,
): SelfServePlanId | null {
	const plan = autumnPlanId?.replace(/_annual$/, "");
	return isSelfServePlanId(plan) ? plan : null;
}

export const MEMORY_GB_PER_VCPU = 2;
/** The size an environment's golden box is built at. */
export const GOLDEN_BOX_VCPUS = 8;

export const MACHINE_SIZE_VCPUS = {
	small: 2,
	medium: 4,
	large: 8,
	xlarge: 16,
	"2xlarge": 32,
} as const;
export type MachineSize = keyof typeof MACHINE_SIZE_VCPUS;
export const MACHINE_SIZES = Object.keys(MACHINE_SIZE_VCPUS) as [
	MachineSize,
	...MachineSize[],
];
/** Every organization can run these; the rest need an Autumn feature each. */
export const OPEN_MACHINE_SIZES: readonly MachineSize[] = [
	"small",
	"medium",
	"large",
];
export const DEFAULT_MACHINE_SIZE: MachineSize = "medium";

export function isMachineSize(value: unknown): value is MachineSize {
	return typeof value === "string" && Object.hasOwn(MACHINE_SIZE_VCPUS, value);
}

export function offeredMachineSizes(
	gated: readonly MachineSize[],
): MachineSize[] {
	return MACHINE_SIZES.filter(
		(size) => OPEN_MACHINE_SIZES.includes(size) || gated.includes(size),
	);
}

export function defaultMachineSize(
	offered: readonly MachineSize[],
): MachineSize {
	return offered.includes(DEFAULT_MACHINE_SIZE)
		? DEFAULT_MACHINE_SIZE
		: (offered[0] ?? DEFAULT_MACHINE_SIZE);
}

export function machineSpec(size: MachineSize): {
	vcpus: number;
	memoryGb: number;
} {
	const vcpus = MACHINE_SIZE_VCPUS[size];
	return { vcpus, memoryGb: vcpus * MEMORY_GB_PER_VCPU };
}
