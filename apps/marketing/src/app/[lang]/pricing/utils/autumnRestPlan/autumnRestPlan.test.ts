import { describe, expect, test } from "bun:test";
import { planCatalogFromAutumn } from "@superset/shared/billing";
import { fromAutumnRest } from "./autumnRestPlan";

describe("fromAutumnRest", () => {
	test("maps Autumn's REST plan fields onto the shared catalog shape", () => {
		const [team] = planCatalogFromAutumn(
			[
				{
					id: "team",
					name: "Team",
					metadata: { self_serve: true, family: "team", display_order: 2 },
					items: [
						{ feature_id: "seats", price: { amount: 60, interval: "month" } },
						{
							feature_id: "box_gb_minutes",
							price: { amount: 1, interval: "month", billing_units: 1000 },
						},
					],
				},
			].map(fromAutumnRest),
		);
		expect(team).toMatchObject({
			family: "team",
			name: "Team",
			monthly: { id: "team", seatPrice: 60, interval: "month" },
			overagePerGbHour: 0.06,
		});
	});
});
