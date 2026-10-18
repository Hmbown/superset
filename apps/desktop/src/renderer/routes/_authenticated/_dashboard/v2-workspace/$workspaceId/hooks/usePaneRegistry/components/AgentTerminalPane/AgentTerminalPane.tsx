import type { RendererContext } from "@superset/panes";
import { useEffect } from "react";
import { useTerminalAgentBinding } from "renderer/hooks/host-service/useTerminalAgentBindings";
import type {
	ChatPaneData,
	OpenFile,
	PaneViewerData,
	TerminalPaneData,
} from "renderer/routes/_authenticated/_dashboard/v2-workspace/$workspaceId/types";
import { chatPaneDataForBinding } from "../../../../utils/chatPaneDataForBinding";
import { TerminalPane } from "../TerminalPane";

type ChatOnTerminalPaneData = TerminalPaneData &
	Omit<ChatPaneData, "sessionId"> & {
		agentSurface?: "cli" | "acp";
		acpSessionId?: string | null;
	};

/**
 * Chats used to be shown on the terminal pane. A layout saved then still holds
 * them there, so each one moves to its own chat pane the first time it renders.
 * A terminal pane opened on a running chat's terminal id has no PTY behind it,
 * so it moves to that chat too.
 */
export function AgentTerminalPane({
	ctx,
	onOpenFile,
	onRevealPath,
	workspaceId,
}: {
	ctx: RendererContext<PaneViewerData>;
	workspaceId: string;
	onOpenFile: OpenFile;
	onRevealPath: (path: string) => void;
}) {
	const data = ctx.pane.data as ChatOnTerminalPaneData;
	const isSavedChat = data.agentSurface === "acp";
	const binding = useTerminalAgentBinding(workspaceId, data.terminalId);
	const isRunningChat =
		!isSavedChat && chatPaneDataForBinding(binding) !== null;

	useEffect(() => {
		if (!isSavedChat) return;
		const {
			agentSurface: _surface,
			acpSessionId,
			createOnAttach: _create,
			...chat
		} = data;
		const state = ctx.store.getState();
		state.setPanePinned({ paneId: ctx.pane.id, pinned: false });
		state.replacePane({
			tabId: ctx.tab.id,
			paneId: ctx.pane.id,
			newPane: {
				kind: "chat-v3",
				pinned: ctx.pane.pinned,
				...(ctx.pane.titleOverride
					? { titleOverride: ctx.pane.titleOverride }
					: {}),
				data: { ...chat, sessionId: acpSessionId ?? null } as ChatPaneData,
			},
		});
	}, [
		isSavedChat,
		data,
		ctx.store,
		ctx.tab.id,
		ctx.pane.id,
		ctx.pane.titleOverride,
		ctx.pane.pinned,
	]);

	useEffect(() => {
		const chat = chatPaneDataForBinding(binding);
		if (isSavedChat || !chat) return;
		const state = ctx.store.getState();
		state.setPanePinned({ paneId: ctx.pane.id, pinned: false });
		state.replacePane({
			tabId: ctx.tab.id,
			paneId: ctx.pane.id,
			newPane: {
				kind: "chat-v3",
				pinned: ctx.pane.pinned,
				...(ctx.pane.titleOverride
					? { titleOverride: ctx.pane.titleOverride }
					: {}),
				data: chat,
			},
		});
	}, [
		isSavedChat,
		binding,
		ctx.store,
		ctx.tab.id,
		ctx.pane.id,
		ctx.pane.titleOverride,
		ctx.pane.pinned,
	]);

	if (isSavedChat || isRunningChat) return null;

	return (
		<TerminalPane
			ctx={ctx}
			onOpenFile={onOpenFile}
			onRevealPath={onRevealPath}
			workspaceId={workspaceId}
		/>
	);
}
