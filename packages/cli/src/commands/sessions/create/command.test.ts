import { describe, expect, test } from "bun:test";
import { withLocalHostService } from "../../../lib/host/test-helpers";
import createSessionCommand from "./command";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

withLocalHostService("org-1", {
	"workspace.list": () => [{ id: WORKSPACE_ID, name: "ws-1" }],
	"sessions.create": () => ({
		kind: "chat",
		sessionId: "chat-new",
		terminalId: "term-1",
		label: "Claude",
	}),
});

function invoke(overrides: Record<string, unknown>) {
	return createSessionCommand.run({
		ctx: {
			config: { organizationId: "org-1" },
			bearer: "bearer",
		} as never,
		args: {} as never,
		options: {
			workspace: WORKSPACE_ID,
			local: true,
			agent: "claude",
			...overrides,
		} as never,
		signal: new AbortController().signal,
	});
}

describe("sessions create", () => {
	test("rejects --resume-session with --continue-session and reports a chat that could not be continued", async () => {
		await expect(
			invoke({ resumeSession: "native-1", continueSession: "chat-old" }),
		).rejects.toThrow(/Choose one session operation/);

		const result = (await invoke({ continueSession: "chat-old" })) as {
			message: string;
		};
		expect(result.message).toStartWith("Previous chat could not be continued");
	});
});
