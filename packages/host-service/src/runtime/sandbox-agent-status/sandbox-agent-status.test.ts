import { afterEach, describe, expect, test } from "bun:test";
import { TerminalAgentStore } from "../../terminal-agents/store";
import { startSandboxAgentStatusReporter } from "./sandbox-agent-status";

const TIMING = { settleMs: 5, minIntervalMs: 20, maxRetryMs: 40 };

async function until(condition: () => boolean, timeoutMs = 2_000) {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error("condition not met in time");
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

function chatEvent(store: TerminalAgentStore, eventType: string) {
	store.recordChatEvent({
		terminalId: "terminal",
		workspaceId: "workspace",
		agentId: "claude",
		chatSessionId: "chat",
		eventType,
		occurredAt: Date.now(),
	});
}

let cleanup: (() => void)[] = [];
afterEach(() => {
	for (const fn of cleanup) fn();
	cleanup = [];
});

function startApi(
	respond: (status: string | null) => Promise<Response> | Response,
) {
	const stored: (string | null)[] = [];
	let inFlight = 0;
	let maxInFlight = 0;
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			try {
				const { status } = (await request.json()) as { status: string | null };
				const response = await respond(status);
				if (response.ok) stored.push(status);
				return response;
			} finally {
				inFlight--;
			}
		},
	});
	const store = new TerminalAgentStore();
	const stop = startSandboxAgentStatusReporter({
		apiUrl: `http://localhost:${server.port}`,
		workspaceId: "workspace",
		hostSecret: "secret",
		store,
		timing: TIMING,
	});
	cleanup.push(stop, () => server.stop(true));
	return { store, stored, maxInFlight: () => maxInFlight };
}

describe("startSandboxAgentStatusReporter", () => {
	test("retries a failed report so a finished agent does not stay working", async () => {
		let failuresLeft = 0;
		const api = startApi((status) => {
			if (status === "review" && failuresLeft > 0) {
				failuresLeft--;
				return new Response(null, { status: 503 });
			}
			return Response.json({ ok: true });
		});
		await until(() => api.stored.length === 1);
		chatEvent(api.store, "Start");
		await until(() => api.stored.at(-1) === "working");

		failuresLeft = 2;
		chatEvent(api.store, "Stop");
		await until(() => api.stored.at(-1) === "review");
		expect(failuresLeft).toBe(0);
	});

	test("sends one report at a time so an older status cannot land last", async () => {
		const api = startApi(async (status) => {
			if (status === "working") {
				await new Promise((resolve) => setTimeout(resolve, 60));
			}
			return Response.json({ ok: true });
		});
		await until(() => api.stored.length === 1);
		chatEvent(api.store, "Start");
		await new Promise((resolve) => setTimeout(resolve, TIMING.minIntervalMs));
		chatEvent(api.store, "Stop");

		await until(() => api.stored.at(-1) === "review");
		expect(api.stored).toEqual([null, "working", "review"]);
		expect(api.maxInFlight()).toBe(1);
	});
});
