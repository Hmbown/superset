import { describe, expect, test } from "bun:test";
import {
	type AutumnPlan,
	BUILT_IN_PLAN_PRICES,
	planPricesFromAutumn,
} from "./planPricesFromAutumn";

function plan(
	id: string,
	seatPrice: number,
	metadata: Record<string, unknown> = {},
): AutumnPlan {
	return {
		id,
		metadata,
		items: [
			{ feature_id: "seats", price: { amount: seatPrice, billing_units: 1 } },
			{
				feature_id: "box_gb_minutes",
				price: { amount: 2, billing_units: 1000 },
			},
			{ feature_id: "pro_access", price: null },
		],
	};
}

describe("planPricesFromAutumn", () => {
	test("reads seat prices, annual prices and per-seat minutes from Autumn", () => {
		const prices = planPricesFromAutumn([
			plan("team", 65, { box_gb_minutes_per_seat: 80000 }),
			plan("team_annual", 600),
		]);
		expect(prices.team).toEqual({
			monthly: 65,
			yearly: 600,
			gbMinutesPerSeat: 80000,
			overagePerGbHour: 0.12,
		});
	});

	test("a plan Autumn does not return keeps the built-in prices", () => {
		expect(planPricesFromAutumn([]).ultra).toEqual(BUILT_IN_PLAN_PRICES.ultra);
	});
});
