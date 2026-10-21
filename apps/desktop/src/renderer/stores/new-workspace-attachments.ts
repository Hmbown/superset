import type { PromptInputAttachment } from "@superset/chat-ui/PromptInput";
import { useNewWorkspaceDraftStore } from "renderer/stores/new-workspace-draft";
import { create } from "zustand";

/**
 * The new-workspace composer's attachments. Module scoped so attached files
 * survive navigation and composer remounts, the same way the prompt text
 * survives in useNewWorkspaceDraftStore.
 */
export const useNewWorkspaceAttachments = create<{
	attachments: PromptInputAttachment[];
}>(() => ({ attachments: [] }));

function revokeDropped(
	previous: readonly PromptInputAttachment[],
	next: readonly PromptInputAttachment[],
): void {
	const kept = new Set(next.map((attachment) => attachment.previewUrl));
	for (const { previewUrl } of previous) {
		if (previewUrl && !kept.has(previewUrl)) URL.revokeObjectURL(previewUrl);
	}
}

export function setNewWorkspaceAttachments(
	next: PromptInputAttachment[],
): void {
	revokeDropped(useNewWorkspaceAttachments.getState().attachments, next);
	useNewWorkspaceAttachments.setState({ attachments: next });
}

// A draft reset (successful create or explicit discard) clears attachments
// with it, even while no create surface is mounted.
useNewWorkspaceDraftStore.subscribe((state, prevState) => {
	if (state.resetKey !== prevState.resetKey) setNewWorkspaceAttachments([]);
});
