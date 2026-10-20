import { describe, expect, test } from "bun:test";
import { boxRateFrom } from "./box-rate";

describe("boxRateFrom", () => {
	test("a customer's box_rate overrides its plan's, and either falls back to 1", () => {
		expect(
			boxRateFrom({ customer: { box_rate: 0.5 }, plan: { box_rate: 0.8 } }),
		).toBe(0.5);
		expect(boxRateFrom({ customer: {}, plan: { box_rate: "0.8" } })).toBe(0.8);
		expect(boxRateFrom({ customer: null, plan: undefined })).toBe(1);
	});

	test("a missing, zero, negative or non-numeric rate is ignored", () => {
		expect(
			boxRateFrom({ customer: { box_rate: 0 }, plan: { box_rate: -2 } }),
		).toBe(1);
		expect(boxRateFrom({ customer: { box_rate: "cheap" }, plan: {} })).toBe(1);
	});
});
