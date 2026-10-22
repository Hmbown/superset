import { describe, expect, test } from "bun:test";
import { setupI18n } from "@lingui/core";
import {
	type AutumnCatalogPlan,
	planCatalogFromAutumn,
} from "@superset/shared/billing";
import { planPriceValues } from "./planPriceValues";

function plan(
	id: string,
	seatPrice: number,
	interval: "month" | "year",
	metadata: Record<string, unknown>,
): AutumnCatalogPlan {
	return {
		id,
		name: id === "team" ? "Team" : id === "ultra" ? "Ultra" : "Pro",
		metadata,
		items: [
			{ featureId: "seats", price: { amount: seatPrice, interval } },
			{
				featureId: "box_gb_minutes",
				price: { amount: 1, interval: "month", billingUnits: 1000 },
			},
		],
	};
}

const pro = { self_serve: true, family: "pro", display_order: 1 };
const team = { self_serve: true, family: "team", display_order: 2 };
const ultra = { self_serve: true, family: "ultra", display_order: 3 };

describe("planPriceValues", () => {
	test("formats each family's prices, GB-hours and multiple of the base plan", () => {
		const catalog = planCatalogFromAutumn([
			plan("pro", 20, "month", { ...pro, box_gb_minutes_per_seat: 19200 }),
			plan("pro_annual", 192, "year", pro),
			plan("team", 60, "month", { ...team, box_gb_minutes_per_seat: 72000 }),
			plan("team_annual", 648, "year", team),
			plan("ultra", 200, "month", {
				...ultra,
				box_gb_minutes_per_seat: 240000,
			}),
			plan("ultra_annual", 2400, "year", ultra),
		]);
		const values = planPriceValues(catalog, setupI18n({ locale: "en" }));
		expect(values.byFamily.team).toMatchObject({
			monthly: "$60",
			yearly: "$54",
			yearlyTotal: "$648",
			gbHours: "1,200",
			multiple: "3.8",
			overage: "$0.06",
			previousName: "Pro",
			baseName: "Pro",
		});
		expect(values.byFamily.ultra).toMatchObject({
			yearly: "$200",
			yearlyTotal: null,
			hasYearlyDiscount: false,
		});
		expect(values.maxDiscount).toBe("20%");
		expect(values.fromPrice).toBe("$16");
	});
});
