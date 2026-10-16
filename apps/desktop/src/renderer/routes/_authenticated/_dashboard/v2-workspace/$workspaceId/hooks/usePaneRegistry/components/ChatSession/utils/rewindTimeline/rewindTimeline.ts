import {
	readBookkeeping,
	type TurnGroup,
	userMessageText,
} from "@superset/chat/core";
import type { UserMessage } from "@superset/chat/protocol";
import { parseAttachmentTags } from "../attachmentTags";

export type RewindPoint = {
	itemId: string;
	text: string;
	startedAtMs: number;
};

/** The user's own messages, newest first: each one is a point the chat can go back to. */
export function rewindPoints(
	groups: TurnGroup[],
	harness: string | undefined,
): RewindPoint[] {
	const points: RewindPoint[] = [];
	for (const group of groups) {
		for (const entry of group.entries) {
			if (entry.kind !== "item" || entry.item.kind !== "user_message") continue;
			const raw = userMessageText(entry.item as UserMessage);
			if (readBookkeeping(harness, raw)) continue;
			const { text } = parseAttachmentTags(raw);
			if (!text) continue;
			points.push({
				itemId: entry.item.id,
				text,
				startedAtMs: entry.item.startedAtMs,
			});
		}
	}
	return points.reverse();
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
