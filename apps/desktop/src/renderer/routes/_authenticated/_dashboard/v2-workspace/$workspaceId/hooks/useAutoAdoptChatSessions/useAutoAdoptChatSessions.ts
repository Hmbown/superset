import type { WorkspaceStore } from "@superset/panes";
import { useEffect } from "react";
import { useAcpChatEnabled } from "renderer/hooks/useAcpChatEnabled";
import type { StoreApi } from "zustand/vanilla";
import type { ChatPaneData, PaneViewerData } from "../../types";
import { chatPaneDataForSession } from "../../utils/chatPaneDataForSession";
import { isChatSessionClosed } from "../../utils/closedChatSessions";
import { useWorkspaceChatSessions } from "../useWorkspaceChatSessions";

interface UseAutoAdoptChatSessionsArgs {
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	linkedStores: readonly StoreApi<WorkspaceStore<PaneViewerData>>[];
	workspaceId: string;
	isLayoutReady: boolean;
}

export function useAutoAdoptChatSessions({
	store,
	linkedStores,
	workspaceId,
	isLayoutReady,
}: UseAutoAdoptChatSessionsArgs): void {
	const enabled = useAcpChatEnabled() === "enabled" && isLayoutReady;
	const sessionsQuery = useWorkspaceChatSessions(workspaceId, enabled);
	const sessions = sessionsQuery.data;
	const isFetchingSessions = sessionsQuery.isFetching;

	useEffect(() => {
		if (!enabled || !sessions || isFetchingSessions) return;

		const attached = new Set<string>();
		for (const tab of [store, ...linkedStores].flatMap(
			(paneStore) => paneStore.getState().tabs,
		)) {
			for (const pane of Object.values(tab.panes)) {
				if (pane.kind !== "terminal" && pane.kind !== "chat-v3") continue;
				const data = pane.data as Partial<ChatPaneData>;
				if (data.terminalId) attached.add(data.terminalId);
				if (data.sessionId) attached.add(data.sessionId);
			}
		}

		const toAdopt = sessions
			.filter(
				(session) =>
					session.live &&
					!isChatSessionClosed(session.sessionId) &&
					!attached.has(session.sessionId) &&
					!(session.terminalId && attached.has(session.terminalId)),
			)
			.sort((a, b) => a.updatedAt - b.updatedAt);
		if (toAdopt.length === 0) return;

		const state = store.getState();
		const restoreActiveTabId = state.tabs.length > 0 ? state.activeTabId : null;
		for (const session of toAdopt) {
			const data = chatPaneDataForSession(session);
			if (!data) continue;
			store.getState().addTab({ panes: [{ kind: "chat-v3", data }] });
		}
		if (restoreActiveTabId) {
			store.getState().setActiveTab(restoreActiveTabId);
		}
	}, [enabled, isFetchingSessions, sessions, store, linkedStores]);
}
