import { acpHarnessForPreset } from "@superset/chat/core";
import type { TerminalAgentBinding } from "renderer/hooks/host-service/useTerminalAgentBindings";
import type { ChatPaneData } from "../../types";

/** The chat pane for a terminal id bound to a running chat, or null. */
export function chatPaneDataForBinding(
	binding:
		| Pick<
				TerminalAgentBinding,
				| "terminalId"
				| "agentId"
				| "agentSessionId"
				| "chatSessionId"
				| "endedAt"
		  >
		| undefined,
): ChatPaneData | null {
	if (!binding?.chatSessionId || binding.endedAt !== undefined) return null;
	if (!acpHarnessForPreset(binding.agentId)) return null;
	return {
		terminalId: binding.terminalId,
		sessionId: binding.chatSessionId,
		agent: {
			id: binding.agentId,
			...(binding.agentSessionId ? { sessionId: binding.agentSessionId } : {}),
		},
	};
}
