import { describe, expect, test } from "bun:test";
import { licenseSeatAction, withRetry } from "./seat-policy";

const RENEWAL = 1_800_000_000_000;

describe("licenseSeatAction", () => {
	test("a new member is billed now", () => {
		expect(
			licenseSeatAction({
				paid: 3,
				members: 4,
				decreasePending: false,
				periodEnd: RENEWAL,
			}),
		).toEqual({ kind: "update", quantity: 4 });
	});

	test("a removed member's seat stays paid until renewal, then drops", () => {
		expect(
			licenseSeatAction({
				paid: 3,
				members: 2,
				decreasePending: false,
				periodEnd: RENEWAL,
			}),
		).toEqual({ kind: "schedule", now: 3, atRenewal: 2 });
	});

	test("a member added while a decrease is pending replaces the schedule", () => {
		expect(
			licenseSeatAction({
				paid: 3,
				members: 4,
				decreasePending: true,
				periodEnd: RENEWAL,
			}),
		).toEqual({ kind: "schedule", now: 4, atRenewal: null });
		expect(
			licenseSeatAction({
				paid: 3,
				members: 3,
				decreasePending: true,
				periodEnd: RENEWAL,
			}),
		).toEqual({ kind: "schedule", now: 3, atRenewal: null });
	});

	test("nothing changes when seats already match", () => {
		expect(
			licenseSeatAction({
				paid: 3,
				members: 3,
				decreasePending: false,
				periodEnd: RENEWAL,
			}),
		).toEqual({ kind: "none" });
	});
});

describe("withRetry", () => {
	test("a transient failure is retried until it succeeds", async () => {
		let calls = 0;
		expect(
			await withRetry(
				async () => {
					calls++;
					if (calls < 3) throw new Error("timeout");
					return "ok";
				},
				{ delayMs: 0 },
			),
		).toBe("ok");
		expect(calls).toBe(3);
	});
});
