import { beforeEach, describe, expect, test } from "bun:test";
import { autumnClient } from "@superset/auth/autumn";
import { db } from "@superset/db/client";
import { stub } from "../../../test/stub";
import type { BoxSession } from "../../lib/sandbox";
import * as sandbox from "../../lib/sandbox";
import { sessionEndedAt } from "../../lib/sandbox/vercel";
import { gbMinutes, lockIdFor, refusalFor, settleBoot } from "./meter";

const MINUTE = 60_000;
const NOW = Date.now();

let boot: Record<string, unknown> | null;
let session: BoxSession | null;
let renewalAllowed: boolean;
let finalizeFails: boolean;
let writes: Record<string, unknown>[];
let autumnCalls: { method: string; params: unknown; headers?: unknown }[];
let stopped: string[];

function chain(rows: () => unknown[]) {
	const link = {
		set: (values: Record<string, unknown>) => {
			writes.push(values);
			return link;
		},
		from: () => link,
		where: () =>
			Object.assign(Promise.resolve().then(rows), {
				returning: async () => rows(),
			}),
	};
	return link;
}

stub(db, {
	update: () => chain(() => (boot ? [boot] : [])),
	select: () => chain(() => [{ providerSandboxId: "ws-box" }]),
});
stub(sandbox, {
	findSandboxSession: async () => ({ session }),
	stopSandbox: async (id: string) => {
		stopped.push(id);
	},
});
stub(autumnClient, {
	check: async (params: unknown) => {
		autumnCalls.push({ method: "check", params });
		return { allowed: renewalAllowed, balance: { remaining: 0 }, flag: null };
	},
	track: async (params: unknown, options?: { headers?: unknown }) => {
		autumnCalls.push({ method: "track", params, headers: options?.headers });
		return { balance: {} };
	},
});
stub(autumnClient.balances, {
	finalize: async (params: unknown) => {
		autumnCalls.push({ method: "finalize", params });
		if (finalizeFails) throw new Error("lock expired");
		return { success: true };
	},
});

beforeEach(() => {
	boot = {
		id: "boot_1",
		organizationId: "org_1",
		cloudWorkspaceId: "ws_1",
		vercelSessionId: "sess_1",
		lockSeq: 0,
		lockOpen: true,
		finalizedThrough: new Date(NOW - 10 * MINUTE),
		createdAt: new Date(NOW - 20 * MINUTE),
	};
	session = {
		id: "sess_1",
		memoryMb: 16_384,
		vcpus: 8,
		startedAt: NOW - 20 * MINUTE,
		endedAt: null,
		activeCpuMs: null,
	};
	renewalAllowed = true;
	finalizeFails = false;
	writes = [];
	autumnCalls = [];
	stopped = [];
});

describe("settleBoot", () => {
	test("a running box is billed since the last settle and gets its next lock", async () => {
		expect(await settleBoot("boot_1")).toBe("renewed");
		const finalize = autumnCalls.find((call) => call.method === "finalize");
		expect(finalize?.params).toMatchObject({
			lockId: "boot_1:0",
			action: "confirm",
		});
		expect(
			(finalize?.params as { overrideValue: number }).overrideValue,
		).toBeCloseTo(160, 0);
		expect(
			autumnCalls.find((call) => call.method === "check")?.params,
		).toMatchObject({
			lock: { lockId: "boot_1:1" },
		});
		expect(writes.at(-1)).toMatchObject({ lockSeq: 1, lockOpen: true });
	});

	test("a stopped box is billed to its stop, records its CPU unbilled, and closes", async () => {
		session = {
			...(session as BoxSession),
			endedAt: NOW - 4 * MINUTE,
			activeCpuMs: 3 * MINUTE,
		};
		expect(await settleBoot("boot_1")).toBe("closed");
		expect(
			(
				autumnCalls.find((call) => call.method === "finalize")?.params as {
					overrideValue: number;
				}
			).overrideValue,
		).toBeCloseTo(96, 5);
		expect(
			autumnCalls.find((call) => call.method === "track")?.params,
		).toMatchObject({
			featureId: "active_cpu_minutes",
			value: 3,
		});
		expect(autumnCalls.some((call) => call.method === "check")).toBe(false);
		expect(writes.at(-1)).toMatchObject({ lockOpen: false });
	});

	test("a box whose next lock is refused at the spend cap is stopped", async () => {
		renewalAllowed = false;
		expect(await settleBoot("boot_1")).toBe("stopped");
		expect(stopped).toEqual(["ws-box"]);
		expect(writes.at(-1)).toMatchObject({ lockSeq: 1, lockOpen: false });
	});

	test("minutes a lock can no longer take are tracked once, keyed by that lock", async () => {
		finalizeFails = true;
		await settleBoot("boot_1");
		const track = autumnCalls.find(
			(call) =>
				call.method === "track" &&
				(call.params as { featureId: string }).featureId === "box_gb_minutes",
		);
		expect(track?.headers).toEqual({ "Idempotency-Key": "boot_1:0:track" });
	});

	test("a boot another run is settling is left alone", async () => {
		boot = null;
		expect(await settleBoot("boot_1")).toBe("skipped");
		expect(autumnCalls).toEqual([]);
	});
});

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
