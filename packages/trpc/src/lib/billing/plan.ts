import { billingUsesAutumn } from "@superset/auth/autumn";
import {
	organizationMachineSizesFromAutumn,
	organizationPlanFromAutumn,
} from "@superset/auth/billing";
import { db } from "@superset/db/client";
import { subscriptions } from "@superset/db/schema";
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

export async function organizationMachineSizes(
	organizationId: string,
): Promise<MachineSizeConfig> {
	return billingUsesAutumn
		? organizationMachineSizesFromAutumn(organizationId)
		: DEFAULT_MACHINE_SIZE_CONFIG;
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
