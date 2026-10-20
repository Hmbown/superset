import {
	readBookkeeping,
	type SessionSnapshot,
	type TimelineEntry,
	type TurnGroup,
	userMessageText,
} from "@superset/chat/core";
import type { UserMessage } from "@superset/chat/protocol";
import { parseChatRewindPrompt } from "@superset/shared/terminal-session-handoff";
import { parseAttachmentTags } from "../attachmentTags";
import { buildChatHandoffTranscript } from "../chatHandoffTranscript";

export function editableMessageIds(
	groups: TurnGroup[],
	harness: string | undefined,
): Set<string> {
	const ids = new Set<string>();
	for (const group of groups) {
		for (const entry of group.entries) {
			if (entry.kind !== "item" || entry.item.kind !== "user_message") continue;
			const message = entry.item as UserMessage;
			if (message.hidden) continue;
			const raw = userMessageText(message);
			if (readBookkeeping(harness, raw)) continue;
			if (!parseAttachmentTags(raw).text) continue;
			ids.add(message.id);
		}
	}
	return ids;
}

/** The timeline as it stood just before `itemId` was sent. */
export function timelineBefore(
	groups: TurnGroup[],
	itemId: string,
): TurnGroup[] {
	const kept: TurnGroup[] = [];
	for (const group of groups) {
		const index = group.entries.findIndex(
			(entry) => entry.kind === "item" && entry.item.id === itemId,
		);
		if (index === -1) {
			kept.push(group);
			continue;
		}
		if (index > 0)
			kept.push({ ...group, entries: group.entries.slice(0, index) });
		return kept;
	}
	return kept;
}

/**
 * The conversation before `itemId`, for the session a rewind starts. A chat
 * that was already rewound opens on the prompt that carried the earlier
 * conversation; that conversation is handed on in its place, and the agent's
 * acknowledgement of it is dropped.
 */
export function rewindTranscript(
	groups: TurnGroup[],
	itemId: string,
	snapshot: SessionSnapshot,
	agentLabel: string,
): string {
	let carried = "";
	let entries: TimelineEntry[] = [];
	let skipReply = false;
	for (const group of timelineBefore(groups, itemId)) {
		for (const entry of group.entries) {
			if (entry.kind === "item" && entry.item.kind === "user_message") {
				const earlier = parseChatRewindPrompt(
					userMessageText(entry.item as UserMessage),
				);
				skipReply = earlier !== null;
				if (earlier !== null) {
					carried = earlier;
					entries = [];
					continue;
				}
			}
			if (
				skipReply &&
				entry.kind === "item" &&
				entry.item.kind === "agent_message"
			) {
				skipReply = false;
				continue;
			}
			entries.push(entry);
		}
	}
	const rest = buildChatHandoffTranscript(
		[{ turn: null, turnId: "", entries }],
		snapshot,
		agentLabel,
	);
	return [carried, rest].filter(Boolean).join("\n\n");
}
