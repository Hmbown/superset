import { describe, expect, it } from "bun:test";
import { chatPaneDataForSession } from "./chatPaneDataForSession";

describe("chatPaneDataForSession", () => {
	it("opens the session itself, on the terminal it is bound to", () => {
		expect(
			chatPaneDataForSession({
				sessionId: "chat-1",
				terminalId: "terminal-1",
				harness: "claude-acp",
				harnessSessionId: "agent-1",
				title: "Email triage",
			}),
		).toEqual({
			terminalId: "terminal-1",
			sessionId: "chat-1",
			agent: { id: "claude", sessionId: "agent-1" },
			chatTitle: "Email triage",
		});
	});

	it("returns null for a harness no agent preset runs", () => {
		expect(
			chatPaneDataForSession({
				sessionId: "chat-1",
				terminalId: "terminal-1",
				harness: "unknown-harness",
				harnessSessionId: null,
				title: null,
			}),
		).toBeNull();
	});
});
