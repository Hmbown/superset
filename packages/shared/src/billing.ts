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

export function autumnProPlanId({
	annual,
}: {
	annual: boolean;
}): "pro" | "pro_annual" {
	return annual ? "pro_annual" : "pro";
}

// Display copy of the Autumn `pro` and `pro_annual` seat prices; checkout bills
// from Autumn, so change both together.
export const PRO_SEAT_PRICE = {
	currency: "USD",
	monthlyCents: 2000,
	yearlyCents: 18000,
} as const;

export function proSeatPricePerMonth({ annual }: { annual: boolean }): number {
	const cents = annual
		? PRO_SEAT_PRICE.yearlyCents / 12
		: PRO_SEAT_PRICE.monthlyCents;
	return cents / 100;
}

export const BOX_HOUR_GB_MINUTES = 480;
export const MEMORY_GB_PER_VCPU = 2;
/** Every box ran at 8 vCPU before sizes; workspaces from then have no size. */
export const UNSIZED_BOX_VCPUS = 8;
/** Vercel Sandbox allows 1 or an even number of vCPUs, up to 32. */
const MAX_SANDBOX_VCPUS = 32;
const MACHINE_SIZE_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export type MachineSizes = Record<string, number>;

export interface MachineSizeConfig {
	sizes: MachineSizes;
	defaultSize: string;
}

export const DEFAULT_MACHINE_SIZE_CONFIG: MachineSizeConfig = {
	sizes: { small: 2, medium: 4 },
	defaultSize: "medium",
};

export function isSandboxVcpuCount(value: number): boolean {
	return (
		Number.isInteger(value) &&
		(value === 1 ||
			(value % 2 === 0 && value >= 2 && value <= MAX_SANDBOX_VCPUS))
	);
}

function machineSizesIn(value: unknown): MachineSizes | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const sizes: MachineSizes = {};
	for (const [name, vcpus] of Object.entries(value)) {
		const count = Number(vcpus);
		if (MACHINE_SIZE_NAME.test(name) && isSandboxVcpuCount(count)) {
			sizes[name] = count;
		}
	}
	return Object.keys(sizes).length > 0 ? sizes : null;
}

type Metadata = Record<string, unknown> | null | undefined;

/** A customer's `machine_sizes` replaces its plan's; neither means the default. */
export function machineSizeConfigFrom({
	customer,
	plan,
}: {
	customer: Metadata;
	plan: Metadata;
}): MachineSizeConfig {
	const sizes =
		machineSizesIn(customer?.machine_sizes) ??
		machineSizesIn(plan?.machine_sizes) ??
		DEFAULT_MACHINE_SIZE_CONFIG.sizes;
	const named = [
		customer?.default_machine_size,
		plan?.default_machine_size,
		DEFAULT_MACHINE_SIZE_CONFIG.defaultSize,
	].find(
		(name): name is string =>
			typeof name === "string" && Object.hasOwn(sizes, name),
	);
	const smallest = Object.entries(sizes).sort((a, b) => a[1] - b[1])[0]?.[0];
	return {
		sizes,
		defaultSize: named ?? smallest ?? DEFAULT_MACHINE_SIZE_CONFIG.defaultSize,
	};
}

export function machineSizeVcpus(
	config: MachineSizeConfig,
	name: string,
): number | null {
	return Object.hasOwn(config.sizes, name)
		? (config.sizes[name] ?? null)
		: null;
}

export function machineSpec(vcpus: number): {
	vcpus: number;
	memoryGb: number;
	boxHoursPerHour: number;
} {
	const memoryGb = vcpus * MEMORY_GB_PER_VCPU;
	return {
		vcpus,
		memoryGb,
		boxHoursPerHour: (memoryGb * 60) / BOX_HOUR_GB_MINUTES,
	};
}
