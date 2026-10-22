import { describe, expect, test } from "bun:test";
import { BUILT_IN_PLAN_PRICES } from "../planPricesFromAutumn";
import { planPriceValues } from "./planPriceValues";

describe("planPriceValues", () => {
	test("formats each plan's monthly and yearly seat price and monthly GB-hours", () => {
		const values = planPriceValues(BUILT_IN_PLAN_PRICES, "en");
		expect(values.plans.team).toEqual({
			monthly: "$60",
			yearly: "$54",
			yearlyTotal: "$648",
			gbHours: "1,200",
			multiple: "3.8",
			overage: "$0.06",
			hasYearlyDiscount: true,
		});
		expect(values.plans.ultra.hasYearlyDiscount).toBe(false);
		expect(values.plans.ultra.multiple).toBe("12.5");
		expect(values.yearlyPrice).toBe("$16");
		expect(values.maxDiscount).toBe("20%");
		expect(values.overagePrice).toBe("$0.06");
	});
});
