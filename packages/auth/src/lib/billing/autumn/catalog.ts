import { isSelfServeAutumnPlan } from "@superset/shared/billing";
import { autumnClient } from "../../../autumn";
import { billingRedis } from "./redis";

type AutumnPlans = Awaited<ReturnType<typeof autumnClient.plans.list>>["list"];

const MEMORY_TTL_MS = 60_000;
const SHARED_TTL_SECONDS = 5 * 60;
const LAST_KNOWN_TTL_SECONDS = 30 * 24 * 60 * 60;
const SHARED_KEY = "billing:catalog";
const LAST_KNOWN_KEY = "billing:catalog:last";

let memory: { plans: AutumnPlans; expiresAt: number } | null = null;

async function readShared(key: string): Promise<AutumnPlans | null> {
	try {
		return await billingRedis.get<AutumnPlans>(key);
	} catch (error) {
		console.error("[billing/catalog] cache read failed", error);
		return null;
	}
}

/** The self-serve Autumn plans, served from the last good copy when Autumn fails. */
export async function selfServeAutumnPlans(): Promise<AutumnPlans> {
	if (memory && memory.expiresAt > Date.now()) return memory.plans;
	const shared = await readShared(SHARED_KEY);
	if (shared) {
		memory = { plans: shared, expiresAt: Date.now() + MEMORY_TTL_MS };
		return shared;
	}
	try {
		const { list } = await autumnClient.plans.list({});
		const plans = list.filter(isSelfServeAutumnPlan);
		memory = { plans, expiresAt: Date.now() + MEMORY_TTL_MS };
		await billingRedis
			.pipeline()
			.set(SHARED_KEY, plans, { ex: SHARED_TTL_SECONDS })
			.set(LAST_KNOWN_KEY, plans, { ex: LAST_KNOWN_TTL_SECONDS })
			.exec()
			.catch((error) =>
				console.error("[billing/catalog] cache write failed", error),
			);
		return plans;
	} catch (error) {
		const lastKnown = await readShared(LAST_KNOWN_KEY);
		if (!lastKnown) throw error;
		console.error(
			"[billing/catalog] Autumn unavailable; serving last known catalog",
			error,
		);
		return lastKnown;
	}
}

export async function isSelfServePlan(planId: string): Promise<boolean> {
	return (await selfServeAutumnPlans()).some((plan) => plan.id === planId);
}
