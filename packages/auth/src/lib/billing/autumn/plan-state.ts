import { db } from "@superset/db/client";
import { subscriptions } from "@superset/db/schema";
import {
	ACTIVE_SUBSCRIPTION_STATUSES,
	type MachineSize,
	type PlanTier,
} from "@superset/shared/billing";
import { Redis } from "@upstash/redis";
import { AutumnError } from "autumn-js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { env } from "../../../env";
import {
	billingFromCustomer,
	billingFromSubscriptionRow,
	FREE_BILLING,
	type OrganizationBilling,
} from "./billing-state";
import { getAutumnCustomer } from "./customer";

const MEMORY_TTL_MS = 10_000;
const SHARED_TTL_SECONDS = 60;
const LAST_KNOWN_TTL_SECONDS = 24 * 60 * 60;
const AUTUMN_READ_TIMEOUT_MS = 2_000;

const FAIL_OPEN: OrganizationBilling = {
	tier: "pro",
	status: "active",
	cancelAt: null,
	periodStart: null,
	periodEnd: null,
	billingInterval: null,
	lapsed: false,
	paymentState: { kind: "ok" },
	cloudUsage: null,
	gatedMachineSizes: [],
};

const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});
const memory = new Map<
	string,
	{ value: OrganizationBilling; expiresAt: number }
>();

function sharedKey(organizationId: string): string {
	return `billing:org:${organizationId}`;
}

function lastKnownKey(organizationId: string): string {
	return `billing:org:${organizationId}:last`;
}

async function readShared(key: string): Promise<OrganizationBilling | null> {
	try {
		return await redis.get<OrganizationBilling>(key);
	} catch (error) {
		console.error("[billing/plan-state] cache read failed", error);
		return null;
	}
}

async function billingFromAutumn(
	organizationId: string,
): Promise<OrganizationBilling> {
	try {
		return billingFromCustomer(
			await getAutumnCustomer(organizationId, {
				timeoutMs: AUTUMN_READ_TIMEOUT_MS,
			}),
			Date.now(),
		);
	} catch (error) {
		if (error instanceof AutumnError && error.statusCode === 404) {
			return FREE_BILLING;
		}
		throw error;
	}
}

async function billingFromStripeProjection(
	organizationId: string,
): Promise<OrganizationBilling> {
	return billingFromSubscriptionRow(
		await db.query.subscriptions.findFirst({
			where: and(
				eq(subscriptions.referenceId, organizationId),
				inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
			),
			orderBy: desc(subscriptions.createdAt),
			columns: {
				plan: true,
				status: true,
				cancelAt: true,
				periodStart: true,
				periodEnd: true,
				billingInterval: true,
			},
		}),
	);
}

async function fetchBilling(
	organizationId: string,
): Promise<OrganizationBilling> {
	const autumn = await billingFromAutumn(organizationId);
	if (autumn.tier !== "free") return autumn;
	const projected = await billingFromStripeProjection(organizationId);
	if (projected.tier === "free") return autumn;
	console.error(
		`[billing/plan-state] ${organizationId} pays in Stripe (${projected.tier}) but Autumn reads free; serving the Stripe projection until the import links it`,
	);
	return projected;
}

export async function organizationBilling(
	organizationId: string,
): Promise<OrganizationBilling> {
	const cached = memory.get(organizationId);
	if (cached && cached.expiresAt > Date.now()) return cached.value;
	const shared = await readShared(sharedKey(organizationId));
	if (shared) {
		memory.set(organizationId, {
			value: shared,
			expiresAt: Date.now() + MEMORY_TTL_MS,
		});
		return shared;
	}
	try {
		const value = await fetchBilling(organizationId);
		memory.set(organizationId, {
			value,
			expiresAt: Date.now() + MEMORY_TTL_MS,
		});
		await redis
			.pipeline()
			.set(sharedKey(organizationId), value, { ex: SHARED_TTL_SECONDS })
			.set(lastKnownKey(organizationId), value, { ex: LAST_KNOWN_TTL_SECONDS })
			.exec()
			.catch((error) =>
				console.error("[billing/plan-state] cache write failed", error),
			);
		return value;
	} catch (error) {
		const lastKnown = await readShared(lastKnownKey(organizationId));
		console.error(
			`[billing/plan-state] Autumn unavailable for ${organizationId}; serving ${lastKnown ? "last known" : "fail-open"} state`,
			error,
		);
		const fallback = lastKnown
			? { ...lastKnown, gatedMachineSizes: [] }
			: FAIL_OPEN;
		memory.set(organizationId, {
			value: fallback,
			expiresAt: Date.now() + MEMORY_TTL_MS,
		});
		return fallback;
	}
}

export async function organizationPlanFromAutumn(
	organizationId: string,
): Promise<PlanTier> {
	return (await organizationBilling(organizationId)).tier;
}

export async function organizationGatedMachineSizesFromAutumn(
	organizationId: string,
): Promise<MachineSize[]> {
	return (await organizationBilling(organizationId)).gatedMachineSizes ?? [];
}

export async function invalidateOrganizationBilling(
	organizationId: string,
): Promise<void> {
	memory.delete(organizationId);
	await redis
		.del(sharedKey(organizationId))
		.catch((error) =>
			console.error("[billing/plan-state] cache invalidate failed", error),
		);
}
