import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { SessionState, UserContent } from "@superset/chat/protocol";
import { FakeHarness } from "../../harness/fake";
import type { HarnessFactoryOptions, HarnessRegistry } from "../../sessions";
import { turn } from "../../testing/fixtures";
import { createTestRuntime } from "../../testing/testRuntime";
import { FAKE_HARNESS, waitFor } from "../../testing/testUtils";

const text = (value: string): UserContent[] => [{ type: "text", text: value }];

function runtimeWithStartedAgents(session: Partial<SessionState> = {}) {
	const started: HarnessFactoryOptions[] = [];
	const harnesses: HarnessRegistry = new Map([
		[
			FAKE_HARNESS,
			(options) => {
				started.push(options);
				return new FakeHarness({
					start: [
						{
							kind: "session",
							session: {
								status: "idle",
								harnessSessionId: "agent-1",
								...session,
							},
						},
					],
					turns: [[{ kind: "turn", turn: turn("t1") }], []],
				});
			},
		],
	]);
	return { runtime: createTestRuntime({ harnesses }), started };
}

describe("resuming chats after a restart", () => {
	test("a running turn and the prompts queued behind it are unfinished", async () => {
		const { runtime } = runtimeWithStartedAgents();
		const { sessionId } = runtime.commands.createSession({
			commandId: randomUUID(),
			scopeId: "workspace-1",
			harness: FAKE_HARNESS,
			cwd: "/tmp/workspace",
			terminalId: "terminal-1",
		});
		await waitFor(() => runtime.live.get(sessionId)?.state.status === "idle");
		const live = runtime.live.require(sessionId);
		live.prompt(text("first"), randomUUID());
		await waitFor(() => live.turn?.status === "running");
		live.prompt(text("second"), randomUUID());

		expect(runtime.live.unfinished()).toEqual([
			expect.objectContaining({
				sessionId,
				scopeId: "workspace-1",
				harnessSessionId: "agent-1",
				terminalId: "terminal-1",
				interrupted: true,
				prompts: [text("second")],
			}),
		]);
		await runtime.dispose();
	});

	test("an idle chat with a command running in the background is unfinished", async () => {
		const idle = runtimeWithStartedAgents();
		const held = runtimeWithStartedAgents({
			backgroundTasks: [
				{
					id: "task-1",
					kind: "process",
					name: "sleep 90",
					canStop: true,
					startedAtMs: 1,
				},
			],
		});
		const open = (runtime: typeof idle.runtime) => {
			const { sessionId } = runtime.commands.createSession({
				commandId: randomUUID(),
				scopeId: "workspace-1",
				harness: FAKE_HARNESS,
				cwd: "/tmp/workspace",
			});
			return waitFor(
				() => runtime.live.get(sessionId)?.state.status === "idle",
			);
		};
		await open(idle.runtime);
		await open(held.runtime);

		expect(idle.runtime.live.unfinished()).toEqual([]);
		expect(held.runtime.live.unfinished()).toEqual([
			expect.objectContaining({ interrupted: true, prompts: [] }),
		]);
		await idle.runtime.dispose();
		await held.runtime.dispose();
	});

	test("a resumed chat is handed to the pane that reattaches to its terminal", async () => {
		const { runtime, started } = runtimeWithStartedAgents();
		const resumed = runtime.commands.resumeSession({
			scopeId: "workspace-1",
			harness: FAKE_HARNESS,
			harnessSessionId: "agent-1",
			terminalId: "terminal-1",
			cwd: "/tmp/workspace",
			prompts: [text("continue")],
		});
		const reattach = (harnessSessionId: string) =>
			runtime.commands.createSession({
				commandId: randomUUID(),
				scopeId: "workspace-1",
				harness: FAKE_HARNESS,
				cwd: "/tmp/workspace",
				terminalId: "terminal-1",
				resume: { harnessSessionId },
			});

		expect(started[0]?.resume).toEqual({ harnessSessionId: "agent-1" });
		await waitFor(
			() => runtime.live.get(resumed.sessionId)?.turn?.status === "running",
		);
		expect(reattach("agent-forked").sessionId).not.toBe(resumed.sessionId);
		expect(reattach("agent-1")).toEqual(resumed);
		expect(reattach("agent-1").sessionId).not.toBe(resumed.sessionId);
		await runtime.dispose();
	});
});
