import { describe, expect, test } from "bun:test";
import { sessionEndedAt } from "../../lib/sandbox/vercel";
import { gbMinutes, lockIdFor, refusalFor } from "./meter";

describe("meter", () => {
	test("usage is GB-minutes: minutes the box was up times its memory in GB", () => {
		expect(gbMinutes({ ms: 60_000, memoryMb: 16_384 })).toBe(16);
		expect(gbMinutes({ ms: 30_000, memoryMb: 2_048 })).toBe(1);
		expect(gbMinutes({ ms: -5_000, memoryMb: 16_384 })).toBe(0);
	});

	test("each lock of a boot has its own id, so a retry reuses the same one", () => {
		expect(lockIdFor("boot_1", 0)).toBe("boot_1:0");
		expect(lockIdFor("boot_1", 3)).toBe("boot_1:3");
	});

	test("a free org is told cloud needs a paid plan; a paid org at its cap is told it hit its limit", () => {
		expect(refusalFor({ allowed: true, balance: null })).toBeNull();
		expect(refusalFor({ allowed: false, balance: null })).toBe(
			"cloudNeedsPaidPlan",
		);
		expect(refusalFor({ allowed: false, balance: { remaining: 0 } })).toBe(
			"usageLimitReached",
		);
	});

	test("a session that ended without a stop time ends at its last update", () => {
		expect(sessionEndedAt({ status: "running", updatedAt: 9 })).toBeNull();
		expect(
			sessionEndedAt({ status: "stopped", stoppedAt: 5, updatedAt: 9 }),
		).toBe(5);
		expect(
			sessionEndedAt({ status: "stopping", requestedStopAt: 4, updatedAt: 9 }),
		).toBe(4);
		expect(sessionEndedAt({ status: "aborted", updatedAt: 9 })).toBe(9);
	});
});
