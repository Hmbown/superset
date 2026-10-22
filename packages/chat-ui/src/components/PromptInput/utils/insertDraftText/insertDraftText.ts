import { $getSelection, $isRangeSelection } from "lexical";
import { MentionChipNode } from "../../nodes/mentionChipNode";
import type { ComposerChipMatch } from "../../types";

/** Inserts `text` at the selection, with each chip in place of its span. */
export function $insertDraftText(
	text: string,
	chips: readonly ComposerChipMatch[],
): void {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return;
	let cursor = 0;
	for (const { start, end, chip } of chips) {
		if (start < cursor || text.slice(start, end) !== chip.serialized) continue;
		if (start > cursor) selection.insertRawText(text.slice(cursor, start));
		selection.insertNodes([MentionChipNode.fromChip(chip)]);
		cursor = end;
	}
	if (cursor < text.length) selection.insertRawText(text.slice(cursor));
}
