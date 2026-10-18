import type { ChatTransport } from "@superset/chat/client";
import { presetForAcpHarness } from "@superset/chat/core";
import type { ChatPaneData } from "../../types";

export type ChatSessionListEntry = Awaited<
	ReturnType<ChatTransport["listSessions"]>
>[number];

export function chatPaneDataForSession(
	session: Pick<
		ChatSessionListEntry,
		"sessionId" | "terminalId" | "harness" | "harnessSessionId" | "title"
	>,
): ChatPaneData | null {
	const presetId = presetForAcpHarness(session.harness);
	if (!presetId) return null;
	return {
		terminalId: session.terminalId ?? session.sessionId,
		sessionId: session.sessionId,
		agent: {
			id: presetId,
			...(session.harnessSessionId
				? { sessionId: session.harnessSessionId }
				: {}),
		},
		...(session.title ? { chatTitle: session.title } : {}),
	};
}
