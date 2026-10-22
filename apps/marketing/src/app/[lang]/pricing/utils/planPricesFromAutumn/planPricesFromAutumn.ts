import {
	SELF_SERVE_PLAN_IDS,
	SELF_SERVE_PLANS,
	type SelfServePlanId,
} from "@superset/shared/billing";

export interface PlanPrice {
	monthly: number;
	yearly: number;
	gbMinutesPerSeat: number;
	overagePerGbHour: number;
}

export type PlanPrices = Record<SelfServePlanId, PlanPrice>;

export interface AutumnPlan {
	id: string;
	metadata?: Record<string, unknown> | null;
	items: Array<{
		feature_id: string;
		price?: { amount?: number | null; billing_units?: number | null } | null;
	}>;
}

const GB_MINUTES_PER_SEAT_METADATA_KEY = "box_gb_minutes_per_seat";

export const BUILT_IN_PLAN_PRICES = Object.fromEntries(
	SELF_SERVE_PLAN_IDS.map((id) => {
		const { monthlyCents, yearlyCents, gbMinutesPerSeat } =
			SELF_SERVE_PLANS[id];
		return [
			id,
			{
				monthly: monthlyCents / 100,
				yearly: yearlyCents / 100,
				gbMinutesPerSeat,
				overagePerGbHour: 0.06,
			},
		];
	}),
) as PlanPrices;

function itemPrice(plan: AutumnPlan | undefined, featureId: string) {
	return plan?.items.find((item) => item.feature_id === featureId)?.price;
}

export function planPricesFromAutumn(plans: AutumnPlan[]): PlanPrices {
	const byId = new Map(plans.map((plan) => [plan.id, plan]));
	return Object.fromEntries(
		SELF_SERVE_PLAN_IDS.map((id) => {
			const plan = byId.get(id);
			const builtIn = BUILT_IN_PLAN_PRICES[id];
			const perSeat = plan?.metadata?.[GB_MINUTES_PER_SEAT_METADATA_KEY];
			const overage = itemPrice(plan, "box_gb_minutes");
			return [
				id,
				{
					monthly: itemPrice(plan, "seats")?.amount ?? builtIn.monthly,
					yearly:
						itemPrice(byId.get(`${id}_annual`), "seats")?.amount ??
						builtIn.yearly,
					gbMinutesPerSeat:
						typeof perSeat === "number" &&
						Number.isFinite(perSeat) &&
						perSeat > 0
							? perSeat
							: builtIn.gbMinutesPerSeat,
					overagePerGbHour:
						overage?.amount != null
							? (overage.amount * 60) / (overage.billing_units ?? 1)
							: builtIn.overagePerGbHour,
				},
			];
		}),
	) as PlanPrices;
}
