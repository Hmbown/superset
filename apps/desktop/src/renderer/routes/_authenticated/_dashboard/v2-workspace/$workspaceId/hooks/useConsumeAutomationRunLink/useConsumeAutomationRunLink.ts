import { useLingui } from "@lingui/react/macro";
import type { WorkspaceStore } from "@superset/panes";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { useEffect, useRef } from "react";
import { useAcpChatEnabled } from "renderer/hooks/useAcpChatEnabled";
import type { StoreApi } from "zustand/vanilla";
import type { ChatPaneData, ConsumeSearch, PaneViewerData } from "../../types";
import {
	type ChatSessionListEntry,
	chatPaneDataForSession,
} from "../../utils/chatPaneDataForSession";
import {
	focusOrAddTerminalPane,
	focusTerminalPane,
} from "../../utils/focusTerminalPane";
import { useWorkspaceChatSessions } from "../useWorkspaceChatSessions";

interface UseConsumeAutomationRunLinkArgs {
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	workspaceId: string;
	terminalId: string | undefined;
	focusRequestId: string | undefined;
	consumeSearch: ConsumeSearch;
	isLayoutReady: boolean;
}

/**
 * When the workspace is opened via a deep link from an automation run
 * (`?terminalId=...`), ensure the corresponding pane is present and focused.
 * The underlying session already exists on the host-service from the
 * dispatcher — we just re-adopt it in the pane store. A run whose agent was
 * since relaunched into a fresh terminal (an account-switch restart) is
 * followed to that terminal, so the link still lands on the conversation.
 * A chat run's terminal id has no PTY, so it opens the chat bound to it.
 */
export function useConsumeAutomationRunLink({
	store,
	workspaceId,
	terminalId,
	focusRequestId,
	consumeSearch,
	isLayoutReady,
}: UseConsumeAutomationRunLinkArgs): void {
	const { t } = useLingui();
	const consumedRef = useRef<Set<string>>(new Set());
	const acpChat = useAcpChatEnabled();
	const terminalSessionsQuery = workspaceTrpc.terminal.list.useQuery(
		{ workspaceId },
		{
			enabled: terminalId != null,
			refetchOnWindowFocus: false,
		},
	);
	const linkedTerminalIsLive =
		terminalId != null &&
		terminalSessionsQuery.isSuccess &&
		terminalSessionBelongsToWorkspace({
			sessions: terminalSessionsQuery.data.sessions,
			terminalId,
			workspaceId,
		});
	// Only a dead link is worth a successor lookup — the live case is the
	// common one and needs nothing more than the session list.
	const successorQuery = workspaceTrpc.terminalAgents.resumedSuccessor.useQuery(
		{ workspaceId, terminalId: terminalId ?? "" },
		{
			enabled:
				terminalId != null &&
				terminalSessionsQuery.isSuccess &&
				!linkedTerminalIsLive,
			refetchOnWindowFocus: false,
		},
	);
	const chatSessionsQuery = useWorkspaceChatSessions(
		workspaceId,
		terminalId != null && acpChat === "enabled",
	);
	const target =
		terminalId == null
			? undefined
			: resolveAutomationRunLinkTarget({
					terminalId,
					linkedTerminalIsLive: terminalSessionsQuery.isSuccess
						? linkedTerminalIsLive
						: undefined,
					successorTerminalId: successorQuery.isSuccess
						? (successorQuery.data?.terminalId ?? null)
						: undefined,
					chatSessions:
						acpChat === "disabled"
							? []
							: chatSessionsQuery.isSuccess
								? chatSessionsQuery.data
								: undefined,
				});
	useEffect(() => {
		// Before the layout hydrates, a focus misses panes that are about to load
		// and a pane added here is replaced by the saved layout.
		if (!terminalId || !isLayoutReady || target === undefined) return;
		const key = getAutomationRunLinkConsumeKey({
			type: "terminal",
			id: terminalId,
			focusRequestId,
		});
		if (consumedRef.current.has(key)) return;
		consumedRef.current.add(key);
		consumeSearch(["terminalId"]);
		if (target.type === "terminal") {
			focusOrAddTerminalPane(store, target.terminalId);
			return;
		}
		if (focusTerminalPane(store, terminalId)) return;
		if (target.type === "chat") {
			store
				.getState()
				.addTab({ panes: [{ kind: "chat-v3", data: target.pane }] });
			return;
		}
		console.warn(
			"[automation-run-link] No terminal or chat session for this link",
			{ terminalId, workspaceId },
		);
		toast.error(t({ message: "This agent session is no longer running" }));
	}, [
		store,
		terminalId,
		focusRequestId,
		target,
		isLayoutReady,
		workspaceId,
		consumeSearch,
		t,
	]);
}

export type AutomationRunLinkTarget =
	| { type: "terminal"; terminalId: string }
	| { type: "chat"; pane: ChatPaneData }
	| { type: "missing" };

/** Each input is undefined while it is still loading. */
export function resolveAutomationRunLinkTarget({
	terminalId,
	linkedTerminalIsLive,
	successorTerminalId,
	chatSessions,
}: {
	terminalId: string;
	linkedTerminalIsLive: boolean | undefined;
	successorTerminalId: string | null | undefined;
	chatSessions:
		| ReadonlyArray<
				Pick<
					ChatSessionListEntry,
					| "sessionId"
					| "terminalId"
					| "harness"
					| "harnessSessionId"
					| "title"
					| "live"
				>
		  >
		| undefined;
}): AutomationRunLinkTarget | undefined {
	if (linkedTerminalIsLive === undefined) return undefined;
	if (linkedTerminalIsLive) return { type: "terminal", terminalId };
	if (successorTerminalId === undefined) return undefined;
	if (successorTerminalId) {
		return { type: "terminal", terminalId: successorTerminalId };
	}
	if (chatSessions === undefined) return undefined;
	const session = chatSessions.find(
		(candidate) => candidate.live && candidate.terminalId === terminalId,
	);
	const pane = session ? chatPaneDataForSession(session) : null;
	return pane ? { type: "chat", pane } : { type: "missing" };
}

export function getAutomationRunLinkConsumeKey({
	type,
	id,
	focusRequestId,
}: {
	type: "terminal";
	id: string;
	focusRequestId: string | undefined;
}): string {
	return focusRequestId
		? `${type}:${id}:focus:${focusRequestId}`
		: `${type}:${id}`;
}

export function terminalSessionBelongsToWorkspace({
	sessions,
	terminalId,
	workspaceId,
}: {
	sessions: Array<{ terminalId: string; workspaceId: string }>;
	terminalId: string;
	workspaceId: string;
}): boolean {
	return sessions.some(
		(session) =>
			session.terminalId === terminalId && session.workspaceId === workspaceId,
	);
}
