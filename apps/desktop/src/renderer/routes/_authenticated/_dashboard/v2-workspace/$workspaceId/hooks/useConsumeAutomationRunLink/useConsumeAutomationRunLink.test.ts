import { describe, expect, it } from "bun:test";
import {
	getAutomationRunLinkConsumeKey,
	resolveAutomationRunLinkTarget,
	terminalSessionBelongsToWorkspace,
} from "./useConsumeAutomationRunLink";

describe("getAutomationRunLinkConsumeKey", () => {
	it("dedupes plain automation links by source id", () => {
		expect(
			getAutomationRunLinkConsumeKey({
				type: "terminal",
				id: "terminal-1",
				focusRequestId: undefined,
			}),
		).toBe("terminal:terminal-1");
	});

	it("treats each notification focus request as a fresh command", () => {
		expect(
			getAutomationRunLinkConsumeKey({
				type: "terminal",
				id: "terminal-1",
				focusRequestId: "request-1",
			}),
		).toBe("terminal:terminal-1:focus:request-1");
		expect(
			getAutomationRunLinkConsumeKey({
				type: "terminal",
				id: "terminal-1",
				focusRequestId: "request-2",
			}),
		).toBe("terminal:terminal-1:focus:request-2");
	});
});

describe("automation run link ownership checks", () => {
	it("accepts terminal sessions only from the current workspace", () => {
		const sessions = [
			{ terminalId: "terminal-a", workspaceId: "workspace-a" },
			{ terminalId: "terminal-b", workspaceId: "workspace-b" },
		];

		expect(
			terminalSessionBelongsToWorkspace({
				sessions,
				terminalId: "terminal-a",
				workspaceId: "workspace-a",
			}),
		).toBe(true);
		expect(
			terminalSessionBelongsToWorkspace({
				sessions,
				terminalId: "terminal-a",
				workspaceId: "workspace-b",
			}),
		).toBe(false);
	});
});

describe("resolveAutomationRunLinkTarget", () => {
	const chatSession = {
		sessionId: "chat-1",
		terminalId: "terminal-1",
		harness: "claude-acp",
		harnessSessionId: null,
		title: null,
		live: true,
	};
	const base = {
		terminalId: "terminal-1",
		linkedTerminalIsLive: false,
		successorTerminalId: null,
		chatSessions: [chatSession],
	};

	it("opens a live terminal without waiting for anything else", () => {
		expect(
			resolveAutomationRunLinkTarget({
				...base,
				linkedTerminalIsLive: true,
				successorTerminalId: undefined,
				chatSessions: undefined,
			}),
		).toEqual({ type: "terminal", terminalId: "terminal-1" });
	});

	it("follows a resumed terminal to its successor", () => {
		expect(
			resolveAutomationRunLinkTarget({
				...base,
				successorTerminalId: "terminal-2",
			}),
		).toEqual({ type: "terminal", terminalId: "terminal-2" });
	});

	it("opens the chat session a chat run's terminal id is bound to", () => {
		expect(resolveAutomationRunLinkTarget(base)).toEqual({
			type: "chat",
			pane: {
				terminalId: "terminal-1",
				sessionId: "chat-1",
				agent: { id: "claude" },
			},
		});
	});

	it("waits while the chat sessions are still loading", () => {
		expect(
			resolveAutomationRunLinkTarget({ ...base, chatSessions: undefined }),
		).toBeUndefined();
	});

	it("reports a link with no terminal and no live chat as missing", () => {
		expect(
			resolveAutomationRunLinkTarget({
				...base,
				chatSessions: [{ ...chatSession, live: false }],
			}),
		).toEqual({ type: "missing" });
		expect(
			resolveAutomationRunLinkTarget({ ...base, chatSessions: [] }),
		).toEqual({ type: "missing" });
	});
});
