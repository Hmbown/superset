import { describe, expect, it } from "bun:test";
import { chatPaneDataForBinding } from "./chatPaneDataForBinding";

describe("chatPaneDataForBinding", () => {
	const chat = {
		terminalId: "terminal-1",
		agentId: "claude" as const,
		agentSessionId: "agent-1",
		chatSessionId: "chat-1",
		endedAt: undefined,
	};

	it("opens the running chat a terminal id is bound to", () => {
		expect(chatPaneDataForBinding(chat)).toEqual({
			terminalId: "terminal-1",
			sessionId: "chat-1",
			agent: { id: "claude", sessionId: "agent-1" },
		});
	});

	it("returns null for a terminal agent or an ended chat", () => {
		expect(
			chatPaneDataForBinding({ ...chat, chatSessionId: undefined }),
		).toBeNull();
		expect(chatPaneDataForBinding({ ...chat, endedAt: 1 })).toBeNull();
		expect(chatPaneDataForBinding(undefined)).toBeNull();
	});
});
