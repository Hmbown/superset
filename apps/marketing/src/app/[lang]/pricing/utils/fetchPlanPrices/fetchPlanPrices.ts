import { cacheLife } from "next/cache";
import { env } from "@/env";
import {
	type AutumnPlan,
	BUILT_IN_PLAN_PRICES,
	type PlanPrices,
	planPricesFromAutumn,
} from "../planPricesFromAutumn";

const AUTUMN_PLANS_URL = "https://api.useautumn.com/v1/plans.list";
const AUTUMN_API_VERSION = "2.4.0";

export async function fetchPlanPrices(): Promise<PlanPrices> {
	"use cache";
	try {
		const response = await fetch(AUTUMN_PLANS_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.AUTUMN_SECRET_KEY}`,
				"Content-Type": "application/json",
				"x-api-version": AUTUMN_API_VERSION,
			},
			body: "{}",
		});
		if (!response.ok) {
			throw new Error(`Autumn plans.list answered ${response.status}`);
		}
		const { list } = (await response.json()) as { list: AutumnPlan[] };
		cacheLife("hours");
		return planPricesFromAutumn(list);
	} catch (error) {
		console.error("[pricing] showing built-in prices", error);
		cacheLife("seconds");
		return BUILT_IN_PLAN_PRICES;
	}
}
