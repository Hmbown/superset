import { billingUsesAutumn } from "@superset/auth/autumn";
import {
	organizationMachineSizesFromAutumn,
	organizationPlanFromAutumn,
} from "@superset/auth/billing";
import { db } from "@superset/db/client";
import { organizations, subscriptions } from "@superset/db/schema";
import {
	ACTIVE_SUBSCRIPTION_STATUSES,
	DEFAULT_MACHINE_SIZE_CONFIG,
	type MachineSizeConfig,
	machineSizeVcpus,
	type PlanTier,
	planTierFromSubscription,
} from "@superset/shared/billing";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * The org's plan as billing.activePlan resolves it: the newest subscription
 * in a paying status, else free. Unrecognized plan names read as free — the
 * gate must fail closed on a plan string this build doesn't know.
 */
export async function organizationPlan(
	organizationId: string,
): Promise<PlanTier> {
	if (billingUsesAutumn) return organizationPlanFromAutumn(organizationId);
	const [subscription] = await db
		.select({ plan: subscriptions.plan, status: subscriptions.status })
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.referenceId, organizationId),
				inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
			),
		)
		.orderBy(desc(subscriptions.createdAt))
		.limit(1);
	return planTierFromSubscription(subscription);
}

export function organizationMetadataObject(
	metadata: string | null | undefined,
): Record<string, unknown> {
	if (!metadata) return {};
	try {
		const parsed: unknown = JSON.parse(metadata);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch (error) {
		console.warn("[billing/plan] organization metadata is not JSON", error);
		return {};
	}
}

/** The sizes Autumn offers the org, with the org's own default when it is one of them. */
export async function organizationMachineSizes(
	organizationId: string,
): Promise<MachineSizeConfig> {
	const [offered, [organization]] = await Promise.all([
		billingUsesAutumn
			? organizationMachineSizesFromAutumn(organizationId)
			: DEFAULT_MACHINE_SIZE_CONFIG,
		db
			.select({ metadata: organizations.metadata })
			.from(organizations)
			.where(eq(organizations.id, organizationId)),
	]);
	const chosen = organizationMetadataObject(
		organization?.metadata,
	).defaultMachineSize;
	return typeof chosen === "string" &&
		machineSizeVcpus(offered, chosen) !== null
		? { ...offered, defaultSize: chosen }
		: offered;
}

export async function resolveMachineSize(
	organizationId: string,
	requested: string | null | undefined,
): Promise<{ name: string; vcpus: number } | null> {
	const config = await organizationMachineSizes(organizationId);
	const name = requested ?? config.defaultSize;
	const vcpus = machineSizeVcpus(config, name);
	return vcpus === null ? null : { name, vcpus };
}
